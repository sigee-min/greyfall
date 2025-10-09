import { useCallback, useEffect, useRef, useState } from 'react';
import type { PreferencesState } from '../../store/preferences';
import { usePreferencesStore } from '../../store/preferences';

type NumericPreferenceKey = {
  [K in keyof PreferencesState]: PreferencesState[K] extends number ? K : never
}[keyof PreferencesState];

type SliderPreferenceOptions<K extends NumericPreferenceKey> = {
  key: K;
  toSlider?: (value: PreferencesState[K]) => number;
  fromSlider?: (value: number) => PreferencesState[K];
  onPreview?: (value: PreferencesState[K]) => void;
  commitDelayMs?: number;
};

type SliderPreferenceHookReturn = {
  value: number;
  handleChange: (sliderValue: number) => void;
  flushPending: () => void;
};

export function useSliderPreference<K extends NumericPreferenceKey>(
  options: SliderPreferenceOptions<K>
): SliderPreferenceHookReturn {
  const {
    key,
    toSlider = (value) => value as number,
    fromSlider = (value) => value as PreferencesState[K],
    onPreview,
    commitDelayMs = 120,
  } = options;

  const setPreference = usePreferencesStore((state) => state.setPreference);
  const storedValue = usePreferencesStore((state) => state[key]) as PreferencesState[K];

  const [sliderValue, setSliderValue] = useState<number>(() => toSlider(storedValue));

  const pendingValueRef = useRef<PreferencesState[K] | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setSliderValue(toSlider(storedValue));
  }, [storedValue, toSlider]);

  const flushPending = useCallback(() => {
    if (pendingValueRef.current == null) return;
    setPreference(key, pendingValueRef.current);
    pendingValueRef.current = null;
  }, [key, setPreference]);

  const scheduleFlush = useCallback(() => {
    if (typeof window === 'undefined') {
      flushPending();
      return;
    }
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      flushPending();
      timeoutRef.current = null;
    }, commitDelayMs);
  }, [commitDelayMs, flushPending]);

  const handleChange = useCallback(
    (nextSliderValue: number) => {
      setSliderValue(nextSliderValue);
      const preferenceValue = fromSlider(nextSliderValue);
      pendingValueRef.current = preferenceValue;
      onPreview?.(preferenceValue);
      scheduleFlush();
    },
    [fromSlider, onPreview, scheduleFlush]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      flushPending();
    };
  }, [flushPending]);

  return {
    value: sliderValue,
    handleChange,
    flushPending,
  };
}
