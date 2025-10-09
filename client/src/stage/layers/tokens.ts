import * as PIXI from 'pixi.js';
import type { TokenState } from '../../store';

type TokenSprite = PIXI.Graphics & { tokenId?: string };

export type TokenHandlers = {
  onPointerDown?: (token: TokenState) => void;
};

export type TokenLayer = {
  container: PIXI.Container;
  sprites: Map<string, TokenSprite>;
};

export function createTokenLayer(): TokenLayer {
  return {
    container: new PIXI.Container(),
    sprites: new Map()
  };
}

export function syncTokens(
  layer: TokenLayer,
  tokens: Record<string, TokenState>,
  selectedTokenId: string | null,
  handlers?: TokenHandlers
) {
  const seen = new Set(Object.keys(tokens));

  for (const [id, sprite] of layer.sprites) {
    if (!seen.has(id)) {
      sprite.destroy();
      layer.sprites.delete(id);
    }
  }

  Object.values(tokens).forEach((token) => {
    const existing = layer.sprites.get(token.id);
    if (existing) {
      drawToken(existing, token, selectedTokenId === token.id);
      positionSprite(existing, token);
      return;
    }

    const sprite = new PIXI.Graphics() as TokenSprite;
    sprite.tokenId = token.id;
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';

    drawToken(sprite, token, selectedTokenId === token.id);
    positionSprite(sprite, token);
    if (handlers?.onPointerDown) {
      sprite.on('pointerdown', () => handlers.onPointerDown?.(token));
    }
    layer.sprites.set(token.id, sprite);
    layer.container.addChild(sprite);
  });
}

function positionSprite(sprite: TokenSprite, token: TokenState) {
  sprite.x = token.position.x;
  sprite.y = token.position.y;
  sprite.zIndex = token.elevation ?? 0;
}

function drawToken(sprite: TokenSprite, token: TokenState, selected: boolean) {
  sprite.clear();
  const fill = token.tint ?? 0x7c3aed;
  const borderColor = selected ? 0x38bdf8 : 0xffffff;
  const borderWidth = selected ? 3 : 2;
  sprite.beginFill(fill, 0.85);
  sprite.lineStyle({ width: borderWidth, color: borderColor, alpha: 1 });
  sprite.drawCircle(0, 0, 18);
  sprite.endFill();
}
