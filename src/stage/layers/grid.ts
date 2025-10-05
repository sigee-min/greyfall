import * as PIXI from 'pixi.js';

export function createGridLayer(): PIXI.Container {
  const grid = new PIXI.Graphics();
  grid.alpha = 0.35;
  redraw(grid, 50, 50, 40, 40);
  return grid;
}

export function redraw(
  grid: PIXI.Graphics,
  cols: number,
  rows: number,
  cellWidth: number,
  cellHeight: number
) {
  grid.clear();
  grid.lineStyle({ color: 0x6b7280, width: 1, alpha: 0.4 });
  const width = cols * cellWidth;
  const height = rows * cellHeight;

  for (let x = 0; x <= cols; x += 1) {
    grid.moveTo(x * cellWidth, 0);
    grid.lineTo(x * cellWidth, height);
  }
  for (let y = 0; y <= rows; y += 1) {
    grid.moveTo(0, y * cellHeight);
    grid.lineTo(width, y * cellHeight);
  }
}
