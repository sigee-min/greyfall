import { cn } from '../../lib/utils';

type ErrorDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export function ErrorDialog({ open, title = '알림', message, onClose }: ErrorDialogProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-6 py-10 backdrop-blur">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border/70 bg-background/95 p-6 shadow-2xl">
        <header>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </header>
        <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="flex justify-end">
          <button
            type="button"
            className={cn(
              'rounded-md border border-border bg-background/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition',
              'hover:border-primary hover:text-primary'
            )}
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
