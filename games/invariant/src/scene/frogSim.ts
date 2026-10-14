import type { State } from '../lang/ast';
import { holds, step } from '../lang/eval';
import type { CompiledLevel } from '../levels/level';
import { useGame } from '../store/game';

export type FrogKind = 'real' | 'test';

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
  /** Dropping from a height (placed by the hand). */
  drop?: { t0: number; dur: number; from: number };
  /** Extra height while carried by the hand. */
  carried?: number;
  hatchT0?: number;
  stopped: boolean;
  red: boolean;
  /** Idle animation phase. */
  phase: number;
  /** Where the frog wants to face (radians): its next hop, or the viewer once stopped. */
  face: number;
  /** Smoothed current facing. */
  yaw: number;
  lastT?: number;
}

export const now = () => performance.now() / 1000;

/** Facing toward tile (tx, ty) from (fx, fy); 0 faces the viewer. */
export const yawToward = (fx: number, fy: number, tx: number, ty: number) => Math.atan2(tx - fx, -(ty - fy));

/** Frogs know where they'll hop next — face that way; once stopped, look at the viewer. */
function facingFor(level: CompiledLevel, s: State, fallback: number): number {
  if (!holds(level.guard, s)) return 0;
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
// then the loop condition flashes with its result when they land. Calls made
// in the same tick are coalesced into one beat.
// ---------------------------------------------------------------------------

let hopQueued = false;
let landQueue: boolean[] | null = null;

function announceHop(dur: number) {
  if (hopQueued) return;
  hopQueued = true;
  queueMicrotask(() => {
    hopQueued = false;
    useGame.setState((g) => ({ hopTick: g.hopTick + 1, hopDur: dur }));
  });
}

function announceLand(continues: boolean) {
  if (!landQueue) {
    landQueue = [];
    queueMicrotask(() => {
      const q = landQueue!;
      landQueue = null;
      const guard = q.every(Boolean) ? 'true' : q.some(Boolean) ? 'mixed' : 'false';
      useGame.setState((g) => ({ landTick: g.landTick + 1, landGuard: guard }));
    });
  }
  landQueue.push(continues);
}

class FrogWorld {
  frogs: FrogSim[] = [];
  private nextId = 1;
  /** Egg tiles that have hatched (key "x,y"); their eggs are hidden. */
  hatched = new Set<string>();
  hatchVersion = 0;
  version = 0;

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
      red: false,
      phase: Math.random() * 10,
      face,
      yaw: face,
      ...opts,
    };
    this.frogs.push(f);
    this.version++;
    return f;
  }

  remove(f: FrogSim) {
    this.frogs = this.frogs.filter((g) => g !== f);
    this.version++;
  }

  clear(kind?: FrogKind) {
    this.frogs = kind ? this.frogs.filter((f) => f.kind !== kind) : [];
    if ((!kind || kind === 'real') && this.hatched.size) {
      this.hatched.clear();
      this.hatchVersion++;
    }
    this.version++;
  }

  /** Animate a hop to the frog's next state. */
  hopTo(level: CompiledLevel, f: FrogSim, next: State, dur = 0.42, quiet = false): Promise<void> {
    f.state = next;
    const tx = Number(next[level.view.x]);
    const ty = Number(next[level.view.y]);
    if (tx !== f.x || ty !== f.y) f.face = yawToward(f.x, f.y, tx, ty);
    f.hop = { fx: f.x, fy: f.y, tx, ty, t0: now(), dur };
    if (!quiet) announceHop(dur);
    return new Promise((res) =>
      setTimeout(() => {
        f.x = tx;
        f.y = ty;
        f.hop = undefined;
        // look ahead to the next hop (or at the viewer, if the loop is done)
        f.face = facingFor(level, next, f.face);
        if (!quiet) announceLand(holds(level.guard, next));
        res();
      }, dur * 1000),
    );
  }
}

export const frogWorld = new FrogWorld();
