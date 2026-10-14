import { CHAPTERS, levels } from '../levels/defs';
import { useGame } from '../store/game';
import { openLevel, openTutorial } from '../director/play';

export function Menu() {
  const progress = useGame((s) => s.progress);
  const chapters = [...new Set(levels.map((l) => l.chapter))];
  return (
    <div className="menu">
      <div className="menu-card">
        <div className="menu-hero">
          <div className="logo">🐸</div>
          <h1>Invariant Frog</h1>
          <p className="tagline">Frogs never leave.</p>
          <p className="blurb">
            Learn loop invariants by drawing an area that no frog can hop out of — and convincing a skeptical hand that it holds
            for every input.
          </p>
          <button className="btn primary big" onClick={openTutorial}>
            {progress.tutorialDone ? 'Replay the tutorial' : 'Start the tutorial'}
          </button>
        </div>
        <div className="chapters">
          {chapters.map((c) => (
            <div key={c} className="chapter">
              <div className="chapter-title">
                <span className="chapter-num">Chapter {c}</span> {CHAPTERS[c]}
              </div>
              <div className="level-grid">
                {levels
                  .filter((l) => l.chapter === c)
                  .map((l) => {
                    const done = progress.cleared.includes(l.id);
                    return (
                      <button key={l.id} className={`level-card ${done ? 'done' : ''}`} onClick={() => openLevel(l)}>
                        <span className="level-card-id">{l.id}</span>
                        <span className="level-card-title">{l.title}</span>
                        {done && <span className="level-card-check">✓</span>}
                      </button>
                    );
                  })}
              </div>
            </div>
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
          Why it works: frogs start on your area (1) and no hop can leave it (2), so they never leave — and when they stop, they
          stop on a goal (3).
        </p>
        <button className="btn primary" onClick={close}>
          Got it
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
        {n}. {name}
      </div>
      <div className="rule-text">{text}</div>
    </div>
  );
}

// Small isometric-ish illustrations in the same visual language as the world.
const Slab = ({ x, y }: { x: number; y: number }) => (
  <g transform={`translate(${x},${y})`}>
    <path d="M0 10 L22 0 L44 10 L22 20 Z" fill="#7fb2f0" />
    <path d="M0 10 L22 20 L22 26 L0 16 Z" fill="#5d95d9" />
    <path d="M44 10 L22 20 L22 26 L44 16 Z" fill="#4f86c9" />
  </g>
);
const Floor = ({ x, y, fill = '#fbfbfa' }: { x: number; y: number; fill?: string }) => (
  <path transform={`translate(${x},${y})`} d="M0 10 L22 0 L44 10 L22 20 Z" fill={fill} stroke="#e1e4ea" />
);
const Frog = ({ x, y, color = '#5fbf4a' }: { x: number; y: number; color?: string }) => (
  <g transform={`translate(${x},${y})`}>
    <ellipse cx="0" cy="0" rx="8" ry="6" fill={color} />
    <circle cx="-4" cy="-5" r="3" fill={color} />
    <circle cx="4" cy="-5" r="3" fill={color} />
    <circle cx="-4" cy="-5.5" r="1.2" fill="#1d2330" />
    <circle cx="4" cy="-5.5" r="1.2" fill="#1d2330" />
  </g>
);

function ArtInit() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <Floor x={10} y={30} />
      <Slab x={38} y={16} />
      <Floor x={66} y={30} />
      <ellipse cx="60" cy="22" rx="5" ry="6.5" fill="#f3ead2" stroke="#d8cfb4" />
    </svg>
  );
}
function ArtPres() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <Slab x={14} y={26} />
      <Slab x={62} y={26} />
      <path d="M36 30 Q60 0 84 30" fill="none" stroke="#8a93a3" strokeDasharray="3 3" strokeWidth="1.5" />
      <Frog x={84} y={30} />
    </svg>
  );
}
function ArtExit() {
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <Slab x={38} y={20} />
      <ellipse cx="60" cy="31" rx="9" ry="4.5" fill="none" stroke="#5b6472" strokeWidth="2" />
      <Frog x={60} y={29} />
    </svg>
  );
}
