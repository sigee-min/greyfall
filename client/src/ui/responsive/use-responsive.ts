import { useEffect, useMemo, useState } from 'react';

export type Orientation = 'portrait' | 'landscape';

export function useResponsive() {
  const [width, setWidth] = useState<number>(() => (typeof window === 'undefined' ? 1024 : window.innerWidth));
  const [height, setHeight] = useState<number>(() => (typeof window === 'undefined' ? 768 : window.innerHeight));
  const [coarsePointer, setCoarsePointer] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(pointer: coarse)').matches
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    const onPointerChange = () => setCoarsePointer(window.matchMedia('(pointer: coarse)').matches);
    window.addEventListener('resize', onResize);
    window.matchMedia('(pointer: coarse)').addEventListener?.('change', onPointerChange);
    return () => {
      window.removeEventListener('resize', onResize);
      window.matchMedia('(pointer: coarse)').removeEventListener?.('change', onPointerChange);
    };
  }, []);

  const orientation: Orientation = useMemo(() => (height >= width ? 'portrait' : 'landscape'), [width, height]);
  const isMobile = width < 640 || coarsePointer;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  return { width, height, orientation, isMobile, isTablet, isDesktop, coarsePointer };
}

