import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel, NotebookActions, Notebook } from '@jupyterlab/notebook';
import { MarkdownCell } from '@jupyterlab/cells';
import { ISessionContext } from '@jupyterlab/apputils';
import {
  scanNotebook,
  transformMarkdown,
  NotebookState,
  DuplicateLabelError,
  ReservedEnumerationMisuseError,
  EnumerationContextError
} from './references';

const stateMap = new WeakMap<NotebookPanel, NotebookState>();

const emptyState: NotebookState = {
  labels: new Map(),
  sections: [],
  enumerations: new Map(),
  duplicates: new Set(),
  duplicateSecondaries: new Map(),
  primaryCellIndices: new Map()
};

function getMarkdownSources(panel: NotebookPanel): string[] {
  return panel.content.widgets
    .filter((cell): cell is MarkdownCell => cell instanceof MarkdownCell)
    .map(cell => cell.model.sharedModel.getSource());
}

function doScan(panel: NotebookPanel): NotebookState {
  const sources = getMarkdownSources(panel);
  try {
    const state = scanNotebook(sources);
    stateMap.set(panel, state);
    return state;
  } catch (err) {
    if (err instanceof DuplicateLabelError) {
      console.error(err);
      const state = err.partialState ?? emptyState;
      stateMap.set(panel, state);
      return state;
    }
    if (err instanceof ReservedEnumerationMisuseError || err instanceof EnumerationContextError) {
      console.error(err);
      stateMap.set(panel, emptyState);
      return emptyState;
    }
    throw err;
  }
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
    const src = (model.data?.[mimeType] as string) ?? '';
    const xformed = transformMarkdown(src, state, mdCellIndex);
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
    console.log('MDX LOAD OK 2026-03-21');

    // Wrap run actions to re-scan and re-render after any cell execution
    const wrap = (
      orig: (notebook: Notebook, session?: ISessionContext) => Promise<boolean>
    ) => async function (this: unknown, notebook: Notebook, session?: ISessionContext) {
      const result = await orig.call(this, notebook, session);
      let panel: NotebookPanel | undefined;
      tracker.forEach(p => { if (p.content === notebook) panel = p; });
      if (panel) {
        doScan(panel);
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
      rerenderMarkdown(panel);
    });
  }
};

export default plugin;
