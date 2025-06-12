// xr.ts (inside src/ directory of your extension)

import { INotebookTracker } from '@jupyterlab/notebook';
import {
  Cell,
  MarkdownCell,
  isMarkdownCellModel
} from '@jupyterlab/cells';


// A label comes in one of two forms.   It is either a member of the global
// enumeration or it is a membr of a named enumeration.   If it has the form
// @foo then it is the member "foo" of the global enumeration.   If it has the form
// @bar:foo then it is the member "foo" of the named enumeration with name "bar".
const labelMap = new Map<string, { name: string | null; id: string; n: number }>();
const enumCounters = new Map<string, number>();

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
  return raw ? `${n}` : name ? `${name} ${n}` : `${n}`;
}

/**
 * Walks the DOM looking for TEXT_NODEs and finding labels.
 * It increment and then assigns an integer to each label thereby
 * creating an enumeration.
 *
 * It also supports named enumerations.
 */
export function scanLabels(tracker: INotebookTracker): void {

  labelMap.clear();
  enumCounters.clear();
  let count : number = 0;

  console.log("scanLabels");

  // walk every Markdown cell
  for (const cell of tracker.currentWidget?.content.widgets ?? []) {
    if (!(cell instanceof MarkdownCell)) {
      continue;
    }

    // narrow the model to IMarkdownCellModel so TS knows about .value
    const model = cell.model;
    if (!isMarkdownCellModel(model)) {
      // if for some reason it isn’t, move on.
      continue;
    }
    const text = model.sharedModel.getSource();

    count++;
    console.log("scanLabels markdown node " + count + " text: " + text);
    const re = /@([A-Za-z]+:)?([A-Za-z0-9:_\-]+)/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const enumName = m[1];
      const id = m[2];
      const name = enumName ? enumName.slice(0, -1) : null;
      const key = toId(name, id);
      if (!labelMap.has(key)) {
        const counterKey = name ?? '_global';
        const n = (enumCounters.get(counterKey) ?? 0) + 1;
        enumCounters.set(counterKey, n);
        labelMap.set(key, { name, id, n });
      }
    }
  }
}


export function attachHooks(cell: Cell, tracker: INotebookTracker) {
  console.log("attachHooks")
  if (!(cell instanceof MarkdownCell)) return;
  if ((cell as any)._xr_hooks_installed) return;

  let edited = false;

  cell.model.sharedModel.changed.connect(() => {
    edited = true;
  });

  cell.renderedChanged.connect(() => {
    if (cell.rendered && edited) {
      console.log("cell.renderedChanged callback found edited cell");
      edited = false;
      scanLabels(tracker);
      rerenderDownstream(cell, tracker); // Propagate changes

    }
  });

  (cell as any)._xr_hooks_installed = true;
}

function rerenderDownstream(cell: MarkdownCell, tracker: INotebookTracker) {
  console.log("rerenderDownstream.");
  const cells = tracker.currentWidget?.content.widgets ?? [];
  const idx = cells.indexOf(cell);

  for (let i = idx + 1; i < cells.length; i++) {
    const c = cells[i];
    if (c instanceof MarkdownCell) {
      // Trigger re-render by flipping the .rendered state
      c.rendered = false;
      c.rendered = true;
    }
  }
}


export function preprocessLabels(markdown: string): string {
  const re = /(@|#)([A-Za-z]+:)?([A-Za-z0-9:_\-]+)(!?)/g;

  return markdown.replace(re, (full, sym, enumName, id, bang) => {
    const name = enumName ? enumName.slice(0, -1) : null;
    const key = toId(name, id);
    const entry = labelMap.get(key);

    if (!entry) {
      return full; // leave unchanged if not found
    }

    const { n } = entry;

    if (sym === '@') {
      // Replace with raw number or formatted (e.g., (3)) if taggable
      return formatLabel(name, n, /* raw= */ false);
    }

    if (sym === '#') {
      // Replace with cross-reference (may include prefix like "eq", unless ! present)
      return formatLabel(name, n, /* raw= */ bang === '!');
    }

    return full;
  });
}



export {
  labelMap,
  enumCounters,
  toId,
  formatLabel
};