import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect } from 'react';
import { useGame } from '../../game/store';
import { CARD, CARD_LABEL } from '../classes';
import { usePresence } from '../presence';

// Levels with a leftover input stack one pond per value, like floors of a
// building: an elevator panel to ride between them, and a toast while riding.

const ARROW = 'grid cursor-pointer place-items-center rounded-xl bg-brand-soft py-1.5 text-brand disabled:cursor-default disabled:opacity-35';

export function PondGauge() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const busy = useGame((s) => s.busy);
  const elevating = useGame((s) => s.elevating);
  const ponds = level.ponds;
  const exists = (p: number) =>
    !!ponds && p >= ponds.min && p <= ponds.max && level.fast.pondReq({ [level.pond!]: p, [level.view.x]: 0, [level.view.y]: 0 }) === true;
  const step = (d: number) => {
    let p = pond + d;
    while (ponds && p >= ponds.min && p <= ponds.max && !exists(p)) p += d;
    if (exists(p)) useGame.setState({ pond: p });
  };
  useEffect(() => {
    if (!level.pond) return;
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().busy) return;
      if (e.key === 'PageUp' || (e.key === ']' && !(e.target instanceof HTMLElement && e.target.closest('.cm-editor')))) {
        e.preventDefault();
        step(1);
      }
      if (e.key === 'PageDown' || (e.key === '[' && !(e.target instanceof HTMLElement && e.target.closest('.cm-editor')))) {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!level.pond || !ponds) return null;
  const floors = [pond + 2, pond + 1, pond, pond - 1, pond - 2];
  return (
    <div className={`${CARD} ml-auto flex w-27 animate-slide-in-right flex-col gap-1 self-center px-2.5 py-3 max-md:w-23`}>
      <div className={`${CARD_LABEL} text-center`}>Input</div>
      <button className={ARROW} disabled={busy || !exists(pond + 1)} onClick={() => step(1)} title="Next input (PageUp or ])">
        <ChevronUp size={18} strokeWidth={2.6} />
      </button>
      <div className="my-1 flex flex-col gap-0.75">
        {floors.map((p) => (
          <button
            key={p}
            className={`cursor-pointer rounded-lg py-1.5 font-mono transition-all duration-200 disabled:cursor-default ${
              p === pond
                ? `bg-brand text-md font-bold text-white shadow-[0_3px_0_var(--color-brand-deep)] ${elevating ? 'animate-blink' : ''}`
                : 'text-sm text-faint enabled:hover:bg-shade/5 enabled:hover:text-ink'
            }`}
            disabled={busy || !exists(p)}
            onClick={() => exists(p) && useGame.setState({ pond: p })}
          >
            {exists(p) ? (
              <>
                <span className="opacity-80">{level.pond}</span> = {p}
              </>
            ) : (
              '—'
            )}
          </button>
        ))}
      </div>
      <button className={ARROW} disabled={busy || !exists(pond - 1)} onClick={() => step(-1)} title="Previous input (PageDown or [)">
        <ChevronDown size={18} strokeWidth={2.6} />
      </button>
      <div className="mt-1.5 text-center text-xs leading-tight text-faint">each input is its own pond</div>
    </div>
  );
}

/** Shown while the camera rides between ponds. */
export function ElevatorToast() {
  const level = useGame((s) => s.level);
  const pond = useGame((s) => s.pond);
  const elevating = useGame((s) => s.elevating);
  const dir = useGame((s) => s.elevatorDir);
  const { mounted, leaving } = usePresence(!!level?.pond && elevating);
  if (!level?.pond || !mounted) return null;
  return (
    <div
      key={pond}
      className={`absolute top-[26vh] left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-brand px-6.5 py-3 font-display text-3xl font-semibold whitespace-nowrap text-white shadow-[0_5px_0_var(--color-brand-deep),0_16px_40px_rgb(59_130_246/0.35)] ${leaving ? 'animate-fade-out' : 'animate-[pop_0.25s_ease-out]'}`}
    >
      <span className="inline-flex opacity-85">{dir > 0 ? <ArrowUp size={22} strokeWidth={2.8} /> : <ArrowDown size={22} strokeWidth={2.8} />}</span>
      <span className="opacity-80">{level.pond}</span> = {pond}
    </div>
  );
}
