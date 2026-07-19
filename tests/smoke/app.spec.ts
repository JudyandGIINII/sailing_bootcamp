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

test('projects L02 through L05 as keyboard-operable, visible assumption-only lessons', async ({ page }) => {
  await page.goto('/');
  const lesson = page.getByLabel('Lesson');
  for (const [id, key, expected] of [
    ['L02', 'KeyM', 'declared-adjusted'], ['L03', 'KeyF', 'selected'], ['L04', 'ArrowLeft', 'recoverable_miss_recorded'], ['L05', 'KeyW', 'wait_recorded'],
  ] as const) {
    await lesson.selectOption(id);
    await expect(page.getByRole('heading', { name: `Sailing Training Sloop — ${id}` })).toBeVisible();
    await expect(page.getByText(/Every lesson is an assumption/)).toBeVisible();
    await page.keyboard.press(key);
    await expect(page.getByText(expected, { exact: true })).toBeVisible();
  }
});

test('ignores globally mapped keyboard actions disallowed by the selected lesson', async ({ page }) => {
  await page.goto('/');
  const lesson = page.getByLabel('Lesson');
  const hud = page.locator('#hud');
  const debrief = page.locator('#debrief');

  for (const [id, key, forbiddenState] of [
    ['L01', 'KeyF', 'selected'],
    ['L02', 'KeyF', 'selected'],
    ['L03', 'KeyP', 'pass_recorded'],
    ['L04', 'KeyW', 'wait_recorded'],
    ['L05', 'KeyM', 'declared-adjusted'],
  ] as const) {
    await lesson.selectOption(id);
    await expect(page.getByRole('heading', { name: `Sailing Training Sloop — ${id}` })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.getByText('PAUSED — explicit resume required; logical state is not progressing.')).toBeVisible();
    await expect(hud).toBeVisible();
    const canonicalState = await hud.textContent();

    await page.keyboard.press(key);

    await expect(hud).toHaveText(canonicalState ?? '');
    await expect(page.getByText(forbiddenState, { exact: true })).not.toBeVisible();
    await expect(debrief).not.toContainText('lesson checkpoint');
  }
});

test('fails closed for a malformed native IndexedDB raw payload and retains an aborted write', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('No saved local attempts.')).toBeVisible();
  await page.evaluate(async () => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('sailing-training-local-replays-v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const committed = db.transaction('replays', 'readwrite');
      committed.oncomplete = () => {
        const aborted = db.transaction('replays', 'readwrite');
        aborted.onabort = () => {
          const verify = db.transaction('replays', 'readonly');
          const read = verify.objectStore('replays').get('corrupt');
          read.onerror = () => reject(read.error);
          verify.onabort = () => reject(verify.error);
          verify.onerror = () => reject(verify.error);
          verify.oncomplete = () => {
            const record = read.result as { payload?: { legacy?: unknown } } | undefined;
            db.close();
            if (record?.payload?.legacy !== true) {
              reject(new Error('Aborted overwrite replaced the persisted malformed record.'));
              return;
            }
            resolve();
          };
        };
        aborted.objectStore('replays').put({ id: 'corrupt', created_at: 'synthetic', payload: {} });
        aborted.abort();
      };
      committed.onerror = () => reject(committed.error);
      committed.objectStore('replays').put({ id: 'corrupt', created_at: 'synthetic', payload: { legacy: true } });
    };
  }));
  await page.reload();
  await page.getByRole('button', { name: 'Load corrupt' }).click();
  await expect(page.getByText(/REPLAY_IDENTITY_MISSING.*Original local payload was preserved/)).toBeVisible();
});

test('has keyboard focus order and no beacon or websocket traffic', async ({ page }) => {
  const webSockets: string[] = []; const requests: string[] = [];
  page.on('websocket', (socket) => webSockets.push(socket.url()));
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Lesson')).toBeFocused();
  expect(webSockets).toEqual([]);
  expect(requests.every((url) => url.startsWith('http://127.0.0.1:4173/'))).toBe(true);
});
