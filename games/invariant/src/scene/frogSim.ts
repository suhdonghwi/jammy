import type { State } from '../lang/ast';
import { holds, step } from '../lang/eval';
import type { CompiledLevel } from '../levels/level';
import { useGame } from '../store/game';
import { goalEvents } from './goalEvents';
import { after, sceneNow } from './sceneTime';

type FrogKind = 'real' | 'test';

export interface FrogSim {
  id: number;
  kind: FrogKind;
  state: State;
  /** Pond this frog lives in (undefined when the level has no ponds). */
  pond?: number;
  /** Visual tile position (floats while animating). */
  x: number;
  y: number;
  hop?: { fx: number; fy: number; tx: number; ty: number; t0: number; dur: number };
  /** Falling/hopping down; (dx, dy) is a starting tile offset that eases to 0. */
  drop?: { t0: number; dur: number; from: number; arc?: number; dx?: number; dy?: number };
  /** Tile offset while carried (e.g. sitting on a palm behind the tile). */
  carryOff?: { dx: number; dy: number };
  /** Extra height while carried by the hand. */
  carried?: number;
  hatchT0?: number;
  stopped: boolean;
  /** Idle animation phase. */
  phase: number;
  /** Where the frog wants to face (radians): its next hop, or the viewer once stopped. */
  face: number;
  /** Smoothed current facing. */
  yaw: number;
  /** A little happy hop after landing on a goal (start time). */
  cheerT0?: number;
  /** A quick turn on the spot, with a tiny hop, when the next hop goes another way. */
  turn?: { t0: number; from: number; delta: number };
  lastT?: number;
  /** Smoothed slot offset/scale when sharing a tile. */
  ox?: number;
  oy?: number;
  os?: number;
  /** Where the frog was last drawn (world), for things that follow it. */
  drawn?: { x: number; y: number; ground: number; z: number; scale: number };
  /** A dropped frog has touched down (fires once). */
  touched?: boolean;
}

/** Scene time in seconds (paused while the page is hidden). */
export const now = sceneNow;

/** Facing toward tile (tx, ty) from (fx, fy); 0 faces the viewer. */
export const yawToward = (fx: number, fy: number, tx: number, ty: number) => Math.atan2(tx - fx, -(ty - fy));

/** Frogs know where they'll hop next and face that way; a stopped frog keeps its facing. */
function facingFor(level: CompiledLevel, s: State, fallback: number): number {
  if (!holds(level.guard, s)) return fallback;
  const n = step(level.program.loop.body, s);
  const fx = Number(s[level.view.x]);
  const fy = Number(s[level.view.y]);
  const tx = Number(n[level.view.x]);
  const ty = Number(n[level.view.y]);
  if (fx === tx && fy === ty) return fallback;
  return yawToward(fx, fy, tx, ty);
}

// ---------------------------------------------------------------------------
// Hop announcements for the code panel: the body lights up while frogs hop,
// then the loop condition flashes with its result when they land. Hops started
// in the same tick form one batch: one body beat, and one condition flash once
// every frog in the batch has landed (their landing timers fire separately).
// ---------------------------------------------------------------------------

interface HopBatch {
  pending: number;
  results: boolean[];
}
let openBatch: HopBatch | null = null;

function joinHopBatch(dur: number): HopBatch {
  if (!openBatch) {
    const b: HopBatch = { pending: 0, results: [] };
    openBatch = b;
    queueMicrotask(() => {
      openBatch = null;
      useGame.setState((g) => ({ hopTick: g.hopTick + 1, hopDur: dur }));
    });
  }
  openBatch.pending++;
  return openBatch;
}

function landInBatch(b: HopBatch, continues: boolean) {
  b.results.push(continues);
  if (b.results.length < b.pending) return;
  const q = b.results;
  const guard = q.every(Boolean) ? 'true' : q.some(Boolean) ? 'mixed' : 'false';
  useGame.setState((g) => ({ landTick: g.landTick + 1, landGuard: guard }));
}

class FrogWorld {
  frogs: FrogSim[] = [];
  private nextId = 1;
  /** Egg tiles that have hatched (key "x,y"); their eggs are hidden. */
  hatched = new Set<string>();
  hatchVersion = 0;

  markHatched(x: number, y: number) {
    this.hatched.add(`${x},${y}`);
    this.hatchVersion++;
  }

  add(level: CompiledLevel, kind: FrogKind, state: State, opts: Partial<FrogSim> = {}): FrogSim {
    const face = facingFor(level, state, 0);
    const f: FrogSim = {
      id: this.nextId++,
      kind,
      state,
      pond: level.pond ? Number(state[level.pond]) : undefined,
      x: Number(state[level.view.x]),
      y: Number(state[level.view.y]),
      stopped: false,
      phase: Math.random() * 10,
      face,
      yaw: face,
      ...opts,
    };
    this.frogs.push(f);
    return f;
  }

  clear(kind?: FrogKind) {
    this.frogs = kind ? this.frogs.filter((f) => f.kind !== kind) : [];
    if ((!kind || kind === 'real') && this.hatched.size) {
      this.hatched.clear();
      this.hatchVersion++;
    }
  }

  /** Animate a hop to the frog's next state. */
  hopTo(level: CompiledLevel, f: FrogSim, next: State, dur = 0.42, quiet = false): Promise<void> {
    f.state = next;
    const tx = Number(next[level.view.x]);
    const ty = Number(next[level.view.y]);
    if (tx !== f.x || ty !== f.y) f.face = yawToward(f.x, f.y, tx, ty);
    f.hop = { fx: f.x, fy: f.y, tx, ty, t0: now(), dur };
    const batch = quiet ? null : joinHopBatch(dur);
    return new Promise((res) =>
      after(dur * 1000, () => {
        f.x = tx;
        f.y = ty;
        f.hop = undefined;
        // look ahead to the next hop (a stopped frog keeps looking the way it came)
        f.face = facingFor(level, next, f.face);
        if (batch) landInBatch(batch, holds(level.guard, next));
        if (!holds(level.guard, next) && holds(level.post, next)) {
          goalEvents.push(tx, ty, f.pond);
          f.cheerT0 = now();
        }
        res();
      }),
    );
  }
}

export const frogWorld = new FrogWorld();
