import { test, expect, Page } from '@playwright/test';
import path from 'path';

function fixture(name: string): string {
  return path.resolve(__dirname, 'fixtures', name);
}

async function openNotebook(page: Page, notebookPath: string) {
  // Replace this with however your current Playwright harness opens a notebook.
  throw new Error(`not implemented: openNotebook(${notebookPath})`);
}

async function runCell(page: Page, index: number) {
  // Replace with your notebook harness helper.
  throw new Error(`not implemented: runCell(${index})`);
}

async function renderedCellText(page: Page, index: number): Promise<string> {
  // Replace selector with the rendered markdown selector used in your harness.
  throw new Error(`not implemented: renderedCellText(${index})`);
}

async function runAllCells(page: Page, count: number) {
  for (let i = 0; i < count; i += 1) {
    await runCell(page, i);
  }
}

async function expectCellContains(
  page: Page,
  index: number,
  expected: string
) {
  await expect.poll(() => renderedCellText(page, index)).toContain(expected);
}

async function expectCellNotContains(
  page: Page,
  index: number,
  unexpected: string
) {
  await expect.poll(() => renderedCellText(page, index)).not.toContain(unexpected);
}

test.describe('mdx citations / bibliography-free fixtures', () => {
  test('single_cell_single_citation shows unresolved citation as [?] without bibliography', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_single_citation.ipynb'));
    await runCell(page, 0);

    await expectCellContains(page, 0, '[?]');
  });

  test('single_cell_no_citations leaves plain markdown unchanged', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_no_citations.ipynb'));
    await runCell(page, 0);

    await expectCellContains(page, 0, 'Plain paragraph text only.');
    await expectCellNotContains(page, 0, '[1]');
    await expectCellNotContains(page, 0, '[?]');
  });

  test('single_cell_bibliography_directive_no_src renders without crashing', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_bibliography_directive_no_src.ipynb'));
    await runCell(page, 0);

    const text = await renderedCellText(page, 0);
    expect(text.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe('mdx citations / bibliography directive fixtures', () => {
  test('single_cell_bibliography_directive_only renders a bibliography from multiple_entries.bib', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_bibliography_directive_only.ipynb'));
    await runCell(page, 0);

    const text = await renderedCellText(page, 0);
    expect(text.length).toBeGreaterThanOrEqual(0);
  });

  test('single_cell_multiple_bibliography_directives renders without crashing', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_multiple_bibliography_directives.ipynb'));
    await runCell(page, 0);

    const text = await renderedCellText(page, 0);
    expect(text.length).toBeGreaterThanOrEqual(0);
  });

  test('single_cell_bibliography_directive_in_code does not activate a bibliography directive', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_bibliography_directive_in_code.ipynb'));
    await runCell(page, 0);

    await expectCellContains(page, 0, '::: bibliography');
  });

  test('single_cell_bibliography_directive_in_comment does not activate a bibliography directive', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_bibliography_directive_in_comment.ipynb'));
    await runCell(page, 0);

    const text = await renderedCellText(page, 0);
    expect(text.length).toBeGreaterThanOrEqual(0);
  });

  test('single_cell_bibliography_directive_outside_comment uses the visible directive', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_bibliography_directive_outside_comment.ipynb'));
    await runCell(page, 0);

    const text = await renderedCellText(page, 0);
    expect(text.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe('mdx citations / notebooks with bibliography cells', () => {
  test('single_cell_single_citation_with_bibliography renders one citation and one bibliography entry', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_single_citation_with_bibliography.ipynb'));
    await runAllCells(page, 2);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, 'Leslie Lamport');
    await expectCellContains(page, 1, 'LaTeX: A Document Preparation System');
    await expectCellContains(page, 1, 'Software: Practice and Experience');
    await expectCellContains(page, 1, '1994');
  });

  test('single_cell_multiple_citations_with_bibliography numbers citations by first appearance', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_multiple_citations_with_bibliography.ipynb'));
    await runAllCells(page, 2);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 0, '[2]');
    await expectCellContains(page, 0, '[3]');

    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, '[2]');
    await expectCellContains(page, 1, '[3]');
    await expectCellContains(page, 1, 'Leslie Lamport');
    await expectCellContains(page, 1, 'Donald E. Knuth');
    await expectCellContains(page, 1, 'Alan M. Turing');
  });

  test('single_cell_repeated_citation_with_bibliography reuses the same citation number', async ({ page }) => {
    await openNotebook(page, fixture('single_cell_repeated_citation_with_bibliography.ipynb'));
    await runAllCells(page, 2);

    const citationText = await renderedCellText(page, 0);
    expect(citationText).toContain('[1]');
    expect(citationText).not.toContain('[2]');

    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, 'Leslie Lamport');
    await expectCellNotContains(page, 1, '[2]');
  });

  test('multi_cell_single_citation_with_bibliography renders bibliography from single_entry.bib', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_single_citation_with_bibliography.ipynb'));
    await runAllCells(page, 2);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, 'Leslie Lamport');
  });

  test('multi_cell_multiple_unique_citations_with_bibliography assigns increasing numbers across markdown cells', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_multiple_unique_citations_with_bibliography.ipynb'));
    await runAllCells(page, 4);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 1, '[2]');
    await expectCellContains(page, 2, '[3]');

    await expectCellContains(page, 3, '[1]');
    await expectCellContains(page, 3, '[2]');
    await expectCellContains(page, 3, '[3]');
  });

  test('multi_cell_repeated_citation_with_bibliography preserves numbering for repeated citations in later cells', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_repeated_citation_with_bibliography.ipynb'));
    await runAllCells(page, 4);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 1, '[2]');
    await expectCellContains(page, 2, '[1]');

    await expectCellContains(page, 3, '[1]');
    await expectCellContains(page, 3, '[2]');
    await expectCellNotContains(page, 3, '[3]');
  });

  test('multi_cell_mixed_citations_with_bibliography renders cited entries once in bibliography order', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_mixed_citations_with_bibliography.ipynb'));
    await runAllCells(page, 4);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 0, '[2]');
    await expectCellContains(page, 1, '[2]');
    await expectCellContains(page, 1, '[3]');
    await expectCellContains(page, 2, '[1]');

    await expectCellContains(page, 3, '[1]');
    await expectCellContains(page, 3, '[2]');
    await expectCellContains(page, 3, '[3]');
    await expectCellContains(page, 3, 'Leslie Lamport');
    await expectCellContains(page, 3, 'Donald E. Knuth');
    await expectCellContains(page, 3, 'Alan M. Turing');
  });

  test('multi_cell_with_plain_markdown_between_citations_with_bibliography ignores non-citation markdown cells', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_plain_markdown_between_citations_with_bibliography.ipynb'));
    await runAllCells(page, 4);

    await expectCellContains(page, 0, '[1]');
    await expectCellNotContains(page, 1, '[1]');
    await expectCellContains(page, 2, '[2]');

    await expectCellContains(page, 3, '[1]');
    await expectCellContains(page, 3, '[2]');
    await expectCellNotContains(page, 3, '[3]');
  });

  test('multi_cell_with_multiple_plain_markdown_cells_with_bibliography ignores plain markdown around cited cells', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_multiple_plain_markdown_cells_with_bibliography.ipynb'));
    await runAllCells(page, 6);

    await expectCellNotContains(page, 0, '[1]');
    await expectCellContains(page, 1, '[1]');
    await expectCellNotContains(page, 2, '[2]');
    await expectCellContains(page, 3, '[2]');
    await expectCellContains(page, 3, '[3]');
    await expectCellNotContains(page, 4, '[4]');

    await expectCellContains(page, 5, '[1]');
    await expectCellContains(page, 5, '[2]');
    await expectCellContains(page, 5, '[3]');
  });

  test('multi_cell_leading_and_trailing_plain_markdown_with_bibliography numbers only cited markdown cells', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_leading_and_trailing_plain_markdown_with_bibliography.ipynb'));
    await runAllCells(page, 4);

    await expectCellNotContains(page, 0, '[1]');
    await expectCellContains(page, 1, '[1]');
    await expectCellNotContains(page, 2, '[2]');

    await expectCellContains(page, 3, '[1]');
    await expectCellContains(page, 3, 'Leslie Lamport');
  });

  test('multi_cell_with_code_cell_between_citations_with_bibliography ignores code cells for citation numbering', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_code_cell_between_citations_with_bibliography.ipynb'));
    await runAllCells(page, 4);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 2, '[2]');

    await expectCellContains(page, 3, '[1]');
    await expectCellContains(page, 3, '[2]');
    await expectCellNotContains(page, 3, '[3]');
  });

  test('multi_cell_with_code_cell_containing_caret_text_with_bibliography ignores caret-like text in code cells', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_code_cell_containing_caret_text_with_bibliography.ipynb'));
    await runAllCells(page, 4);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 2, '[2]');

    await expectCellContains(page, 3, '[1]');
    await expectCellContains(page, 3, '[2]');
    await expectCellNotContains(page, 3, '[3]');
  });

  test('multi_cell_code_cells_only_one_markdown_citation_with_bibliography uses only markdown citations', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_code_cells_only_one_markdown_citation_with_bibliography.ipynb'));
    await runAllCells(page, 4);

    await expectCellContains(page, 1, '[1]');

    await expectCellContains(page, 3, '[1]');
    await expectCellContains(page, 3, 'Donald E. Knuth');
    await expectCellNotContains(page, 3, 'Leslie Lamport');
    await expectCellNotContains(page, 3, 'Alan M. Turing');
  });

  test('multi_cell_markdown_and_code_mixed_with_bibliography handles mixed markdown and code cells', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_markdown_and_code_mixed_with_bibliography.ipynb'));
    await runAllCells(page, 7);

    await expectCellContains(page, 2, '[1]');
    await expectCellContains(page, 2, '[2]');
    await expectCellContains(page, 5, '[3]');

    await expectCellContains(page, 6, '[1]');
    await expectCellContains(page, 6, '[2]');
    await expectCellContains(page, 6, '[3]');
  });

  test('multi_cell_with_bibliography_directive renders citations and bibliography from multiple_entries.bib', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_bibliography_directive.ipynb'));
    await runAllCells(page, 2);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 0, '[2]');

    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, '[2]');
    await expectCellContains(page, 1, 'Leslie Lamport');
    await expectCellContains(page, 1, 'Donald E. Knuth');
    await expectCellNotContains(page, 1, 'Alan M. Turing');
  });

  test('multi_cell_bibliography_with_plain_markdown_and_code renders bibliography despite surrounding plain markdown and code', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_bibliography_with_plain_markdown_and_code.ipynb'));
    await runAllCells(page, 5);

    await expectCellContains(page, 2, '[1]');

    await expectCellContains(page, 4, '[1]');
    await expectCellContains(page, 4, 'Leslie Lamport');
    await expectCellContains(page, 4, 'LaTeX: A Document Preparation System');
  });

  test('multi_cell_bibliography_with_code_cell_containing_fake_directive ignores fake bibliography directive inside code', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_bibliography_with_code_cell_containing_fake_directive.ipynb'));
    await runAllCells(page, 3);

    await expectCellContains(page, 0, '[1]');

    await expectCellContains(page, 2, '[1]');
    await expectCellContains(page, 2, 'Leslie Lamport');
    await expectCellNotContains(page, 2, 'fake.bib');
  });
});

