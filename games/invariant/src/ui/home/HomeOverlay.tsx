import { ArrowLeft, GraduationCap, LayoutGrid } from 'lucide-react';
import { useEffect, useState } from 'react';
import { openLevel, openTutorial } from '../../game/actions';
import { useGame } from '../../game/store';
import { GROUPS, levelNumber } from '../../levels/catalog';
import { button } from '../classes';
import { usePresence } from '../presence';
import { Title3D } from './title/Title3D';
import { useCompactHome } from './useCompactHome';

// The home screen over the 3D scene: the title, a line about the game, the way
// in, and the level list.

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
    </>
  );
}

/** A soft wash behind the copy so the grid doesn't fight the type: from the left, or from below when stacked. */
const WASH =
  'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-linear-to-r before:from-wash/94 before:via-wash/70 before:via-26% before:to-wash/0 before:to-42% narrow:before:bg-linear-to-t narrow:before:from-wash/95 narrow:before:via-wash/80 narrow:before:via-42% narrow:before:to-62%';

function HomeButtons() {
  return (
    <div className="flex gap-3.5 narrow:justify-center max-sm:gap-2.5">
      <button className={button('primary', 'lg')} onClick={openTutorial}>
        <GraduationCap size={22} strokeWidth={2.2} /> Tutorial
      </button>
      <button className={button('toy', 'lg')} onClick={() => useGame.setState({ menuView: 'levels' })}>
        <LayoutGrid size={22} strokeWidth={2.2} /> Levels
      </button>
    </div>
  );
}

/** The title, a line about the game, and the way in. */
function HeroCopy({ behind }: { behind: boolean }) {
  return (
    <div className={`max-w-118 animate-[rise_0.6s_ease-out_both] narrow:text-center ${behind ? '' : 'pointer-events-auto'}`}>
      <p className="mb-3 font-display text-xs font-semibold tracking-[0.08em] text-muted uppercase">A little game about loop invariants</p>
      <h1 className="mb-3.5">
        <span className="sr-only">Invariant Frog</span>
        <Title3D />
      </h1>
      <p className="mb-6.5 text-lg leading-[1.55] text-muted max-sm:text-base">Draw an area no frog can hop out of. Then convince a skeptical hand it holds for every input.</p>
      <HomeButtons />
    </div>
  );
}

function LevelPicker({ leaving, instant }: { leaving: boolean; instant: boolean }) {
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
            <ArrowLeft size={16} strokeWidth={2.4} /> Back
          </button>
          <h2 className="flex-1 text-center font-display text-2xl font-semibold">Levels</h2>
          <span className="w-20" />
        </div>
        <div className="overflow-y-auto px-6 pt-1.5 pb-6">
          {GROUPS.map((g, tier) => (
            <section key={g.name}>
              <h3 className="mt-4 mb-2.5 flex items-center gap-2.5 font-display text-lg font-semibold">
                {g.name}
                <Pips filled={tier + 1} of={GROUPS.length} />
              </h3>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
                {g.levels.map((l) => (
                  <button
                    key={l.id}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white py-2.5 pr-3.5 pl-2.5 text-left shadow-[0_3px_0_#e2e6ee] transition-[translate,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_5px_0_#dfe4ec,0_10px_20px_rgb(32_44_70/0.08)]"
                    onClick={() => openLevel(l)}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft font-display text-md font-semibold text-brand">
                      {levelNumber(l.id)}
                    </span>
                    <span className="font-display text-md font-semibold">{l.title}</span>
                  </button>
                ))}
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
  return (
    // a pixel below the line box's centre (the capitals'), toward the lowercase letters', so they don't look high
    <span className="flex translate-y-px gap-1" aria-label={`difficulty ${filled} of ${of}`}>
      {Array.from({ length: of }, (_, k) => (
        <span key={k} className={`size-2 rounded-full ${k < filled ? 'bg-brand' : 'bg-shade/12'}`} />
      ))}
    </span>
  );
}
