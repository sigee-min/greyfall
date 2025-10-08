import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';

function computeCandidateList(src: string): string[] {
  const list: string[] = [];
  const push = (s: string) => { if (!list.includes(s)) list.push(s); };
  const addVariants = (base: string) => {
    push(base);
    const ext = base.match(/\.(png|webp|jpg|jpeg|gif)$/i)?.[0] || '';
    const stem = ext ? base.slice(0, -ext.length) : base;
    ['.webp', '.png', '.gif', '.jpg', '.jpeg'].forEach((e) => push(stem + e));
  };
  addVariants(src);
  return list;
}

type Props = {
  src: string;
  className?: string;
  alt?: string;
  fallbackSrc?: string; // default to main lobby background
  objectFit?: CSSProperties['objectFit'];
  objectPosition?: CSSProperties['objectPosition'];
  style?: CSSProperties;
};

const LOBBY_BG = '/assets/bg/theme.png';

export function FallbackBackground({
  src,
  className,
  alt = '',
  fallbackSrc = LOBBY_BG,
  objectFit,
  objectPosition,
  style
}: Props) {
  const primaryList = useMemo(() => computeCandidateList(src), [src]);
  const fallbackList = useMemo(() => computeCandidateList(fallbackSrc), [fallbackSrc]);
  const candidates = useMemo(() => [...primaryList, ...fallbackList], [primaryList, fallbackList]);
  const [index, setIndex] = useState<number>(0);
  const current = candidates[Math.min(index, candidates.length - 1)];

  useEffect(() => { setIndex(0); }, [src, fallbackSrc]);

  const handleError = useCallback(() => {
    setIndex((i) => Math.min(i + 1, candidates.length - 1));
  }, [candidates.length]);

  return (
    <img
      src={current}
      style={{ objectFit, objectPosition, ...style }}
      onError={handleError}
      alt={alt}
      className={cn('absolute inset-0 h-full w-full object-cover', className)}
      aria-hidden
    />
  );
}
