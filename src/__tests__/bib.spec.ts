import { scanNotebookCitations } from '../bib';

describe('mdx bib / scanNotebookCitations', () => {
  it('returns an empty citation map for an empty notebook', () => {
    const state = scanNotebookCitations([]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([]);
  });

  it('returns an empty citation map when no cells contain citations', () => {
    const state = scanNotebookCitations([
      'Plain text only.',
      '## A heading with no citations',
      'More plain text.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([]);
  });

  it('assigns [1] to the first cited key in a single cell', () => {
    const state = scanNotebookCitations([
      'See ^lamport1994 for details.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([
      ['lamport1994', 1]
    ]);
  });

  it('assigns numbers to unique citations in first-appearance order within one cell', () => {
    const state = scanNotebookCitations([
      'See ^lamport1994, ^knuth1984, and ^turing1936.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([
      ['lamport1994', 1],
      ['knuth1984', 2],
      ['turing1936', 3]
    ]);
  });

  it('preserves the first number assigned to a repeated citation in one cell', () => {
    const state = scanNotebookCitations([
      'See ^lamport1994, then ^knuth1984, then ^lamport1994 again.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([
      ['lamport1994', 1],
      ['knuth1984', 2]
    ]);

    expect(state.citationNumbers.get('lamport1994')).toBe(1);
    expect(state.citationNumbers.get('knuth1984')).toBe(2);
  });

  it('assigns numbers in first-appearance order across multiple cells', () => {
    const state = scanNotebookCitations([
      'First cite ^lamport1994.',
      'Then cite ^knuth1984.',
      'Finally cite ^turing1936.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([
      ['lamport1994', 1],
      ['knuth1984', 2],
      ['turing1936', 3]
    ]);
  });

  it('preserves the original number when a citation is repeated in a later cell', () => {
    const state = scanNotebookCitations([
      'First cite ^lamport1994.',
      'Then cite ^knuth1984.',
      'Cite ^lamport1994 again here.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([
      ['lamport1994', 1],
      ['knuth1984', 2]
    ]);

    expect(state.citationNumbers.get('lamport1994')).toBe(1);
    expect(state.citationNumbers.get('knuth1984')).toBe(2);
  });

  it('ignores citations inside inline code when assigning numbers', () => {
    const state = scanNotebookCitations([
      'Use `^lamport1994` literally.',
      'But cite ^knuth1984 here.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([
      ['knuth1984', 1]
    ]);
  });

  it('ignores citations inside fenced code blocks when assigning numbers', () => {
    const state = scanNotebookCitations([
      `
\`\`\`
^lamport1994
\`\`\`
`,
      'See ^knuth1984 here.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([
      ['knuth1984', 1]
    ]);
  });

  it('ignores citations inside HTML comments when assigning numbers', () => {
    const state = scanNotebookCitations([
      `
<!-- ^lamport1994 should be ignored -->
`,
      'See ^knuth1984 here.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([
      ['knuth1984', 1]
    ]);
  });

  it('uses O(1) lookup through citationNumbers.get(key)', () => {
    const state = scanNotebookCitations([
      'See ^lamport1994 and ^knuth1984 and ^turing1936.'
    ]);

    expect(state.citationNumbers.get('lamport1994')).toBe(1);
    expect(state.citationNumbers.get('knuth1984')).toBe(2);
    expect(state.citationNumbers.get('turing1936')).toBe(3);
    expect(state.citationNumbers.get('missing')).toBeUndefined();
  });

  it('iterates bibliography entries in citation-number order', () => {
    const state = scanNotebookCitations([
      'See ^lamport1994 and ^knuth1984.',
      'Then ^turing1936.'
    ]);

    expect(Array.from(state.citationNumbers.keys())).toEqual([
      'lamport1994',
      'knuth1984',
      'turing1936'
    ]);

    expect(Array.from(state.citationNumbers.values())).toEqual([1, 2, 3]);
  });

  it('allows underscores and digits in citation keys across cells', () => {
    const state = scanNotebookCitations([
      'See ^foo_2.',
      'Then ^bar99.',
      'Then ^foo_2 again.'
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([
      ['foo_2', 1],
      ['bar99', 2]
    ]);
  });
});