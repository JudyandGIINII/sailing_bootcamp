import { expect, test } from '@playwright/test';
import { classifyLocalOnlyRequest } from '../../src/app/local-network-policy.js';

test('runs the keyboard-only L01 prototype with visible non-navigation status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sailing Training Sloop — L01' })).toBeVisible();
  await expect(page.getByText('Simulation-only prototype • Unvalidated content • Not navigation, safety, or certification guidance.')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#debrief')).toContainText('action recorded');
  await page.keyboard.press('Space');
  await expect(page.getByText('PAUSED — explicit resume required; logical state is not progressing.')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByText('RUNNING — logical tick scheduler active.')).toBeVisible();
});

test('keeps reset attempts locally, supports delete, and makes no unexpected network request', async ({ page }) => {
  const requests: { url: string; resourceType: string; method: string }[] = [];
  page.on('request', (request) => requests.push({ url: request.url(), resourceType: request.resourceType(), method: request.method() }));
  const navigation = page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sailing Training Sloop — L01' })).toBeVisible();
  await page.keyboard.press('R');
  await navigation;
  await expect(page.getByText(/Saved local attempts: 1\./)).toBeVisible();
  await expect(page.getByRole('button', { name: /Load attempt-/ })).toBeVisible();
  await page.getByRole('button', { name: /Delete attempt-/ }).click();
  await expect(page.getByText('No saved local attempts.')).toBeVisible();
  expect(requests.map((request) => classifyLocalOnlyRequest(request)).every((classification) => classification.startsWith('allowed_'))).toBe(true);
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

test('projects L02 through L05 as keyboard-operable, manifest-only observation HUDs', async ({ page }) => {
  await page.goto('/');
  const lesson = page.locator('#lesson-select');
  for (const [id, key, observation] of [
    ['L02', 'KeyM', 'Declared trim feedback / 선언된 트림 피드백'], ['L03', 'KeyF', 'Synthetic gust/wave cue / 합성 돌풍·파도 신호'], ['L04', 'ArrowLeft', 'Declared virtual mark relation / 선언된 가상 마크 관계'], ['L05', 'KeyW', 'Synthetic tide state / 합성 조류 상태'],
  ] as const) {
    await lesson.selectOption(id);
    await expect(page.getByRole('heading', { name: `Sailing Training Sloop — ${id}` })).toBeVisible();
    await expect(page.getByText(/Every lesson is an assumption/)).toBeVisible();
    await expect(page.locator('#hud')).toContainText(observation);
    await expect(page.locator('#hud')).toContainText(/declared_(synthetic|unavailable)/);
    await page.keyboard.press(key);
    await expect(page.locator('#debrief')).toContainText('action recorded');
  }
});

test('reaches the L03 trace and debrief by keyboard with textual evidence and boundaries', async ({ page }) => {
  await page.goto('/');
  await page.locator('select#lesson-select').selectOption('L03');
  await page.keyboard.press('Space');

  await expect(page.getByRole('heading', { name: 'Sailing Training Sloop — L03' })).toBeVisible();
  await expect(page.getByText('PAUSED — explicit resume required; logical state is not progressing.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'L03 trace' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Static lesson-manifest declaration' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current runtime trace' })).toBeVisible();
  await expect(page.locator('#l03-static-trace')).toContainText('not a runtime record');
  await expect(page.locator('#l03-runtime-trace')).toContainText('Unavailable: no runtime record.');

  await page.keyboard.press('Space');
  await page.keyboard.press('KeyF');
  await expect(page.locator('#l03-runtime-trace')).toContainText('Synthetic episode evidence');
  await expect(page.locator('#l03-runtime-trace')).toContainText('Registered reef action evidence');
  await expect(page.locator('#l03-runtime-trace')).toContainText('Declared checkpoint evidence');
  await expect(page.locator('#l03-runtime-trace')).toContainText('Event ID:');
  await expect(page.locator('#l03-runtime-trace')).toContainText('Recorded cause reference:');
  await expect(page.locator('#debrief')).toContainText('Static lesson-manifest declaration');
  await expect(page.locator('#debrief')).toContainText('Current runtime trace');
  await expect(page.locator('#l03-trace-boundary')).toHaveText('Simulation-only runtime trace. Unvalidated content. Not navigation or safety guidance.');
  await expect(page.locator('#l03-trace-section')).not.toContainText(/\b(?:knot|meter|mile|degree|second|minute|hour|bearing|threshold)\b/i);
});

test('renders uniquely named L04 runtime evidence from keyboard actions without conflating it with static declarations', async ({ page }) => {
  const requests: { url: string; resourceType: string; method: string }[] = [];
  page.on('request', (request) => requests.push({ url: request.url(), resourceType: request.resourceType(), method: request.method() }));
  await page.goto('/');

  await page.keyboard.press('Tab');
  const lesson = page.locator('#lesson-select');
  await expect(lesson).toBeFocused();
  await lesson.selectOption('L04');

  const l04Region = page.getByRole('region', { name: 'L04 runtime-evidence trace', exact: true });
  const staticDeclarations = page.locator('#l04-static-declarations');
  const runtimeEvidence = page.locator('#l04-runtime-evidence');
  await expect(l04Region).toHaveCount(1);
  await expect(l04Region).toBeVisible();
  await expect(page.getByRole('heading', { name: 'L04 static lesson-manifest declarations', exact: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'L04 runtime evidence', exact: true })).toHaveCount(1);
  await expect(staticDeclarations).toHaveCount(1);
  await expect(runtimeEvidence).toHaveCount(1);
  await expect(staticDeclarations).toContainText('static declaration, not runtime evidence');
  await expect(runtimeEvidence).toContainText('Unavailable: no matching L04 runtime record.');

  await page.keyboard.press('ArrowLeft');
  await expect(runtimeEvidence).toContainText('Recoverable synthetic mark miss runtime evidence');
  await expect(runtimeEvidence).toContainText('Recorded L04 runtime evidence. Event ID:');
  await expect(runtimeEvidence).toContainText('Explicit cause: recoverable synthetic mark miss recorded.');
  await expect(runtimeEvidence).toContainText('Unavailable: no matching L04 runtime record.');

  await page.keyboard.press('ArrowRight');
  await expect(runtimeEvidence).toContainText('Slower valid synthetic correction runtime evidence');
  await expect(runtimeEvidence).toContainText('Explicit cause: slower valid synthetic correction recorded.');
  await expect(page.getByText('Simulation-only runtime evidence. Unvalidated content. Not navigation or safety guidance.', { exact: true })).toHaveCount(1);
  await expect(page.getByText('L04 runtime evidence', { exact: true })).toHaveCount(1);
  await expect(page.getByText('L04 static lesson-manifest declarations', { exact: true })).toHaveCount(1);
  expect(requests.map((request) => classifyLocalOnlyRequest(request)).every((classification) => classification.startsWith('allowed_'))).toBe(true);
});

test('ignores globally mapped keyboard actions disallowed by the selected lesson', async ({ page }) => {
  await page.goto('/');
  const lesson = page.locator('#lesson-select');
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
  const webSockets: string[] = []; const requests: { url: string; resourceType: string; method: string }[] = [];
  page.on('websocket', (socket) => webSockets.push(socket.url()));
  page.on('request', (request) => requests.push({ url: request.url(), resourceType: request.resourceType(), method: request.method() }));
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.locator('#lesson-select')).toBeFocused();
  const cadence = page.getByLabel('Browser update cadence');
  await cadence.selectOption('125');
  await expect(cadence).toHaveValue('125');
  await cadence.selectOption('500');
  await expect(cadence).toHaveValue('500');
  await page.keyboard.press('Space');
  await expect(page.getByText('PAUSED — explicit resume required; logical state is not progressing.')).toBeVisible();
  expect(webSockets).toEqual([]);
  expect(requests.map((request) => classifyLocalOnlyRequest(request)).every((classification) => classification.startsWith('allowed_'))).toBe(true);
});

test('denies every active browser transport before dispatch with a stable local-only reason', async ({ page }) => {
  const forbiddenRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/transport-denial')) forbiddenRequests.push(request.url());
  });
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const denial = (error: unknown) => {
      const candidate = error as { name?: unknown; code?: unknown; message?: unknown };
      return `${candidate.name}:${candidate.code}:${candidate.message}`;
    };
    const fetchResult = await fetch('/api/transport-denial').then(() => 'accepted', denial);
    const xhrOpenResult = (() => {
      try { new XMLHttpRequest().open('GET', '/api/transport-denial'); return 'accepted'; }
      catch (error) { return denial(error); }
    })();
    const xhrSendResult = (() => {
      try { new XMLHttpRequest().send(); return 'accepted'; }
      catch (error) { return denial(error); }
    })();
    const socketResult = (() => {
      try { new WebSocket('ws://127.0.0.1:4173/api/transport-denial'); return 'accepted'; }
      catch (error) { return denial(error); }
    })();
    const beaconResult = (() => {
      try { navigator.sendBeacon('/api/transport-denial', 'x'); return 'accepted'; }
      catch (error) { return denial(error); }
    })();
    return { fetchResult, xhrOpenResult, xhrSendResult, socketResult, beaconResult };
  });
  for (const result of Object.values(results)) {
    expect(result).toBe('LocalOnlyTransportDeniedError:LOCAL_ONLY_TRANSPORT_DENIED:LOCAL_ONLY_TRANSPORT_DENIED');
  }
  expect(forbiddenRequests).toEqual([]);
});
