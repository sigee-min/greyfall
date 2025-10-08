import { FallbackBackground } from '../../../common/fallback-bg';
import { cn } from '../../../../lib/utils';

type LobbyBackdropProps = {
  src: string;
  objectFit?: 'cover' | 'contain';
  objectPosition?: string;
  overlayClassName?: string;
  gradientClassName?: string;
};

export function LobbyBackdrop({
  src,
  objectFit = 'cover',
  objectPosition = 'center',
  overlayClassName,
  gradientClassName
}: LobbyBackdropProps) {
  return (
    <>
      <FallbackBackground src={src} objectFit={objectFit} objectPosition={objectPosition} />
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-slate-950/38 mix-blend-multiply',
          overlayClassName
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950/55 via-slate-900/45 to-slate-950/82',
          gradientClassName
        )}
      />
    </>
  );
}

