import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel, NotebookActions, Notebook } from '@jupyterlab/notebook';
import { MarkdownCell } from '@jupyterlab/cells';
import { ISessionContext } from '@jupyterlab/apputils';
import {
  scanNotebook,
  transformMarkdown,
  NotebookState,
  ScanLogger,
  ScanIssue
} from './references';
import {
  CitationState,
  BibliographyEntry,
  BibSourceError,
  scanNotebookCitations,
  parseBibFile,
  transformCitationRefs,
  transformBibliographyDirective
} from './bib';
import { scanBibliographyDirectives } from './syntax';

const stateMap = new WeakMap<NotebookPanel, NotebookState>();
const citationStateMap = new WeakMap<NotebookPanel, CitationState>();
const bibEntriesMap = new WeakMap<NotebookPanel, Map<string, BibliographyEntry>>();
const bibErrorsMap = new WeakMap<NotebookPanel, BibSourceError[]>();

const consoleLogger: ScanLogger = {
  warn(message: string, issue: ScanIssue) {
    const tag = issue.kind === 'duplicate-label' ? 'DuplicateLabelError'
      : issue.kind === 'reserved-enumeration-misuse' ? 'ReservedEnumerationMisuseError'
      : 'EnumerationContextError';
    console.warn('[mdx]', tag, message, issue);
  }
};

const emptyState: NotebookState = {
  labels: new Map(),
  sections: [],
  enumerations: new Map(),
  duplicates: new Set(),
  misused: new Set(),
  issues: []
};

const emptyCitationState: CitationState = {
  citationNumbers: new Map()
};

function getMarkdownSources(panel: NotebookPanel): string[] {
  return panel.content.widgets
    .filter((cell): cell is MarkdownCell => cell instanceof MarkdownCell)
    .map(cell => cell.model.sharedModel.getSource());
}

function doScan(panel: NotebookPanel): NotebookState {
  const sources = getMarkdownSources(panel);
  const state = scanNotebook(sources, consoleLogger);
  stateMap.set(panel, state);
  return state;
}

function normalizePath(path: string): { path: string; escapedRoot: boolean } {
  const parts = path.split('/');
  const resolved: string[] = [];
  let escapedRoot = false;
  for (const part of parts) {
    if (part === '..') {
      if (resolved.length === 0) escapedRoot = true;
      else resolved.pop();
    } else if (part !== '.') {
      resolved.push(part);
    }
  }
  return { path: resolved.join('/'), escapedRoot };
}

interface BibCacheEntry {
  lastModified: string;
  entries: Map<string, BibliographyEntry>;
}

const bibCache = new Map<string, BibCacheEntry>();

async function fetchBibLastModified(bibPath: string): Promise<string | null> {
  try {
    const encodedPath = bibPath.split('/').map(encodeURIComponent).join('/');
    const resp = await fetch(`/api/contents/${encodedPath}`);
    if (!resp.ok) return null;
    const data = await resp.json() as { last_modified?: unknown };
    return typeof data.last_modified === 'string' ? data.last_modified : null;
  } catch {
    return null;
  }
}

