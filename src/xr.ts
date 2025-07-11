// xr.ts

import { INotebookTracker } from '@jupyterlab/notebook';
import {
  Cell,
  MarkdownCell,
} from '@jupyterlab/cells';
import { setsEqualOrdered, union } from './util';
import { preprocessCitations } from './bib';

type CellXRMeta = {
  labelsDefined: Set<string>;       // e.g. ["eq:foo", "eq:bar", "goo"]
  labelsReferenced: Set<string>;    // same kinds of labels as labelsDefined.
};

type CellBibMeta = {
  citationsReferenced: Set<string>;
  bibCell: boolean;
  src?: string;
};

export interface MarkdownCellWithXR extends MarkdownCell {
  xrMeta?: CellXRMeta;
  bibMeta?: CellBibMeta;
}


// A label comes in one of two forms.   It is either a member of the global
// enumeration or it is a membr of a named enumeration.   If it has the form
// @foo then it is the member "foo" of the global enumeration.   If it has the form
// @bar:foo then it is the member "foo" of the named enumeration with name "bar".
const gLabelMap = new Map<string, { name: string | null; id: string; n: number }>();
export const gDuplicateLabels = new Set<string>();

// TAGGABLE is a reference to the \tag command in LaTex.  It is used to
// number equations.  Currently only do this for the 'eq' but we may
// add other predefined namespaces.
const TAGGABLE_NAMES = new Set(['eq']);

console.log("Loaded xr.ts module");

/**
 * Converts an optional enumeration name and ID to a fully qualified key.
 * @param name - The enumeration name (e.g. "eq", "fig"), or null for global.
 * @param id - The specific label ID.
 * @returns A composite string key like "eq:foo" or "foo".
 */
function toId(name: string | null, id: string): string {
  return name ? `${name}:${id}` : id;
}

function formatLabel(name: string | null, n: number | string, raw = false): string {
  if (name && TAGGABLE_NAMES.has(name.toLowerCase())) {
    return raw ? `${n}` : `(${n})`;
  }
  return `${n}`;
}


/**
 * finds labels and references throughout the document and
 * associates numbers with each labels.   It also associates
 * the labels and references appearing within a single
 * cell as metadata attached to that cell.  
 */
export function scanLabels(tracker: INotebookTracker): void {
  console.log("scanLabels");
  gLabelMap.clear();
  gDuplicateLabels.clear();

  const enumCounters = new Map<string, number>();
  const cells = tracker.currentWidget?.content.widgets ?? [];

  for (const cell of cells) {
    //console.log("s2 scanLabels for cell of cells: Markdown celll?", cell instanceof MarkdownCell);
    if (!(cell instanceof MarkdownCell)) continue;

    const xrCell = cell as MarkdownCellWithXR;
    const src = xrCell.model.sharedModel.getSource();

    //console.log("s3 scanLabels calling analyzeMarkdown on", src);

    const meta = analyzeMarkdown(src);
    xrCell.xrMeta = meta;

    // Now assign numbers to any newly discovered labels
    for (const key of meta.labelsDefined) {
      if (gLabelMap.has(key)) {
        gDuplicateLabels.add(key);
      } else {
        const [name, id] = key.includes(':') ? key.split(':') : [null, key];
        const enumName = name ?? '_global';
        const n = (enumCounters.get(enumName) ?? 0) + 1;
        enumCounters.set(enumName, n);
        //console.log(`s4 scanLabels gLabelMap set ${key}, { ${name}, ${id}, ${n} }`);

        gLabelMap.set(key, { name, id, n });
      }
    }
    console.log("s5 scanLabels returning");
  }
}

/**
 * finds labels and references within the markdown of a single cell.
 */
function analyzeMarkdown(src: string): CellXRMeta {

  const labelsDefined = new Set<string>();
  const labelsReferenced = new Set<string>();

  // Match labels: @eq:foo or @foo
  const labelRe = /@([A-Za-z]+:)?([A-Za-z0-9:_\-]+)/g;
  let match;
  while ((match = labelRe.exec(src)) !== null) {
    const name = match[1] ? match[1].slice(0, -1) : null;
    const id = match[2];
    labelsDefined.add(toId(name, id));
  }

  // Match references: #eq:foo or #foo
  const refRe = /#([A-Za-z]+:)?([A-Za-z0-9:_\-]+)/g;
  while ((match = refRe.exec(src)) !== null) {
    const name = match[1] ? match[1].slice(0, -1) : null;
    const id = match[2];
    labelsReferenced.add(toId(name, id));
  }

  return { labelsDefined, labelsReferenced };
}

/**
 * Finds all labels and references in the given markdown text and replaces them with:
 * - The corresponding number (for valid labels or references),
 * - '⚠️ {undefined: ...}' if a reference does not match any known label,
 * - '⚠️ {duplicate: ...}' if a label is known to be duplicated.
 *
 * @param markdown - Markdown text potentially containing labels (e.g., @foo) or 
 *                   references (e.g., #foo).
 * @param duplicateLabels - Set of labels known to appear more than once in the document.
 * @returns Transformed markdown with each label or reference replaced appropriately.
 */
