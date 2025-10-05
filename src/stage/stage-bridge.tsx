import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import type * as PIXI from 'pixi.js';
import { cn } from '../lib/utils';
import { FallbackBackground } from '../ui/common/fallback-bg';
import { createStage, type StageRef } from './stage-app';
import { createGridLayer } from './layers/grid';
import { createFogLayer, syncFog, type FogLayer } from './layers/fog';
import { createTokenLayer, syncTokens, type TokenLayer, type TokenHandlers } from './layers/tokens';
import { createEffectsLayer } from './layers/effects';
import { createTokenHandlers } from './stage-events';
import { selectScene, selectSelectedTokenId, useGreyfallStore } from '../store';

type StageViewportProps = {
  children?: ReactNode;
  background?: string;
  className?: string;
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

      stage.root.addChild(grid);
      stage.root.addChild(fog.container);
      stage.root.addChild(tokens.container);
      stage.root.addChild(effects);

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

export function StageViewport({ children, background, className }: StageViewportProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { layersRef } = useStage(canvasRef);
  const scene = useGreyfallStore(selectScene);
  const selectedTokenId = useGreyfallStore(selectSelectedTokenId);
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
      {children}
    </div>
  );
}
