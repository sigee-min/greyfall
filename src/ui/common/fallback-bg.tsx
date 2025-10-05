import { useCallback, useEffect, useMemo, useState } from 'react';
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
};

export function FallbackBackground({ src, className, alt = '' }: Props) {
  const { gif, png } = useMemo(() => computeCandidates(src), [src]);
  const [current, setCurrent] = useState<string>(gif);

  useEffect(() => {
    setCurrent(gif);
  }, [gif]);

  const handleError = useCallback(() => {
    if (current.toLowerCase().endsWith('.gif')) {
      setCurrent(png);
    }
  }, [current, png]);

  return (
    <img
      src={current}
      onError={handleError}
      alt={alt}
      className={cn('absolute inset-0 h-full w-full object-cover', className)}
      aria-hidden
    />
  );
}

