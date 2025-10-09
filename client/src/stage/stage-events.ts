import type * as PIXI from 'pixi.js';
import { useGreyfallStore, type TokenState } from '../store';
import { playSelectionCue } from '../lib/sfx';
import { usePreferencesStore } from '../store/preferences';
import { showPulse } from './layers/effects';
import type { TokenHandlers } from './layers/tokens';

function getStore() {
  return useGreyfallStore.getState();
}

export function createTokenHandlers(effectsLayer: PIXI.Container): TokenHandlers {
  return {
    onPointerDown: (token: TokenState) => {
      const store = getStore();
      const preferences = usePreferencesStore.getState();
      const previousSelection = store.selectedTokenId;
      store.selectToken(token.id);

      if (preferences.sfxEnabled) {
        showPulse(effectsLayer, token.position);
        void playSelectionCue();
      }

      if (previousSelection !== token.id) {
        store.appendLog({ id: `select-${token.id}`, body: `${token.label} selected` });
      }
    }
  };
}
