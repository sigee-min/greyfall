export type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
  msExitFullscreen?: () => Promise<void>;
  msFullscreenElement?: Element | null;
};

export type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
};

export function getFullscreenElement(doc: FullscreenDocument = document as FullscreenDocument) {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null;
}

const fullscreenLogsEnabled = Boolean(import.meta.env.VITE_FULLSCREEN_LOGS);

function info(message: string, payload?: Record<string, unknown>) {
  if (!fullscreenLogsEnabled) return;
  console.info(message, payload);
}

function warn(message: string, payload?: Record<string, unknown>) {
  if (!fullscreenLogsEnabled) return;
  console.warn(message, payload);
}

export async function requestFullscreen(element: HTMLElement, context = 'unspecified') {
  const target = element as FullscreenElement;
  const req =
    target.requestFullscreen ?? target.webkitRequestFullscreen ?? target.msRequestFullscreen;
  if (!req) {
    warn('[fullscreen] request not supported', { context });
    return false;
  }

  info('[fullscreen] requesting', { context, element });
  try {
    await req.call(target);
    info('[fullscreen] request resolved', { context, element: getFullscreenElement() });
    return true;
  } catch (error) {
    warn('[fullscreen] request failed', { context, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export async function exitFullscreen(doc: FullscreenDocument = document as FullscreenDocument, context = 'unspecified') {
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.msExitFullscreen;
  if (!exit) {
    warn('[fullscreen] exit not supported', { context });
    return false;
  }

  if (!getFullscreenElement(doc)) {
    info('[fullscreen] exit skipped – no element', { context });
    return false;
  }

  info('[fullscreen] exiting', { context });
  try {
    await exit.call(doc);
    info('[fullscreen] exit resolved', { context });
    return true;
  } catch (error) {
    warn('[fullscreen] exit failed', { context, error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export function logFullscreenState(context = 'unspecified', doc: FullscreenDocument = document as FullscreenDocument) {
  if (!fullscreenLogsEnabled) return;
  info('[fullscreen] state', { context, element: getFullscreenElement(doc) });
}