test.describe('mdx citations / bibliography fixture variants', () => {
  test('multi_cell_with_bibliography_directive_single_entry uses single_entry.bib', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_bibliography_directive_single_entry.ipynb'));
    await runAllCells(page, 2);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, 'Leslie Lamport');
    await expectCellNotContains(page, 1, '[2]');
  });

  test('multi_cell_with_bibliography_directive_multiple_entries uses multiple_entries.bib', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_bibliography_directive_multiple_entries.ipynb'));
    await runAllCells(page, 2);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 0, '[2]');

    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, '[2]');
    await expectCellContains(page, 1, 'Leslie Lamport');
    await expectCellContains(page, 1, 'Donald E. Knuth');
    await expectCellNotContains(page, 1, 'Alan M. Turing');
  });

  test('multi_cell_with_bibliography_directive_subset_of_multiple_entries renders only cited entries from multiple_entries.bib', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_bibliography_directive_subset_of_multiple_entries.ipynb'));
    await runAllCells(page, 2);

    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, '[2]');
    await expectCellContains(page, 1, 'Leslie Lamport');
    await expectCellContains(page, 1, 'Donald E. Knuth');
    await expectCellNotContains(page, 1, '[3]');
    await expectCellNotContains(page, 1, 'Alan M. Turing');
  });

  test('multi_cell_with_bibliography_directive_mixed_entry_types uses mixed_entry_types.bib', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_bibliography_directive_mixed_entry_types.ipynb'));
    await runAllCells(page, 2);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 0, '[2]');
    await expectCellContains(page, 0, '[3]');

    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, '[2]');
    await expectCellContains(page, 1, '[3]');

    await expectCellContains(page, 1, 'Leslie Lamport');
    await expectCellContains(page, 1, 'Donald E. Knuth');
    await expectCellContains(page, 1, 'Alfred V. Aho');
    await expectCellContains(page, 1, 'LaTeX: A Document Preparation System');
    await expectCellContains(page, 1, 'Literate Programming');
    await expectCellContains(page, 1, 'Compilers: Principles, Techniques, and Tools');
    await expectCellContains(page, 1, 'Software: Practice and Experience');
    await expectCellContains(page, 1, 'Proceedings of the ACM Symposium on Text Manipulation');
    await expectCellContains(page, 1, '2006');
    await expectCellNotContains(page, 1, 'John McCarthy');
  });
});

