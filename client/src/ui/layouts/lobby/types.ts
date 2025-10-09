export type LobbyLayoutProps = {
  playerName: string;
  joinCode: string;
  canCreate: boolean;
  canJoin: boolean;
  onNameChange: (value: string) => void;
  onJoinCodeChange: (value: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onOptions: () => void;
  onAbout: () => void;
  background: string;
};
