import { cn } from '../../lib/utils';
import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn('absolute inset-x-0 bottom-0 flex justify-center')}>
        <div className="mx-3 mb-3 w-full max-w-3xl rounded-2xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">{title}</h3>
            <button
              type="button"
              className="rounded-md border border-border/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground hover:border-primary hover:text-primary"
              onClick={onClose}
            >
              닫기
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

