import { useEffect, useMemo, useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import type { AuthUser } from '../../lib/auth';
import { getAuthUser, setAuthUser } from '../../lib/auth';
import { signinWithGoogle, getAuthNonce } from '../../lib/auth-session';
import { selectAssetPreloadSnapshot, useAssetPreloadStore } from '../../domain/assets/preload-store';

export type LoginGateProps = {
  onSignedIn?: (user: AuthUser) => void;
};

export function LoginGate({ onSignedIn }: LoginGateProps) {
  const snapshot = useAssetPreloadStore(selectAssetPreloadSnapshot);

  const progress = useMemo(() => {
    const total = Math.max(1, snapshot.total || 1);
    const pct = Math.max(0, Math.min(100, Math.round((snapshot.completed / total) * 100)));
    return { pct, completed: snapshot.completed, total: snapshot.total };
  }, [snapshot.completed, snapshot.total]);

  // Fetch server-issued nonce per mount (short-lived)
  const [nonceData, setNonceData] = useState<{ nonce?: string; token?: string }>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getAuthNonce();
      if (alive && r.ok) setNonceData({ nonce: r.nonce, token: r.nonceToken });
    })();
    return () => { alive = false; };
  }, []);

  const handleSuccess = async (cr: CredentialResponse) => {
    try {
      if (!cr.credential) return;
      const result = await signinWithGoogle(cr.credential, nonceData.token ?? nonceData.nonce, nonceData.token ? 'token' : 'nonce');
      if (!result.ok || !result.user?.sub) return;
      setAuthUser(result.user);
      onSignedIn?.(result.user);
    } catch (err) {
      console.warn('[auth] signin error', err);
    }
  };

  const existing = getAuthUser();

  return (
    <div className="pointer-events-auto fixed inset-0 z-[1000]">
      {/* Atmospheric background */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-black" />
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ backgroundImage: 'radial-gradient(1200px 600px at 50% -10%, rgba(56,189,248,0.10), transparent 60%)' }} />

      <div className="relative grid h-full place-items-center p-6">
        <div className="w-[min(560px,94vw)] overflow-hidden rounded-2xl border border-border/60 bg-background/70 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Header */}
          <div className="relative border-b border-border/60 px-6 py-5">
            <div className="flex items-center gap-3">
              {/* Minimal glyph */}
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-primary">
                <path d="M12 3l2.4 4.8L20 9l-4 3.9.9 5.1L12 15.8 7.1 18l.9-5.1L4 9l5.6-1.2L12 3z" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
              <div>
                <h2 className="text-lg font-semibold tracking-wide text-foreground">Greyfall</h2>
                <p className="text-xs text-muted-foreground">세계가 깨어나기 전, 로비로 진입합니다</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            {/* Progress */}
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>로비 에셋 로딩</span>
                <span>
                  {progress.pct}% ({progress.completed}/{progress.total || 0})
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div
          className="h-full bg-gradient-to-r from-primary via-sky-400 to-primary transition-all"
          style={{ width: `${progress.pct}%` }}
        />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                <p className="leading-relaxed">Google로 로그인하여 로비에 합류하세요.</p>
                <p className="mt-1 text-xs">보안 강화를 위해 일회용 nonce를 사용합니다.</p>
              </div>
              <div className="flex items-center gap-4">
                <GoogleLogin onSuccess={handleSuccess} useOneTap={false} auto_select={false} nonce={nonceData.nonce} />
                {existing && (
                  <button
                    type="button"
                    className="rounded-md border border-border/60 bg-background/70 px-3 py-1.5 text-[12px] font-medium hover:border-primary hover:text-primary"
                    onClick={() => onSignedIn?.(existing)}
                    title={existing.name ? `${existing.name}로 계속` : '계속'}
                  >
                    계속
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
