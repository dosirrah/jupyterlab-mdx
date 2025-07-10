import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { MarkdownCell } from '@jupyterlab/cells';
import { ContentsManager } from '@jupyterlab/services';
import { PathExt } from '@jupyterlab/coreutils';
import { MarkdownCellWithXR } from './xr';
import { setsEqualOrdered, union } from './util';
import bibtexParse from 'bibtex-parse-js';
import { NotebookActions } from '@jupyterlab/notebook';

// Global citation order (first-use)
export const gCitationOrder: string[] = [];

// citation key → { n: citationNumber }
const gCitationMap = new Map<string, { n: number }>();

// populated from the .bib file.
export let gCitationEntries = new Map<string, any>() ;

// metainfo about the bib file including when
// it last changed.
const bibCache = new Map<string, any[]>();

// Regex for math spans ($...$, $$...$$, or \[...\]) to ignore ^ inside math
const mathSpanRe = /(\${2}[\s\S]+?\${2}|\$[^$]+\$|\\\[[\s\S]+?\\\])/g;
const mathPlaceholder = (i: number) => `\u0000MATH${i}\u0000`;
const mathRestoreRe = /\u0000MATH(\d+)\u0000/g;



/**
 * Scan all markdown cells for '^KEY' citations in first-use order, ignoring math.
 */
export function scanCitations(tracker: INotebookTracker): string[] {
  gCitationOrder.length = 0;
  gCitationMap.clear();
  const seen = new Set<string>();

  tracker.currentWidget?.content.widgets.forEach(widget => {
    if (!(widget instanceof MarkdownCell)) return;
    const xrCell = widget as MarkdownCellWithXR;
    const src = xrCell.model.sharedModel.getSource();

    // Attach per-cell metadata
    const cites = analyzeCitations(src);

    xrCell.bibMeta = {
        citationsReferenced: cites,
        bibCell : /^::: *bibliography/m.test(src)
    };

    // Update global order & map
    for (const key of cites) {
      if (!seen.has(key)) {
        seen.add(key);
        gCitationOrder.push(key);
        gCitationMap.set(key, { n: gCitationOrder.length });
      }
    }
  });

  return gCitationOrder;
}


/**
 * finds citiations within the markdown of a single cell.
 */
function analyzeCitations(src: string): Set<string> {
  const cites = new Set<string>();
  const text = src.replace(mathSpanRe, '');  // strip out math

  for (const [, key] of text.matchAll(/\^([A-Za-z0-9_-]+)/g)) {
    if (!cites.has(key)) {
      cites.add(key);
    }
  }

  return cites;
}


/**
 * Replace '^KEY' with '[n]' according to gCitationOrder, restoring math spans.
 */
export function preprocessCitations(markdown: string): string {
  // 1) Hide math spans so ^ inside LaTeX won’t match
  const mathSpans: string[] = [];
  const withoutMath = markdown.replace(mathSpanRe, m => {
    const idx = mathSpans.push(m) - 1;
    return mathPlaceholder(idx);
  });

  // 2) Replace each ^KEY with its [n] from gCitationMap
  const withNumbers = withoutMath.replace(/\^([A-Za-z0-9_-]+)/g, (_, key) => {
    const entry = gCitationMap.get(key);
    return entry ? `[${entry.n}]` : `[?]`;
  });

  // 3) Restore math spans
  return withNumbers.replace(mathRestoreRe, (_, idx) => mathSpans[+idx]);
}


/**
 * Given the edited cell and all cells, update only citation state:
 *  - re-generate gCitationOrder & gCitationMap
 *  - return the set of citation keys whose numbers changed
 */
export function updateCitationMap(
  edited: MarkdownCellWithXR,
  allCells: MarkdownCellWithXR[]
): Set<string> {

  // 1) Extract old vs new citations from the cell
  const text = edited.model.sharedModel.getSource()
  const oldCites = edited.bibMeta?.citationsReferenced ?? new Set();
  const newCites = analyzeCitations(text);

  // Attach only citation metadata:
  edited.bibMeta = {
    citationsReferenced: newCites,
    bibCell: /^::: *bibliography/m.test(text)
  };

  // 2) If no change, bail early
  if (setsEqualOrdered(oldCites, newCites)) {
    return new Set();
  }

  // 3) Detect removals in the edited cell.  No other cells will have removals.
  const removed = new Set<string>(
    [...oldCites].filter(key => !newCites.has(key))
  );

  // 4) Rebuild the global order array from per‐cell metadata
  const seen = new Set<string>();
  const newOrder: string[] = [];
  allCells.forEach(cell => {
    (cell.bibMeta?.citationsReferenced ?? []).forEach((key:string) => {
      if (!seen.has(key)) {
        seen.add(key);
        newOrder.push(key);
      }
    });
  });

  // 5) Recompute map & detect which keys have been moved or added.
  const oldOrder = [...gCitationOrder];   // create shallow copy of gCitationOrder
  gCitationOrder.length = 0;
  gCitationMap.clear();
  const changed = new Set<string>(removed);  // start with any removals

  newOrder.forEach((key, i) => {
    gCitationOrder.push(key);
    gCitationMap.set(key, { n: i + 1 });
    // If position differs from old, mark as changed
    if (oldOrder[i] !== key) {
      changed.add(key);
    }
  });

  return changed;
}

