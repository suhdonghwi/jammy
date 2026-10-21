import { ArrowLeft, Check, GraduationCap, LayoutGrid } from 'lucide-react';
import { openLevel, openTutorial } from '../../game/actions';
import { useProgress } from '../../game/progress';
import { useGame } from '../../game/store';
import { COMPACT_HOME, NARROW_HOME, useMedia } from '../../hooks/media';
import { useT } from '../../i18n/i18n';
import { GROUPS, levelNumber, levels } from '../../levels/catalog';
import { groupName, localizeLevel } from '../../levels/localize';
import { button } from '../classes';
import { Overlay } from '../Dialog';
import { CornerControls } from './CornerControls';
import { LangSwitch } from './LangSwitch';
import { Title3D } from './title/Title3D';

export function HomeOverlay() {
  const view = useGame((s) => s.menuView);
  const compact = useMedia(COMPACT_HOME);
  return (
    <>
      <div
        className={`pointer-events-none fixed inset-0 isolate flex flex-col items-start justify-center pl-[max(5vw,24px)] [--copy-end:calc(max(5vw,24px)+29.5rem)] transition-opacity duration-180 narrow:items-center narrow:px-4 narrow:pb-[5vh] ${
          compact ? BACKDROP : `narrow:justify-end ${WASH}`
        } ${view === 'levels' ? 'opacity-35' : ''}`}
      >
        <HeroCopy behind={view === 'levels'} />
      </div>
      <div
        className={`fixed top-4 right-4 flex max-sm:top-2.5 max-sm:right-2.5 animate-[fade_0.4s_var(--ease-entrance)_0.6s_both] items-center gap-2 transition-opacity duration-180 ${
          view === 'levels' ? 'opacity-35' : ''
        }`}
      >
        <CornerControls />
        <LangSwitch />
      </div>
      <LevelPicker open={view === 'levels'} />
    </>
  );
}

const BACKDROP = 'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-wash/72';

const WASH =
  'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-linear-to-r before:from-wash/94 before:via-wash/70 before:via-(length:--copy-end) before:to-wash/0 before:to-[length:calc(var(--copy-end)+15rem)] narrow:before:bg-linear-to-t narrow:before:from-wash/95 narrow:before:via-wash/80 narrow:before:via-42% narrow:before:to-62%';

function HomeButtons() {
  const tr = useT();
  return (
    <div className="flex animate-[rise_0.5s_var(--ease-entrance)_0.45s_both] gap-3.5 narrow:justify-center max-sm:gap-2.5">
      <button className={button('primary', 'lg')} onClick={openTutorial}>
        <GraduationCap size={22} strokeWidth={2.2} /> {tr.home.tutorial}
      </button>
      <button className={button('toy', 'lg')} onClick={() => useGame.setState({ menuView: 'levels' })}>
        <LayoutGrid size={22} strokeWidth={2.2} /> {tr.home.levels}
      </button>
    </div>
  );
}

function HeroCopy({ behind }: { behind: boolean }) {
  const tr = useT();
  const narrow = useMedia(NARROW_HOME);
  return (
    <div className={`max-w-118 narrow:text-center ${behind ? '' : 'pointer-events-auto'}`}>
      <p className="mb-3 animate-[rise_0.5s_var(--ease-entrance)_0.1s_both] font-display short:mb-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">{tr.home.tagline}</p>
      <h1 className="mb-3.5 short:mb-2">
        <span className="sr-only">Invariant Frog</span>
        <Title3D align={narrow ? 'center' : 'left'} />
      </h1>
      <p className="mb-6.5 animate-[rise_0.5s_var(--ease-entrance)_0.35s_both] text-lg leading-[1.55] text-muted max-sm:text-base short:mb-4 short:max-w-[min(29.5rem,48vw)] short:text-base">{tr.home.pitch}</p>
      <HomeButtons />
    </div>
  );
}

function LevelPicker({ open }: { open: boolean }) {
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
