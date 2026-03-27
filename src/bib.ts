

export interface CitationState {
  citationNumbers: Map<string, number>;
}

export function scanNotebookCitations(cells: string[]): CitationState {
  // Note that the entire citation -> number mapping is created fresh each time
  // scanNotebookCitations is called.
  throw new Error('not implemented');
}

export interface BibliographyEntry {
  key: string;
  entryType: string;
  fields: Map<string, string>;
}

export function parseBibFile(source: string): Map<string, BibliographyEntry> {
  throw new Error('not implemented');
}

export function formatBibliographyEntry(
  entry: BibliographyEntry,
  citationNumber: number
): string {
  // Example output:
  // [1] Leslie Lamport, “LaTeX: A Document Preparation System,” *Software: Practice and Experience*, 1994.
  //
  // In the example, the citationNumber is 1 corresponding to the [1] appearing in the
  // output.
  
  throw new Error('not implemented');
}

export function renderBibliographyMarkdown(
  citationState: CitationState,
  entries: Map<string, BibliographyEntry>
): string {
  throw new Error('not implemented');
}