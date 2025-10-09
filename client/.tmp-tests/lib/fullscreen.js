export function getFullscreenElement(doc = document) {
    return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null;
}
const fullscreenLogsEnabled = Boolean(import.meta.env.VITE_FULLSCREEN_LOGS);
function info(message, payload) {
    if (!fullscreenLogsEnabled)
        return;
    console.info(message, payload);
}
function warn(message, payload) {
    if (!fullscreenLogsEnabled)
        return;
    console.warn(message, payload);
}
export async function requestFullscreen(element, context = 'unspecified') {
    const target = element;
    const req = target.requestFullscreen ?? target.webkitRequestFullscreen ?? target.msRequestFullscreen;
    if (!req) {
        warn('[fullscreen] request not supported', { context });
        return false;
    }
    info('[fullscreen] requesting', { context, element });
    try {
        await req.call(target);
        info('[fullscreen] request resolved', { context, element: getFullscreenElement() });
        return true;
    }
    catch (error) {
        warn('[fullscreen] request failed', { context, error: error instanceof Error ? error.message : String(error) });
        return false;
    }
}
export async function exitFullscreen(doc = document, context = 'unspecified') {
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
    }
    catch (error) {
        warn('[fullscreen] exit failed', { context, error: error instanceof Error ? error.message : String(error) });
        return false;
    }
}
export function logFullscreenState(context = 'unspecified', doc = document) {
    if (!fullscreenLogsEnabled)
        return;
    info('[fullscreen] state', { context, element: getFullscreenElement(doc) });
}
