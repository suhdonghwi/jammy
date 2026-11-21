/**
 * Development only: the figure page (`?figure`, ui/dev/Figure.tsx) draws
 * the board as a figure for print, so only the tiles in this box are drawn:
 * the floor outside it is left out, and so are eggs and goal columns. Null
 * everywhere else, where nothing changes.
 */
export interface ClipBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const figureClip: { box: ClipBox | null } = { box: null };

/** The figure page renders at the page's full pixel ratio, past MAX_DPR. */
export const figurePage = import.meta.env.DEV && new URLSearchParams(location.search).has('figure');

export function inFigureClip(x: number, y: number): boolean {
  const b = figureClip.box;
  return !b || (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
}
