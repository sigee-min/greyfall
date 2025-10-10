export function resolveMinimapSize(viewportWidth: number, pointerCoarse: boolean): { size: number } {
  if (pointerCoarse) {
    if (viewportWidth < 768) return { size: 160 };
    if (viewportWidth < 1024) return { size: 180 };
  }
  if (viewportWidth >= 1920) return { size: 280 };
  if (viewportWidth >= 1440) return { size: 240 };
  if (viewportWidth >= 1024) return { size: 220 };
  return { size: 180 };
}

