export type SessionRole = 'host' | 'guest';
export type SessionMode = SessionRole;

export type SessionParticipant = {
  id: string;
  name: string;
  tag: string;
  ready: boolean;
  role: SessionRole;
  isSelf?: boolean;
};

// Backwards-compatible aliases for legacy naming
export type LobbyParticipant = SessionParticipant;
