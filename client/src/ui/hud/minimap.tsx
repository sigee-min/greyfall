import { useEffect, useMemo, useRef } from 'react';
import { defaultMiniStyle } from './minimap-style';
import { resolveMinimapSize } from './minimap-size';
import { projectToMinimap, rectToMinimap } from './minimap-coord';
import { useGreyfallStore, selectScene, selectCamera, selectWorld, selectMinimap } from '../../store';
import { rectForViewport, clampCamera } from '../../stage/camera';
import { useState } from 'react';
import { MinimapSvg } from './minimap-svg';
import { MinimapTravelChip } from './minimap-travel-chip';
import { useTravelVote } from '../../domain/world/travel/use-travel-vote';
import { useGlobalBus } from '../../bus/global-bus';
import { useI18n } from '../../i18n';
import type { RegisterLobbyHandler, PublishLobbyMessage } from '../../domain/chat/use-lobby-chat';

type Props = {
  stageCanvasRef: React.RefObject<HTMLCanvasElement>;
  localParticipantId?: string | null;
  publishLobbyMessage?: PublishLobbyMessage;
  registerLobbyHandler?: RegisterLobbyHandler;
  className?: string;
};

import { WORLD_STATIC } from '../../domain/world/data';
import { worldPositionsClient } from '../../domain/net-objects/world-positions-client';
import { getGraph } from '../../domain/world/graph/state';
import { shortestPath } from '../../domain/world/graph/path';

