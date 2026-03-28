import { test, expect } from '@playwright/test';

// md(page, n) returns the nth rendered markdown cell locator.
function md(page: any, n: number) {
  return page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').nth(n);
}

test.describe('mdx citations / bibliography-free fixtures', () => {
  test('single_cell_single_citation shows unresolved citation as [?] without bibliography', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_single_citation.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[?]');
  });

  test('single_cell_no_citations leaves plain markdown unchanged', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_no_citations.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('Plain paragraph text only.');
    await expect(md(page, 0)).not.toContainText('[1]');
    await expect(md(page, 0)).not.toContainText('[?]');
  });

  test('single_cell_bibliography_directive_no_src renders without crashing', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_bibliography_directive_no_src.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
  });
});

test.describe('mdx citations / bibliography directive fixtures', () => {
  test('single_cell_bibliography_directive_only renders without crashing', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_bibliography_directive_only.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
  });

  test('single_cell_multiple_bibliography_directives renders without crashing', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_multiple_bibliography_directives.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
  });

  test('single_cell_bibliography_directive_in_code does not activate a bibliography directive', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_bibliography_directive_in_code.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('::: bibliography');
  });

  test('single_cell_bibliography_directive_in_comment does not activate a bibliography directive', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_bibliography_directive_in_comment.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    // The directive is inside an HTML comment so it must not be processed:
    // no directive syntax, no bib filename, no bibliography entries, no citation numbers.
    await expect(md(page, 0)).not.toContainText(':::');
    await expect(md(page, 0)).not.toContainText('multiple_entries.bib');
    await expect(md(page, 0)).not.toContainText('Leslie Lamport');
    await expect(md(page, 0)).not.toContainText('[1]');
  });

  test('single_cell_bibliography_directive_outside_comment uses the visible directive', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_bibliography_directive_outside_comment.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    // The commented-out directive (ignored.bib) must not be processed.
    await expect(md(page, 0)).not.toContainText('ignored.bib');
  });
});

