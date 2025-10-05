import type { LobbyMessageBodies, LobbyMessageKind } from '../../protocol';
import type { LobbyStore } from '../session/session-store';

export type Publish = <K extends LobbyMessageKind>(
  kind: K,
  body: LobbyMessageBodies[K],
  context?: string
) => boolean;

export type HostObject = {
  id: string;
  onRequest: (sinceRev?: number) => boolean;
  // Optional but recommended: enable targeted resend and incremental recovery
  getSnapshot?: () => { rev: number; value: unknown } | null | undefined;
  getLogsSince?: (sinceRev: number) => { rev: number; ops: unknown[] }[] | null | undefined;
};

export type ClientObject = {
  id: string;
  onReplace: (rev: number, value: unknown) => void;
  onPatch?: (rev: number, ops: unknown[]) => void;
};

export type CommonDeps = {
  publish: Publish;
  lobbyStore: LobbyStore;
};
