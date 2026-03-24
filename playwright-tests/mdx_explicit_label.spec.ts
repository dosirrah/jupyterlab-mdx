import { test, expect } from '@playwright/test';

test.describe('mdx explicit label with single cell', () => {
  test('plain markdown renders unchanged', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_plain_markdown.ipynb');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('Just plain markdown text.');
  });

  test('explicit heading label is hidden in rendered heading', async ({ page }) => {
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_explicit_label_only.ipynb');
  
    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('1. My Heading');
    await expect(renderedCell).not.toContainText('@foo');
  });

  test('explicit heading label resolves in same cell', async ({ page }) => {
    // notebook fixture cell:
    // "## @foo My Heading\n\nSee #foo."

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_explicit_heading_label.ipynb');
  
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
  
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_unresolved.ipynb');

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
    
    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_duplicate.ipynb');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();  
    await expect(renderedCell).toContainText('⚠ duplicate: @bar');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError') && m.includes('bar'))
    ).toBe(true);
  });

});
