import { test, expect } from '@playwright/test';

test('MDX extension loads', async ({ page }) => {
  const logs: string[] = [];

  page.on('console', msg => {
    logs.push(msg.text());
  });

  await page.goto('/lab');

  await expect.poll(() =>
    logs.some(l => l.includes('MDX LOAD OK'))
  ).toBeTruthy();
});

