import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';

function computeCandidates(src: string) {
  const gif = src.endsWith('.gif')
    ? src
    : src.replace(/\.(png|webp|jpg|jpeg)$/i, '.gif');
  const png = gif.replace(/\.gif$/i, '.png');
  return { gif, png };
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
  const { gif, png } = useMemo(() => computeCandidates(src), [src]);
  const { gif: fbGif, png: fbPng } = useMemo(() => computeCandidates(fallbackSrc), [fallbackSrc]);
  const [current, setCurrent] = useState<string>(gif);

  useEffect(() => {
    setCurrent(gif);
  }, [gif]);

  const handleError = useCallback(() => {
    const lower = current.toLowerCase();
    if (lower === gif.toLowerCase()) {
      setCurrent(png);
      return;
    }
    if (lower === png.toLowerCase()) {
      setCurrent(fbGif);
      return;
    }
    if (lower === fbGif.toLowerCase()) {
      setCurrent(fbPng);
      return;
    }
  }, [current, fbGif, fbPng, gif, png]);

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
