import type { StartLobbyLayoutProps } from './types';
import StartLobbyLayoutBase from './layout-base';

export default function StartLobbyStandardLayout(props: StartLobbyLayoutProps) {
  return <StartLobbyLayoutBase variant="standard" {...props} />;
}
