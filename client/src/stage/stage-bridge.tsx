import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type * as PIXI from 'pixi.js';
import { cn } from '../lib/utils';
import { FallbackBackground } from '../ui/common/fallback-bg';
import { Minimap } from '../ui/hud/minimap';
import { createStage, type StageRef } from './stage-app';
import { createGridLayer } from './layers/grid';
import { createFogLayer, syncFog, type FogLayer } from './layers/fog';
import { createTokenLayer, syncTokens, type TokenLayer, type TokenHandlers } from './layers/tokens';
import { createEffectsLayer } from './layers/effects';
import { createTokenHandlers } from './stage-events';
import { selectScene, selectSelectedTokenId, selectCamera, selectWorld, useGreyfallStore } from '../store';
import { applyCamera } from './camera';

import type { RegisterLobbyHandler, PublishLobbyMessage } from '../domain/chat/use-lobby-chat';

type StageViewportProps = {
  children?: ReactNode;
  background?: string;
  className?: string;
  localParticipantId?: string | null;
  publishLobbyMessage?: PublishLobbyMessage;
  registerLobbyHandler?: RegisterLobbyHandler;
};

function useStage(canvasRef: RefObject<HTMLCanvasElement>) {
  const stageRef = useRef<StageRef>();
  const layersRef = useRef<{
    grid: PIXI.Container;
    fog: FogLayer;
    tokens: TokenLayer;
    effects: PIXI.Container;
  }>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mounted = true;

    createStage(canvas).then((stage) => {
      if (!mounted) {
        stage.dispose();
        return;
      }
      stageRef.current = stage;

      const grid = createGridLayer();
      const fog = createFogLayer();
      const tokens = createTokenLayer();
      const effects = createEffectsLayer();

      stage.world.addChild(grid);
      stage.world.addChild(fog.container);
      stage.world.addChild(tokens.container);
      stage.world.addChild(effects);

      layersRef.current = { grid, fog, tokens, effects };
    });

    return () => {
      mounted = false;
      stageRef.current?.dispose();
      stageRef.current = undefined;
      layersRef.current = undefined;
    };
  }, [canvasRef]);

  return { stageRef, layersRef };
}

export function StageViewport({ children, background, className, localParticipantId = null, publishLobbyMessage, registerLobbyHandler }: StageViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { stageRef, layersRef } = useStage(canvasRef);
  const scene = useGreyfallStore(selectScene);
  const selectedTokenId = useGreyfallStore(selectSelectedTokenId);
  const camera = useGreyfallStore(selectCamera);
  const world = useGreyfallStore(selectWorld);
  const handlersRef = useRef<TokenHandlers>();

  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;

    if (!handlersRef.current) {
      handlersRef.current = createTokenHandlers(layers.effects);
    }

    syncTokens(layers.tokens, scene.tokens, selectedTokenId, handlersRef.current);
    syncFog(layers.fog, scene.fog);
  }, [layersRef, scene, selectedTokenId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const st = stageRef.current;
    if (!st) return;
    applyCamera(st.camera as any, camera, world, { width: rect.width, height: rect.height });
  }, [camera, world, stageRef]);

  useEffect(() => {
    const onResize = () => {
      const canvas = canvasRef.current; const st = stageRef.current;
      if (!canvas || !st) return;
      const rect = canvas.getBoundingClientRect();
      applyCamera(st.camera as any, camera, world, { width: rect.width, height: rect.height });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [stageRef, camera, world]);

  return (
    <div
      className={cn(
        'relative h-screen w-screen overflow-hidden bg-slate-950 text-foreground',
        className
      )}
    >
      {background ? <FallbackBackground src={background} /> : null}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-slate-950/55" />
      <Minimap stageCanvasRef={canvasRef} localParticipantId={localParticipantId} publishLobbyMessage={publishLobbyMessage} registerLobbyHandler={registerLobbyHandler} />
      {children}
    </div>
  );
}
