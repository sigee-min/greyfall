import { cn } from '../../../../lib/utils';

type Alignment = 'start' | 'center' | 'end';
type Variant = 'standard' | 'wide' | 'tall';

type LobbyHeroProps = {
  title: string;
  subtitle: string;
  description: string;
  brand?: string | null;
  alignment?: Alignment;
  variant?: Variant;
  className?: string;
};

const variantStyles: Record<Variant, { container: string; brand: string; title: string; subtitle: string; description: string }> = {
  standard: {
    container: 'gap-5',
    brand: 'text-xs uppercase tracking-[0.38em] text-primary/75',
    title: 'max-w-3xl text-4xl font-semibold uppercase tracking-[0.2em] text-slate-100 drop-shadow-[0_22px_45px_rgba(2,6,23,0.7)] sm:text-5xl sm:tracking-[0.24em] lg:text-6xl lg:tracking-[0.3em]',
    subtitle: 'text-xs uppercase tracking-[0.4em] text-primary/80 sm:text-sm sm:tracking-[0.46em] lg:text-base lg:tracking-[0.5em]',
    description: 'max-w-2xl text-sm text-slate-200/85 sm:text-base lg:text-lg lg:text-slate-100/85'
  },
  wide: {
    container: 'gap-5',
    brand: 'text-xs uppercase tracking-[0.38em] text-primary/70 lg:text-sm lg:tracking-[0.42em]',
    title: 'max-w-3xl text-5xl font-semibold uppercase tracking-[0.22em] text-slate-100 drop-shadow-[0_24px_48px_rgba(2,6,23,0.72)] md:text-6xl md:tracking-[0.28em] xl:text-7xl xl:tracking-[0.34em]',
    subtitle: 'text-sm uppercase tracking-[0.42em] text-primary/80 md:text-base md:tracking-[0.48em]',
    description: 'max-w-xl text-base text-slate-200/90 md:text-lg xl:text-xl xl:text-slate-100/85'
  },
  tall: {
    container: 'gap-4 text-center',
    brand: 'text-xs uppercase tracking-[0.34em] text-primary/70',
    title: 'text-3xl font-semibold uppercase tracking-[0.2em] text-slate-100 drop-shadow-[0_16px_32px_rgba(2,6,23,0.6)] sm:text-4xl',
    subtitle: 'text-xs uppercase tracking-[0.36em] text-primary/80 sm:text-sm',
    description: 'text-sm text-slate-200/80 sm:text-base'
  }
};

const alignmentClass: Record<Alignment, string> = {
  start: 'items-start text-left',
  center: 'items-center text-center',
  end: 'items-end text-right'
};

export function LobbyHero({
  title,
  subtitle,
  description,
  brand,
  alignment = 'center',
  variant = 'standard',
  className
}: LobbyHeroProps) {
  const variantTokens = variantStyles[variant];

  return (
    <div className={cn('flex flex-col', alignmentClass[alignment], variantTokens.container, className)}>
      {brand ? <p className={variantTokens.brand}>{brand}</p> : null}
      <h1 className={variantTokens.title}>{title}</h1>
      <p className={variantTokens.subtitle}>{subtitle}</p>
      <p className={variantTokens.description}>{description}</p>
    </div>
  );
}

