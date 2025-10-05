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

