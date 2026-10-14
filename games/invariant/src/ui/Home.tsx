import { ArrowLeft, Check, GraduationCap, LayoutGrid } from 'lucide-react';
import { CHAPTERS, levels } from '../levels/defs';
import { useGame } from '../store/game';
import { openLevel, openTutorial } from '../director/play';

export function HomeOverlay() {
  const view = useGame((s) => s.menuView);
  if (view === 'levels') return <LevelPicker />;
  return (
    <div className="home">
      <div className="home-bottom">
        <p className="home-tagline">Frogs never leave.</p>
        <p className="home-blurb">
          Learn loop invariants by drawing an area no frog can hop out of — and convincing a skeptical hand it holds for every
          input.
        </p>
        <div className="home-buttons">
          <button className="btn toy big primary icon-btn" onClick={openTutorial}>
            <GraduationCap size={22} strokeWidth={2.2} /> Tutorial
          </button>
          <button className="btn toy big icon-btn" onClick={() => useGame.setState({ menuView: 'levels' })}>
            <LayoutGrid size={22} strokeWidth={2.2} /> Levels
          </button>
        </div>
      </div>
    </div>
  );
}

function LevelPicker() {
  const chapters = [...new Set(levels.map((l) => l.chapter))];
  return (
    <div className="picker-backdrop">
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

export function RulesCard() {
  const show = useGame((s) => s.showRules);
  if (!show) return null;
  const close = () => useGame.setState({ showRules: false });
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>The three rules</h2>
        <p className="modal-sub">If your area passes all three, every frog — for every input — stops on a goal.</p>
        <div className="rules">
          <Rule n={1} name="Init" text="Every egg sits on your area." art={<ArtInit />} />
          <Rule n={2} name="Preservation" text="A frog on your area that hops lands on your area." art={<ArtPres />} />
          <Rule n={3} name="Exit" text="A frog that stops on your area is on a goal." art={<ArtExit />} />
        </div>
        <p className="modal-foot">
          Frogs start on your area (1) and no hop can leave it (2), so they never leave — and when they stop, they stop on a goal
          (3).
        </p>
        <button className="btn toy primary icon-btn" onClick={close}>
          <Check size={17} strokeWidth={2.6} /> Got it
        </button>
      </div>
    </div>
  );
}

function Rule({ n, name, text, art }: { n: number; name: string; text: string; art: React.ReactNode }) {
  return (
    <div className="rule">
      <div className="rule-art">{art}</div>
      <div className="rule-name">
        <span className="rule-n">{n}</span> {name}
      </div>
      <div className="rule-text">{text}</div>
    </div>
  );
}

// Small isometric illustrations in the world's visual language.
const Slab = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x},${y})`}>
    <path d="M2 10 L22 1 L42 10 L22 19 Z" fill="#5c9df5" />
    <path d="M2 10 L22 19 L22 25 L2 16 Z" fill="#3a78d8" />
    <path d="M42 10 L22 19 L22 25 L42 16 Z" fill="#2f66bf" />
  </g>
);
const Tile = ({ x, y }: { x: number; y: number }) => (
  <path transform={`translate(${x},${y})`} d="M2 10 L22 1 L42 10 L22 19 Z" fill="#ffffff" stroke="#d3d9e2" strokeWidth="1.5" />
);
const Frog = ({ x, y, color = '#52c24a' }: { x: number; y: number; color?: string }) => (
  <g transform={`translate(${x},${y})`}>
    <ellipse cx="0" cy="1" rx="9" ry="6.5" fill={color} stroke="#2a3142" strokeWidth="1.2" />
    <circle cx="-4.2" cy="-5" r="3.4" fill="#fff" stroke="#2a3142" strokeWidth="1.2" />
    <circle cx="4.2" cy="-5" r="3.4" fill="#fff" stroke="#2a3142" strokeWidth="1.2" />
    <circle cx="-4" cy="-4.8" r="1.5" fill="#12141c" />
    <circle cx="4.4" cy="-4.8" r="1.5" fill="#12141c" />
  </g>
);

function ArtInit() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <Tile x={12} y={32} />
      <Slab x={38} y={19} />
      <Tile x={64} y={32} />
      <ellipse cx="60" cy="22" rx="5" ry="6.5" fill="#f8efd9" stroke="#2a3142" strokeWidth="1.2" />
    </svg>
  );
}
function ArtPres() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <Slab x={14} y={28} />
      <Slab x={62} y={28} />
      <path d="M36 32 Q60 2 84 30" fill="none" stroke="#2f6fe0" strokeDasharray="3 3" strokeWidth="1.8" />
      <Frog x={84} y={32} />
    </svg>
  );
}
function ArtExit() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <Slab x={38} y={22} />
      <ellipse cx="60" cy="32" rx="9" ry="4.5" fill="none" stroke="#efa52b" strokeWidth="2.4" />
      <Frog x={60} y={28} />
    </svg>
  );
}
