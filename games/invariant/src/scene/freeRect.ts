export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const area = (r: Rect) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);

const overlaps = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

function edges(view: Rect, blocks: Rect[], lo: 'left' | 'top', hi: 'right' | 'bottom'): number[] {
  const all = [view[lo], view[hi], ...blocks.flatMap((b) => [b[lo], b[hi]])];
  return [...new Set(all.filter((v) => v >= view[lo] && v <= view[hi]))].sort((a, b) => a - b);
}

export function freeRect(width: number, height: number): Rect {
  const view: Rect = { left: 0, top: 0, right: width, bottom: Math.min(height, window.innerHeight) };
  const blocks: Rect[] = [];
  for (const el of document.querySelectorAll('[data-frame]')) {
    const b = el.getBoundingClientRect();
    if (b.width && b.height && overlaps(b, view)) blocks.push(b);
  }
  const xs = edges(view, blocks, 'left', 'right');
  const ys = edges(view, blocks, 'top', 'bottom');
  let best = view;
  let bestArea = blocks.length ? 0 : area(view);
  for (const [i, left] of xs.entries())
    for (const right of xs.slice(i + 1))
      for (const [j, top] of ys.entries())
        for (const bottom of ys.slice(j + 1)) {
          const r = { left, top, right, bottom };
          const a = area(r);
          if (a <= bestArea || blocks.some((b) => overlaps(b, r))) continue;
          best = r;
          bestArea = a;
        }
  return best;
}
