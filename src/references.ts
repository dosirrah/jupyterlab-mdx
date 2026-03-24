export interface SectionInfo {
  kind: 'section';
  level: number;      // literal markdown heading level
  title: string;
  number: string;     // derived section number, e.g. "2.1"
  isExplicit: boolean;
}

export interface EnumerationInfo {
  kind: 'enumeration';
  number: string;     // derived global-enumeration number, e.g. "3"
}

export type LabelInfo = SectionInfo | EnumerationInfo;

export interface NotebookState {
  labels: Map<string, LabelInfo>;
  sections: string[];      // ordered canonical labels of sections
  enumeration: string[];   // ordered canonical labels in the global enumeration
}

export class DuplicateLabelError extends Error {
  constructor(label: string) {
    super(`Duplicate canonical label: ${label}`);
    this.name = 'DuplicateLabelError';
  }
}

 
/**
 * First pass over the notebook.
 *
 *
 * `cells` contains only markdown cells, in notebook order.

 * This function calls `scanLabels` on each cell and builds notebook-global
 * state for:
 *   - numbered sections
 *   - numbered global-enumeration labels
 *   - canonical label lookup
 *
 * The returned `NotebookState` is later used to resolve references and to
 * transform individual cells at render time.
 *
 * This design is non-reactive and state-gated. `scanNotebook` is run only
 * when the notebook is ready enough to read all markdown cell sources.
 */
export function scanNotebook(cells: string[]): NotebookState {
  throw new Error('not implemented');
}

/**
 * Resolves a user-facing reference to a canonical label.
 *
 * Resolution precedence:
 *   1. exact match against an explicit label
 *   2. exact match against an implicit section label
 *   3. unique prefix match against an implicit section label
 *   4. otherwise unresolved
 *
 * If an explicit label is matched, the numbering semantics come from the
 * context where that label was defined:
 *   - section heading -> section numbering
 *   - ordinary text   -> global enumeration numbering
 *
 * Assumes a previous call to `scanNotebook` to populate notebook-global state.
 *
 * Returns the canonical label if resolved, or `null` if unresolved.
 */
export function resolveReference(ref: string, state: NotebookState): string | null {
  throw new Error('not implemented');
}

/**
 * Render-time transform for a single markdown cell.
 *
 * `md` is the source markdown for one cell. This function is called immediately
 * before the cell is rendered. The source cell is not modified.
 *
 * This transform:
 *   - inserts section numbers into headings
 *   - replaces explicit non-section labels with global-enumeration numbers
 *   - resolves references to either section numbers or global-enumeration numbers
 *   - renders visible diagnostics for unresolved references and duplicate labels
 *
 * `state` must have been previously populated by `scanNotebook`.
 */
export function transformMarkdown(md: string, state: NotebookState): string {
  throw new Error('not implemented');
}
