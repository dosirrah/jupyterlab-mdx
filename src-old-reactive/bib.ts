import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { MarkdownCell } from '@jupyterlab/cells';
import { ContentsManager } from '@jupyterlab/services';
import { PathExt } from '@jupyterlab/coreutils';
import { MarkdownCellWithXR } from './xr';
import { setsEqualOrdered, union } from './util';
import bibtexParse from 'bibtex-parse-js';
import { NotebookActions } from '@jupyterlab/notebook';
import { BibInfo } from './state';

// metainfo about the bib file including when
// it last changed.
//const bibCache = new Map<string, any[]>();

// Regex for math spans ($...$, $$...$$, or \[...\]) to ignore ^ inside math
const mathSpanRe = /(\${2}[\s\S]+?\${2}|\$[^$]+\$|\\\[[\s\S]+?\\\])/g;
const mathPlaceholder = (i: number) => `\u0000MATH${i}\u0000`;
const mathRestoreRe = /\u0000MATH(\d+)\u0000/g;



/**
 * Scan all markdown cells for '^KEY' citations in first-use order, ignoring math.
 *
 * @returns A list of citations keys in the order they were encountered in the
 *          notebook.
 */
export function scanCitations(tracker: INotebookTracker): string[] {
  const seen = new Set<string>();

  //console.log("sC1 scanCitations");
  
  tracker.currentWidget?.content.widgets.forEach(widget => {
    if (!(widget instanceof MarkdownCell)) return;
    const xrCell = widget as MarkdownCellWithXR;
    const src = xrCell.model.sharedModel.getSource();
    //console.log("sC1 scanCitations src:", src);

    // Attach per-cell metadata
    const cites = analyzeCitations(src);
    //console.log("sC2 scanCitations cites:", cites);

    xrCell.bibMeta = {
        citationsReferenced: cites,
        bibCell : /^::: *bibliography/m.test(src)
    };

    // Update global order & map
    for (const key of cites) {
      if (!seen.has(key)) {
        //console.log("sC3: seen. Adding key:", key);
        seen.add(key);
      }
    }
  });
  //console.log("sC3: seen.size", seen.size);

  return Array.from(seen);  // all citations in the order added.
}


/**
 * finds citiations within the markdown of a single cell.
 */
function analyzeCitations(src: string): Set<string> {
  const cites = new Set<string>();

  // 1) Remove HTML comments so we don't pick up ^… inside <!-- … -->
  const noComments = src.replace(/<!--[\s\S]*?-->/g, '');

  // 2) Strip out math spans
  const text = noComments.replace(mathSpanRe, '');

  for (const [, key] of text.matchAll(/\^([A-Za-z0-9_-]+)/g)) {
    if (!cites.has(key)) {
      cites.add(key);
    }
  }

  return cites;
}


/**
 * Replace '^KEY' with '[n]' according to citation order, restoring math spans.
 */
export function preprocessCitations(markdown: string,
                                    citationMap: Map<string, number>): string {
  // 1) Hide math spans so ^ inside LaTeX won’t match
  const mathSpans: string[] = [];
  const withoutMath = markdown.replace(mathSpanRe, m => {
    const idx = mathSpans.push(m) - 1;
    return mathPlaceholder(idx);
  });

  // 2) Replace each ^KEY with its [n] from citationMap
  const withNumbers = withoutMath.replace(/\^([A-Za-z0-9_-]+)/g, (_, key) => {
    const n = citationMap.get(key);
    //const safe_key = encodeURIComponent(key);
    return `<a href="#cite-${key}" target="_self">[${n}]</a>`;
  });

  // 3) Restore math spans
  return withNumbers.replace(mathRestoreRe, (_, idx) => mathSpans[+idx]);
}


/**
 * Given the edited cell and all cells, update only citation state:
 *  - update citationMap.
 *  - determine the set of citation keys whose numbers changed
 *
 * @param edited    The cell that has just been run.
 * @param allCells  All markdown cells in the notebook.
 * @param citationMap updated to reflect the new mapping from key to number.
 * @returns the set of citation keys whose numbers changed
 */
