type DeveloperDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function DeveloperDialog({ open, onClose }: DeveloperDialogProps) {
  if (!open) return null;

  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 px-6 py-10 backdrop-blur">
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-border/60 bg-background/95 p-6 shadow-2xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Greyfall Console</p>
            <h2 className="text-2xl font-semibold">Developer Notes</h2>
          </div>
          <button
            type="button"
            className="rounded-md border border-border bg-background/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground transition hover:border-primary hover:text-primary"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <section className="space-y-4 text-sm text-muted-foreground">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Hi! I'm Sigee!</h3>
            <p>
              Greyfall TRPG Console is a browser-based stage and command interface built with React, Zustand, and PixiJS.
              It synchronises tactical scenes, LLM-assisted prompts, and WebRTC peer sessions for narrative play.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Stack & Tooling</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Rendering: Vite + React 18, PixiJS 7, Tailwind/shadcn styling baseline.</li>
              <li>State: Zustand stores for session, preferences, and peer sync.</li>
              <li>RTC: Browser-native WebRTC with STUN bootstrap and manual signalling.</li>
              <li>AI Assist: WebGPU hooks prepared for local WebLLM integration.</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Contact</h3>
            <p>
              Prototype maintained for the Greyfall campaign. For collaboration or feedback, reach the Lantern Circle dev collective at <span className="font-mono text-primary">minshigee@gmail.com</span>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
