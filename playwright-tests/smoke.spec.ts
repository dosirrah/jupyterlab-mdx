import { test, expect } from '@playwright/test';

test('JupyterLab loads', async ({ page }) => {
  const response = await page.goto('/lab');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveURL(/\/lab/);
});

