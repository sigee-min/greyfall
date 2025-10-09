import { useEffect } from 'react';

type CursorType =
  | 'default'
  | 'pointer'
  | 'press'
  | 'disabled'
  | 'text'
  | 'crosshair'
  | 'move'
  | 'wait';

const CURSOR_HOTSPOT = { x: 16, y: 16 } as const;

function cursorUrl(file: string, fallback: string): string {
  return `url('/assets/cursors/${file}') ${CURSOR_HOTSPOT.x} ${CURSOR_HOTSPOT.y}, ${fallback}`;
}

const CURSOR_STYLE: Record<CursorType, string> = {
  default: cursorUrl('lantern-default.png', 'auto'),
  pointer: cursorUrl('lantern-pointer.png', 'pointer'),
  press: cursorUrl('lantern-click.png', 'pointer'),
  disabled: cursorUrl('lantern-disabled.png', 'not-allowed'),
  text: cursorUrl('lantern-text.png', 'text'),
  crosshair: cursorUrl('lantern-crosshair.png', 'crosshair'),
  move: cursorUrl('lantern-move.png', 'move'),
  wait: cursorUrl('lantern-progress.png', 'progress')
};

const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number'
]);

const CLASS_CURSOR_MAP: Array<[string, CursorType]> = [
  ['cursor-pointer', 'pointer'],
  ['cursor-click', 'press'],
  ['cursor-press', 'press'],
  ['cursor-disabled', 'disabled'],
  ['cursor-not-allowed', 'disabled'],
  ['cursor-text', 'text'],
  ['cursor-crosshair', 'crosshair'],
  ['cursor-move', 'move'],
  ['cursor-grab', 'move'],
  ['cursor-wait', 'wait'],
  ['cursor-progress', 'wait'],
  ['cursor-default', 'default']
];

function normalizeCursor(value: string | undefined | null): CursorType | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase() as CursorType;
  return CURSOR_STYLE[key] ? key : undefined;
}

function elementIsDisabled(element: Element): boolean {
  if (element.getAttribute('aria-disabled') === 'true') return true;
  if (element.getAttribute('data-disabled') === 'true') return true;

  if (element instanceof HTMLButtonElement) return element.disabled;
  if (element instanceof HTMLInputElement) return element.disabled;
  if (element instanceof HTMLSelectElement) return element.disabled;
  if (element instanceof HTMLTextAreaElement) return element.disabled;
  if (element instanceof HTMLFieldSetElement) return element.disabled;

  return false;
}

function elementIsTextual(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) {
    return !elementIsDisabled(element);
  }
  if (element instanceof HTMLInputElement) {
    if (elementIsDisabled(element)) return false;
    return TEXT_INPUT_TYPES.has(element.type);
  }
  if (element instanceof HTMLElement && element.hasAttribute('contenteditable')) {
    const value = element.getAttribute('contenteditable');
    return value === null || value === '' || value === 'true';
  }
  return false;
}

function cursorFromClassList(element: Element): CursorType | undefined {
  if (!(element instanceof HTMLElement)) return undefined;
  const { classList } = element;
  for (const [name, type] of CLASS_CURSOR_MAP) {
    if (classList.contains(name)) {
      return type;
    }
  }
  return undefined;
}

function cursorFromRole(element: HTMLElement): CursorType | undefined {
  const role = element.getAttribute('role');
  if (!role) return undefined;
  if (role === 'button' || role === 'link' || role === 'switch' || role === 'menuitem' || role === 'option') {
    return elementIsDisabled(element) ? 'disabled' : 'pointer';
  }
  return undefined;
}