export function updateCitationMap(
  edited: MarkdownCellWithXR,
  allCells: MarkdownCellWithXR[],
  citationMap: Map<string, number>
): Set<string> {

  // 1) Extract old vs new citations from the cell
  const text = edited.model.sharedModel.getSource()
  const oldCites = edited.bibMeta?.citationsReferenced ?? new Set();
  const newCites = analyzeCitations(text);
  //console.log("1 updateCitationMap. oldCites:", oldCites, "newCites:", newCites);

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
  allCells.forEach(cell => {
    (cell.bibMeta?.citationsReferenced ?? []).forEach((key:string) => {
      if (!seen.has(key)) {
        seen.add(key);
      }
    });
  });

  // 5) Recompute map & detect which keys have been moved or added.
  const oldOrder = Array.from(citationMap.keys());  // In order added.
  const newOrder = Array.from(seen);   // Also in order added.
  //console.log("2 updateCitationMap. oldOrder=", oldOrder, " newOrder=", newOrder);
  citationMap.clear();
  const changed = new Set<string>(removed);  // start with any removals

  citationMap.clear();
  newOrder.forEach((key, i) => {
    citationMap.set(key, i + 1);
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


/**
 * Will load (or reload) a .bibtex file to populate the
 * bibliography.  This function checks whether a remote .bibtex
 * file has changed and reloads if it has.
 *
 * @param cell
 * @param notebookPath
 * @param bibInfo       to be updated.
 * @returns whether the bibInfo changed.
 */
export async function updateBibliography(
  cell: MarkdownCellWithXR,
  notebookPath: string,
  bibInfo : BibInfo
): Promise<boolean> {
  const text = cell.model.sharedModel.getSource();
  const CONTAINER_RE = /^::: *bibliography[\s\S]*?:::\s*$/m;
  const SRC_RE       = /^src:\s*(\S+)\s*$/m;

  //console.log("u1 updateBibliography");
  
  if (!CONTAINER_RE.test(text)) {
    //console.log("1a updateBibliography  no ::: bibliography found. Returning");

    return false;
  }
  
  const m = text.match(SRC_RE);
  if (!m) {
    console.warn('Found ::: bibliography but no src: line');
    return false;
  }
  const src = m[1];

  //console.log("u2 updateBibliography src:", src);

  cell.bibMeta = cell.bibMeta || { citationsReferenced: new Set(), bibCell: true };
  const srcChanged = bibInfo.src !== src;
  let metadataChanged = false;

  // — Cached: do a metadata-only check
  if (!srcChanged) {

    //console.log("u3 updateBibliography srcChanged");

    if (/^[a-z]+:\/\//i.test(src)) {
      // remote HEAD
      const headResp = await fetch(src, { method: 'HEAD' });
      if (!headResp.ok) {
        throw new Error(
          `Could not fetch bibliography at ${src}: ` +
          `HEAD request failed with ${headResp.status} ${headResp.statusText}`
        );

      } else {
        const newEtag = headResp.headers.get('etag') ?? undefined;
        const newLm   = headResp.headers.get('last-modified') ?? undefined;
        metadataChanged = (newEtag !== bibInfo.etag)
                           || (newLm !== bibInfo.lastModified);
      }
  
    } else {
      // local metadata‐only
      const cm = new ContentsManager();
      const dir = PathExt.dirname(notebookPath);

      const fullPath = PathExt.join(dir, src);
      const model = await cm.get(fullPath, {
        content: false,
        type: 'file',
        format: 'text'
      });
      const newLm = (model as any).last_modified as string | undefined;
      metadataChanged = newLm !== bibInfo.lastModified;
    }
  }

  //console.log("u4 updateBibliography srcChanged", srcChanged, " metadataChanged", metadataChanged);

  // If changed to a different .bib file or the .bib file has changed then load.
  if (srcChanged || metadataChanged) {
    const { entries, etag, lastModified } = await loadBibEntries(src, notebookPath);
    bibInfo.src          = src;
    bibInfo.entries      = entries;
    bibInfo.etag         = etag;
    bibInfo.lastModified = lastModified;
    return true;
  }
  //console.log("u5 updateBibliography srcChanged", srcChanged, " metadataChanged", metadataChanged);

  return false;
}


/** 
 * Ensure a single '::: bibliography' cell exists, inserting one if missing.
 */
export function injectIfNoBibliography(
  tracker: INotebookTracker,
  panel: NotebookPanel,
  defaultSrc?: string | null
): void {
  const notebook = panel.content;
  const cells = notebook.widgets;

  //console.log("i1 injectIfNoBibliography cells.length", cells.length);
  
  // 1) Do we already have a ::: bibliography container?
  for (const cell of cells) {
    //console.log("i2 injectIfNoBibliography in for loop cell.model.type:", cell.model.type);

    if (cell.model.type !== 'markdown') {
      //console.log('  not markdown, skipping');
      continue;
    }

    //if (!(cell instanceof MarkdownCell)) {
    //  console.log("i3 injectIfNoBibliography not MarkdownCell.  Continuing.");
    //  continue;
    //}
    const xrCell = cell as MarkdownCellWithXR;
    const text = cell.model.sharedModel.getSource();
    
    if (xrCell.bibMeta?.bibCell) return;

    //console.log("i5 bibCell is undefined or false");

    if (/^::: *bibliography/m.test(text)) {

      //console.log("i6 ::: bibliography found");

      // Preserve any existing citationsReferenced, or start fresh
      const existingCites = xrCell.bibMeta?.citationsReferenced ?? new Set<string>();

      // Re-assign bibMeta with bibCell flag but keep citationsReferenced
      xrCell.bibMeta = {
        citationsReferenced: existingCites,
        bibCell: true
      };

      return;
    }
    //console.log("i7 ::: bibliography NOT found");

  }
  //console.log("i8 no bibliography found.  Appending one");


  // 2) No container → we need to insert one at the end
  // Make the last cell “active” so that insertBelow will append after it
  notebook.activeCellIndex = cells.length - 1;

  // Perform the standard “insert a markdown cell below” action:
  NotebookActions.insertBelow(notebook);
  NotebookActions.changeCellType(notebook, 'markdown');

  // Grab the newly created cell (it’s now active)
  const newCell = notebook.activeCell as MarkdownCell;

  if (defaultSrc) {
    // 3a) Fill it with the bibliography container snippet
    newCell.model.sharedModel.setSource(
`<!--
Automatically added by jupyterlab-mdx because you cited something (^lamport1994)
but hadn’t yet created a bibliography. When you run this cell it will
generate your reference list. If you’d like a different .bib file,
just change the “src:” path below.
-->

::: bibliography
src: ${defaultSrc}
:::
`);
    
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
  const vol      = tags.volume ? ` <strong>${tags.volume}</strong>` : '';
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
 * @param md            The raw markdown of a cell containing ::: bibliography :::
 * @param 
 */
export function generateBibliography(md: string,
                                     citations: string[],
                                     bibMap: Map<string, any>
                                     ): string {

  // 1) Find the entire ::: bibliography … ::: block
  //    - `m` = multiline, `s` = dot matches newline
  const containerRe = /^::: *bibliography[\s\S]*?:::\s*$/m;
  if (!containerRe.test(md)) {
    return md;
  }

  // 2) Build the bibliography lines in order
  const lines = citations.map((key, idx) => {
    const entry = bibMap.get(key);
    if (!entry) {
      return `<div id="cite-${key}"><strong>[${idx + 1}]</strong>. Missing entry for \`${key}\`</div>`;
    }
    return `<div id="cite-${key}">[${idx + 1}] ${formatACM(entry)}</div>`;

  });

  // 3) Replace just that placeholder block with our formatted list
  return md.replace(containerRe, lines.join('\n\n'));
}

// exported for purposes of testing.
export const __testExports__ = {
  analyzeCitations,
  loadBibEntries
};

