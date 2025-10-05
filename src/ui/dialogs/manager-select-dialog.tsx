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
      <div className="w-[min(640px,92vw)] rounded-2xl border border-border/60 bg-card/95 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-primary/70">Guidance</p>
            <h3 className="text-xl font-semibold text-foreground">운명의 안내인을 고르시오.</h3>
          </div>
          <button
            type="button"
            className="rounded-md border border-border/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <button
            type="button"
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/5"
            onClick={() => onSelect('hasty')}
          >
            <span className="mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary transition-transform duration-300 ease-out group-hover:-rotate-3 group-hover:scale-110">
              <img src="/assets/icons/hasty.svg" alt="강림" className="h-5 w-5" />
            </span>
            <span>
              <p className="text-sm font-semibold text-foreground">강림</p>
              <p className="mt-1 text-xs text-muted-foreground">즉각 대응</p>
            </span>
          </button>
          <button
            type="button"
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/5"
            onClick={() => onSelect('fast')}
          >
            <span className="mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary transition-transform duration-300 ease-out group-hover:rotate-6 group-hover:scale-110">
              <img src="/assets/icons/fast.svg" alt="백무상" className="h-5 w-5" />
            </span>
            <span>
              <p className="text-sm font-semibold text-foreground">백무상</p>
              <p className="mt-1 text-xs text-muted-foreground">민첩함</p>
            </span>
          </button>

          <button
            type="button"
            className="group flex items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-4 text-left transition hover:border-primary hover:bg-primary/5"
            onClick={() => onSelect('smart')}
          >
            <span className="mr-1 grid h-10 w-10 place-items-center rounded-full bg-primary transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110">
              <img src="/assets/icons/smart.svg" alt="흑무상" className="h-5 w-5" />
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