async function loadBibFile(bibPath: string): Promise<string | null> {
  try {
    const encodedPath = bibPath.split('/').map(encodeURIComponent).join('/');
    const resp = await fetch(`/api/contents/${encodedPath}?content=1&format=text`, { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = await resp.json() as { content?: unknown };
    return typeof data.content === 'string' ? data.content : null;
  } catch {
    return null;
  }
}

async function loadBibEntries(bibPath: string): Promise<Map<string, BibliographyEntry> | null> {
  const lastModified = await fetchBibLastModified(bibPath);
  if (lastModified === null) return null;

  const cached = bibCache.get(bibPath);
  if (cached && cached.lastModified === lastModified) {
    console.log('[mdx] bib cache hit:', bibPath);
    return cached.entries;
  }

  const content = await loadBibFile(bibPath);
  if (content === null) return null;

  const entries = parseBibFile(content);
  console.log('[mdx] bib parsed entries:', [...entries.keys()]);
  bibCache.set(bibPath, { lastModified, entries });
  return entries;
}

async function doCitationScan(panel: NotebookPanel): Promise<void> {
  const sources = getMarkdownSources(panel);

  const citState = scanNotebookCitations(sources);
  citationStateMap.set(panel, citState);

  // Resolve notebook directory for relative bib file paths
  const localPath = panel.context.localPath;
  const slashIdx = localPath.lastIndexOf('/');
  const notebookDir = slashIdx >= 0 ? localPath.slice(0, slashIdx) : '';

  const allEntries = new Map<string, BibliographyEntry>();
  const bibErrors: BibSourceError[] = [];

  for (const src of sources) {
    const directives = scanBibliographyDirectives(src);
    for (const directive of directives) {
      if (!directive.src) continue;
      const { path: bibPath, escapedRoot } = normalizePath(
        notebookDir ? `${notebookDir}/${directive.src}` : directive.src
      );
      if (escapedRoot) {
        console.warn('[mdx] bib path escapes JupyterLab root:', directive.src, '→', bibPath);
        bibErrors.push({ src: directive.src, reason: 'sandbox', resolvedPath: bibPath });
        continue;
      }
      const entries = await loadBibEntries(bibPath);
      if (entries) {
        for (const [key, entry] of entries) {
          if (!allEntries.has(key)) allEntries.set(key, entry);
        }
      } else {
        console.warn('[mdx] failed to load bib:', bibPath);
        bibErrors.push({ src: directive.src, reason: 'not-found', resolvedPath: bibPath });
      }
    }
  }

  console.log('[mdx] citation keys scanned:', [...citState.citationNumbers.keys()]);
  bibEntriesMap.set(panel, allEntries);
  bibErrorsMap.set(panel, bibErrors);
}

// Patch a cell's renderer so every renderModel call—ours or JupyterLab's—
// always applies the current notebook-wide transformation.  The closure
// captures `panel` so it can look up the latest state at call time.
function patchCellRenderer(cell: MarkdownCell, panel: NotebookPanel, mdCellIndex: number): void {
  // If already patched with the same index, skip
  if ((cell.renderer as any)._mdxPatched === mdCellIndex) return;
  // If patched with a different index (cell was moved), re-patch
  (cell.renderer as any)._mdxPatched = mdCellIndex;

  const mimeType = 'text/markdown';
  const origRenderModel = (cell.renderer as any)._mdxOrigRenderModel
    ?? cell.renderer.renderModel.bind(cell.renderer);
  (cell.renderer as any)._mdxOrigRenderModel = origRenderModel;

  cell.renderer.renderModel = async (model: any) => {
    const state = stateMap.get(panel) ?? emptyState;
    const citState = citationStateMap.get(panel) ?? emptyCitationState;
    const entries = bibEntriesMap.get(panel) ?? new Map<string, BibliographyEntry>();
    const bibErrors = bibErrorsMap.get(panel) ?? [];
    const src = (model.data?.[mimeType] as string) ?? '';
    let xformed = transformMarkdown(src, state, mdCellIndex);
    xformed = transformCitationRefs(xformed, citState, entries);
    xformed = transformBibliographyDirective(xformed, citState, entries, bibErrors);
    return origRenderModel({
      data: { [mimeType]: xformed },
      metadata: model.metadata ?? {},
      trusted: model.trusted ?? true
    } as any);
  };
}

function rerenderMarkdown(panel: NotebookPanel): void {
  const mimeType = 'text/markdown';
  let mdCellIndex = 0;

  for (const cell of panel.content.widgets) {
    if (!(cell instanceof MarkdownCell)) continue;

    const idx = mdCellIndex++;

    // Patch every markdown cell so the intercept is in place before
    // JupyterLab renders it — even if the cell isn't attached yet.
    patchCellRenderer(cell, panel, idx);

    // Only trigger an explicit re-render for cells already in the DOM.
    // Unattached cells will be rendered by JupyterLab when they attach;
    // the patch above ensures that render goes through our transform.
    if (!cell.isAttached) continue;

    const source = cell.model.sharedModel.getSource();

    void cell.renderer.renderModel({
      data: { [mimeType]: source },
      metadata: {},
      trusted: true
    } as any).then(() => {
      if (!cell.rendered) {
        cell.rendered = true;
      }
    });
  }
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-mdx',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker
  ) => {
    console.log('MDX LOAD OK 2026-05-16');

    // Wrap run actions to re-scan and re-render after any cell execution
    const wrap = (
      orig: (notebook: Notebook, session?: ISessionContext) => Promise<boolean>
    ) => async function (this: unknown, notebook: Notebook, session?: ISessionContext) {
      const result = await orig.call(this, notebook, session);
      let panel: NotebookPanel | undefined;
      tracker.forEach(p => { if (p.content === notebook) panel = p; });
      if (panel) {
        doScan(panel);
        await doCitationScan(panel);
        rerenderMarkdown(panel);
      }
      return result;
    };

    NotebookActions.run          = wrap(NotebookActions.run);
    NotebookActions.runAndAdvance = wrap(NotebookActions.runAndAdvance);
    NotebookActions.runAll        = wrap(NotebookActions.runAll);
    NotebookActions.runAllBelow   = wrap(NotebookActions.runAllBelow);
    NotebookActions.runAllAbove   = wrap(NotebookActions.runAllAbove);

    // Scan and render when a notebook is opened
    tracker.currentChanged.connect(async (_, panel) => {
      if (!panel) return;
      if ((panel as any)._mdxAttached) return;
      (panel as any)._mdxAttached = true;

      await panel.context.ready;
      doScan(panel);
      await doCitationScan(panel);
      rerenderMarkdown(panel);
    });
  }
};

export default plugin;
