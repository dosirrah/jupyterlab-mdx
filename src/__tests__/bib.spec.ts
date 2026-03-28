import fs from 'fs';
import path from 'path';
import {
  scanNotebookCitations,
  parseBibFile,
  formatBibliographyEntry,
  renderBibliographyMarkdown
} from '../bib';


function bibFixture(name: string): string {
  return fs.readFileSync(
    path.resolve(__dirname, '../../playwright-tests/fixtures', name),
    'utf-8'
  );
}

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

  it('ignores citations inside LaTeX equation blocks', () => {
    const state = scanNotebookCitations([
      `
$$
\int_{x=0}^t x^2 dx   @eq:foo
$$
`
    ]);

    expect(Array.from(state.citationNumbers.entries())).toEqual([]);
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


describe('mdx bib / parseBibFile', () => {
  it('parses a single-entry bibliography fixture', () => {
    const entries = parseBibFile(bibFixture('single_entry.bib'));

    expect(Array.from(entries.keys())).toEqual(['lamport1994']);

    const entry = entries.get('lamport1994');
    expect(entry).toBeDefined();
    expect(entry?.key).toBe('lamport1994');
    expect(entry?.entryType).toBe('article');
    expect(entry?.fields.get('author')).toBe('Leslie Lamport');
    expect(entry?.fields.get('title')).toBe('LaTeX: A Document Preparation System');
    expect(entry?.fields.get('journal')).toBe('Software: Practice and Experience');
    expect(entry?.fields.get('year')).toBe('1994');
  });

  it('parses multiple entries from multiple_entries.bib', () => {
    const entries = parseBibFile(bibFixture('multiple_entries.bib'));

    expect(Array.from(entries.keys())).toEqual([
      'lamport1994',
      'knuth1984',
      'turing1936'
    ]);

    expect(entries.get('lamport1994')?.entryType).toBe('article');
    expect(entries.get('knuth1984')?.entryType).toBe('article');
    expect(entries.get('turing1936')?.entryType).toBe('article');

    expect(entries.get('knuth1984')?.fields.get('author')).toBe('Donald E. Knuth');
    expect(entries.get('knuth1984')?.fields.get('title')).toBe('Literate Programming');
    expect(entries.get('knuth1984')?.fields.get('journal')).toBe('The Computer Journal');
    expect(entries.get('knuth1984')?.fields.get('year')).toBe('1984');
  });

  it('parses mixed entry types from mixed_entry_types.bib', () => {
    const entries = parseBibFile(bibFixture('mixed_entry_types.bib'));

    expect(Array.from(entries.keys())).toEqual([
      'lamport1994',
      'knuth1984',
      'aho2006',
      'mccarthy1960'
    ]);

    expect(entries.get('lamport1994')?.entryType).toBe('article');
    expect(entries.get('knuth1984')?.entryType).toBe('inproceedings');
    expect(entries.get('aho2006')?.entryType).toBe('book');
    expect(entries.get('mccarthy1960')?.entryType).toBe('misc');
  });

  it('parses extra fields on article entries', () => {
    const entries = parseBibFile(bibFixture('mixed_entry_types.bib'));
    const entry = entries.get('lamport1994');

    expect(entry).toBeDefined();
    expect(entry?.fields.get('volume')).toBe('15');
    expect(entry?.fields.get('number')).toBe('3');
    expect(entry?.fields.get('pages')).toBe('1--23');
  });

  it('parses booktitle for inproceedings entries', () => {
    const entries = parseBibFile(bibFixture('mixed_entry_types.bib'));
    const entry = entries.get('knuth1984');

    expect(entry).toBeDefined();
    expect(entry?.fields.get('author')).toBe('Donald E. Knuth');
    expect(entry?.fields.get('title')).toBe('Literate Programming');
    expect(entry?.fields.get('booktitle')).toBe(
      'Proceedings of the ACM Symposium on Text Manipulation'
    );
    expect(entry?.fields.get('pages')).toBe('1--10');
    expect(entry?.fields.get('year')).toBe('1984');
  });

  it('parses publisher on book entries', () => {
    const entries = parseBibFile(bibFixture('mixed_entry_types.bib'));
    const entry = entries.get('aho2006');

    expect(entry).toBeDefined();
    expect(entry?.fields.get('author')).toBe(
      'Alfred V. Aho and Monica S. Lam and Ravi Sethi and Jeffrey D. Ullman'
    );
    expect(entry?.fields.get('title')).toBe(
      'Compilers: Principles, Techniques, and Tools'
    );
    expect(entry?.fields.get('publisher')).toBe('Pearson');
    expect(entry?.fields.get('year')).toBe('2006');
  });

  it('parses note on misc entries', () => {
    const entries = parseBibFile(bibFixture('mixed_entry_types.bib'));
    const entry = entries.get('mccarthy1960');

    expect(entry).toBeDefined();
    expect(entry?.fields.get('author')).toBe('John McCarthy');
    expect(entry?.fields.get('title')).toBe(
      'Recursive Functions of Symbolic Expressions and Their Computation by Machine'
    );
    expect(entry?.fields.get('note')).toBe('Classic AI paper');
    expect(entry?.fields.get('year')).toBe('1960');
  });

  it('supports O(1) lookup by citation key', () => {
    const entries = parseBibFile(bibFixture('multiple_entries.bib'));

    expect(entries.get('lamport1994')?.fields.get('year')).toBe('1994');
    expect(entries.get('knuth1984')?.fields.get('year')).toBe('1984');
    expect(entries.get('turing1936')?.fields.get('year')).toBe('1936');
    expect(entries.get('missing')).toBeUndefined();
  });

  it('preserves entry insertion order during iteration', () => {
    const entries = parseBibFile(bibFixture('mixed_entry_types.bib'));

    expect(Array.from(entries.keys())).toEqual([
      'lamport1994',
      'knuth1984',
      'aho2006',
      'mccarthy1960'
    ]);
  });
});

describe('mdx bib / formatBibliographyEntry', () => {
  it('formats a simple article entry in simplified IEEE style', () => {
    const entries = parseBibFile(bibFixture('single_entry.bib'));
    const entry = entries.get('lamport1994');

    expect(entry).toBeDefined();
    expect(formatBibliographyEntry(entry!, 1)).toBe(
      '[1] Leslie Lamport, "LaTeX: A Document Preparation System," *Software: Practice and Experience*, 1994.'
    );
  });

  it('falls back to booktitle when journal is not present', () => {
    const entries = parseBibFile(bibFixture('mixed_entry_types.bib'));
    const entry = entries.get('knuth1984');

    expect(entry).toBeDefined();
    expect(formatBibliographyEntry(entry!, 2)).toBe(
      '[2] Donald E. Knuth, "Literate Programming," *Proceedings of the ACM Symposium on Text Manipulation*, 1984.'
    );
  });

  it('formats a book entry without a venue when neither journal nor booktitle is present', () => {
    const entries = parseBibFile(bibFixture('mixed_entry_types.bib'));
    const entry = entries.get('aho2006');

    expect(entry).toBeDefined();
    expect(formatBibliographyEntry(entry!, 3)).toBe(
      '[3] Alfred V. Aho and Monica S. Lam and Ravi Sethi and Jeffrey D. Ullman, "Compilers: Principles, Techniques, and Tools," 2006.'
    );
  });

  it('uses Unknown when author is missing', () => {
    const entry = {
      key: 'missingauthor',
      entryType: 'article',
      fields: new Map<string, string>([
        ['title', 'Anonymous Work'],
        ['journal', 'Mystery Journal'],
        ['year', '2025']
      ])
    };

    expect(formatBibliographyEntry(entry, 7)).toBe(
      '[7] Unknown, "Anonymous Work," *Mystery Journal*, 2025.'
    );
  });

  it('omits missing title', () => {
    const entry = {
      key: 'notitle',
      entryType: 'article',
      fields: new Map<string, string>([
        ['author', 'Jane Doe'],
        ['journal', 'Journal of Tests'],
        ['year', '2025']
      ])
    };

    expect(formatBibliographyEntry(entry, 4)).toBe(
      '[4] Jane Doe, *Journal of Tests*, 2025.'
    );
  });

  it('omits missing venue', () => {
    const entry = {
      key: 'novenue',
      entryType: 'misc',
      fields: new Map<string, string>([
        ['author', 'Jane Doe'],
        ['title', 'Untethered Work'],
        ['year', '2025']
      ])
    };

    expect(formatBibliographyEntry(entry, 5)).toBe(
      '[5] Jane Doe, "Untethered Work," 2025.'
    );
  });

  it('omits missing year', () => {
    const entry = {
      key: 'noyear',
      entryType: 'article',
      fields: new Map<string, string>([
        ['author', 'Jane Doe'],
        ['title', 'Undated Work'],
        ['journal', 'Journal of Tests']
      ])
    };

    expect(formatBibliographyEntry(entry, 6)).toBe(
      '[6] Jane Doe, "Undated Work," *Journal of Tests*.'
    );
  });
});

describe('mdx bib / renderBibliographyMarkdown', () => {
  it('renders a bibliography for all cited entries found in the .bib file', () => {
    const citationState = scanNotebookCitations([
      'See ^lamport1994 and ^knuth1984 and ^turing1936.'
    ]);
    const entries = parseBibFile(bibFixture('multiple_entries.bib'));

    expect(renderBibliographyMarkdown(citationState, entries)).toBe(
      [
        '[1] Leslie Lamport, "LaTeX: A Document Preparation System," *Software: Practice and Experience*, 1994.',
        '[2] Donald E. Knuth, "Literate Programming," *The Computer Journal*, 1984.',
        '[3] Alan M. Turing, "On Computable Numbers, with an Application to the Entscheidungsproblem," *Proceedings of the London Mathematical Society*, 1936.'
      ].join('\n\n')
    );
  });

  it('renders entries in citation order rather than raw .bib order', () => {
    const citationState = scanNotebookCitations([
      'See ^knuth1984 and then ^lamport1994.'
    ]);
    const entries = parseBibFile(bibFixture('multiple_entries.bib'));

    expect(renderBibliographyMarkdown(citationState, entries)).toBe(
      [
        '[1] Donald E. Knuth, "Literate Programming," *The Computer Journal*, 1984.',
        '[2] Leslie Lamport, "LaTeX: A Document Preparation System," *Software: Practice and Experience*, 1994.'
      ].join('\n\n')
    );
  });

  it('renders each cited entry only once even if cited multiple times', () => {
    const citationState = scanNotebookCitations([
      'See ^lamport1994 and ^knuth1984.',
      'Then ^lamport1994 again.'
    ]);
    const entries = parseBibFile(bibFixture('multiple_entries.bib'));

    expect(renderBibliographyMarkdown(citationState, entries)).toBe(
      [
        '[1] Leslie Lamport, "LaTeX: A Document Preparation System," *Software: Practice and Experience*, 1994.',
        '[2] Donald E. Knuth, "Literate Programming," *The Computer Journal*, 1984.'
      ].join('\n\n')
    );
  });

  it('omits cited keys that are missing from the parsed bibliography', () => {
    const citationState = scanNotebookCitations([
      'See ^lamport1994 and ^missing2025.'
    ]);
    const entries = parseBibFile(bibFixture('single_entry.bib'));

    expect(renderBibliographyMarkdown(citationState, entries)).toBe(
      '[1] Leslie Lamport, "LaTeX: A Document Preparation System," *Software: Practice and Experience*, 1994.'
    );
  });

  it('returns empty string when no cited keys are found in the bibliography', () => {
    const citationState = scanNotebookCitations([
      'See ^missing2025 and ^anothermissing.'
    ]);
    const entries = parseBibFile(bibFixture('single_entry.bib'));

    expect(renderBibliographyMarkdown(citationState, entries)).toBe('');
  });

  it('returns empty string when there are no citations', () => {
    const citationState = scanNotebookCitations([
      'Plain text only.'
    ]);
    const entries = parseBibFile(bibFixture('multiple_entries.bib'));

    expect(renderBibliographyMarkdown(citationState, entries)).toBe('');
  });

  it('renders mixed entry types correctly', () => {
    const citationState = scanNotebookCitations([
      'See ^lamport1994 and ^knuth1984 and ^aho2006.'
    ]);
    const entries = parseBibFile(bibFixture('mixed_entry_types.bib'));

    expect(renderBibliographyMarkdown(citationState, entries)).toBe(
      [
        '[1] Leslie Lamport, "LaTeX: A Document Preparation System," *Software: Practice and Experience*, 1994.',
        '[2] Donald E. Knuth, "Literate Programming," *Proceedings of the ACM Symposium on Text Manipulation*, 1984.',
        '[3] Alfred V. Aho and Monica S. Lam and Ravi Sethi and Jeffrey D. Ullman, "Compilers: Principles, Techniques, and Tools," 2006.'
      ].join('\n\n')
    );
  });
});