test.describe('mdx citations / notebooks with bibliography cells', () => {
  // Fixtures in this group are all-markdown notebooks unless noted.
  // Cell index in test == markdown cell index.

  test('single_cell_single_citation_with_bibliography renders one citation and one bibliography entry', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_single_citation_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).toContainText('LaTeX: A Document Preparation System');
    await expect(md(page, 1)).toContainText('Software: Practice and Experience');
    await expect(md(page, 1)).toContainText('1994');
  });

  test('single_cell_multiple_citations_with_bibliography numbers citations by first appearance', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_multiple_citations_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 0)).toContainText('[2]');
    await expect(md(page, 0)).toContainText('[3]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[2]');
    await expect(md(page, 1)).toContainText('[3]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).toContainText('Donald E. Knuth');
    await expect(md(page, 1)).toContainText('Alan M. Turing');
  });

  test('single_cell_repeated_citation_with_bibliography reuses the same citation number', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_repeated_citation_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 0)).not.toContainText('[2]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).not.toContainText('[2]');
  });

  test('multi_cell_single_citation_with_bibliography renders bibliography from single_entry.bib', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_single_citation_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
  });

  test('multi_cell_multiple_unique_citations_with_bibliography assigns increasing numbers across markdown cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_multiple_unique_citations_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[2]');
    await expect(md(page, 2)).toContainText('[3]');
    await expect(md(page, 3)).toContainText('[1]');
    await expect(md(page, 3)).toContainText('[2]');
    await expect(md(page, 3)).toContainText('[3]');
  });

  test('multi_cell_repeated_citation_with_bibliography preserves numbering for repeated citations in later cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_repeated_citation_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[2]');
    await expect(md(page, 2)).toContainText('[1]');
    await expect(md(page, 3)).toContainText('[1]');
    await expect(md(page, 3)).toContainText('[2]');
    await expect(md(page, 3)).not.toContainText('[3]');
  });

  test('multi_cell_mixed_citations_with_bibliography renders cited entries once in bibliography order', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_mixed_citations_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 0)).toContainText('[2]');
    await expect(md(page, 1)).toContainText('[2]');
    await expect(md(page, 1)).toContainText('[3]');
    await expect(md(page, 2)).toContainText('[1]');
    await expect(md(page, 3)).toContainText('[1]');
    await expect(md(page, 3)).toContainText('[2]');
    await expect(md(page, 3)).toContainText('[3]');
    await expect(md(page, 3)).toContainText('Leslie Lamport');
    await expect(md(page, 3)).toContainText('Donald E. Knuth');
    await expect(md(page, 3)).toContainText('Alan M. Turing');
  });

  test('multi_cell_with_plain_markdown_between_citations_with_bibliography ignores non-citation markdown cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_plain_markdown_between_citations_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 1)).not.toContainText('[1]');
    await expect(md(page, 2)).toContainText('[2]');
    await expect(md(page, 3)).toContainText('[1]');
    await expect(md(page, 3)).toContainText('[2]');
    await expect(md(page, 3)).not.toContainText('[3]');
  });

  test('multi_cell_with_multiple_plain_markdown_cells_with_bibliography ignores plain markdown around cited cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_multiple_plain_markdown_cells_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).not.toContainText('[1]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 2)).not.toContainText('[2]');
    await expect(md(page, 3)).toContainText('[2]');
    await expect(md(page, 3)).toContainText('[3]');
    await expect(md(page, 4)).not.toContainText('[4]');
    await expect(md(page, 5)).toContainText('[1]');
    await expect(md(page, 5)).toContainText('[2]');
    await expect(md(page, 5)).toContainText('[3]');
  });

  test('multi_cell_leading_and_trailing_plain_markdown_with_bibliography numbers only cited markdown cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_leading_and_trailing_plain_markdown_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).not.toContainText('[1]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 2)).not.toContainText('[2]');
    await expect(md(page, 3)).toContainText('[1]');
    await expect(md(page, 3)).toContainText('Leslie Lamport');
  });

  // Fixtures below mix markdown and code cells.
  // Comments show the full cell sequence; md() indices count only markdown cells.

  test('multi_cell_with_code_cell_between_citations_with_bibliography ignores code cells for citation numbering', async ({ page }) => {
    // [md, code, md, md] → md indices: 0, 1, 2
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_code_cell_between_citations_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');  // cell 0
    await expect(md(page, 1)).toContainText('[2]');  // cell 2
    await expect(md(page, 2)).toContainText('[1]');  // cell 3 (bib)
    await expect(md(page, 2)).toContainText('[2]');
    await expect(md(page, 2)).not.toContainText('[3]');
  });

  test('multi_cell_with_code_cell_containing_caret_text_with_bibliography ignores caret-like text in code cells', async ({ page }) => {
    // [md, code, md, md] → md indices: 0, 1, 2
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_code_cell_containing_caret_text_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');  // cell 0
    await expect(md(page, 1)).toContainText('[2]');  // cell 2
    await expect(md(page, 2)).toContainText('[1]');  // cell 3 (bib)
    await expect(md(page, 2)).toContainText('[2]');
    await expect(md(page, 2)).not.toContainText('[3]');
  });

  test('multi_cell_code_cells_only_one_markdown_citation_with_bibliography uses only markdown citations', async ({ page }) => {
    // [code, md, code, md] → md indices: 0, 1
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_code_cells_only_one_markdown_citation_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');  // cell 1
    await expect(md(page, 1)).toContainText('[1]');  // cell 3 (bib)
    await expect(md(page, 1)).toContainText('Donald E. Knuth');
    await expect(md(page, 1)).not.toContainText('Leslie Lamport');
    await expect(md(page, 1)).not.toContainText('Alan M. Turing');
  });

  test('multi_cell_markdown_and_code_mixed_with_bibliography handles mixed markdown and code cells', async ({ page }) => {
    // [md, code, md, code, md, md, md] → md indices: 0, 1, 2, 3, 4
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_markdown_and_code_mixed_with_bibliography.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 1)).toContainText('[1]');  // cell 2
    await expect(md(page, 1)).toContainText('[2]');
    await expect(md(page, 3)).toContainText('[3]');  // cell 5
    await expect(md(page, 4)).toContainText('[1]');  // cell 6 (bib)
    await expect(md(page, 4)).toContainText('[2]');
    await expect(md(page, 4)).toContainText('[3]');
  });

  test('multi_cell_with_bibliography_directive renders citations and bibliography from multiple_entries.bib', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_bibliography_directive.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 0)).toContainText('[2]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[2]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).toContainText('Donald E. Knuth');
    await expect(md(page, 1)).not.toContainText('Alan M. Turing');
  });

  test('multi_cell_bibliography_with_plain_markdown_and_code renders bibliography despite surrounding plain markdown and code', async ({ page }) => {
    // [md, code, md, md, md] → md indices: 0, 1, 2, 3
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_bibliography_with_plain_markdown_and_code.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 1)).toContainText('[1]');  // cell 2
    await expect(md(page, 3)).toContainText('[1]');  // cell 4 (bib)
    await expect(md(page, 3)).toContainText('Leslie Lamport');
    await expect(md(page, 3)).toContainText('LaTeX: A Document Preparation System');
  });

  test('multi_cell_bibliography_with_code_cell_containing_fake_directive ignores fake bibliography directive inside code', async ({ page }) => {
    // [md, code, md] → md indices: 0, 1
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_bibliography_with_code_cell_containing_fake_directive.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).not.toContainText('fake.bib');
  });
});

