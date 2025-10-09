import { cn } from '../../lib/utils';

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
};

export function ConfirmDialog({
  open,
  title = '확인',
  message,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  children
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 px-6 py-10 backdrop-blur">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border/70 bg-background/95 p-6 shadow-2xl">
        <header>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {message && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>}
        </header>
        {children && <div className="text-sm text-muted-foreground">{children}</div>}
        <div className="mt-2 flex justify-end gap-3">
          <button
            className={cn(
              'rounded-md border border-border bg-background/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition hover:border-destructive hover:text-destructive'
            )}
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className={cn(
              'rounded-md border border-primary/70 bg-primary/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground transition hover:bg-primary'
            )}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

