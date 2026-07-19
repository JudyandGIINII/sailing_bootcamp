import { describe, expect, it } from 'vitest';
import { classifyLocalOnlyRequest, isAllowedLocalOnlyRequest, LOCAL_TEST_ORIGIN } from '../../src/app/local-network-policy.js';

describe('local-only browser request policy', () => {
  it('permits only configured-origin documents and static assets', () => {
    expect(classifyLocalOnlyRequest({ url: `${LOCAL_TEST_ORIGIN}/`, resourceType: 'document' })).toBe('allowed_local_document');
    expect(classifyLocalOnlyRequest({ url: `${LOCAL_TEST_ORIGIN}/assets/app.js`, resourceType: 'script' })).toBe('allowed_local_static_asset');
    expect(isAllowedLocalOnlyRequest({ url: `${LOCAL_TEST_ORIGIN}/assets/app.css`, resourceType: 'stylesheet' })).toBe(true);
  });

  it('denies external, active, and same-origin API or non-static requests', () => {
    expect(classifyLocalOnlyRequest({ url: 'https://example.test/app.js', resourceType: 'script' })).toBe('denied_external_origin');
    expect(classifyLocalOnlyRequest({ url: `${LOCAL_TEST_ORIGIN}/api/replay`, resourceType: 'fetch' })).toBe('denied_active_transport');
    expect(classifyLocalOnlyRequest({ url: `${LOCAL_TEST_ORIGIN}/socket`, resourceType: 'websocket' })).toBe('denied_active_transport');
    expect(classifyLocalOnlyRequest({ url: `${LOCAL_TEST_ORIGIN}/beacon`, resourceType: 'beacon' })).toBe('denied_active_transport');
    expect(classifyLocalOnlyRequest({ url: `${LOCAL_TEST_ORIGIN}/api/replay`, resourceType: 'document' })).toBe('denied_non_static_route');
    expect(classifyLocalOnlyRequest({ url: `${LOCAL_TEST_ORIGIN}/api/replay`, resourceType: 'xhr', method: 'POST' })).toBe('denied_active_transport');
    expect(classifyLocalOnlyRequest({ url: `${LOCAL_TEST_ORIGIN}/assets/app.js`, resourceType: 'script', method: 'POST' })).toBe('denied_non_get');
  });
});