export function Minimap({ stageCanvasRef, localParticipantId = null, publishLobbyMessage, registerLobbyHandler }: Props) {
  const scene = useGreyfallStore(selectScene);
  const camera = useGreyfallStore(selectCamera);
  const world = useGreyfallStore(selectWorld);
  const mini = useGreyfallStore(selectMinimap);
  const centerOn = useGreyfallStore((s) => s.centerOn);
  const panBy = useGreyfallStore((s) => s.panBy);
  const zoomTo = useGreyfallStore((s) => s.zoomTo);
  const bus = useGlobalBus();
  const { t } = useI18n();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const overlayInnerRef = useRef<HTMLDivElement>(null);
  const style = useMemo(() => defaultMiniStyle(), []);
  const [drag, setDrag] = useState<{ active: boolean; start: { x: number; y: number } } | null>(null);
  const [pings, setPings] = useState<Array<{ x: number; y: number; at: number }>>([]);
  const [hover, setHover] = useState<{ nodeId: string | null }>({ nodeId: null });
  const [innerSize, setInnerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [resizeTick, setResizeTick] = useState(0);
  // Travel vote domain (for entry guard / propose)
  const safeRegister: RegisterLobbyHandler = (_kind, _handler) => () => {};
  const safePublish: PublishLobbyMessage = (_kind, _body, _context) => false;
  const travel = useTravelVote({
    publishLobbyMessage: publishLobbyMessage ?? safePublish,
    registerLobbyHandler: registerLobbyHandler ?? safeRegister,
    localParticipantId,
    sessionMode: null
  });

  // Exit marker titles (localized). If cannot propose, append Entry-needed hint.
  const exitTitles = useMemo(() => {
    const pos = localParticipantId ? worldPositionsClient.getFor(localParticipantId) : null;
    const mid = pos?.mapId ?? WORLD_STATIC.head;
    const map = WORLD_STATIC.maps.find((m) => m.id === mid) ?? WORLD_STATIC.maps[0];
    const findName = (id: string | null) => (id ? (WORLD_STATIC.maps.find((m) => m.id === id)?.name ?? id) : null);
    const prevName = findName(map.prev);
    const nextName = findName(map.next);
    const can = Boolean(travel?.computed.canPropose);
    return {
      prev: prevName ? (can ? t('map.travel.proposeTo', { name: prevName }) : t('map.travel.proposeToEntry', { name: prevName })) : undefined,
      next: nextName ? (can ? t('map.travel.proposeTo', { name: nextName }) : t('map.travel.proposeToEntry', { name: nextName })) : undefined
    };
  }, [localParticipantId, travel?.computed.canPropose, t]);
  const graphRef = useRef<ReturnType<typeof getGraph> | null>(null);
  const touchRef = useRef<{ pointers: Map<number, { x: number; y: number }>; lastMid?: { x: number; y: number }; lastDist?: number; active: boolean }>({ pointers: new Map(), active: false });

  // Position + size
  useEffect(() => {
    const canvas = canvasRef.current; const stageCanvas = stageCanvasRef.current;
    if (!canvas || !stageCanvas) return;
    const rect = stageCanvas.getBoundingClientRect();
    const coarse = matchMedia('(pointer: coarse)').matches;
    const resolved = mini.sizeMode === 'custom' && mini.customSize && mini.customSize > 0
      ? { size: mini.customSize }
      : resolveMinimapSize(rect.width, coarse);
    const { size } = resolved;
    canvas.width = Math.floor(size * (window.devicePixelRatio ? Math.min(2, window.devicePixelRatio) : 1));
    canvas.height = canvas.width;
    // CSS size
    canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
    // Position: top-right margin 16px
    canvas.style.position = 'absolute';
    canvas.style.top = '16px';
    canvas.style.right = '16px';
    canvas.style.zIndex = '10';
    canvas.style.opacity = String(Math.max(0.6, Math.min(1, mini.opacity ?? 0.9)));

    // Overlay container mirrors canvas box; inner subtracts padding (8px each side)
    const overlay = overlayRef.current; const inner = overlayInnerRef.current;
    if (overlay && inner) {
      overlay.style.position = 'absolute';
      overlay.style.top = '16px'; overlay.style.right = '16px';
      overlay.style.width = `${size}px`; overlay.style.height = `${size}px`;
      overlay.style.zIndex = '12'; overlay.style.pointerEvents = 'auto';
      const pad = 8; // CSS px
      inner.style.position = 'absolute'; inner.style.left = `${pad}px`; inner.style.top = `${pad}px`;
      const iw = Math.max(0, size - pad * 2); const ih = iw; // square minimap
      inner.style.width = `${iw}px`; inner.style.height = `${ih}px`;
      setInnerSize({ w: iw, h: ih });
    }
  }, [stageCanvasRef, mini.sizeMode, mini.customSize, mini.opacity]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current; const stageCanvas = stageCanvasRef.current;
    if (!canvas || !stageCanvas || !mini.enabled) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const DPR = canvas.width / parseFloat(canvas.style.width || `${canvas.width}`);
    const W = canvas.width; const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background rounded rect
    const R = Math.max(8 * DPR, 8);
    const pad = Math.max(8 * DPR, 8);
    roundRect(ctx, pad, pad, W - 2 * pad, H - 2 * pad, R, style.bg);
    strokeRect(ctx, pad, pad, W - 2 * pad, H - 2 * pad, style.border, 2 * DPR);

    // grid (optional, light)
    ctx.strokeStyle = style.grid; ctx.lineWidth = DPR;
    const inner = { x: pad, y: pad, width: W - 2 * pad, height: H - 2 * pad };
    const gridStep = Math.max(24 * DPR, 16);
    for (let x = inner.x; x <= inner.x + inner.width; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, inner.y); ctx.lineTo(x, inner.y + inner.height); ctx.stroke(); }
    for (let y = inner.y; y <= inner.y + inner.height; y += gridStep) { ctx.beginPath(); ctx.moveTo(inner.x, y); ctx.lineTo(inner.x + inner.width, y); ctx.stroke(); }

    // Fog overlay (dark) with holes for reveals
    if (mini.showFog && scene.fog.enabled) {
      ctx.save();
      ctx.fillStyle = style.fog;
      roundRect(ctx, inner.x, inner.y, inner.width, inner.height, R, style.fog);
      ctx.globalCompositeOperation = 'destination-out';
      for (const rev of scene.fog.reveals) {
        const p = projectToMinimap(rev.position, world, inner);
        ctx.beginPath(); ctx.arc(p.x, p.y, (rev.radius / world.width) * inner.width, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // Tokens with simple grid clustering
    if (mini.showTokens) {
      const toks = Object.values(scene.tokens);
      const bins = new Map<string, { cx: number; cy: number; count: number }>();
      const CELLS = 10; // static grid for now
      for (const t of toks) {
        const p = projectToMinimap(t.position, world, inner);
        const gx = Math.floor(((p.x - inner.x) / inner.width) * CELLS);
        const gy = Math.floor(((p.y - inner.y) / inner.height) * CELLS);
        const key = `${gx}:${gy}`;
        const b = bins.get(key) || { cx: 0, cy: 0, count: 0 };
        b.cx += p.x; b.cy += p.y; b.count += 1; bins.set(key, b);
      }
      const threshold = Math.max(2, mini.clusterThreshold || 3);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${Math.max(9 * DPR, 9)}px system-ui, sans-serif`;
      for (const b of bins.values()) {
        const cx = b.cx / b.count; const cy = b.cy / b.count;
        if (b.count >= threshold) {
          const rr = Math.max(4 * DPR, 4) + Math.min(10 * DPR, b.count);
          ctx.beginPath(); ctx.fillStyle = style.tokenNeutral; ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(12,12,12,0.9)'; ctx.fillText(String(b.count), cx, cy);
        } else {
          const rr = Math.max(2 * DPR, 2);
          ctx.beginPath(); ctx.fillStyle = style.tokenNeutral; ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Pings
    const now = Date.now();
    for (const ping of pings) {
      const age = (now - ping.at) / 1000; // seconds
      if (age < 0 || age > 2.0) continue;
      const p = projectToMinimap({ x: ping.x, y: ping.y }, world, inner);
      const rr = Math.max(6 * DPR, 6) + age * 18 * DPR;
      const alpha = Math.max(0, 1 - age / 2);
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56,189,248,${alpha.toFixed(2)})`;
      ctx.lineWidth = 2 * DPR; ctx.stroke();
    }

    // Connectivity overlay (graph) based on current map
    const pos = localParticipantId ? worldPositionsClient.getFor(localParticipantId) : null;
    const map = WORLD_STATIC.maps.find((m) => m.id === (pos?.mapId ?? WORLD_STATIC.head)) ?? WORLD_STATIC.maps[0];
    const graph = getGraph(map, { width: world.width, height: world.height, padding: Math.max(64 * DPR, 64) });
    // Edges
    ctx.save();
    ctx.strokeStyle = style.grid; ctx.lineWidth = 1.5 * DPR;
    for (const e of graph.edges) {
      const a = graph.nodes.find((n) => n.id === e.from)!;
      const b = graph.nodes.find((n) => n.id === e.to)!;
      const pa = projectToMinimap(a.pos, world, inner);
      const pb = projectToMinimap(b.pos, world, inner);
      ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
    ctx.restore();
    // Nodes
    for (const n of graph.nodes) {
      const p = projectToMinimap(n.pos, world, inner);
      drawNode(ctx, p.x, p.y, n.kind, DPR);
    }
    graphRef.current = graph;

    // Labels (desktop/ultra)
    const cssSize = parseFloat(canvas.style.width || '0');
    if (cssSize >= 240) {
      ctx.save();
      ctx.fillStyle = 'rgba(226,232,240,0.95)';
      ctx.font = `${Math.max(10 * DPR, 10)}px system-ui, sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const entryId = map.entryFieldId;
      const entry = graph.nodes.find((n) => n.id === entryId);
      if (entry) {
        const p = projectToMinimap(entry.pos, world, inner);
        ctx.fillText('ENTRY', p.x + 6 * DPR, p.y);
      }
      // Label immediate neighbors of entry
      const fEntry = map.fields.find((f) => f.id === entryId);
      const neigh = fEntry ? fEntry.neighbors.slice(0, 5) : [];
      for (const id of neigh) {
        const node = graph.nodes.find((n) => n.id === id);
        if (!node) continue;
        const p = projectToMinimap(node.pos, world, inner);
        ctx.fillText(node.name.slice(0, 10), p.x + 6 * DPR, p.y);
      }
      ctx.restore();
    }

    // Prev/Next exits
    ctx.save();
    ctx.fillStyle = style.viewport;
    if (map.prev) drawArrow(ctx, inner.x + 8 * DPR, inner.y + inner.height / 2, -1, DPR);
    if (map.next) drawArrow(ctx, inner.x + inner.width - 8 * DPR, inner.y + inner.height / 2, 1, DPR);
    ctx.restore();

    // Path preview to hovered node (if any)
    if (hover.nodeId && pos?.fieldId) {
      const start = pos.fieldId;
      if (start !== hover.nodeId) {
        const path = shortestPath(graph, start, hover.nodeId);
        if (path.length >= 2) {
          ctx.save();
          ctx.setLineDash([4 * DPR, 3 * DPR]);
          ctx.strokeStyle = 'rgba(56,189,248,0.9)';
          ctx.lineWidth = 2 * DPR;
          ctx.beginPath();
          const first = graph.nodes.find((n) => n.id === path[0])!;
          let pp = projectToMinimap(first.pos, world, inner);
          ctx.moveTo(pp.x, pp.y);
          for (let i = 1; i < path.length; i += 1) {
            const n = graph.nodes.find((nn) => nn.id === path[i])!;
            pp = projectToMinimap(n.pos, world, inner);
            ctx.lineTo(pp.x, pp.y);
          }
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Viewport box
    const stageRect = stageCanvas.getBoundingClientRect();
    const clamped = clampCamera(camera, world, { width: stageRect.width, height: stageRect.height });
    const vpWorld = rectForViewport(camera, { width: stageRect.width, height: stageRect.height });
    const worldRect = { x: clamped.x - vpWorld.width / 2, y: clamped.y - vpWorld.height / 2, width: vpWorld.width, height: vpWorld.height };
    const miniRect = rectToMinimap(worldRect, world, inner);
    strokeRect(ctx, miniRect.x, miniRect.y, miniRect.width, miniRect.height, style.viewport, 2 * DPR);
  }, [scene.tokens, scene.fog, camera, world, mini.enabled, mini.showFog, mini.showTokens, mini.clusterThreshold, stageCanvasRef, localParticipantId, pings, hover, resizeTick, style]);

  // Resize redraw
  useEffect(() => {
    const onResize = () => setResizeTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Input handlers
  useEffect(() => {
    const canvas = canvasRef.current; const stageCanvas = stageCanvasRef.current;
    if (!canvas || !stageCanvas || !mini.enabled) return;
    canvas.style.touchAction = 'none';
    const DPR = canvas.width / parseFloat(canvas.style.width || `${canvas.width}`);
    const pad = Math.max(8 * DPR, 8);
    const inner = { x: pad, y: pad, width: canvas.width - 2 * pad, height: canvas.height - 2 * pad };

    const toWorld = (mx: number, my: number) => {
      const nx = Math.max(0, Math.min(1, (mx - inner.x) / inner.width));
      const ny = Math.max(0, Math.min(1, (my - inner.y) / inner.height));
      return { x: nx * world.width, y: ny * world.height };
    };

    const onPointerDown = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const my = (ev.clientY - rect.top) * (canvas.height / rect.height);
      if (ev.shiftKey) {
        const w = toWorld(mx, my);
        const now = Date.now();
        setPings((prev) => [...prev.filter((p) => now - p.at < 1800), { x: w.x, y: w.y, at: now }]);
        if (publishLobbyMessage && localParticipantId) {
          try { publishLobbyMessage('map:ping', { byId: localParticipantId, x: w.x, y: w.y, at: now, ttlMs: 2000 }, 'ui:ping'); } catch {}
        }
        return;
      }
      if (ev.pointerType === 'touch') {
        touchRef.current.pointers.set(ev.pointerId, { x: mx, y: my });
        if (touchRef.current.pointers.size === 2) {
          touchRef.current.active = true;
          const arr = Array.from(touchRef.current.pointers.values());
          touchRef.current.lastMid = { x: (arr[0].x + arr[1].x) / 2, y: (arr[0].y + arr[1].y) / 2 };
          const dx = arr[0].x - arr[1].x; const dy = arr[0].y - arr[1].y;
          touchRef.current.lastDist = Math.hypot(dx, dy);
        }
      } else {
        setDrag({ active: true, start: { x: mx, y: my } });
      }
    };
    const onPointerMove = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const my = (ev.clientY - rect.top) * (canvas.height / rect.height);
      // Hover detection when not dragging
      if (!drag?.active) {
        const graph = graphRef.current;
        let best: { id: string; d2: number } | null = null;
        if (graph) {
          for (const n of graph.nodes) {
            const p = projectToMinimap(n.pos, world, inner);
            const dx2 = p.x - mx; const dy2 = p.y - my; const d2 = dx2 * dx2 + dy2 * dy2;
            if (!best || d2 < best.d2) best = { id: n.id, d2 };
          }
        }
        const thresh = (12 * (canvas.width / parseFloat(canvas.style.width || `${canvas.width}`))) ** 2;
        setHover({ nodeId: best && best.d2 <= thresh ? best.id : null });
        // Multi-touch gestures
        if (ev.pointerType === 'touch' && touchRef.current.active) {
          touchRef.current.pointers.set(ev.pointerId, { x: mx, y: my });
          if (touchRef.current.pointers.size === 2) {
            const arr = Array.from(touchRef.current.pointers.values());
            const mid = { x: (arr[0].x + arr[1].x) / 2, y: (arr[0].y + arr[1].y) / 2 };
            const dx = arr[0].x - arr[1].x; const dy = arr[0].y - arr[1].y;
            const dist = Math.hypot(dx, dy);
            const prevMid = touchRef.current.lastMid ?? mid;
            const prevDist = touchRef.current.lastDist ?? dist;
            // Pan by mid delta
            const ddx = mid.x - prevMid.x; const ddy = mid.y - prevMid.y;
            const wx = (ddx / inner.width) * world.width;
            const wy = (ddy / inner.height) * world.height;
            panBy(wx * -1, wy * -1);
            // Pinch zoom around mid anchor
            const scaleFactor = prevDist > 0 ? dist / prevDist : 1;
            const anchorW = toWorld(mid.x, mid.y);
            const nextScale = Math.max(camera.minScale, Math.min(camera.maxScale, camera.scale * scaleFactor));
            useGreyfallStore.getState().setCamera({ x: anchorW.x, y: anchorW.y, scale: nextScale });
            touchRef.current.lastMid = mid; touchRef.current.lastDist = dist;
          }
        }
        return;
      }
      // Dragging → pan
      const dx = mx - drag.start.x; const dy = my - drag.start.y;
      const wx = (dx / inner.width) * world.width;
      const wy = (dy / inner.height) * world.height;
      panBy(wx * -1, wy * -1);
      setDrag({ active: true, start: { x: mx, y: my } });
    };
    const onPointerUp = (ev: PointerEvent) => {
      if (!drag) return;
      // If it was a click (small movement), center camera
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const my = (ev.clientY - rect.top) * (canvas.height / rect.height);
      const dx = Math.abs(mx - drag.start.x); const dy = Math.abs(my - drag.start.y);
      setDrag(null);
      if (dx < 3 && dy < 3) {
        const w = toWorld(mx, my); centerOn(w.x, w.y);
      }
      // touch end
      touchRef.current.pointers.delete(ev.pointerId);
      if (touchRef.current.pointers.size < 2) { touchRef.current.active = false; touchRef.current.lastMid = undefined; touchRef.current.lastDist = undefined; }
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const delta = Math.sign(ev.deltaY);
      const step = 0.1; // 10% per notch
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * (canvas.width / rect.width);
      const my = (ev.clientY - rect.top) * (canvas.height / rect.height);
      const w = toWorld(mx, my);
      const nextScale = Math.max(camera.minScale, Math.min(camera.maxScale, camera.scale * (1 - delta * step)));
      // Center towards anchor point when zooming
      const nx = w.x; const ny = w.y;
      useGreyfallStore.getState().setCamera({ x: nx, y: ny, scale: nextScale });
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [mini.enabled, stageCanvasRef, world, camera.scale, camera.minScale, camera.maxScale, panBy, centerOn, zoomTo, drag, localParticipantId, publishLobbyMessage]);

  // Keyboard toggles: M(toggle enable), F(toggle fog), T(toggle tokens)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') {
        useGreyfallStore.getState().setMinimap({ enabled: !useGreyfallStore.getState().minimap.enabled });
      } else if (e.key === 'f' || e.key === 'F') {
        useGreyfallStore.getState().setMinimap({ showFog: !useGreyfallStore.getState().minimap.showFog });
      } else if (e.key === 't' || e.key === 'T') {
        useGreyfallStore.getState().setMinimap({ showTokens: !useGreyfallStore.getState().minimap.showTokens });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Ping GC timer
  useEffect(() => {
    if (pings.length === 0) return;
    const id = window.setInterval(() => setPings((list) => list.filter((p) => Date.now() - p.at < 2000)), 250);
    return () => window.clearInterval(id);
  }, [pings.length]);

  // Subscribe to network pings
  useEffect(() => {
    if (!registerLobbyHandler) return;
    const unsub = registerLobbyHandler('map:ping', (msg) => {
      const at = typeof (msg.body.at) === 'number' ? msg.body.at : Date.now();
      setPings((prev) => [...prev.filter((p) => Date.now() - p.at < 1800), { x: msg.body.x, y: msg.body.y, at }]);
    });
    return unsub;
  }, [registerLobbyHandler]);

  if (!mini.enabled) return null;
  return (
    <div aria-live="polite" aria-label="Minimap" className="pointer-events-auto">
      <canvas ref={canvasRef} />
      <div ref={overlayRef}>
        <div ref={overlayInnerRef}>
          {/* SVG overlay sits above canvas; uses world-space viewBox and CSS inner size */}
          <MinimapSvg
            cssWidth={innerSize.w}
            cssHeight={innerSize.h}
            world={world}
            localParticipantId={localParticipantId}
            showLabels
            onNodeHover={(id) => setHover({ nodeId: id })}
            onNodeClick={(_id, pos) => centerOn(pos.x, pos.y)}
            hoverNodeId={hover.nodeId}
            onExitClick={(dir) => {
              if (!publishLobbyMessage || !localParticipantId || !travel) return;
              if (!travel.computed.canPropose) {
                bus.publish('toast:show', { status: 'info', message: t('map.travel.entryRequired') });
                travel.actions.expand(true);
                return;
              }
              travel.actions.propose({ direction: dir });
            }}
            exitPrevTitle={exitTitles.prev}
            exitNextTitle={exitTitles.next}
          />
        </div>
        {publishLobbyMessage && registerLobbyHandler && (
          <MinimapTravelChip localParticipantId={localParticipantId ?? null} publishLobbyMessage={publishLobbyMessage} registerLobbyHandler={registerLobbyHandler} />
        )}
      </div>
      <button
        type="button"
        aria-label={mini.enabled ? 'Hide minimap' : 'Show minimap'}
        className="absolute right-[16px] top-[16px] z-20 rounded-md border border-border/60 bg-background/70 px-2 py-1 text-[11px]"
        onClick={() => useGreyfallStore.getState().setMinimap({ enabled: !mini.enabled })}
      >
        {mini.enabled ? '−' : '+'}
      </button>
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}

function strokeRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, stroke: string, lw: number) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x, y, w, h); ctx.restore();
}

function drawNode(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, DPR: number) {
  const r = Math.max(3 * DPR, 3);
  ctx.save(); ctx.lineWidth = 1.5 * DPR; ctx.strokeStyle = 'rgba(203,213,225,0.9)'; ctx.fillStyle = 'rgba(30,41,59,0.9)';
  switch (kind) {
    case 'entry': circle(); break;
    case 'market': rect(); break;
    case 'interior': roundRectPath(r * 1.4); break;
    case 'docks': anchor(); break;
    case 'junction': triangle(); break;
    case 'vault': diamond(); break;
    case 'district': circle(); break;
    default: circle(); break;
  }
  ctx.restore();

  function circle() { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  function rect() { ctx.beginPath(); ctx.rect(x - r, y - r, r * 2, r * 2); ctx.fill(); ctx.stroke(); }
  function triangle() { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function diamond() { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function roundRectPath(rr: number) { ctx.beginPath(); ctx.moveTo(x - r, y - r + rr); ctx.quadraticCurveTo(x - r, y - r, x - r + rr, y - r); ctx.lineTo(x + r - rr, y - r); ctx.quadraticCurveTo(x + r, y - r, x + r, y - r + rr); ctx.lineTo(x + r, y + r - rr); ctx.quadraticCurveTo(x + r, y + r, x + r - rr, y + r); ctx.lineTo(x - r + rr, y + r); ctx.quadraticCurveTo(x - r, y + r, x - r, y + r - rr); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  function anchor() { circle(); }
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, dir: -1 | 1, DPR: number) {
  const w = 10 * DPR; const h = 6 * DPR;
  ctx.beginPath();
  if (dir > 0) { // right
    ctx.moveTo(x - w, y - h); ctx.lineTo(x, y); ctx.lineTo(x - w, y + h);
  } else { // left
    ctx.moveTo(x + w, y - h); ctx.lineTo(x, y); ctx.lineTo(x + w, y + h);
  }
  ctx.closePath(); ctx.fill();
}
