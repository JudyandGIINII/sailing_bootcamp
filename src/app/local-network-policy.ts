export const LOCAL_TEST_ORIGIN = 'http://127.0.0.1:4173';
export const LOCAL_ONLY_TRANSPORT_DENIAL_CODE = 'LOCAL_ONLY_TRANSPORT_DENIED';

export type BrowserRequestResource = 'document' | 'stylesheet' | 'script' | 'image' | 'font' | 'media' | 'manifest' | 'fetch' | 'xhr' | 'websocket' | 'beacon' | string;
export interface BrowserRequestDescriptor {
  readonly url: string;
  readonly resourceType: BrowserRequestResource;
  readonly method?: string;
}
export type LocalRequestClassification =
  | 'allowed_local_document'
  | 'allowed_local_static_asset'
  | 'denied_invalid_url'
  | 'denied_external_origin'
  | 'denied_non_get'
  | 'denied_active_transport'
  | 'denied_non_static_route';

const staticResources = new Set(['stylesheet', 'script', 'image', 'font', 'media', 'manifest']);
const staticPath = /(?:^\/assets\/|\.(?:css|js|mjs|map|png|jpe?g|gif|svg|ico|webp|avif|woff2?|ttf|otf|mp3|mp4|webm|json)$)/i;

/** Pure browser-observation policy; it authorizes only local documents and static assets. */
export function classifyLocalOnlyRequest(
  request: BrowserRequestDescriptor,
  configuredOrigin: string = LOCAL_TEST_ORIGIN,
): LocalRequestClassification {
  let url: URL;
  try { url = new URL(request.url); } catch { return 'denied_invalid_url'; }
  if (url.origin !== configuredOrigin) return 'denied_external_origin';
  if (['fetch', 'xhr', 'websocket', 'beacon'].includes(request.resourceType)) return 'denied_active_transport';
  if ((request.method ?? 'GET').toUpperCase() !== 'GET') return 'denied_non_get';
  if (request.resourceType === 'document' && (url.pathname === '/' || url.pathname === '/index.html')) return 'allowed_local_document';
  if (staticResources.has(request.resourceType) && staticPath.test(url.pathname)) return 'allowed_local_static_asset';
  return 'denied_non_static_route';
}

export function isAllowedLocalOnlyRequest(
  request: BrowserRequestDescriptor,
  configuredOrigin: string = LOCAL_TEST_ORIGIN,
): boolean {
  return classifyLocalOnlyRequest(request, configuredOrigin).startsWith('allowed_');
}

/** Stable, non-sensitive failure used for every app-owned active transport attempt. */
export class LocalOnlyTransportDeniedError extends Error {
  readonly code = LOCAL_ONLY_TRANSPORT_DENIAL_CODE;

  constructor() {
    super(LOCAL_ONLY_TRANSPORT_DENIAL_CODE);
    this.name = 'LocalOnlyTransportDeniedError';
  }
}

function denyActiveTransport(): never {
  throw new LocalOnlyTransportDeniedError();
}

interface TransportGuardWindow extends Window {
  XMLHttpRequest: typeof XMLHttpRequest;
  WebSocket: typeof WebSocket;
  fetch: typeof fetch;
}

/**
 * Browser-only pre-dispatch guard. Native document and static-asset loading do
 * not use these app APIs, so Vite/browser loader traffic remains untouched.
 */
export function installLocalOnlyTransportGuard(browserWindow: TransportGuardWindow = window): void {
  const marker = '__sailingTrainingLocalOnlyTransportGuardInstalled__';
  const markerTarget = browserWindow as unknown as Record<string, unknown>;
  if (markerTarget[marker] === true) return;

  class DeniedXMLHttpRequest {
    open(): never { return denyActiveTransport(); }
    send(): never { return denyActiveTransport(); }
  }

  Object.defineProperties(browserWindow, {
    fetch: { configurable: true, value: () => Promise.reject(new LocalOnlyTransportDeniedError()) },
    XMLHttpRequest: { configurable: true, value: DeniedXMLHttpRequest },
    WebSocket: { configurable: true, value: class DeniedWebSocket { constructor() { denyActiveTransport(); } } },
  });
  Object.defineProperty(browserWindow.navigator, 'sendBeacon', {
    configurable: true,
    value: () => denyActiveTransport(),
  });
  Object.defineProperty(browserWindow, marker, { configurable: false, value: true });
}
