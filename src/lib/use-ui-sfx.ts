import { useEffect } from 'react';
import { playUiClick, playUiHover } from './sfx';
import { usePreferencesStore, selectSfxEnabled, selectSfxVolume } from '../store/preferences';

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="switch"]',
  '[data-ui-sound]'
].join(',');

const MUTE_ATTRIBUTE = '[data-ui-sound="mute"]';
const TEXT_INPUT_TYPES = new Set([
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url'
]);

export function useUiSfx() {
  const sfxEnabled = usePreferencesStore(selectSfxEnabled);
  const sfxVolume = usePreferencesStore(selectSfxVolume);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleClick = (event: MouseEvent) => {
      if (!sfxEnabled) return;
      const target = event.target as Element | null;
      const interactive = findInteractiveElement(target);
      if (!interactive) return;
      if (shouldMute(interactive)) return;
      if (shouldSkipClickSound(interactive)) return;

      void playUiClick(sfxVolume);
    };

    const handlePointerOver = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (!sfxEnabled) return;

      const target = event.target as Element | null;
      const interactive = findInteractiveElement(target);
      if (!interactive) return;
      if (shouldMute(interactive)) return;

      const related = event.relatedTarget as Node | null;
      if (related && interactive.contains(related)) return;

      void playUiHover(sfxVolume);
    };

    window.addEventListener('click', handleClick, true);
    window.addEventListener('pointerover', handlePointerOver, true);

    return () => {
      window.removeEventListener('click', handleClick, true);
      window.removeEventListener('pointerover', handlePointerOver, true);
    };
  }, [sfxEnabled, sfxVolume]);
}

function findInteractiveElement(target: Element | null) {
  let element: Element | null = target;
  while (element) {
    if (element.matches(INTERACTIVE_SELECTOR)) {
      if (isDisabled(element)) return null;
      return element as HTMLElement;
    }
    element = element.parentElement;
  }
  return null;
}

function isDisabled(element: Element) {
  if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    if (element.disabled) return true;
  }

  return element.getAttribute('aria-disabled') === 'true';
}

function shouldMute(element: Element) {
  if (element.matches(MUTE_ATTRIBUTE)) return true;
  return Boolean(element.closest(MUTE_ATTRIBUTE));
}

function shouldSkipClickSound(element: Element) {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (!type) return true;
    if (TEXT_INPUT_TYPES.has(type)) return true;
  }
  return false;
}
