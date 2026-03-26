import { test, expect } from '@playwright/test';

test.describe('mdx named enumerations with single cell', () => {
  test('single fig label is numbered from the fig enumeration', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_named_fig_label.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('Figure 1 shows the system.');
  });

  test('fig reference resolves in the same cell', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_named_fig_reference_same_cell.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('Figure 1 shows the system.');
    await expect(renderedCell).toContainText('See 1.');
  });

  test('multiple fig labels number independently within fig enumeration', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_multiple_fig_labels.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('Figure 1 shows the first system.');
    await expect(renderedCell).toContainText('Figure 2 shows the second system.');
  });

  test('fig and eq enumerations each start at 1 in the same cell', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_multiple_named_enumerations.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('Figure 1 shows the system.');
    await expect(renderedCell).toContainText('Figure 2 shows the pipeline.');
    await expect(renderedCell).toContainText('\\tag{(1)}');
    await expect(renderedCell).toContainText('See 1 and 1.');
  });

  test('eq label inside $$ block renders as a parenthesized equation tag', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_eq_block_dollars.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('\\tag{(1)}');
  });

  test('eq label inside \\[ \\] block renders as a parenthesized equation tag', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_eq_block_brackets.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('\\tag{(1)}');
  });

  test('eq reference resolves in the same cell', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_eq_reference_same_cell.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('\\tag{(1)}');
    await expect(renderedCell).toContainText('See 1.');
  });

  test('same member name is allowed in fig and eq enumerations', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_fig_and_eq_same_member_name.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('Figure 1 shows the architecture.');
    await expect(renderedCell).toContainText('\\tag{(1)}');
    await expect(renderedCell).toContainText('See 1 and 1.');
  });

  test('same member name is allowed in global and fig enumerations', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_global_and_named_same_member_name.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('Step 1. Prepare the input.');
    await expect(renderedCell).toContainText('Figure 1 shows the pipeline.');
    await expect(renderedCell).toContainText('See 1 and 1.');
  });
});

test.describe('mdx named enumerations with multiple cells', () => {
  test('fig label then reference resolves across cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_fig_label_then_reference.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('Figure 1 shows the system.');
    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('See 1.');
  });

  test('forward fig reference resolves after full notebook scan', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_fig_reference_then_label_forward.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('See 1.');
    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('Figure 1 shows the system.');
  });

  test('multiple fig labels number correctly across cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_multiple_figs_with_later_references.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toContainText('Figure 1 shows the first architecture.');
    await expect(renderedCells.nth(1)).toContainText('Figure 2 shows the second architecture.');
    await expect(renderedCells.nth(2)).toContainText('See 1 and 2.');
  });

  test('eq label then reference resolves across cells with $$ delimiters', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_eq_label_then_reference_dollars.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toContainText('\\tag{(1)}');
    await expect(renderedCells.nth(1)).toContainText('See 1.');
  });

  test('eq label then reference resolves across cells with \\[ \\] delimiters', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_eq_label_then_reference_brackets.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toContainText('\\tag{(1)}');
    await expect(renderedCells.nth(1)).toContainText('See 1.');
  });

  test('forward eq reference resolves after full notebook scan', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_eq_reference_then_label_forward.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toContainText('See 1.');
    await expect(renderedCells.nth(1)).toContainText('\\tag{(1)}');
  });

  test('fig and eq cross references resolve across cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_fig_and_eq_cross_references.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toContainText('Figure 1 shows the system.');
    await expect(renderedCells.nth(1)).toContainText('\\tag{(1)}');
    await expect(renderedCells.nth(2)).toContainText('See 1 and 1.');
  });

  test('same member name is allowed in different named enumerations across cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_same_member_name_different_enumerations.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toContainText('Figure 1 shows the architecture.');
    await expect(renderedCells.nth(1)).toContainText('\\tag{(1)}');
    await expect(renderedCells.nth(2)).toContainText('See 1 and 1.');
  });

  test('same member name is allowed in global and named enumerations across cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_global_and_named_same_member_name.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toContainText('Step 1. Prepare the input.');
    await expect(renderedCells.nth(1)).toContainText('Figure 1 shows the pipeline.');
    await expect(renderedCells.nth(2)).toContainText('See 1 and 1.');
  });
});

test.describe('mdx named enumerations mixed with sections', () => {
  test('sections, figures, and equations number independently across cells', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_sections_figures_and_equations.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('Notebook Title');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('1. Introduction');
    await expect(renderedCells.nth(1)).toContainText('Figure 1 shows the system.');

    await expect(renderedCells.nth(2)).toBeVisible();
    await expect(renderedCells.nth(2)).toContainText('2. Methods');
    await expect(renderedCells.nth(2)).toContainText('\\tag{(1)}');

    await expect(renderedCells.nth(3)).toBeVisible();
    await expect(renderedCells.nth(3)).toContainText('See 1 in 1 and 1 in 2.');
  });

  test('named enumeration references coexist with section references', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_named_enumerations_with_section_references.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toContainText('1. Overview');
    await expect(renderedCells.nth(1)).toContainText('Figure 1 shows the full system.');
    await expect(renderedCells.nth(2)).toContainText('\\tag{(1)}');
    await expect(renderedCells.nth(3)).toContainText('In 1, see 1 and 1.');
  });
});

test.describe('mdx named enumerations invalid fixtures', () => {
  test('eq misuse in text shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_eq_misuse_in_text.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText(/eq|reserved|display math/i);

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('ReservedEnumerationMisuseError'))
    ).toBe(true);
  });

  test('eq misuse in heading shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_eq_misuse_in_heading.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText(/eq|reserved|display math/i);

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('ReservedEnumerationMisuseError'))
    ).toBe(true);
  });

  test('eq misuse in inline math shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_eq_misuse_inline_math.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText(/eq|reserved|display math/i);

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('ReservedEnumerationMisuseError'))
    ).toBe(true);
  });

  test('eq misuse in list item shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_eq_misuse_in_list_item.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText(/eq|reserved|display math/i);

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('ReservedEnumerationMisuseError'))
    ).toBe(true);
  });

  test('eq misuse across cells shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_eq_misuse_in_text_then_reference.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText(/eq|reserved|display math/i);

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('ReservedEnumerationMisuseError'))
    ).toBe(true);
  });

  test('eq misuse in heading across cells shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_eq_misuse_in_heading_then_reference.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText(/eq|reserved|display math/i);

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('ReservedEnumerationMisuseError'))
    ).toBe(true);
  });

  test('duplicate fig label in one cell shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_duplicate_named_fig.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('⚠ duplicate');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError'))
    ).toBe(true);
  });

  test('duplicate eq label in one cell shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_duplicate_named_eq.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('⚠ duplicate');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError'))
    ).toBe(true);
  });

  test('duplicate fig label across cells shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_duplicate_named_fig.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('Figure 1 shows the first architecture.');
    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('⚠ duplicate');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError'))
    ).toBe(true);
  });

  test('duplicate eq label across cells shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_duplicate_named_eq.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('\\tag{(1)}');
    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('⚠ duplicate');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError'))
    ).toBe(true);
  });

  test('duplicate named label between heading and body shows rendered warning and console error in one cell', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_duplicate_named_section_label.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('⚠ duplicate');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError'))
    ).toBe(true);
  });

  test('duplicate named label between heading and body shows rendered warning and console error across cells', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_duplicate_named_section_label.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('1. Overview');
    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('⚠ duplicate');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError'))
    ).toBe(true);
  });
});