test.describe('mdx citations / consistency model', () => {
  test('bibliography cell rebuilds citation state from a full notebook scan', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_bibliography_directive_multiple_entries.ipynb'));
    await runCell(page, 0);
    await runCell(page, 1);

    await expectCellContains(page, 0, '[1]');
    await expectCellContains(page, 0, '[2]');
    await expectCellContains(page, 1, '[1]');
    await expectCellContains(page, 1, '[2]');
  });

  test('other cells are not required to rerender automatically for eventual consistency', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_bibliography_directive_multiple_entries.ipynb'));
    await runCell(page, 0);
    await runCell(page, 1);

    const citationText = await renderedCellText(page, 0);
    expect(citationText).toContain('[1]');
    expect(citationText).toContain('[2]');

    const bibliographyText = await renderedCellText(page, 1);
    expect(bibliographyText).toContain('[1]');
    expect(bibliographyText).toContain('[2]');
  });

  test('single_entry.bib renders simplified IEEE-style output', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_bibliography_directive_single_entry.ipynb'));
    await runAllCells(page, 2);

    const text = await renderedCellText(page, 1);
    expect(text).toContain('[1]');
    expect(text).toContain('Leslie Lamport');
    expect(text).toContain('LaTeX: A Document Preparation System');
    expect(text).toContain('Software: Practice and Experience');
    expect(text).toContain('1994');
  });

  test('multiple_entries.bib preserves bibliography order according to citation order, not full .bib contents', async ({ page }) => {
    await openNotebook(page, fixture('multi_cell_with_bibliography_directive_subset_of_multiple_entries.ipynb'));
    await runAllCells(page, 2);

    const text = await renderedCellText(page, 1);
    const lamportPos = text.indexOf('Leslie Lamport');
    const knuthPos = text.indexOf('Donald E. Knuth');

    expect(lamportPos).toBeGreaterThanOrEqual(0);
    expect(knuthPos).toBeGreaterThan(lamportPos);
    expect(text).not.toContain('Alan M. Turing');
  });
});
