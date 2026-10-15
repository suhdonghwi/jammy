import { useLayoutEffect, useRef } from 'react';
import { useGame } from '../../game/store';
import { displayNames } from '../../levels/level';
import { useHover } from '../../scene/hover';
import { tileState } from '../../scene/tiles';

// What is the pointer on? The hovered tile's values, where a frog there would
// go, and whether it is in the area.

// a dark pill; with tags on its right it hugs them more tightly than its text on the left
const READOUT = 'flex animate-[fade_0.15s_ease-out] items-center gap-2 rounded-full bg-ink/86 px-3.5 py-1.75 text-sm text-white shadow-card has-[>span+span]:pr-2';
const TAG = 'rounded-full px-2.5 py-0.75 font-display text-sm font-medium';

/** Room the readout needs to sit in the top bar's row (values plus two tags). */
const READOUT_ROOM = 440;

/**
 * Lift the readout into the top bar's row when the bar's middle is free (the
 * tutorial, wide screens); otherwise it stays just below the bar. The check
 * uses a fixed width, not the current text, so it never hops between rows
 * while you hover around.
 */
function useTopRowPlacement(ref: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
    const groups = document.querySelectorAll('.topbar > .pill-group');
    if (!groups.length) return;
    const left = groups[0].getBoundingClientRect();
    const right = groups[groups.length - 1].getBoundingClientRect();
    const mid = window.innerWidth / 2;
    const half = READOUT_ROOM / 2;
    const oneRow = Math.abs(left.top - right.top) < 4;
    const fits = mid - half >= left.right && (groups.length < 2 || mid + half <= right.left);
    if (!oneRow || !fits) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translateY(${left.top + left.height / 2 - (r.top + r.height / 2)}px)`;
  });
}

export function HoverReadout() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const tile = useHover((s) => s.tile);
  const ref = useRef<HTMLDivElement>(null);
  useTopRowPlacement(ref);
  if (!tile || !reveal.axes) return null;
  const s = tileState(level, tile[0], tile[1], pond);
  const vals = displayNames(level).filter((n) => n in s).map((n) => `${n} = ${s[n]}`).join(', ');
  // tiles the precondition rules out: there is no such state, so nothing more to say
  if (!level.fast.pondReq(s)) {
    return (
      <div className={READOUT} ref={ref}>
        <span className="font-mono font-semibold">{vals}</span>
        <span className={`${TAG} bg-white/6 text-[#9aa3b5]`}>not a possible state</span>
      </div>
    );
  }
  const cont = level.fast.guard(s) === true;
  let next: string | null = null;
  if (cont) {
    const n: Record<string, number> = { ...s };
    for (const v in level.fast.next) n[v] = level.fast.next[v](s) as number;
    next = `(${n[level.view.x]}, ${n[level.view.y]})`;
  }
  const inArea = reveal.formula && valid ? valid.fast(s) === true : null;
  const goal = !cont && level.fast.post(s) === true;
  return (
    <div className={READOUT} ref={ref}>
      <span className="font-mono font-semibold">{vals}</span>
      {reveal.stop && (
        <span className={`${TAG} ${cont ? 'bg-white/12' : 'bg-[#efa52b]/25 text-[#ffd48a]'}`}>{cont ? `hops to ${next}` : goal && reveal.goals ? 'stops · goal ✓' : 'stops here'}</span>
      )}
      {inArea !== null && <span className={`${TAG} ${inArea ? 'bg-slab/35 text-[#d5e6ff]' : 'bg-white/8 text-[#c9cfdb]'}`}>{inArea ? 'in the area' : 'outside the area'}</span>}
    </div>
  );
}
