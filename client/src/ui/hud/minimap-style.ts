export type MiniStyle = {
  bg: string;
  border: string;
  grid: string;
  fog: string;
  tokenAlly: string;
  tokenNeutral: string;
  tokenEnemy: string;
  viewport: string;
};

export function defaultMiniStyle(): MiniStyle {
  return {
    bg: 'rgba(10, 15, 22, 0.85)',
    border: 'rgba(56, 189, 248, 0.9)', // sky-400
    grid: 'rgba(148, 163, 184, 0.25)', // slate-400
    fog: 'rgba(2, 6, 23, 0.75)', // slate-950
    tokenAlly: 'rgba(34, 197, 94, 0.95)', // green-500
    tokenNeutral: 'rgba(180, 180, 180, 0.95)',
    tokenEnemy: 'rgba(244, 63, 94, 0.95)', // rose-500
    viewport: 'rgba(56, 189, 248, 0.95)'
  };
}

