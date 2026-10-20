import { sfx } from '../../audio/sfx';
import type { State } from '../../lang/ast';
import { holds, step } from '../../lang/eval';
import { inputsOf, planeKey, type CompiledLevel } from '../../levels/level';
import { goalEvents } from '../goalEvents';
import { after, sceneNow } from '../sceneTime';
import { joinHopBatch, landInBatch } from './hopBatch';

// Every frog on the board: its program state, where it is drawn, and what it
// is doing (hopping, dropping, being carried, hatching). The renderer reads it
// every frame; sequences change it.

type FrogKind = 'real' | 'test';

export interface FrogSim {
  id: number;
  kind: FrogKind;
  state: State;
  /** The plane this frog lives in (see planeKey). */
  plane: string;
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
      plane: planeKey(inputsOf(level, state)),
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
    f.hop = { fx: f.x, fy: f.y, tx, ty, t0: sceneNow(), dur };
    const batch = quiet ? null : joinHopBatch(dur);
    return new Promise((res) =>
      after(dur * 1000, () => {
        f.x = tx;
        f.y = ty;
        f.hop = undefined;
        // look ahead to the next hop (a stopped frog keeps looking the way it came)
        f.face = facingFor(level, next, f.face);
        if (batch) landInBatch(batch, holds(level.guard, next));
        if (!holds(level.guard, next) && holds(level.post, next)) this.landOnGoal(f, quiet);
        res();
      }),
    );
  }

  /** A frog landed on a goal: rings on its pool, a chime, and a little happy hop. */
  landOnGoal(f: FrogSim, quiet = false) {
    goalEvents.push(f.x, f.y, f.plane);
    if (!quiet) sfx.goal();
    f.cheerT0 = sceneNow();
  }
}

export const frogWorld = new FrogWorld();
