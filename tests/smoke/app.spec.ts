import { expect, test } from '@playwright/test';

test('runs the keyboard-only L01 prototype with visible non-navigation status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sailing Training Sloop — L01' })).toBeVisible();
  await expect(page.getByText('Simulation-only prototype • Unvalidated content • Not navigation, safety, or certification guidance.')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('starboard', { exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('PAUSED — explicit resume required; logical state is not progressing.')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('RUNNING — logical tick scheduler active.')).toBeVisible();
});

test('keeps reset attempts locally, supports delete, and makes no unexpected network request', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const navigation = page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sailing Training Sloop — L01' })).toBeVisible();
  await page.keyboard.press('R');
  await navigation;
  await expect(page.getByText(/Saved local attempts: 1\./)).toBeVisible();
  await expect(page.getByRole('button', { name: /Load attempt-/ })).toBeVisible();
  await page.getByRole('button', { name: /Delete attempt-/ }).click();
  await expect(page.getByText('No saved local attempts.')).toBeVisible();
  expect(requests.every((url) => url.startsWith('http://127.0.0.1:4173/'))).toBe(true);
});

test('uses visible focus and reduced-motion-safe styles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.keyboard.press('R');
  const button = page.getByRole('button', { name: /Load attempt-/ });
  await button.focus();
  await expect(button).toBeFocused();
  await expect(button).toHaveCSS('outline-style', 'solid');
});
