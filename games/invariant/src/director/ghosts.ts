import { sfx } from '../audio/sfx';
import { useGame } from '../game/store';
import type { State } from '../lang/ast';
import { holds } from '../lang/eval';
import { hop, running, toBig } from '../levels/level';
import { tileOf, tilesNear } from '../levels/tiles';
import { cameraRig } from '../scene/cameraRig';
import { clamp01, smoothstep } from '../scene/easing';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { ARC_DRAW, hopArcs } from '../scene/frogs/HopArcs';
import { after, sceneNow, sleep } from '../scene/sceneTime';
import { sendFrogsHome } from './frogs';
import { busyWhile, currentLevel } from './sequence';

export const GHOST_RISE = 0.6;
const TURNS = 2;

export function raiseGhost(s: State, fade = 1): FrogSim {
  const L = currentLevel();
  const f = frogWorld.add(L, 'test', s, { rise: { t0: sceneNow(), dur: GHOST_RISE, turns: TURNS }, fade });
  after(GHOST_RISE * 1000, () => {
    if (frogWorld.frogs.includes(f) && !running(L, f.state) && holds(L.post, f.state)) frogWorld.landOnGoal(f);
  });
  return f;
}

export function previewHop(s: State, fade = 1): FrogSim {
  const L = currentLevel();
  const f = raiseGhost(s, fade);
  const [tx, ty] = tileOf(L, hop(L, s));
  hopArcs.add({
    frog: f.id,
    fx: f.x,
    fy: f.y,
    tx,
    ty,
    plane: f.plane,
    t0: sceneNow() + GHOST_RISE + 0.1,
    fade,
  });
  after((GHOST_RISE + 0.1 + ARC_DRAW) * 1000, () => frogWorld.frogs.includes(f) && sfx.landing());
  return f;
}

const PROOF_NEAR = 6;
const PROOF_FAR = 13;
const PROOF_MAX = 40;

interface ProofHop {
  from: State;
  to: State;
  d: number;
}

function spreadHops(hops: ProofHop[]): ProofHop[] {
  const L = currentLevel();
  const at = (s: State) => tileOf(L, s);
  const apart = (a: readonly number[], b: readonly number[], r: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) >= r;
  const picked: ProofHop[] = [];
  for (const h of hops) {
    if (picked.length >= PROOF_MAX) break;
    const [f, t] = [at(h.from), at(h.to)];
    const fits = picked.every((p) => {
      const [pf, pt] = [at(p.from), at(p.to)];
      return apart(f, pf, 2.2) && apart(f, pt, 1.2) && apart(t, pf, 1.2) && apart(t, pt, 1.2);
    });
    if (fits) picked.push(h);
  }
  return picked;
}

export function playProof() {
  return busyWhile(async (tok) => {
    void sendFrogsHome();
    await cameraRig.zoomTo(Math.max(cameraRig.distance(), 18));
    if (tok.alive) await proofWave();
  });
}

export async function proofWave(): Promise<FrogSim | null> {
  const L = currentLevel();
  const { valid: inv, inputs } = useGame.getState();
  if (!inv) return null;
  const { x: tx, y: ty } = cameraRig.viewCenter();
  const near = (x: number, y: number) => Math.hypot(x - tx, y - ty);
  const candidates = tilesNear(L, inputs, { cx: Math.round(tx), cy: Math.round(ty), R: PROOF_FAR }, (s, x, y) => {
    if (!L.fast.planeReq(s) || inv.fast(s) !== true || L.fast.guard(s) !== true || near(x, y) > PROOF_FAR) return undefined;
    const from = toBig(s);
    return { from, to: hop(L, from), d: near(x, y) };
  });
  const hops = spreadHops(candidates.sort((a, b) => a.d - b.d));
  const fadeAt = (d: number) => 1 - smoothstep(clamp01((d - PROOF_NEAR) / (PROOF_FAR - PROOF_NEAR)));
  sfx.ghost();
  const ghosts = hops.map((h) => previewHop(h.from, fadeAt(h.d)));
  await sleep((GHOST_RISE + 1.0) * 1000);
  return ghosts[0] ?? null;
}
