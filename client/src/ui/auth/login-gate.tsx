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
  // Hardcoded hero image path; place file at client/public/assets/login/hero.svg
  const heroUrl = '/assets/login/hero.svg';

  return (
    <div className="pointer-events-auto fixed inset-0 z-[1000]">
      {/* Subtle, weighty backdrop */}
      <div className="absolute inset-0 bg-slate-950" />
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={heroUrl}
          alt=""
          className="h-full w-full object-cover opacity-35"
          decoding="async"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_400px_at_50%_-10%,rgba(148,163,184,0.06),transparent_60%)]" />

      <div className="relative grid h-full place-items-center p-6">
        <div className="w-[min(560px,94vw)] overflow-hidden rounded-xl border border-border/60 bg-background/70 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/60">
          {/* Header */}
          <div className="relative border-b border-border/60 px-6 py-5">
            <div className="flex items-center gap-3">
              {/* Minimal glyph (muted) */}
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="text-slate-400">
                <path d="M12 3l2.2 4.5L19.5 9l-3.7 3.6.8 4.8L12 15.4 7.4 17.4l.8-4.8L4.5 9l5.3-1.5L12 3z" stroke="currentColor" strokeWidth="1.1" fill="none" />
              </svg>
              <div>
                <h2 className="text-[15px] font-semibold tracking-[0.12em] text-foreground uppercase">Greyfall</h2>
                <p className="text-[11px] text-muted-foreground">세션 준비 중 · 인증 필요</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            {/* Progress (neutral) */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>리소스 로딩</span>
                <span>{progress.pct}% ({progress.completed}/{progress.total || 0})</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                <div className="h-full bg-foreground/70 transition-all" style={{ width: `${progress.pct}%` }} />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[13px] leading-relaxed text-muted-foreground">
                <p>Google 계정으로 인증 후 로비에 입장합니다.</p>
                <p className="mt-1 text-[11px]">로딩이 끝나면 회랑의 문이 열립니다.</p>
              </div>
              <div className="flex items-center gap-3">
                <GoogleLogin onSuccess={handleSuccess} useOneTap={false} auto_select={false} nonce={nonceData.nonce} />
                {existing && (
                  <button
                    type="button"
                    className="rounded-md border border-border/60 bg-background/60 px-3 py-1.5 text-[12px] font-medium text-foreground/90 hover:border-foreground/30"
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
