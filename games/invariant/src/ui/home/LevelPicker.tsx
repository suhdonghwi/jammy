import { ArrowLeft, Check } from 'lucide-react';
import { openLevel } from '../../game/actions';
import { useProgress } from '../../game/progress';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { GROUPS, levelNumber, levels } from '../../levels/catalog';
import { groupName, localizeLevel } from '../../levels/localize';
import { button } from '../classes';
import { Overlay } from '../Dialog';

export function LevelPicker({ open }: { open: boolean }) {
  const tr = useT();
  const cleared = useProgress((s) => s.cleared);
  const done = levels.filter((l) => cleared.includes(l.id)).length;
  const close = () => useGame.setState({ menuView: 'home' });
  return (
    <Overlay open={open} onClose={close} card="flex max-w-110 flex-col border border-line bg-card backdrop-blur-lg">
      <div className="flex items-center px-4 pt-3.5 pb-1.5">
        <button className={button('quiet')} onClick={close}>
          <ArrowLeft size={16} strokeWidth={2.4} /> {tr.home.back}
        </button>
        <h2 className="flex-1 text-center font-display text-2xl font-semibold">{tr.home.levels}</h2>
        <span className="w-20 pr-2 text-right font-mono text-sm text-muted" title={tr.home.clearedCount(done, levels.length)}>
          {done}/{levels.length}
        </span>
      </div>
      <div className="overflow-y-auto px-4 pt-1 pb-5">
        {GROUPS.map((g) => (
          <section key={g.name}>
            <h3 className="mt-4 mb-2 flex items-baseline justify-between px-1 font-display text-md font-semibold">
              {groupName(g.name)}
              <span className="font-mono text-xs font-normal text-muted">
                {g.levels.filter((l) => cleared.includes(l.id)).length}/{g.levels.length}
              </span>
            </h3>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {g.levels.map((l) => {
                const isCleared = cleared.includes(l.id);
                return (
                  <button
                    key={l.id}
                    className="flex w-full cursor-pointer items-center gap-3 py-2 pr-4 pl-2.5 text-left transition-colors duration-150 hover:bg-sky"
                    onClick={() => openLevel(l)}
                  >
                    <span
                      className={`grid size-7 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold tabular-nums ${
                        isCleared ? 'bg-pass-soft text-pass' : 'bg-brand-soft text-brand'
                      }`}
                    >
                      {levelNumber(l.id)}
                    </span>
                    <span className="flex-1 font-display text-md font-semibold">{localizeLevel(l).title}</span>
                    {isCleared && <Check size={16} strokeWidth={2.8} className="shrink-0 text-pass" aria-label={tr.home.cleared} />}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Overlay>
  );
}
