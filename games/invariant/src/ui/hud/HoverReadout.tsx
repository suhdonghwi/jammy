import { useLayoutEffect, useRef } from 'react';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { scalarNames } from '../../levels/level';
import { useHover } from '../../scene/hover';
import { hopFrom, tileState } from '../../levels/tiles';

const READOUT =
  'flex animate-[fade_var(--duration-micro)_var(--ease-entrance)] items-center gap-2 rounded-full bg-ink/86 p-1.25 text-sm text-white shadow-card has-[>span+span]:pr-2 compact:mx-4 compact:flex-wrap compact:justify-center compact:pr-1.25!';
const TAG = 'rounded-full px-2.5 py-0.75 font-display text-sm font-medium compact:hidden';
const VAR = 'flex items-baseline gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 font-mono';

function Values({ names, state }: { names: string[]; state: Record<string, unknown> }) {
  return (
    <span className="flex flex-wrap justify-center gap-1">
      {names.map((n) => (
        <span key={n} className={VAR}>
          <span className="text-white/55">{n}</span>
          <span className="font-semibold tabular-nums">{String(state[n])}</span>
        </span>
      ))}
    </span>
  );
}

const READOUT_ROOM = 440;

function useTopRowPlacement(ref: React.RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = '';
    const pill = document.querySelector('[data-topbar] > [data-pill]')?.getBoundingClientRect();
    if (!pill || window.innerWidth / 2 - READOUT_ROOM / 2 < pill.right) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translateY(${pill.top + pill.height / 2 - (r.top + r.height / 2)}px)`;
  });
}

export function HoverReadout() {
  const level = useGame((s) => s.level)!;
  const inputs = useGame((s) => s.inputs);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const tile = useHover((s) => s.tile);
  const ref = useRef<HTMLDivElement>(null);
  const tr = useT();
  useTopRowPlacement(ref);
  if (!tile || !reveal.axes) return null;
  const s = tileState(level, tile[0], tile[1], inputs);
  const names = scalarNames(level).filter((n) => n in s);
  if (!level.fast.planeReq(s)) {
    return (
      <div className={READOUT} ref={ref}>
        <Values names={names} state={s} />
        <span className={`${TAG} bg-white/6 text-[#9aa3b5]`}>{tr.hover.impossible}</span>
      </div>
    );
  }
  const next = hopFrom(level, s);
  const cont = next !== null;
  const inArea = reveal.formula && valid ? valid.fast(s) === true : null;
  const goal = !cont && level.fast.post(s) === true;
  return (
    <div className={READOUT} ref={ref}>
      <Values names={names} state={s} />
      {reveal.stop && (
        <span className={`${TAG} ${cont ? 'bg-white/12' : 'bg-[#efa52b]/25 text-[#ffd48a]'}`}>{cont ? tr.hover.hopsTo(`(${next[0]}, ${next[1]})`) : goal && reveal.goals ? tr.hover.stopsOnGoal : tr.hover.stops}</span>
      )}
      {inArea !== null && <span className={`${TAG} ${inArea ? 'bg-slab/35 text-[#d5e6ff]' : 'bg-white/8 text-[#c9cfdb]'}`}>{inArea ? tr.hover.inArea : tr.hover.outsideArea}</span>}
    </div>
  );
}
