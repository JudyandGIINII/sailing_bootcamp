import { expect, test } from '@playwright/test';

test('renders the prototype browser shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sailing Training Sloop' })).toBeVisible();
});