export function preprocessLabels(markdown: string, duplicateLabels: Set<string>): string {
  const re = /(@|#)([A-Za-z]+:)?([A-Za-z0-9:_\-]+)(!?)/g;

  return markdown.replace(re, (full, sym, enumName, id, bang) => {
    const name = enumName ? enumName.slice(0, -1) : null;
    const key = toId(name, id);
    const entry = gLabelMap.get(key);

    if (duplicateLabels.has(key)) {
        return `⚠️ {duplicate: ${key}}`
    }
    
    if (!entry) {
      return `⚠️ {undefined: ${key}}`;
    }

    const { n } = entry;

    if (sym === '@') {
      // Replace with raw number or formatted (e.g., (3)) if taggable
      return formatLabel(name, n, /* raw= */ true);
    }

    if (sym === '#') {
      // Replace with cross-reference
      return formatLabel(name, n, /* raw= */ false);
    }

    return full;
  });
}


/**
 * Updates the global gLabelMap after an edit to a single Markdown cell.
 *
 * This function:
 * - Analyzes the edited cell to extract any label changes.
 * - Compares old and new labels to detect additions, deletions, or reorderings.
 * - Removes obsolete labels from the global gLabelMap.
 * - Recomputes numbering for downstream labels affected by the change.
 * - Identifies any duplicate labels that emerge as a result.
 *
 * @param edited - The Markdown cell that was just edited.
 * @param allCells - All Markdown cells in the document, in visual/topological order.
 *
 * @returns A pair:
 *   - `changedLabels`: A set of labels whose numbers have changed or were removed.
 *   - `duplicateLabels`: A set of labels that were found more than once (and should be flagged).
 */
export function updateLabelMap(
  edited: MarkdownCellWithXR,
  allCells: MarkdownCellWithXR[]
): [Set<string>, Set<string>] {
  //console.log("1 updateLabelMap");
  const newMeta = analyzeMarkdown(edited.model.sharedModel.getSource());

  const oldMeta = edited.xrMeta ?? {
    labelsDefined: new Set<string>(),
    labelsReferenced: new Set<string>()
  };

  edited.xrMeta = newMeta;

  const oldLabels = oldMeta.labelsDefined;
  const newLabels = newMeta.labelsDefined;

  const labelsChanged = !setsEqualOrdered(oldLabels, newLabels);  // order matters.
  //console.log("3 updateLabelMap labelsChanged", labelsChanged);

  // If labels didn't change then we can safely return.  If only refs changed there is no
  // need to update the gLabelMap and the cell will still properly render even if there are new
  // references.
  if (!labelsChanged) return [new Set<string>(), gDuplicateLabels];

  const affectedEnums = new Set<string>();
  const removedLabels = new Set<string>();

  // remove any labels that no longer exist.
  for (const label of oldMeta.labelsDefined) {
    if (!newMeta.labelsDefined.has(label)) {
      gLabelMap.delete(label);
      removedLabels.add(label);  // Track for invalidation
    }
  }

  // Labels changed → renumber downstream
  for (const label of union(oldLabels, newLabels)) {
    const [name] = label.includes(':') ? label.split(':') : [null];
    affectedEnums.add(name ?? '_global');
  }

  const [changedLabels, duplicateLabels] = renumberDownstream(edited, allCells, affectedEnums);

  // gDuplicateLabels is used by default render pipeline.
  gDuplicateLabels.clear();
  for (const item of duplicateLabels) {
      gDuplicateLabels.add(item);
  }
  
  // make sure that dangling references are rerendered as "??" by including removed
  // labels in the set of changedLabels.
  for (const label of removedLabels) {
    changedLabels.add(label);
  }

  return [changedLabels, duplicateLabels];  
}

function renumberDownstream(
  fromCell: MarkdownCellWithXR,
  allCells: MarkdownCellWithXR[],
  affectedEnums: Set<string>
): [Set<string>, Set<string>] {
  const startIdx = allCells.indexOf(fromCell);
  const counters = new Map<string, number>();
  const changedLabels = new Set<string>();
  const encounteredLabels = new Set<string>();
  const duplicateLabels = new Set<string>();

  // Step 1: Walk upstream to initialize counters
  for (let i = 0; i < startIdx; i++) {
    const cell = allCells[i];
    const meta = (cell as MarkdownCellWithXR).xrMeta;
    if (!meta) continue;

    for (const label of meta.labelsDefined) {
      const [name, _id] = label.includes(':') ? label.split(':') : [null, label];
      const enumKey = name ?? '_global';
      if (!affectedEnums.has(enumKey)) continue;

      const current = counters.get(enumKey) ?? 0;
      counters.set(enumKey, current + 1);

      // look for duplicate labels.
      if (encounteredLabels.has(label)) {
          duplicateLabels.add(label);
      }
      else {
          encounteredLabels.add(label);
      }
    }
  }

  // Step 2: Renumber from the edited cell onward
  for (let i = startIdx; i < allCells.length; i++) {
    const cell = allCells[i];
    const meta = (cell as MarkdownCellWithXR).xrMeta;
    if (!meta) continue;

    for (const label of meta.labelsDefined) {
      const [name, id] = label.includes(':') ? label.split(':') : [null, label];
      const enumKey = name ?? '_global';
      if (!affectedEnums.has(enumKey)) continue;

      if (encounteredLabels.has(label)) {
          duplicateLabels.add(label);
      }
      else {
          encounteredLabels.add(label);
      
          const newN = (counters.get(enumKey) ?? 0) + 1;
          counters.set(enumKey, newN);
          
          const prev = gLabelMap.get(label);
          if (!prev || prev.n !== newN) {
              gLabelMap.set(label, { name, id, n: newN });
              changedLabels.add(label);
          }
      }
    }
  }

  return [changedLabels, duplicateLabels];
}


function computeChangedLabels(
  oldMeta: CellXRMeta,
  newMeta: CellXRMeta
): Set<string> {
  const changed = new Set<string>();

  for (const label of oldMeta.labelsDefined) {
    if (!newMeta.labelsDefined.has(label)) changed.add(label);
  }
  for (const label of newMeta.labelsDefined) {
    if (!oldMeta.labelsDefined.has(label)) changed.add(label);
  }

  return changed;
}


// exported for purposes of testing.
export const __testExports__ = {
  gLabelMap,
  toId,
  formatLabel,
  analyzeMarkdown
};