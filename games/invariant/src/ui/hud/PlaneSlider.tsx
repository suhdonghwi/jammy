import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../game/store';
import { CARD } from '../classes';

// Levels with a leftover input show one plane per value of it: a slim vertical
// slider picks which, and the plane switches at once. The thumb carries the
// value, so the slider is only as wide as the widest value.

export function PlaneSlider() {
  const level = useGame((s) => s.level)!;
  const plane = useGame((s) => s.plane);
  const busy = useGame((s) => s.busy);
  // the input's values that exist: the precondition may rule some out, and the slider skips them
  const values = useMemo(() => {
    const out: number[] = [];
    if (!level.plane || !level.planes) return out;
    for (let p = level.planes.min; p <= level.planes.max; p++) {
      if (level.fast.planeReq({ [level.plane]: p, [level.view.x]: 0, [level.view.y]: 0 }) === true) out.push(p);
    }
    return out;
  }, [level]);
  const index = Math.max(0, values.indexOf(plane));
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // a switch the slider didn't make (the hand going to a counterexample's plane) makes the thumb pop
  const own = useRef(false);
  const [pops, setPops] = useState(0);
  useEffect(() => {
    if (own.current) own.current = false;
    else setPops((k) => k + 1);
  }, [plane]);

  const go = (i: number) => {
    const p = values[Math.max(0, Math.min(values.length - 1, i))];
    if (p === undefined || p === useGame.getState().plane || useGame.getState().busy) return;
    own.current = true;
    useGame.setState({ plane: p });
  };
  /** The value under the pointer: larger values are higher up. */
  const goTo = (clientY: number) => {
    const r = track.current?.getBoundingClientRect();
    if (!r || values.length < 2) return;
    const u = 1 - (clientY - r.top) / r.height;
    go(Math.round(Math.max(0, Math.min(1, u)) * (values.length - 1)));
  };

  if (!values.length) return null;
  // the thumb fits the widest value (monospaced), so its width never changes
  const widest = Math.max(...values.map((v) => String(v).length));
  const width = `calc(${widest}ch + 0.75rem)`;
  const at = values.length > 1 ? (index / (values.length - 1)) * 100 : 0;
  // the thumb and fill glide when the value jumps, and follow the pointer while dragging
  const glide = dragging ? 'duration-0' : 'duration-200 ease-out';
  return (
    <div className={`${CARD} ml-auto flex animate-slide-in-right flex-col items-center gap-1 self-center rounded-full px-1.5 pt-2.5 pb-3 ${busy ? 'opacity-60' : ''}`}>
      <span className="font-mono text-xs font-semibold text-muted">{level.plane}</span>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={`Input ${level.plane}`}
        aria-valuemin={values[0]}
        aria-valuemax={values[values.length - 1]}
        aria-valuenow={plane}
        aria-disabled={busy}
        className={`relative my-3 flex h-44 justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-4 max-sm:h-32 ${busy ? 'cursor-default' : 'cursor-pointer'}`}
        style={{ width }}
        onPointerDown={(e) => {
          if (busy) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          goTo(e.clientY);
        }}
        onPointerMove={(e) => dragging && goTo(e.clientY)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(e) => {
          const step = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
          if (step) {
            e.preventDefault();
            go(index + step);
          } else if (e.key === 'Home' || e.key === 'End') {
            e.preventDefault();
            go(e.key === 'End' ? values.length - 1 : 0);
          }
        }}
      >
        {/* the track, filled up to the thumb */}
        <div className="absolute inset-y-0 w-1.5 rounded-full bg-shade/10">
          <div className={`absolute inset-x-0 bottom-0 rounded-full bg-brand/40 transition-[height] ${glide}`} style={{ height: `${at}%` }} />
        </div>
        {/* the thumb carries the value */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 translate-y-1/2 transition-[bottom] ${glide}`}
          style={{ bottom: `${at}%` }}
        >
          <div
            key={pops}
            className="animate-[pop_0.3s_ease-out] rounded-full bg-brand py-0.5 text-center font-mono text-xs font-bold text-white shadow-[0_2px_0_var(--color-brand-deep)]"
            style={{ width }}
          >
            {plane}
          </div>
        </div>
      </div>
    </div>
  );
}
