import type { State } from '../../lang/ast';
import { holds } from '../../lang/eval';
import { inputsOf, planeKey } from '../../levels/inputs';
import { hop, running, type CompiledLevel } from '../../levels/level';
import { tileOf } from '../../levels/tiles';
import { goalEvents } from '../goalEvents';
import { after, sceneNow } from '../sceneTime';

export type FrogKind = 'real' | 'test';

export const HOP = 0.34;
export const HOP_GAP_MS = 90;

export interface FrogSim {
  id: number;
  kind: FrogKind;
  state: State;
  plane: string;
  x: number;
  y: number;
  hop?: { fx: number; fy: number; tx: number; ty: number; t0: number; dur: number };
  rise?: { t0: number; dur: number; turns: number };
  leave?: { t0: number; dur: number };
  home?: [number, number];
  trail?: [number, number][];
  fade?: number;
  hatchT0?: number;
  landT0?: number;
  stopped: boolean;
  phase: number;
  face: number;
  yaw: number;
  cheerT0?: number;
  turn?: { t0: number; from: number; delta: number };
  lastT?: number;
  ox?: number;
  oy?: number;
  os?: number;
  drawn?: { x: number; y: number; ground: number; z: number; scale: number };
}

export const yawToward = (fx: number, fy: number, tx: number, ty: number) => Math.atan2(tx - fx, -(ty - fy));

function facingFor(level: CompiledLevel, s: State, fallback: number, stoppedToo = false): number {
  if (!stoppedToo && !running(level, s)) return fallback;
  const [fx, fy] = tileOf(level, s);
  const [tx, ty] = tileOf(level, hop(level, s));
  if (fx === tx && fy === ty) return fallback;
  return yawToward(fx, fy, tx, ty);
}

class FrogWorld {
  frogs: FrogSim[] = [];
  private nextId = 1;
  hatched = new Set<string>();
  returned = new Map<string, number>();
  hatchVersion = 0;

  markHatched(x: number, y: number) {
    this.hatched.add(`${x},${y}`);
    this.hatchVersion++;
  }

  returnEgg(x: number, y: number) {
    const key = `${x},${y}`;
    if (!this.hatched.delete(key)) return;
    this.returned.set(key, sceneNow());
    this.hatchVersion++;
  }

  remove(f: FrogSim) {
    this.frogs = this.frogs.filter((g) => g !== f);
  }

  add(level: CompiledLevel, kind: FrogKind, state: State, opts: Partial<FrogSim> = {}): FrogSim {
    const face = facingFor(level, state, 0, true);
    const [x, y] = tileOf(level, state);
    const f: FrogSim = {
      id: this.nextId++,
      kind,
      state,
      plane: planeKey(inputsOf(level, state)),
      x,
      y,
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
      this.returned.clear();
      this.hatchVersion++;
    }
  }

  hopTo(level: CompiledLevel, f: FrogSim, next: State, dur = HOP): Promise<void> {
    f.state = next;
    const [tx, ty] = tileOf(level, next);
    if (tx !== f.x || ty !== f.y) f.face = yawToward(f.x, f.y, tx, ty);
    f.hop = { fx: f.x, fy: f.y, tx, ty, t0: sceneNow(), dur };
    return new Promise((res) =>
      after(dur * 1000, () => {
        f.x = tx;
        f.y = ty;
        f.hop = undefined;
        f.landT0 = sceneNow();
        f.trail?.push([tx, ty]);
        f.face = facingFor(level, next, f.face);
        if (!running(level, next) && holds(level.post, next)) this.landOnGoal(f);
        res();
      }),
    );
  }

  landOnGoal(f: FrogSim) {
    goalEvents.push(f.x, f.y, f.plane);
    f.cheerT0 = sceneNow();
  }
}

export function trailFrogs(plane: string): FrogSim[] {
  const trailed = frogWorld.frogs.filter((f) => f.kind === 'real' && f.trail && f.plane === plane);
  const latest = trailed.filter((f) => !f.leave).at(-1);
  return trailed.filter((f) => f.leave || f === latest);
}

export const frogWorld = new FrogWorld();
