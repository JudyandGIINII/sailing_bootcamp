import { expect, test } from '@playwright/test';

async function beginAttempt(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Before you begin' })).toBeVisible();
  await page.getByRole('button', { name: 'Enter active play' }).click();
  await expect(page.getByRole('heading', { name: 'Abstract synthetic world' })).toBeVisible();
}

async function endAttempt(page: import('@playwright/test').Page): Promise<void> {
  await page.getByRole('button', { name: 'End Voyage' }).click();
  await expect(page.getByRole('heading', { name: 'End Voyage?' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm End Voyage' }).click();
  await expect(page.getByRole('heading', { name: 'Frozen synthetic debrief' })).toBeVisible();
}

test('P5 supports a keyboard-only baseline, retry comparison, reload clearing, and no persistence access', async ({ page }) => {
  const persistenceAccess: string[] = [];
  const unexpectedHttp: string[] = [];
  page.on('console', (message) => { if (message.type() === 'warning') persistenceAccess.push(message.text()); });
  page.on('request', (request) => { if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') unexpectedHttp.push(request.url()); });
  await page.addInitScript(() => {
    for (const name of ['localStorage', 'sessionStorage', 'indexedDB'] as const) {
      Object.defineProperty(window, name, { configurable: true, get() { console.warn(`P5 forbidden persistence access: ${name}`); return undefined; } });
    }
  });
  await page.goto('/scenario1-p5.html');
  await expect(page.getByText('Synthetic, unvalidated, memory-only training display.')).toBeVisible();
  await beginAttempt(page);
  const headingButton = page.getByRole('button', { name: 'Heading +100' });
  await headingButton.focus();
  await expect(headingButton).toBeFocused();
  await expect(headingButton).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Synthetic control committed in canonical logical order.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Heading +100' })).toBeFocused();
  await page.getByRole('button', { name: 'Heading +100' }).evaluate((button) => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
  });
  await expect(page.getByRole('button', { name: 'Heading +100' })).toBeFocused();
  const mainToggle = page.getByRole('button', { name: 'Retract main' });
  await mainToggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Deploy main' })).toBeFocused();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.locator('#hud')).toContainText('paused');
  await expect(page.getByRole('button', { name: 'Heading +100' })).toBeDisabled();
  await page.getByRole('button', { name: 'Resume' }).click();
  await endAttempt(page);
  await expect(page.getByText('No prior same-condition comparison is available')).toBeVisible();
  await page.getByRole('button', { name: 'Retry same seed' }).click();
  await page.getByRole('button', { name: 'Engine +100' }).click();
  await endAttempt(page);
  await expect(page.getByRole('heading', { name: 'Previous/current comparison' })).toBeVisible();
  const scoreComparison = page.getByRole('table', { name: 'Frozen score and contributors' });
  await expect(scoreComparison).toBeVisible();
  await expect(scoreComparison).toContainText('Previous');
  await expect(scoreComparison).toContainText('Current');
  await expect(scoreComparison).toContainText('Difference (current − previous)');
  await expect(scoreComparison).toContainText('Score');
  await expect(scoreComparison).toContainText('Sail fit contributor');
  await expect(scoreComparison).toContainText('Course contributor');
  await expect(scoreComparison).toContainText('Propulsion contributor');
  await expect(scoreComparison).toContainText('Propulsion penalty contributor');
  await expect(page.getByText('Action traces are canonical logical-order associations only')).toBeVisible();
  expect(persistenceAccess).toEqual([]);
  expect(unexpectedHttp).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Scenario 1 — Synthetic Debrief Comparison', exact: true })).toBeVisible();
  await expect(page.getByText('This page keeps at most two eligible terminated attempts only until reload or navigation.')).toBeVisible();
  await beginAttempt(page);
  await endAttempt(page);
  await expect(page.getByText('No prior same-condition comparison is available')).toBeVisible();
});

test.describe('P5 narrow touch controls and visibility', () => {
  test.use({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true });

  test('keeps controls and comparison usable without visibility-driven records', async ({ page }) => {
    await page.goto('/scenario1-p5.html');
    await beginAttempt(page);
    await expect(page.getByRole('button', { name: 'Engine +100' })).toBeVisible();
    await page.getByRole('button', { name: 'Engine +100' }).tap();
    await endAttempt(page);
    await page.getByRole('button', { name: 'Retry same seed' }).tap();
    await page.getByRole('button', { name: 'Heading +100' }).tap();
    await endAttempt(page);
    await expect(page.getByRole('heading', { name: 'Previous/current comparison' })).toBeVisible();
    await expect(page.getByText('Controls: changed')).toBeVisible();
    const scoreScrollRegion = page.getByRole('region', { name: 'Frozen score and contributors: horizontal scroll region' });
    await scoreScrollRegion.focus();
    await expect(scoreScrollRegion).toBeFocused();
    expect(await scoreScrollRegion.evaluate((region) => region.scrollWidth > region.clientWidth)).toBe(true);
    await page.keyboard.press('ArrowRight');
    expect(await scoreScrollRegion.evaluate((region) => region.scrollLeft)).toBeGreaterThan(0);
    const scoreBefore = await page.locator('#debrief-status').textContent();
    const comparisonBefore = await page.locator('#comparison').innerText();
    const trace = page.getByRole('table', { name: 'Current action trace' });
    const traceBefore = await trace.locator('tbody tr').allTextContents();
    await page.evaluate(() => {
      let visibilityState: DocumentVisibilityState = 'hidden';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibilityState });
      document.dispatchEvent(new Event('visibilitychange'));
      visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await expect(page.locator('#debrief-status')).toHaveText(scoreBefore ?? '');
    expect(await page.locator('#comparison').innerText()).toBe(comparisonBefore);
    expect(await trace.locator('tbody tr').allTextContents()).toEqual(traceBefore);
  });
});