export interface LoadedText {
  content: string;
  etag?: string;
  lastModified?: string;
}

export async function fetchOrLoadViaContentsManager(
  src: string,
  notebookPath: string
): Promise<LoadedText> {
  if (/^[a-z]+:\/\//i.test(src)) {
    // remote URL → fetch()
    const url = new URL(src, window.location.href).href;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}`);
    const content      = await resp.text();
    const etag         = resp.headers.get('etag') ?? undefined;
    const lastModified = resp.headers.get('last-modified') ?? undefined;
    return { content, etag, lastModified };
  } else {
    // local path → normalize & resolve it
    const cm  = new ContentsManager();
    const dir = PathExt.dirname(notebookPath);
    //const fullPath = PathExt.resolve(dir, src);
    const fullPath = PathExt.join(dir, src);
    const model = await cm.get(fullPath, {
      content: true,
      type: 'file',
      format: 'text'
    });

    // Contents.IModel has a last_modified field
    const content       = model.content as string;
    const lastModified  = (model as any).last_modified as string | undefined;
    return { content, lastModified };
  }
}


interface BibLoadResult {
  entries: Map<string,any>;
  etag?: string;
  lastModified?: string;
}

/** 
 * Load and parse .bib entries from a URL or local path
 */
export async function loadBibEntries(
  src: string,
  notebookPath: string
): Promise<BibLoadResult> {
  const { content, etag, lastModified } =
    await fetchOrLoadViaContentsManager(src, notebookPath);
  const array = bibtexParse.toJSON(content);
  const entries     = new Map<string, any>();
  for (const e of array) {
    entries.set(e.citationKey, e);
  }
  return { entries, etag, lastModified };
}

// module‐scope cache: src → { etag?, lastModified?, entriesMap }
interface BibInfo {
  etag?: string;
  lastModified?: string;
  entries: Map<string, any>;
}
const _bibCache = new Map<string, BibInfo>();

/**
 * Will load (or reload) a .bibtex file to populate the
 * bibliography.  This function checks whether a remote .bibtex
 * file has changed and reloads if it has.
 */
export async function updateBibliography(
  cell: MarkdownCellWithXR,
  notebookPath: string
): Promise<boolean> {
  const text = cell.model.sharedModel.getSource();
  const CONTAINER_RE = /^::: *bibliography[\s\S]*?:::\s*$/m;
  const SRC_RE       = /^src:\s*(\S+)\s*$/m;

  if (!CONTAINER_RE.test(text)) {
    return false;
  }
  const m = text.match(SRC_RE);
  if (!m) {
    console.warn('Found ::: bibliography but no src: line');
    return false;
  }
  const src = m[1];

  cell.bibMeta = cell.bibMeta || { citationsReferenced: new Set(), bibCell: true };
  const srcChanged = cell.bibMeta.src !== src;
  cell.bibMeta.src = src;

  // 1) If we’ve never seen this src before, do a full load
  let info = _bibCache.get(src);
  if (!info) {
    const { entries, etag, lastModified } = await loadBibEntries(src, notebookPath);
    info = { entries, etag, lastModified };
    _bibCache.set(src, info);
    gCitationEntries = entries;
    return true;
  }

  // — Cached: do a metadata-only check
  let metadataChanged = false;

  if (/^[a-z]+:\/\//i.test(src)) {
    // remote HEAD
    const headResp = await fetch(src, { method: 'HEAD' });
    if (!headResp.ok) {
      // remote disappeared → clear & force update
      _bibCache.delete(src);
      gCitationEntries.clear();
      return true;
    }
    const newEtag = headResp.headers.get('etag') ?? undefined;
    const newLm   = headResp.headers.get('last-modified') ?? undefined;
    metadataChanged = (newEtag !== info.etag)
                       || (newLm !== info.lastModified);

  } else {
    // local metadata‐only
    const cm = new ContentsManager();
    const dir = PathExt.dirname(notebookPath);
    const fullPath = PathExt.join(dir, src);
    try {
      const model = await cm.get(fullPath, {
        content: false,
        type: 'file',
        format: 'text'
      });
      const newLm = (model as any).last_modified as string | undefined;
      metadataChanged = newLm !== info.lastModified;
    } catch {
      // file missing → clear & force update
      _bibCache.delete(src);
      gCitationEntries.clear();
      return true;
    }
  }

  // — If file truly changed, re-load+parse
  if (metadataChanged) {
    const { entries, etag, lastModified } = await loadBibEntries(src, notebookPath);
    info.entries      = entries;
    info.etag         = etag;
    info.lastModified = lastModified;
    gCitationEntries  = entries;
    return true;
  }

  // — No metadata change: but if user literally edited the src: line,
  //   force a rerender (pulling from cache, not reloading)
  if (srcChanged) {
    gCitationEntries = info.entries;
    return true;
  }

  // — Nothing changed
  return false;
}


/** 
 * Ensure a single '::: bibliography' cell exists, inserting one if missing.
 */
export function injectBibliography(
  tracker: INotebookTracker,
  panel: NotebookPanel,
  defaultSrc?: string
): void {
  const notebook = panel.content;
  const cells = notebook.widgets;

  // 1) Do we already have a ::: bibliography container?
  for (const cell of cells) {
    if (!(cell instanceof MarkdownCell)) {
      continue;
    }
    const xrCell = cell as MarkdownCellWithXR;
    const text = cell.model.sharedModel.getSource();
    if (/^::: *bibliography/m.test(text)) {

      // Preserve any existing citationsReferenced, or start fresh
      const existingCites = xrCell.bibMeta?.citationsReferenced ?? new Set<string>();

      // Re-assign bibMeta with bibCell flag but keep citationsReferenced
      xrCell.bibMeta = {
        citationsReferenced: existingCites,
        bibCell: true
      };

      return;
    }
  }

  // 2) No container → we need to insert one at the end
  // Make the last cell “active” so that insertBelow will append after it
  notebook.activeCellIndex = cells.length - 1;

  // Perform the standard “insert a markdown cell below” action:
  NotebookActions.insertBelow(notebook);

  // Grab the newly created cell (it’s now active)
  const newCell = notebook.activeCell as MarkdownCell;

  if (defaultSrc) {
    // 3a) Fill it with the bibliography container snippet
    newCell.model.sharedModel.setSource(`::: bibliography
src: ${defaultSrc}
:::`);

  } else {
    // 3b) Fill it with usage instructions
    newCell.model.sharedModel.setSource( [
      '<!-- jupyterlab-mdx bibliography usage -->',
      '**Enable Bibliography with jupyterlab-mdx**',
      '',
      '1. **Cite** entries inline with the caret syntax: `^YourCiteKey`',
      '2. **Add** a bibliography container in a Markdown cell:',
      '',
      '```markdown',
      '::: bibliography',
      'src: path/to/your-references.bib',
      ':::',
      '```',
      '',
      '_jupyterlab-mdx will fetch and parse your `.bib` file at render time and display the References list._'
    ].join('\n'));
  }

  // Finally, leave that cell “unrendered” so the user sees the source
  newCell.rendered = false;
}




