import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { listStreams, subscribeStreams, type StreamSnapshot, type StreamEvent } from '../../llm/stream-bus';
import { subscribeProgress, getLastProgress, type ProgressReport } from '../../llm/progress-bus';

export function LlmMonitor({ onClose }: { onClose?: () => void }) {
  const [streams, setStreams] = useState<StreamSnapshot[]>(() => listStreams());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressReport | null>(() => getLastProgress());

  // Window position and size (draggable, size clamped by viewport)
  const computeDims = () => {
    const vw = (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const vh = (typeof window !== 'undefined' ? window.innerHeight : 800);
    const width = Math.max(360, Math.floor(vw / 3));
    const maxHeight = Math.max(240, Math.floor(vh / 2.3));
    const top = Math.max(12, vh - maxHeight - 12);
    const left = 12; // prefer left side usage
    return { width, maxHeight, top, left };
  };
  const [{ width, maxHeight, top, left }, setLayout] = useState(() => computeDims());
  const posRef = useRef({ top, left });
  const draggingRef = useRef<{ dx: number; dy: number; active: boolean }>({ dx: 0, dy: 0, active: false });

  useEffect(() => {
    const update = () => setStreams(listStreams());
    const unsub = subscribeStreams((e: StreamEvent) => {
      update();
      if (e.type === 'open') { setSelectedId(e.meta.id); setAutoFollow(true); }
      if (e.type === 'done' && !selectedId) setSelectedId(e.id);
    });
    const timer = setInterval(update, 1000);
    const unprog = subscribeProgress((r) => setProgress(r));
    const onResize = () => {
      setLayout((prev) => {
        const dims = computeDims();
        // Clamp current position to new viewport
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const clampedLeft = Math.min(Math.max(prev.left, 0), Math.max(0, vw - dims.width - 12));
        const clampedTop = Math.min(Math.max(prev.top, 0), Math.max(0, vh - dims.maxHeight - 12));
        posRef.current = { top: clampedTop, left: clampedLeft };
        return { ...dims, top: clampedTop, left: clampedLeft };
      });
    };
    window.addEventListener('resize', onResize);
    return () => { unsub(); unprog(); clearInterval(timer); window.removeEventListener('resize', onResize); };
  }, [selectedId]);

  const active = useMemo(() => streams.slice(-3).reverse(), [streams]);
  const current = useMemo(() => active.find((s) => s.meta.id === selectedId) ?? active[0] ?? null, [active, selectedId]);
  const tokenBoxRef = useRef<HTMLDivElement | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);

  // Drag handling
  useEffect(() => {
    const onMove = (ev: MouseEvent) => {
      const d = draggingRef.current; if (!d.active) return;
      const vw = window.innerWidth; const vh = window.innerHeight;
      let nl = ev.clientX - d.dx; let nt = ev.clientY - d.dy;
      nl = Math.min(Math.max(0, nl), Math.max(0, vw - width - 12));
      nt = Math.min(Math.max(0, nt), Math.max(0, vh - maxHeight - 12));
      posRef.current = { top: nt, left: nl };
      setLayout((prev) => ({ ...prev, top: nt, left: nl }));
    };
    const onUp = () => { draggingRef.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [width, maxHeight]);

  const beginDrag = (ev: React.MouseEvent) => {
    if (ev.button !== 0) return;
    const rectLeft = posRef.current.left;
    const rectTop = posRef.current.top;
    draggingRef.current = { dx: ev.clientX - rectLeft, dy: ev.clientY - rectTop, active: true };
  };

  // Auto scroll-to-bottom when new tokens arrive, unless user scrolled up
  useEffect(() => {
    const el = tokenBoxRef.current; if (!el) return;
    if (autoFollow) { el.scrollTop = el.scrollHeight; }
  }, [autoFollow, current?.meta.id, current?.tokenCount, current?.tailText]);

  const onTokenScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const threshold = 24;
    const atBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
    setAutoFollow(atBottom);
  };

  const ui = (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483647 }}>
      <div style={{ position: 'absolute', left, top, width, maxHeight, height: maxHeight, background: 'rgba(10,10,14,0.88)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden', pointerEvents: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 2147483647, display: 'flex', flexDirection: 'column' }}>
        <div onMouseDown={beginDrag} style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', cursor: 'move', userSelect: 'none' }}>
          <div style={{ fontWeight: 700, letterSpacing: 0.5 }}>LLM Monitor</div>
          <div style={{ marginLeft: 8, fontSize: 12, opacity: 0.7 }}>streams: {active.length}</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {/* Close 버튼 제거됨; Ctrl+`로 토글하세요 */}
          </div>
        </div>
        {progress && (
          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>{progress.text || '준비 중…'}</div>
            {typeof progress.progress === 'number' && (
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginTop: 6 }}>
                <div style={{ width: `${Math.round(progress.progress * 100)}%`, height: '100%', background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', borderRadius: 4 }} />
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: 0, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {active.map((s) => (
              <button
                key={s.meta.id}
                onClick={() => setSelectedId(s.meta.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  background: selectedId === s.meta.id ? 'rgba(99,102,241,0.25)' : 'transparent',
                  color: selectedId === s.meta.id ? '#e5e7eb' : '#9ca3af',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  fontSize: 12
                }}
                title={`${s.status.toUpperCase()} · tok ${s.tokenCount} · ${new Date(s.meta.startedAt).toLocaleTimeString()}`}
              >
                <span style={{ opacity: 0.8 }}>{s.status.toUpperCase()}</span>
                <span style={{ marginLeft: 6, opacity: 0.7 }}>tok {s.tokenCount}</span>
                <span style={{ marginLeft: 6, opacity: 0.7 }}>{new Date(s.meta.startedAt).toLocaleTimeString()}</span>
              </button>
            ))}
          </div>
          <div style={{ padding: 10, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {current ? (
              <>
                <div style={{ fontSize: 12, color: '#9ca3af', display: 'flex', gap: 8, marginBottom: 8 }}>
                  <span>id</span><span style={{ color: '#e5e7eb' }}>{current.meta.id}</span>
                  <span>status</span><span style={{ color: '#e5e7eb' }}>{current.status}</span>
                  <span>tok</span><span style={{ color: '#e5e7eb' }}>{current.tokenCount}</span>
                  {typeof current.firstTokenAt === 'number' && (
                    <span>TTFT {(current.firstTokenAt - current.meta.startedAt)}ms</span>
                  )}
                  {typeof current.firstTokenAt === 'number' && (
                    <span>
                      TPS {
                        (() => {
                          const end = current.endedAt ?? Date.now();
                          const ms = Math.max(1, end - current.firstTokenAt!);
                          return (current.tokenCount / (ms / 1000)).toFixed(2);
                        })()
                      }
                    </span>
                  )}
                </div>
                <div
                  ref={tokenBoxRef}
                  onScroll={onTokenScroll}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 10, paddingBottom: 24, boxSizing: 'border-box', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize: 12, lineHeight: 1.5, flex: 1, minHeight: 0, overflowY: 'auto', whiteSpace: 'pre-wrap' }}
                >
                  {/* System Section */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <div style={{ color: '#93c5fd', fontWeight: 700 }}>System</div>
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>
                      len {String(current.meta.system ?? current.meta.systemPreview ?? '').length}
                    </div>
                  </div>
                  <div style={{ color: '#e5e7eb', marginBottom: 10 }}>{current.meta.system ?? current.meta.systemPreview ?? '(none)'}</div>

                  {/* User Section */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <div style={{ color: '#86efac', fontWeight: 700 }}>User</div>
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>
                      len {String(current.meta.prompt ?? current.meta.promptPreview ?? '').length}
                    </div>
                  </div>
                  <div style={{ color: '#e5e7eb', marginBottom: 10 }}>{current.meta.prompt ?? current.meta.promptPreview ?? '(empty)'}
                  </div>

                  <div style={{ opacity: 0.5, borderTop: '1px dashed rgba(255,255,255,0.25)', margin: '8px 0 10px' }} />

                  {/* Assistant Section */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                    <div style={{ color: '#fca5a5', fontWeight: 700 }}>Assistant</div>
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>
                      tok {current.tokenCount}
                    </div>
                    {typeof current.firstTokenAt === 'number' && (
                      <div style={{ color: '#9ca3af', fontSize: 11 }}>
                        TPS {
                          (() => {
                            const end = current.endedAt ?? Date.now();
                            const ms = Math.max(1, end - current.firstTokenAt!);
                            return (current.tokenCount / (ms / 1000)).toFixed(2);
                          })()
                        }
                      </div>
                    )}
                  </div>
                  <div style={{ color: '#e5e7eb' }}>{current.tailText || '(no tokens yet)'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={async () => { try { await navigator.clipboard.writeText(`${current.meta.system ?? current.meta.systemPreview ?? ''}\n\n${current.meta.prompt ?? current.meta.promptPreview ?? ''}\n\n${current.tailText}`.trim()); } catch {} }}
                    style={{ background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                  >Copy View</button>
                </div>
              </>
            ) : (
              <div style={{ color: '#9ca3af', fontSize: 13 }}>활성 스트림이 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  if (typeof document !== 'undefined' && document.body) return createPortal(ui, document.body);
  return ui;
}
