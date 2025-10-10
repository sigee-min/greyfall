import { useMemo } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import type { AuthUser } from '../../lib/auth';
import { getAuthUser, setAuthUser } from '../../lib/auth';
import { signinWithGoogle } from '../../lib/auth-session';
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

  // Stable nonce per mount to mitigate replay; passed to Google and server
  const nonce = useMemo(() => {
    try {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    }
  }, []);

  const handleSuccess = async (cr: CredentialResponse) => {
    try {
      if (!cr.credential) return;
      const result = await signinWithGoogle(cr.credential, nonce);
      if (!result.ok || !result.user?.sub) return;
      setAuthUser(result.user);
      onSignedIn?.(result.user);
    } catch (err) {
      console.warn('[auth] signin error', err);
    }
  };

  const existing = getAuthUser();

  return (
    <div className="pointer-events-auto fixed inset-0 z-[1000] grid place-items-center bg-black/80">
      <div className="w-[min(520px,92vw)] rounded-2xl border border-border/60 bg-card/80 p-6 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Welcome</h2>
          <p className="text-sm text-muted-foreground">메인 로비 에셋을 준비하는 동안 Google로 로그인해 주세요.</p>
        </div>
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>로비 에셋 로딩</span>
            <span>{progress.pct}% ({progress.completed}/{progress.total || 0})</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <GoogleLogin onSuccess={handleSuccess} useOneTap={false} auto_select={false} nonce={nonce} />
          {existing && (
            <div className="text-xs text-muted-foreground">
              {existing.name ? `${existing.name}로 로그인됨` : '로그인됨'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
