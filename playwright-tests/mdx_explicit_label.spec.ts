import { test, expect } from '@playwright/test';

test.describe('mdx explicit label with single cell', () => {
  test('plain markdown renders unchanged', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_plain_markdown.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('Just plain markdown text.');
  });

  test('explicit heading label is hidden in rendered heading', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_explicit_label_only.ipynb?reset');
  
    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('1. My Heading');
    await expect(renderedCell).not.toContainText('@foo');
  });

  test('explicit heading label resolves in same cell', async ({ page }) => {
    // notebook fixture cell:
    // "## @foo My Heading\n\nSee #foo."

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_explicit_heading_label.ipynb?reset');
  
    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('1. My Heading');
    await expect(renderedCell).not.toContainText('@foo');
    await expect(renderedCell).toContainText('See 1.');
  });

  test('unresolved reference is rendered visibly', async ({ page }) => {
    // notebook fixture cell:
    // ## @foo My Heading
    //
    // See #bar.
  
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_unresolved.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();  
    await expect(renderedCell).toContainText('1. My Heading');
    await expect(renderedCell).toContainText('⚠ unresolved: #bar');
  });

  test('duplicate explicit label shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];
  
    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // notebook fixture cell:
    // "## @bar First\n\n## @bar Second"
    
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_duplicate.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();  
    await expect(renderedCell).toContainText('⚠ duplicate: @bar');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError') && m.includes('bar'))
    ).toBe(true);
  });

});


test.describe('mdx explicit label with multiple cells', () => {
  test('explicit heading label resolves across cells', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "## @foo My Heading"
    // cell 2: "See #foo."

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_explicit_heading_label.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('1. My Heading');
    await expect(renderedCells.nth(0)).not.toContainText('@foo');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('See 1.');
  });

  test('later explicit labels increment numbering across cells', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "## @foo First Heading"
    // cell 2: "## @bar Second Heading\n\nSee #foo and #bar."

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_sequential_explicit_labels.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('1. First Heading');
    await expect(renderedCells.nth(0)).not.toContainText('@foo');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('2. Second Heading');
    await expect(renderedCells.nth(1)).not.toContainText('@bar');
    await expect(renderedCells.nth(1)).toContainText('See 1 and 2.');
  });

  test('forward reference resolves after full notebook scan', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "See #foo."
    // cell 2: "## @foo My Heading"

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_forward_reference.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('See 1.');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('1. My Heading');
    await expect(renderedCells.nth(1)).not.toContainText('@foo');
  });

  test('unresolved reference in another cell is rendered visibly', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "## @foo My Heading"
    // cell 2: "See #bar."

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_unresolved.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('1. My Heading');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('⚠ unresolved: #bar');
  });

  test('duplicate explicit label across cells shows rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];

    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // notebook fixture cells:
    // cell 1: "## @bar First"
    // cell 2: "## @bar Second"

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_duplicate.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('⚠ duplicate: @bar');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('⚠ duplicate: @bar');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError') && m.includes('bar'))
    ).toBe(true);
  });

  test('multiple references in later cell all resolve', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "## @foo First"
    // cell 2: "## @bar Second"
    // cell 3: "Refs: #foo, #bar."

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_multiple_references.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toContainText('1. First');
    await expect(renderedCells.nth(1)).toContainText('2. Second');
    await expect(renderedCells.nth(2)).toContainText('Refs: 1, 2.');
  });
});