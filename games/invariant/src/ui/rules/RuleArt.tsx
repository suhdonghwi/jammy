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

export function ArtInit() {
  const p = top(0, 0);
  return (
    <svg viewBox="0 0 120 70" width="120" height="70">
      <Cells cells={PLUS('slab')} />
      <ellipse cx={p.x} cy={p.y - 6} rx="5" ry="6.5" fill="#f8efd9" stroke="#2a3142" strokeWidth="1.2" />
    </svg>
  );
}
export function ArtPres() {
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
export function ArtExit() {
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
