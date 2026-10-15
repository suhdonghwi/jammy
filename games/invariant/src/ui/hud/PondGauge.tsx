import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';
import { useEffect } from 'react';
import { useGame } from '../../game/store';
import { usePresence } from '../presence';

// Levels with a leftover input stack one pond per value, like floors of a
// building: an elevator panel to ride between them, and a toast while riding.

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
    <div className={`card gauge ${elevating ? 'moving' : ''}`}>
      <div className="card-label">Input</div>
      <button className="gauge-arrow" disabled={busy || !exists(pond + 1)} onClick={() => step(1)} title="Next input (PageUp or ])">
        <ChevronUp size={18} strokeWidth={2.6} />
      </button>
      <div className="gauge-floors">
        {floors.map((p) => (
          <button
            key={p}
            className={`gauge-floor ${p === pond ? 'current' : ''}`}
            disabled={busy || !exists(p)}
            onClick={() => exists(p) && useGame.setState({ pond: p })}
          >
            {exists(p) ? (
              <>
                <span className="gauge-name">{level.pond}</span> = {p}
              </>
            ) : (
              '—'
            )}
          </button>
        ))}
      </div>
      <button className="gauge-arrow" disabled={busy || !exists(pond - 1)} onClick={() => step(-1)} title="Previous input (PageDown or [)">
        <ChevronDown size={18} strokeWidth={2.6} />
      </button>
      <div className="gauge-hint">each input is its own pond</div>
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
    <div className={`elevator-toast ${leaving ? 'leaving' : ''}`} key={pond}>
      <span className="elevator-arrow">{dir > 0 ? <ArrowUp size={22} strokeWidth={2.8} /> : <ArrowDown size={22} strokeWidth={2.8} />}</span>
      <span className="elevator-name">{level.pond}</span> = {pond}
    </div>
  );
}
