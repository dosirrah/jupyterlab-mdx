import { test, expect } from '@playwright/test';

test.describe('mdx implicit label with single cell', () => {
  test('single heading renders with section number', async ({ page }) => {
    // notebook fixture cell:
    // "## My Heading"

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_single_section.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('1. My Heading');
  });

  test('subsection renders hierarchical numbering in same cell', async ({ page }) => {
    // notebook fixture cell:
    // "## First Section"
    // "### Subsection"

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_section_and_subsection.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('1. First Section');
    await expect(renderedCell).toContainText('1.1 Subsection');
  });

  test('implicit section reference resolves in same cell', async ({ page }) => {
    // notebook fixture cell:
    // "## Introduction"
    //
    // "See #introduction."

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_implicit_reference_same_cell.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('1. Introduction');
    await expect(renderedCell).toContainText('See 1.');
  });

  test('multiple implicit sections in one cell number correctly', async ({ page }) => {
    // notebook fixture cell:
    // "## One"
    // "### One One"
    // "## Two"

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_multiple_sections.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('1. One');
    await expect(renderedCell).toContainText('1.1 One One');
    await expect(renderedCell).toContainText('2. Two');
  });

  test('unresolved implicit reference is rendered visibly', async ({ page }) => {
    // notebook fixture cell:
    // "## Introduction"
    //
    // "See #does_not_exist."

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_implicit_unresolved.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('1. Introduction');
    await expect(renderedCell).toContainText('⚠ unresolved: #does_not_exist');
  });

  test('duplicate implicit labels show rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];

    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // notebook fixture cell:
    // "## Intro"
    // "## Intro"

    await page.goto('/lab/tree/playwright-tests/fixtures/single_cell_implicit_duplicate.ipynb?reset');

    const renderedCell = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon').first();
    await expect(renderedCell).toBeVisible();
    await expect(renderedCell).toContainText('⚠ duplicate');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError'))
    ).toBe(true);
  });
});

test.describe('mdx implicit label with multiple cells', () => {
  test('implicit section reference resolves across cells', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "# Introduction"
    // cell 2: "See #introduction."

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_implicit_reference.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('1. Introduction');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('See 1.');
  });

  test('top-level sections increment across cells', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "# First"
    // cell 2: "# Second"

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_top_level_sections.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('1. First');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('2. Second');
  });

  test('subsections continue correctly across cells', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "## First"
    // cell 2: "### Details"
    // cell 3: "### More Details"
    // cell 4: "## Second"

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_sections_and_subsections.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toContainText('1. First');
    await expect(renderedCells.nth(1)).toContainText('1.1 Details');
    await expect(renderedCells.nth(2)).toContainText('1.2 More Details');
    await expect(renderedCells.nth(3)).toContainText('2. Second');
  });

  test('subsection under second section resets numbering correctly', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "## First"
    // cell 2: "### First Child"
    // cell 3: "## Second"
    // cell 4: "### Second Child"

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_subsection_reset.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toContainText('1. First');
    await expect(renderedCells.nth(1)).toContainText('1.1 First Child');
    await expect(renderedCells.nth(2)).toContainText('2. Second');
    await expect(renderedCells.nth(3)).toContainText('2.1 Second Child');
  });

  test('deep hierarchy numbers correctly across cells', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "## A"
    // cell 2: "### B"
    // cell 3: "#### C"

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_deep_hierarchy.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toContainText('1. A');
    await expect(renderedCells.nth(1)).toContainText('1.1 B');
    await expect(renderedCells.nth(2)).toContainText('1.1.1 C');
  });

  test('forward implicit reference resolves after full notebook scan', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "See #discussion."
    // cell 2: "## Discussion"

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_implicit_forward_reference.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('See 1.');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('1. Discussion');
  });

  test('unresolved implicit reference in later cell is rendered visibly', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "## Introduction"
    // cell 2: "See #missing_section."

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_implicit_unresolved.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('1. Introduction');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('⚠ unresolved: #missing_section');
  });

  test('multiple implicit sections with a title', async ({ page }) => {
    // cell 1: "# My Title"
    // cell 2: "## Introduction"
    // cell 3: "See #missing_section."

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_with_title_and_sections.ipynb?reset');
    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');
   
    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('My Title');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('1. Introduction');

    await expect(renderedCells.nth(2)).toBeVisible();
    await expect(renderedCells.nth(2)).toContainText('⚠ unresolved: #missing_section');

  });


  test('duplicate implicit labels across cells show rendered warning and console error', async ({ page }) => {
    const consoleMessages: string[] = [];

    page.on('console', msg => {
      consoleMessages.push(msg.text());
    });

    // notebook fixture cells:
    // cell 1: "## Intro"
    // cell 2: "## Intro"

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_implicit_duplicate.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('1. Intro');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('⚠ duplicate');

    await expect.poll(() =>
      consoleMessages.some(m => m.includes('DuplicateLabelError'))
    ).toBe(true);
  });

  test('multiple implicit references in later cell all resolve', async ({ page }) => {
    // notebook fixture cells:
    // cell 1: "## Intro"
    // cell 2: "## Methods"
    // cell 3: "See #intro and #methods."

    await page.goto('/lab/tree/playwright-tests/fixtures/multi_cell_multiple_implicit_references.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toContainText('1. Intro');
    await expect(renderedCells.nth(1)).toContainText('2. Methods');
    await expect(renderedCells.nth(2)).toContainText('See 1 and 2.');
  });
});


test.describe('mdx implicit labels across more complicated markdown', () => {
  test('complicated notebook renders correct section numbers', async ({ page }) => {
   
    await page.goto('/lab/tree/playwright-tests/fixtures/complicated.ipynb?reset');

    const renderedCells = page.locator('.jp-MarkdownCell .jp-RenderedHTMLCommon');

    await expect(renderedCells.nth(0)).toBeVisible();
    await expect(renderedCells.nth(0)).toContainText('Spark Exact Quantile Analysis');

    await expect(renderedCells.nth(1)).toBeVisible();
    await expect(renderedCells.nth(1)).toContainText('1. Note on cross-references');

    await expect(renderedCells.nth(2)).toContainText('2. Computation Models');
    await expect(renderedCells.nth(2)).toContainText('2.1 Parallel Random-Access Machine (PRAM)');
    await expect(renderedCells.nth(2)).toContainText('2.2 Bulk-Synchronous Parallel (BSP)');
    await expect(renderedCells.nth(2)).toContainText('2.3 Coarse-Grained Multiprocessor (CGM)');
    await expect(renderedCells.nth(2)).toContainText('2.4 Spark Model');
    
    await expect(renderedCells.nth(3)).toContainText('Assumption:');

    await expect(renderedCells.nth(4)).toContainText('3. Performance Evaluation Procedure');

    await expect(renderedCells.nth(4)).toContainText('4. Sequential External-Memory Sample Sort');

    await expect(renderedCells.nth(5)).toContainText('5. Parallel Sorting by Regular Sampling (PSRS)');

    await expect(renderedCells.nth(6)).toContainText('5.1 PSRS BSP-style Time complexity');

    await expect(renderedCells.nth(7)).toContainText('6. Spark Sort');

  });
});
