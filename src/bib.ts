

export interface CitationState {
  citationNumbers: Map<string, number>;
}

export function scanNotebookCitations(cells: string[]): CitationState {
  // Note that the entire citation -> number mapping is created fresh each time
  // scanNotebookCitations is called.
  throw new Error('not implemented');
}
