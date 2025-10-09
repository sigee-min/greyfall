import type { StartLobbyLayoutProps } from './types';
import StartLobbyLayoutBase from './layout-base';

export default function StartLobbyWideLayout(props: StartLobbyLayoutProps) {
  return <StartLobbyLayoutBase variant="wide" {...props} />;
}
