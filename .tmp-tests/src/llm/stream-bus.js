const listeners = new Set();
const streams = new Map();
function emit(e) {
    for (const l of Array.from(listeners)) {
        try {
            l(e);
        }
        catch { /* noop */ }
    }
}
export function subscribeStreams(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
export function openStream(metaIn) {
    const id = metaIn.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const meta = {
        id,
        startedAt: Date.now(),
        promptPreview: metaIn.promptPreview,
        systemPreview: metaIn.systemPreview,
        prompt: metaIn.prompt,
        system: metaIn.system,
        options: metaIn.options
    };
    streams.set(id, { meta, status: 'open', tokenCount: 0, tailText: '' });
    emit({ type: 'open', meta });
    return id;
}
export function pushToken(id, token) {
    const st = streams.get(id);
    if (!st)
        return -1;
    st.tokenCount += 1;
    if (!st.firstTokenAt)
        st.firstTokenAt = Date.now();
    // Keep only a rolling tail to avoid growing indefinitely
    const next = (st.tailText + token);
    st.tailText = next.length > 4000 ? next.slice(-4000) : next;
    emit({ type: 'token', id, token, index: st.tokenCount - 1 });
    return st.tokenCount;
}
export function markDone(id, fullText) {
    const st = streams.get(id);
    if (!st)
        return;
    st.status = 'done';
    st.endedAt = Date.now();
    if (typeof fullText === 'string')
        st.fullText = fullText;
    emit({ type: 'done', id, fullTextLength: (fullText?.length ?? st.tailText.length), durationMs: st.endedAt - st.meta.startedAt });
}
export function markError(id, error) {
    const st = streams.get(id);
    if (!st)
        return;
    st.status = 'error';
    st.error = error;
    st.endedAt = Date.now();
    emit({ type: 'error', id, error });
}
export function markAborted(id) {
    const st = streams.get(id);
    if (!st)
        return;
    st.status = 'aborted';
    st.endedAt = Date.now();
    emit({ type: 'aborted', id });
}
export function getStreamSnapshot(id) {
    const st = streams.get(id);
    if (!st)
        return null;
    return { meta: st.meta, status: st.status, tokenCount: st.tokenCount, firstTokenAt: st.firstTokenAt, endedAt: st.endedAt, error: st.error, tailText: st.tailText };
}
export function listStreams() {
    return Array.from(streams.values()).map((st) => ({ meta: st.meta, status: st.status, tokenCount: st.tokenCount, firstTokenAt: st.firstTokenAt, endedAt: st.endedAt, error: st.error, tailText: st.tailText }));
}