// A helper to format one entry in a simple ACM-ish style
function formatACM(entry: any): string {
  const tags = entry.entryTags;
  const authors = (tags.author || '').replace(/\sand\s/g, ', ') + '.';
  const year    = tags.year ? tags.year : '';
  const title   = tags.title ? ` ${tags.title}.` : '';
  const venue   = tags.journal 
    ? ` *${tags.journal}*` 
    : tags.booktitle 
      ? ` *${tags.booktitle}*`
      : '';
  const vol      = tags.volume ? ` **${tags.volume}**` : '';
  const num      = tags.number ? `, ${tags.number}` : '';
  const date     = tags.month 
    ? ` (${tags.month} ${tags.year})` 
    : tags.year 
      ? ` (${tags.year})` 
      : '';
  const pages    = tags.pages ? `, ${tags.pages}` : '';
  const doiLink  = tags.doi 
    ? ` [https://doi.org/${tags.doi}](https://doi.org/${tags.doi})`
    : '';
  return `${authors} ${year}.${title}${venue}${vol}${num}${date}${pages}.${doiLink}`;
}

/**
 * Replace the first ::: bibliography … ::: container in `md` with
 * a rendered, numbered ACM-style reference list based on gCitationOrder.
 *
 * @param md            The raw markdown of one cell.
 * @param notebookPath  Path to the .ipynb (for resolving relative src).
 */
export function generateBibliography(md: string): string {
  // 1) Find the entire ::: bibliography … ::: block
  //    - `m` = multiline, `s` = dot matches newline
  const containerRe = /^::: *bibliography[\s\S]*?:::\s*$/m;
  if (!containerRe.test(md)) {
    return md;
  }

  // 2) Build the bibliography lines in order
  const lines = gCitationOrder.map((key, idx) => {
    const entry = gCitationEntries.get(key);
    if (!entry) {
      return `${idx + 1}. **[?]** Missing entry for \`${key}\``;
    }
    return `${idx + 1}. ${formatACM(entry)}`;
  });

  // 3) Replace just that placeholder block with our formatted list
  return md.replace(containerRe, lines.join('\n\n'));
}

// exported for purposes of testing.
export const __testExports__ = {
  gCitationOrder,
  gCitationMap,
  _bibCache,
  analyzeCitations,
  loadBibEntries
};

