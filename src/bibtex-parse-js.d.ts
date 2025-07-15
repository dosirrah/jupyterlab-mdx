// src/bibtex-parse-js.d.ts
declare module 'bibtex-parse-js' {
  /** A single parsed BibTeX entry */
  export interface BibEntry {
    citationKey: string;
    entryType: string;
    entryTags: Record<string, string>;
  }

  /** Parse a raw BibTeX string into JSON entries */
  export function toJSON(bibtex: string): BibEntry[];

  /** Default export convenience */
  const bibtexParse: { toJSON(bibtex: string): BibEntry[] };
  export default bibtexParse;
}