test.describe('mdx citations / bibliography fixture variants', () => {
  test('multi_cell_with_bibliography_directive_single_entry uses single_entry.bib', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_bibliography_directive_single_entry.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).not.toContainText('[2]');
  });

  test('multi_cell_with_bibliography_directive_multiple_entries uses multiple_entries.bib', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_bibliography_directive_multiple_entries.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 0)).toContainText('[2]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[2]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).toContainText('Donald E. Knuth');
    await expect(md(page, 1)).not.toContainText('Alan M. Turing');
  });

  test('multi_cell_with_bibliography_directive_subset_of_multiple_entries renders only cited entries from multiple_entries.bib', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_bibliography_directive_subset_of_multiple_entries.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[2]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).toContainText('Donald E. Knuth');
    await expect(md(page, 1)).not.toContainText('[3]');
    await expect(md(page, 1)).not.toContainText('Alan M. Turing');
  });

  test('multi_cell_with_bibliography_directive_mixed_entry_types uses mixed_entry_types.bib', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_bibliography_directive_mixed_entry_types.ipynb?reset');
    await expect(md(page, 0)).toBeVisible();
    await expect(md(page, 0)).toContainText('[1]');
    await expect(md(page, 0)).toContainText('[2]');
    await expect(md(page, 0)).toContainText('[3]');
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('[2]');
    await expect(md(page, 1)).toContainText('[3]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).toContainText('Donald E. Knuth');
    await expect(md(page, 1)).toContainText('Alfred V. Aho');
    await expect(md(page, 1)).toContainText('LaTeX: A Document Preparation System');
    await expect(md(page, 1)).toContainText('Literate Programming');
    await expect(md(page, 1)).toContainText('Compilers: Principles, Techniques, and Tools');
    await expect(md(page, 1)).toContainText('Software: Practice and Experience');
    await expect(md(page, 1)).toContainText('Proceedings of the ACM Symposium on Text Manipulation');
    await expect(md(page, 1)).toContainText('2006');
    await expect(md(page, 1)).not.toContainText('John McCarthy');
  });
});

test.describe('mdx citations / consistency model', () => {
  test('single_entry.bib renders simplified IEEE-style output', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_bibliography_directive_single_entry.ipynb?reset');
    await expect(md(page, 1)).toBeVisible();
    await expect(md(page, 1)).toContainText('[1]');
    await expect(md(page, 1)).toContainText('Leslie Lamport');
    await expect(md(page, 1)).toContainText('LaTeX: A Document Preparation System');
    await expect(md(page, 1)).toContainText('Software: Practice and Experience');
    await expect(md(page, 1)).toContainText('1994');
    // Verify the venue is rendered as italic (markdown *...* → <em>...</em>)
    await expect(md(page, 1).locator('em')).toContainText('Software: Practice and Experience');
  });

  test('bibliography renders entries in citation order, not raw .bib order', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_bibliography_directive_subset_of_multiple_entries.ipynb?reset');
    await expect(md(page, 1)).toBeVisible();
    const text = await md(page, 1).textContent() ?? '';
    const lamportPos = text.indexOf('Leslie Lamport');
    const knuthPos = text.indexOf('Donald E. Knuth');
    expect(lamportPos).toBeGreaterThanOrEqual(0);
    expect(knuthPos).toBeGreaterThan(lamportPos);
    expect(text).not.toContain('Alan M. Turing');
  });
});
