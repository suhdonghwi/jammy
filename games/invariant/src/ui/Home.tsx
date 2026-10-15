import { ArrowLeft, Check, GraduationCap, LayoutGrid } from 'lucide-react';
import { CHAPTERS, levels } from '../levels/defs';
import { useEffect } from 'react';
import { useGame } from '../store/game';
import { HOME_DRAFTS, useHomeDraft, type HomeDraftId } from '../home/drafts';
import { Title3D } from '../home/Title3D';
import { openLevel, openTutorial } from '../director/play';

export function HomeOverlay() {
  const view = useGame((s) => s.menuView);
  const draft = useHomeDraft((s) => s.draft);
  // the page background (sky) follows the draft
  useEffect(() => {
    document.documentElement.dataset.home = draft;
    return () => {
      delete document.documentElement.dataset.home;
    };
  }, [draft]);
  if (view === 'levels') return <LevelPicker />;
  return (
    <>
      <DraftSwitcher />
      <div className={`home home-e`} key={draft}>
        <EditorialCopy draft={draft} />
      </div>
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

const TITLE_STYLE = { a: 'standing', b: 'platforms', c: 'plaque' } as const;

function EditorialCopy({ draft }: { draft: HomeDraftId }) {
  return (
    <div className="editorial">
      <p className="editorial-eyebrow">A little game about loop invariants</p>
      {draft === 'd' ? (
        <h1 className="editorial-title">
          <span className="t-blue">Invariant</span>
          <span className="t-green">Frog</span>
        </h1>
      ) : (
        <h1 className="editorial-title-3d">
          <span className="sr-only">Invariant Frog</span>
          <Title3D style={TITLE_STYLE[draft]} />
        </h1>
      )}
      <p className="editorial-lede">Draw an area no frog can hop out of. Then convince a skeptical hand it holds for every input.</p>
      <HomeButtons />
    </div>
  );
}

/** Pick a home screen draft (exploration only). */
function DraftSwitcher() {
  const draft = useHomeDraft((s) => s.draft);
  const setDraft = useHomeDraft((s) => s.setDraft);
  const note = HOME_DRAFTS.find((d) => d.id === draft)?.note;
  return (
    <div className="draft-switcher">
      <div className="draft-pills">
        <span className="draft-label">Home draft</span>
        {HOME_DRAFTS.map((d) => (
          <button key={d.id} className={`draft-pill ${d.id === draft ? 'on' : ''}`} onClick={() => setDraft(d.id)} title={d.note}>
            <b>{d.id.toUpperCase()}</b> {d.name}
          </button>
        ))}
      </div>
      <p className="draft-note">{note}</p>
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

// Small isometric illustrations in the world's visual language, laid out on a
// real isometric grid: cell (i, j) sits at x = (i − j)·20, y = (i + j)·9.
const iso = (i: number, j: number) => ({ x: 60 + (i - j) * 20, y: 36 + (i + j) * 9 });
const SLAB_T = 6;

// Cells are drawn a little smaller than the grid pitch, so neighbours stay
// visibly separate (like the world's tiles and slabs).
const HW = 17;
const HH = 7.65;

const Tile = ({ i, j }: { i: number; j: number }) => {
  const { x, y } = iso(i, j);
  return (
    <path d={`M${x - HW} ${y} L${x} ${y - HH} L${x + HW} ${y} L${x} ${y + HH} Z`} fill="#ffffff" stroke="#d3d9e2" strokeWidth="1.5" strokeLinejoin="round" />
  );
};
const Slab = ({ i, j }: { i: number; j: number }) => {
  const { x, y } = iso(i, j);
  const t = y - SLAB_T;
  return (
    <g strokeLinejoin="round">
      <path d={`M${x - HW} ${t} L${x} ${t + HH} L${x} ${y + HH} L${x - HW} ${y} Z`} fill="#3a78d8" />
      <path d={`M${x + HW} ${t} L${x} ${t + HH} L${x} ${y + HH} L${x + HW} ${y} Z`} fill="#2f66bf" />
      <path d={`M${x - HW} ${t} L${x} ${t - HH} L${x + HW} ${t} L${x} ${t + HH} Z`} fill="#5c9df5" />
    </g>
  );
};
/** Top-centre of a slab, where things sit. */
const top = (i: number, j: number) => {
  const { x, y } = iso(i, j);
  return { x, y: y - SLAB_T };
};
const Frog = ({ x, y, color = '#52c24a' }: { x: number; y: number; color?: string }) => (
  <g transform={`translate(${x},${y - 6})`}>
    <ellipse cx="0" cy="1" rx="9" ry="6.5" fill={color} stroke="#2a3142" strokeWidth="1.2" />
    <circle cx="-4.2" cy="-5" r="3.4" fill="#fff" stroke="#2a3142" strokeWidth="1.2" />
    <circle cx="4.2" cy="-5" r="3.4" fill="#fff" stroke="#2a3142" strokeWidth="1.2" />
    <circle cx="-4" cy="-4.8" r="1.5" fill="#12141c" />
    <circle cx="4.4" cy="-4.8" r="1.5" fill="#12141c" />
  </g>
);

/** Cells drawn back to front. */
function Cells({ cells }: { cells: [number, number, 'tile' | 'slab'][] }) {
  return (
    <>
      {[...cells]
        .sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
        .map(([i, j, k]) => (k === 'slab' ? <Slab key={`${i},${j}`} i={i} j={j} /> : <Tile key={`${i},${j}`} i={i} j={j} />))}
    </>
  );
}

const PLUS = (center: 'tile' | 'slab'): [number, number, 'tile' | 'slab'][] => [
  [0, -1, 'tile'],
  [-1, 0, 'tile'],
  [0, 0, center],
  [1, 0, 'tile'],
  [0, 1, 'tile'],
];

function ArtInit() {
  const p = top(0, 0);
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <Cells cells={PLUS('slab')} />
      <ellipse cx={p.x} cy={p.y - 6} rx="5" ry="6.5" fill="#f8efd9" stroke="#2a3142" strokeWidth="1.2" />
    </svg>
  );
}
function ArtPres() {
  const a = top(-1, 0);
  const b = top(1, 0);
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <Cells
        cells={[
          [-1, 0, 'slab'],
          [0, 0, 'slab'],
          [1, 0, 'slab'],
          [0, -1, 'tile'],
          [0, 1, 'tile'],
        ]}
      />
      <path
        d={`M${a.x} ${a.y - 2} Q${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 30} ${b.x} ${b.y - 10}`}
        fill="none"
        stroke="#2f6fe0"
        strokeDasharray="3 3"
        strokeWidth="1.8"
      />
      <Frog x={b.x} y={b.y} />
    </svg>
  );
}
function ArtExit() {
  const p = top(0, 0);
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <defs>
        <linearGradient id="goal-col" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f6c35b" stopOpacity="0.55" />
          <stop offset="1" stopColor="#f6c35b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Cells cells={PLUS('slab')} />
      {/* the goal: a pale amber pool with a column of light, as in the world */}
      <ellipse cx={p.x} cy={p.y} rx="11.5" ry="5.2" fill="#fde3a7" stroke="#efa52b" strokeWidth="2" />
      <path d={`M${p.x - 11.5} ${p.y} L${p.x - 11.5} ${p.y - 24} L${p.x + 11.5} ${p.y - 24} L${p.x + 11.5} ${p.y} Z`} fill="url(#goal-col)" />
      <Frog x={p.x} y={p.y - 2} />
    </svg>
  );
}