function resolveCursor(target: EventTarget | null, root: HTMLElement): CursorType {
  if (!target || !(target instanceof Element)) return 'default';

  let element: Element | null = target;
  while (element && element !== root) {
    if (element instanceof HTMLElement) {
      const dataCursor = normalizeCursor(element.dataset.cursor);
      if (dataCursor) return dataCursor;

      const roleCursor = cursorFromRole(element);
      if (roleCursor) return roleCursor;
    }

    if (elementIsDisabled(element)) {
      return 'disabled';
    }

    if (elementIsTextual(element)) {
      return 'text';
    }

    if (element instanceof HTMLAnchorElement && element.href) {
      return 'pointer';
    }

    if (element instanceof HTMLButtonElement) {
      return elementIsDisabled(element) ? 'disabled' : 'pointer';
    }

    if (element instanceof HTMLInputElement) {
      if (elementIsDisabled(element)) return 'disabled';
      return elementIsTextual(element) ? 'text' : 'pointer';
    }

    if (element instanceof HTMLSelectElement) {
      return elementIsDisabled(element) ? 'disabled' : 'pointer';
    }

    if (element instanceof HTMLTextAreaElement) {
      return elementIsDisabled(element) ? 'disabled' : 'text';
    }

    if (element instanceof HTMLCanvasElement) {
      const classCursor = cursorFromClassList(element);
      return classCursor ?? 'crosshair';
    }

    const classCursor = cursorFromClassList(element);
    if (classCursor) return classCursor;

    element = element.parentElement;
  }

  return 'default';
}

function setBodyCursor(body: HTMLElement, cursor: CursorType) {
  const style = CURSOR_STYLE[cursor];
  if (body.style.cursor !== style) {
    body.style.setProperty('cursor', style, 'important');
  }
}

function needsPressFeedback(element: EventTarget | null): boolean {
  if (!element || !(element instanceof Element)) return false;

  if (element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement) {
    return !elementIsDisabled(element);
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
    return !elementIsDisabled(element);
  }

  if (element instanceof HTMLElement) {
    const role = element.getAttribute('role');
    if (role === 'button' || role === 'link' || role === 'switch' || role === 'menuitem' || role === 'option') {
      return !elementIsDisabled(element);
    }
  }

  return false;
}

export function useCustomCursor(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;

    let lastCursor: CursorType = 'default';
    let activePointer = false;

    const applyCursor = (cursor: CursorType) => {
      const forced = body.classList.contains('waiting');
      const next = forced ? 'wait' : cursor;
      if (next === lastCursor && body.dataset.cursor === next) return;
      lastCursor = next;
      setBodyCursor(body, next);
      body.dataset.cursor = next;
    };

    const updateFromTarget = (target: EventTarget | null) => {
      const cursor = resolveCursor(target, body);
      applyCursor(cursor);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (activePointer) return;
      updateFromTarget(event.target);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        updateFromTarget(event.target);
        return;
      }

      if (needsPressFeedback(event.target)) {
        activePointer = true;
        applyCursor('press');
      } else {
        updateFromTarget(event.target);
      }
    };

    const finishPress = (event: Event) => {
      activePointer = false;
      updateFromTarget(event instanceof PointerEvent ? event.target : document.activeElement);
    };

    const handlePointerCancel = () => {
      activePointer = false;
      applyCursor('default');
    };

    const handlePointerLeave = () => {
      activePointer = false;
      applyCursor('default');
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (activePointer) return;
      updateFromTarget(event.target);
    };

    const handleFocusOut = () => {
      if (activePointer) return;
      applyCursor('default');
    };

    const observer = new MutationObserver(() => {
      if (body.classList.contains('waiting')) {
        applyCursor('wait');
      } else {
        updateFromTarget(document.activeElement);
      }
    });

    observer.observe(body, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('pointermove', handlePointerMove, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointerup', finishPress, true);
    document.addEventListener('pointercancel', handlePointerCancel, true);
    document.addEventListener('pointerleave', handlePointerLeave, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);

    updateFromTarget(document.activeElement);

    return () => {
      observer.disconnect();
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointerup', finishPress, true);
      document.removeEventListener('pointercancel', handlePointerCancel, true);
      document.removeEventListener('pointerleave', handlePointerLeave, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      body.style.cursor = CURSOR_STYLE.default;
    };
  }, []);
}
