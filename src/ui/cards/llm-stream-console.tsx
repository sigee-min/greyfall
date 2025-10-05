import { FormEvent, useMemo, useRef, useState } from 'react';

type Manager = 'hasty' | 'fast' | 'smart';

type Props = {
  defaultManager?: Manager;
  onClose?: () => void;
};

export function LlmStreamConsole({ defaultManager = 'smart', onClose }: Props) {
  const [manager, setManager] = useState<Manager>(defaultManager);
  const [prompt, setPrompt] = useState('간단한 인사 한 줄로만 출력해 주세요.');
  const [maxTokens, setMaxTokens] = useState(96);
  const [temperature, setTemperature] = useState(0.5);
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const disabled = streaming;
  const tokenCount = useMemo(() => output.length, [output]);

  const handleStart = async (e?: FormEvent) => {
    e?.preventDefault();
    if (streaming) return;
    setError(null);
    setOutput('');
    setStatus('엔진 준비 중…');
    setStreaming(true);
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const {
        loadQwenEngineByManager,
        ensureChatApiReady,
        probeChatApiActive,
        generateQwenChat
      } = await import('../../llm/qwen-webgpu');

      await loadQwenEngineByManager(manager, (report: { text?: string; progress?: number }) => {
        if (report.text) setStatus(report.text);
      });
      await ensureChatApiReady(10_000);
      // 적극적으로 활성 프로브를 재확인 (프록시 바인딩 레이스 완화)
      {
        let ok = await probeChatApiActive(800);
        let attempts = 0;
        while (!ok && attempts < 8) {
          setStatus('준비 확인 중…');
          await delay(250);
          ok = await probeChatApiActive(800);
          attempts += 1;
        }
      }

      setStatus('스트리밍 시작…');
      let text = '';
      try {
        text = await generateQwenChat(prompt, {
          maxTokens,
          temperature,
          signal: ctl.signal,
          onToken: (tok: string) => setOutput((prev) => prev + tok)
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/reading 'engine'|not a function/i.test(msg)) {
          // 일시 레이스로 판단하고 짧게 재시도
          await delay(300);
          text = await generateQwenChat(prompt, {
            maxTokens,
            temperature,
            signal: ctl.signal,
            onToken: (tok: string) => setOutput((prev) => prev + tok)
          });
        } else {
          throw err;
        }
      }
      if (!output) setOutput(text);
      setStatus('완료');
    } catch (err) {
      if ((err as any)?.name === 'AbortError') {
        setStatus('취소됨');
      } else {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus('실패');
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    try {
      abortRef.current?.abort();
    } catch {}
  };

  return (
    <section className="rounded-xl border border-border bg-card/70">
      <form onSubmit={handleStart} className="space-y-3 p-4">
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.35em] text-muted-foreground">LLM Stream Tester</h2>
          {onClose && (
            <button
              type="button"
              className="rounded-md border border-border/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground transition hover:border-primary hover:text-primary"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </header>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">Manager</span>
            <select
              className="rounded-md border border-border bg-background/70 px-2 py-1"
              value={manager}
              onChange={(e) => setManager(e.target.value as Manager)}
              disabled={disabled}
            >
              <option value="hasty">hasty (0.6B)</option>
              <option value="fast">fast (1.7B)</option>
              <option value="smart">smart (4B)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">Max Tokens</span>
            <input
              type="number"
              className="rounded-md border border-border bg-background/70 px-2 py-1"
              min={8}
              max={2048}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              disabled={disabled}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-muted-foreground">Temperature</span>
            <input
              type="number"
              step={0.1}
              min={0}
              max={2}
              className="rounded-md border border-border bg-background/70 px-2 py-1"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              disabled={disabled}
            />
          </label>
        </div>

        <textarea
          className="h-28 w-full resize-y rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          placeholder="LLM에게 보낼 프롬프트를 입력하세요."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />

        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md border border-primary bg-primary/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-primary-foreground transition hover:bg-primary"
            disabled={disabled}
          >
            Stream
          </button>
          <button
            type="button"
            className="rounded-md border border-border bg-background/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground transition hover:border-destructive hover:text-destructive"
            onClick={handleCancel}
            disabled={!streaming}
          >
            Cancel
          </button>
          <span className="text-xs text-muted-foreground">{status}</span>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="rounded-md border border-border/60 bg-background/80 p-3">
          <p className="mb-2 text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Output ({tokenCount} chars)</p>
          <pre className="max-h-56 whitespace-pre-wrap break-words overflow-y-auto text-sm">{output}</pre>
        </div>
      </form>
    </section>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
