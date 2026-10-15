import { ArrowLeft, Check, GraduationCap, LayoutGrid } from 'lucide-react';
import { useEffect, useState } from 'react';
import { openLevel, openTutorial } from '../../game/actions';
import { useProgress } from '../../game/progress';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { GROUPS, levelNumber, levels } from '../../levels/catalog';
import { groupName, localizeLevel } from '../../levels/localize';
import { button } from '../classes';
import { usePresence } from '../presence';
import { LangSwitch } from './LangSwitch';
import { ResetProgress } from './ResetProgress';
import { SoundToggle } from './SoundToggle';
import { Title3D } from './title/Title3D';
import { useCompactHome } from './useCompactHome';

// The home screen over the 3D scene: the title, a line about the game, the way
// in, the level list, and in the corner, resetting progress and the language.

export function HomeOverlay() {
  const view = useGame((s) => s.menuView);
  const compact = useCompactHome();
  const picker = usePresence(view === 'levels');
  // Arriving straight on the level list (back from a level), it is simply
  // there; opened from the home screen, it fades in.
  const [instant, setInstant] = useState(view === 'levels');
  useEffect(() => {
    if (view === 'home') setInstant(false);
  }, [view]);
  return (
    <>
      {/* the title and buttons stay, faded back behind the level list */}
      <div
        className={`pointer-events-none fixed inset-0 isolate flex flex-col items-start justify-center pl-[max(5vw,24px)] transition-opacity duration-180 narrow:items-center narrow:px-4 narrow:pb-[5vh] ${
          compact ? '' : `narrow:justify-end ${WASH}`
        } ${view === 'levels' ? 'opacity-35' : ''}`}
      >
        <HeroCopy behind={view === 'levels'} />
      </div>
      {picker.mounted && <LevelPicker leaving={picker.leaving} instant={instant} />}
      <div className="fixed top-4 right-4 flex animate-[fade_0.4s_ease-out_both] items-center gap-2">
        <ResetProgress />
        <SoundToggle />
        <LangSwitch />
      </div>
    </>
  );
}

/** A soft wash behind the copy so the grid doesn't fight the type: from the left, or from below when stacked. */
const WASH =
  'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-linear-to-r before:from-wash/94 before:via-wash/70 before:via-26% before:to-wash/0 before:to-42% narrow:before:bg-linear-to-t narrow:before:from-wash/95 narrow:before:via-wash/80 narrow:before:via-42% narrow:before:to-62%';

function HomeButtons() {
  const tr = useT();
  return (
    <div className="flex gap-3.5 narrow:justify-center max-sm:gap-2.5">
      <button className={button('primary', 'lg')} onClick={openTutorial}>
        <GraduationCap size={22} strokeWidth={2.2} /> {tr.home.tutorial}
      </button>
      <button className={button('toy', 'lg')} onClick={() => useGame.setState({ menuView: 'levels' })}>
        <LayoutGrid size={22} strokeWidth={2.2} /> {tr.home.levels}
      </button>
    </div>
  );
}

/** The title, a line about the game, and the way in. */
function HeroCopy({ behind }: { behind: boolean }) {
  const tr = useT();
  return (
    <div className={`max-w-118 animate-[rise_0.6s_ease-out_both] narrow:text-center ${behind ? '' : 'pointer-events-auto'}`}>
      <p className="mb-3 font-display text-xs font-semibold tracking-[0.08em] text-muted uppercase">{tr.home.tagline}</p>
      <h1 className="mb-3.5">
        <span className="sr-only">Invariant Frog</span>
        <Title3D />
      </h1>
      <p className="mb-6.5 text-lg leading-[1.55] text-muted max-sm:text-base">{tr.home.pitch}</p>
      <HomeButtons />
    </div>
  );
}

function LevelPicker({ leaving, instant }: { leaving: boolean; instant: boolean }) {
  const tr = useT();
  const cleared = useProgress((s) => s.cleared);
  const done = levels.filter((l) => cleared.includes(l.id)).length;
  return (
    // arriving straight on the list (back from a level), it is simply there
    <div
      className={`fixed inset-0 flex items-center justify-center bg-horizon/45 p-4 backdrop-blur-xs ${
        leaving ? 'pointer-events-none animate-fade-out' : instant ? '' : 'animate-[fade_0.18s_ease-out]'
      }`}
    >
      <div
        className={`flex max-h-[calc(100vh-2rem)] w-full max-w-215 flex-col rounded-3xl border border-line bg-card shadow-float backdrop-blur-lg ${
          leaving ? 'animate-pop-out' : instant ? '' : 'animate-rise'
        }`}
      >
        <div className="flex items-center px-4 pt-3.5 pb-1.5">
          <button className={button('quiet')} onClick={() => useGame.setState({ menuView: 'home' })}>
            <ArrowLeft size={16} strokeWidth={2.4} /> {tr.home.back}
          </button>
          <h2 className="flex-1 text-center font-display text-2xl font-semibold">{tr.home.levels}</h2>
          {/* as wide as Back, so the title stays centred */}
          <span className="w-20 pr-2 text-right font-mono text-sm text-muted" title={tr.home.clearedCount(done, levels.length)}>
            {done}/{levels.length}
          </span>
        </div>
        <div className="overflow-y-auto px-6 pt-1.5 pb-6">
          {GROUPS.map((g, tier) => (
            <section key={g.name}>
              <h3 className="mt-4 mb-2.5 flex items-center gap-2.5 font-display text-lg font-semibold">
                {groupName(g.name)}
                <Pips filled={tier + 1} of={GROUPS.length} />
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
                {g.levels.map((l) => {
                  const isCleared = cleared.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white py-2.5 pr-3.5 pl-2.5 text-left shadow-[0_3px_0_#e2e6ee] transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_5px_0_#dfe4ec,0_10px_20px_rgb(32_44_70/0.08)]"
                      onClick={() => openLevel(l)}
                    >
                      {/* a cleared level's number turns green */}
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-lg font-display text-md font-semibold ${
                          isCleared ? 'bg-pass-soft text-pass' : 'bg-brand-soft text-brand'
                        }`}
                      >
                        {levelNumber(l.id)}
                      </span>
                      <span className="flex-1 font-display text-md font-semibold">{localizeLevel(l).title}</span>
                      {isCleared && <Check size={18} strokeWidth={2.8} className="shrink-0 text-pass" aria-label={tr.home.cleared} />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A tier's difficulty as filled dots: ●○○, ●●○, ●●●. */
function Pips({ filled, of }: { filled: number; of: number }) {
  const tr = useT();
  return (
    // a pixel below the line box's centre (the capitals'), toward the lowercase letters', so they don't look high
    <span className="flex translate-y-px gap-1" aria-label={tr.home.difficulty(filled, of)}>
      {Array.from({ length: of }, (_, k) => (
        <span key={k} className={`size-2 rounded-full ${k < filled ? 'bg-brand' : 'bg-shade/12'}`} />
      ))}
    </span>
  );
}
