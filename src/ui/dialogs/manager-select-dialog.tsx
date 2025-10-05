import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (manager: 'hasty' | 'fast' | 'smart') => void;
};

export function ManagerSelectDialog({ open, onClose, onSelect }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="hud-card w-[min(640px,92vw)] rounded-2xl border border-border/60 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-accent/80">Judgement</p>
            <h3 className="text-xl font-semibold text-foreground">운명의 심판자를 고르시오.</h3>
          </div>
          <button
            type="button"
            className="hud-button rounded-md border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <button
            type="button"
            className="hud-button group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/10"
            onClick={() => onSelect('hasty')}
          >
            <span className="glow-primary mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/45 ring-offset-1 ring-offset-background shadow shadow-black/40 transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path fill="currentColor" d="M12 2l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5z"/>
              </svg>
            </span>
            <span>
              <p className="text-sm font-semibold text-foreground">강림</p>
              <p className="mt-1 text-xs text-muted-foreground">즉각 대응</p>
            </span>
          </button>
          <button
            type="button"
            className="hud-button group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/10"
            onClick={() => onSelect('fast')}
          >
            <span className="glow-primary mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/45 ring-offset-1 ring-offset-background shadow shadow-black/40 transition-transform duration-300 ease-out group-hover:rotate-6 group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path fill="currentColor" d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>
              </svg>
            </span>
            <span>
              <p className="text-sm font-semibold text-foreground">백무상</p>
              <p className="mt-1 text-xs text-muted-foreground">민첩함</p>
            </span>
          </button>

          <button
            type="button"
            className="hud-button group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/10"
            onClick={() => onSelect('smart')}
          >
            <span className="glow-primary mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/45 ring-offset-1 ring-offset-background shadow shadow-black/40 transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path fill="currentColor" d="M12 2 19 6v6c0 5-3.5 9-7 10C8.5 21 5 17 5 12V6l7-4z"/>
              </svg>
            </span>
            <span>
              <p className="text-sm font-semibold text-foreground">흑무상</p>
              <p className="mt-1 text-xs text-muted-foreground">신중함</p>
            </span>
          </button>
        </div>
        <div className="mt-5 rounded-xl border border-border/60 bg-background/60 p-4 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            <span className="text-primary">채용 전</span> 유의사항
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>최신 Chrome/Edge + <span className="text-primary">HTTPS</span></li>
            <li><span className="text-primary">WebGPU</span> 지원 브라우저</li>
            <li>민첩: <span className="text-primary">2GB+</span> VRAM 권장</li>
            <li>심사숙고: <span className="text-primary">4GB+</span> VRAM 권장</li>
            <li>첫 배치 시 자료 다운로드 시간 발생</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
