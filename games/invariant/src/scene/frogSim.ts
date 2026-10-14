import type { State } from '../lang/ast';
import type { CompiledLevel } from '../levels/level';

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
  /** Sitting frogs blink and idle. */
  phase: number;
  /** Fade-out start (removal). */
  fadeT0?: number;
}

export const now = () => performance.now() / 1000;

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
  hopTo(level: CompiledLevel, f: FrogSim, next: State, dur = 0.42): Promise<void> {
    f.state = next;
    const tx = Number(next[level.view.x]);
    const ty = Number(next[level.view.y]);
    f.hop = { fx: f.x, fy: f.y, tx, ty, t0: now(), dur };
    return new Promise((res) =>
      setTimeout(() => {
        f.x = tx;
        f.y = ty;
        f.hop = undefined;
        res();
      }, dur * 1000),
    );
  }
}

export const frogWorld = new FrogWorld();
