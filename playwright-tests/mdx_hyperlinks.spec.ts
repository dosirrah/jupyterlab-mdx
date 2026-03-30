import { test, expect } from '@playwright/test';

test.describe('mdx hyperlinks — anchors and hrefs in DOM', () => {

  test.describe('implicit section label', () => {
    test('anchor is injected for implicit section heading', async ({ page }) => {
      // notebook fixture cell:
      // "## Introduction\n\nSee #introduction."
      await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_implicit_reference_same_cell.ipynb?reset');

      const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
      await expect(renderedCell).toBeVisible();

      await expect(renderedCell.locator('a[id="introduction"]')).toBeAttached();
    });

    test('reference to implicit section becomes href link', async ({ page }) => {
      // notebook fixture cell:
      // "## Introduction\n\nSee #introduction."
      await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_implicit_reference_same_cell.ipynb?reset');

      const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
      await expect(renderedCell).toBeVisible();

      const link = renderedCell.locator('a[href="#introduction"]');
      await expect(link).toBeAttached();
      await expect(link).toHaveText('1');
    });
  });

  test.describe('explicit section label', () => {
    test('anchor is injected for explicit heading label in same cell', async ({ page }) => {
      // notebook fixture cell:
      // "## @foo My Heading\n\nSee #foo."
      await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_explicit_heading_label.ipynb?reset');

      const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
      await expect(renderedCell).toBeVisible();

      await expect(renderedCell.locator('a[id="foo"]')).toBeAttached();
    });

    test('reference to explicit label becomes href link in same cell', async ({ page }) => {
      // notebook fixture cell:
      // "## @foo My Heading\n\nSee #foo."
      await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_explicit_heading_label.ipynb?reset');

      const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
      await expect(renderedCell).toBeVisible();

      const link = renderedCell.locator('a[href="#foo"]');
      await expect(link).toBeAttached();
      await expect(link).toHaveText('1');
    });

    test('anchor is injected in cell containing the explicit label', async ({ page }) => {
      // notebook fixture cells:
      // cell 1: "## @foo My Heading"
      // cell 2: "See #foo."
      await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_explicit_heading_label.ipynb?reset');

      const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
      await expect(renderedCells.nth(0)).toBeVisible();

      await expect(renderedCells.nth(0).locator('a[id="foo"]')).toBeAttached();
    });

    test('reference to explicit label in another cell becomes href link', async ({ page }) => {
      // notebook fixture cells:
      // cell 1: "## @foo My Heading"
      // cell 2: "See #foo."
      await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_explicit_heading_label.ipynb?reset');

      const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
      await expect(renderedCells.nth(1)).toBeVisible();

      const link = renderedCells.nth(1).locator('a[href="#foo"]');
      await expect(link).toBeAttached();
      await expect(link).toHaveText('1');
    });
  });

  test.describe('named enumeration label', () => {
    test('anchor uses dash instead of colon for named enumeration label', async ({ page }) => {
      // notebook fixture cell:
      // "Figure @fig:architecture shows the system."
      await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_named_fig_label.ipynb?reset');

      const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
      await expect(renderedCell).toBeVisible();

      // colon replaced with dash: fig:architecture → fig-architecture
      await expect(renderedCell.locator('a[id="fig-architecture"]')).toBeAttached();
    });

    test('reference to named enumeration label becomes href link with dash', async ({ page }) => {
      // notebook fixture cells:
      // cell 1: "Figure @fig:architecture shows the system."
      // cell 2: "See #fig:architecture."
      await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_fig_label_then_reference.ipynb?reset');

      const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
      await expect(renderedCells.nth(1)).toBeVisible();

      const link = renderedCells.nth(1).locator('a[href="#fig-architecture"]');
      await expect(link).toBeAttached();
      await expect(link).toHaveText('1');
    });
  });

  test.describe('citation hyperlinks', () => {
    test('citation reference becomes href link to bibliography entry', async ({ page }) => {
      // notebook fixture cells:
      // cell 0: "See ^lamport1994."
      // cell 1: "::: bibliography\nsrc: single_entry.bib\n:::"
      await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_single_citation_with_bibliography.ipynb?reset');

      const citationCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').nth(0);
      await expect(citationCell).toBeVisible();

      const link = citationCell.locator('a[href="#cite-lamport1994"]');
      await expect(link).toBeAttached();
      await expect(link).toHaveText('[1]');
    });

    test('bibliography block has anchor for each entry', async ({ page }) => {
      // notebook fixture cells:
      // cell 0: "See ^lamport1994."
      // cell 1: "::: bibliography\nsrc: single_entry.bib\n:::"
      await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_single_citation_with_bibliography.ipynb?reset');

      const bibCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').nth(1);
      await expect(bibCell).toBeVisible();

      await expect(bibCell.locator('a[id="cite-lamport1994"]')).toBeAttached();
    });

    test('multiple citation references each become href links with correct numbers', async ({ page }) => {
      // notebook fixture cells:
      // cell 0: "See ^lamport1994 and ^knuth1984."
      // cell 1: "::: bibliography\nsrc: multiple_entries.bib\n:::"
      await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_bibliography_directive_multiple_entries.ipynb?reset');

      const citationCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').nth(0);
      await expect(citationCell).toBeVisible();

      await expect(citationCell.locator('a[href="#cite-lamport1994"]')).toHaveText('[1]');
      await expect(citationCell.locator('a[href="#cite-knuth1984"]')).toHaveText('[2]');
    });

    test('bibliography block has anchors for each of multiple entries', async ({ page }) => {
      // notebook fixture cells:
      // cell 0: "See ^lamport1994 and ^knuth1984."
      // cell 1: "::: bibliography\nsrc: multiple_entries.bib\n:::"
      await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_bibliography_directive_multiple_entries.ipynb?reset');

      const bibCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').nth(1);
      await expect(bibCell).toBeVisible();

      await expect(bibCell.locator('a[id="cite-lamport1994"]')).toBeAttached();
      await expect(bibCell.locator('a[id="cite-knuth1984"]')).toBeAttached();
    });
  });

});
