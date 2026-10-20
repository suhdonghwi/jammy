import { sfx } from '../../audio/sfx';
import type { State } from '../../lang/ast';
import { holds, step } from '../../lang/eval';
import { inputsOf, planeKey, type CompiledLevel } from '../../levels/level';
import { goalEvents } from '../goalEvents';
import { after, sceneNow } from '../sceneTime';
import { joinHopBatch, landInBatch } from './hopBatch';

type FrogKind = 'real' | 'test';

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
  hatchT0?: number;
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
  touched?: boolean;
}

export const yawToward = (fx: number, fy: number, tx: number, ty: number) => Math.atan2(tx - fx, -(ty - fy));

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
      this.returned.clear();
      this.hatchVersion++;
    }
  }

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
        f.face = facingFor(level, next, f.face);
        if (batch) landInBatch(batch, holds(level.guard, next));
        if (!holds(level.guard, next) && holds(level.post, next)) this.landOnGoal(f, quiet);
        res();
      }),
    );
  }

  landOnGoal(f: FrogSim, quiet = false) {
    goalEvents.push(f.x, f.y, f.plane);
    if (!quiet) sfx.goal();
    f.cheerT0 = sceneNow();
  }
}

export const frogWorld = new FrogWorld();
