import { ArrowLeft, GraduationCap, LayoutGrid } from 'lucide-react';
import { useEffect, useState } from 'react';
import { openLevel, openTutorial } from '../../game/actions';
import { useGame } from '../../game/store';
import { CHAPTERS, levels } from '../../levels/catalog';
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
      <div className={`home ${compact ? 'compact' : ''} ${view === 'levels' ? 'behind' : ''}`}>
        <HeroCopy />
      </div>
      {picker.mounted && <LevelPicker leaving={picker.leaving} instant={instant} />}
    </>
  );
}

function HomeButtons() {
  return (
    <div className="home-buttons">
      <button className="btn toy big primary icon-btn" onClick={openTutorial}>
        <GraduationCap size={22} strokeWidth={2.2} /> Tutorial
      </button>
      <button className="btn toy big icon-btn" onClick={() => useGame.setState({ menuView: 'levels' })}>
        <LayoutGrid size={22} strokeWidth={2.2} /> Levels
      </button>
    </div>
  );
}

/** The title, a line about the game, and the way in. */
function HeroCopy() {
  return (
    <div className="hero">
      <p className="hero-eyebrow">A little game about loop invariants</p>
      <h1 className="hero-title">
        <span className="sr-only">Invariant Frog</span>
        <Title3D />
      </h1>
      <p className="hero-lede">Draw an area no frog can hop out of. Then convince a skeptical hand it holds for every input.</p>
      <HomeButtons />
    </div>
  );
}

function LevelPicker({ leaving, instant }: { leaving: boolean; instant: boolean }) {
  const chapters = [...new Set(levels.map((l) => l.chapter))];
  return (
    <div className={`picker-backdrop ${leaving ? 'leaving' : ''} ${instant ? 'instant' : ''}`}>
      <div className="picker">
        <div className="picker-head">
          <button className="btn ghost icon-btn" onClick={() => useGame.setState({ menuView: 'home' })}>
            <ArrowLeft size={16} strokeWidth={2.4} /> Back
          </button>
          <h2>Levels</h2>
          <span className="picker-spacer" />
        </div>
        <div className="picker-body">
          {chapters.map((c) => (
            <section key={c} className="chapter">
              <h3>
                <span className="chapter-num">{c}</span>
                {CHAPTERS[c]}
              </h3>
              <div className="level-grid">
                {levels
                  .filter((l) => l.chapter === c)
                  .map((l) => (
                    <button key={l.id} className="level-card" onClick={() => openLevel(l)}>
                      <span className="level-card-id">{l.id}</span>
                      <span className="level-card-title">{l.title}</span>
                      {l.intro && <span className="level-card-intro">{l.intro}</span>}
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
