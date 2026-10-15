import gsap from 'gsap';
import * as THREE from 'three';
import type { State } from '../lang/ast';
import { holds } from '../lang/eval';
import { checkFormula, type CheckResult, type Formula } from '../checker/check';
import type { Counterexample } from '../checker/types';
import { browserZ3 } from '../checker/z3-browser';
import { hop, RULES, running, showState, toBig, type CompiledLevel, type Rule } from '../levels/level';
import { game, type CaptionTone } from '../store/game';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld, now, type FrogSim } from '../scene/frogSim';
import { handState } from '../scene/handState';
import { field } from '../scene/field';
import { occupancy } from '../scene/occupancy';
import { HATCH_EMERGE, hatchFx } from '../scene/Hatch';
import { SLAB_H } from '../scene/constants';
import { areaNear, eggsNear, tileState } from '../scene/tiles';
import { bridgeState } from '../scene/Bridge';

// ---------------------------------------------------------------------------
// Sequencing: every sequence gets a token; starting a new one cancels the old.
// ---------------------------------------------------------------------------

let seq = 0;
interface Token {
  readonly alive: boolean;
}
function begin(): Token {
  const id = ++seq;
  gsap.killTweensOf(handState);
  return {
    get alive() {
      return id === seq;
    },
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function tween(target: object, vars: gsap.TweenVars): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(target, { ...vars, onComplete: () => resolve(), onInterrupt: () => resolve() });
  });
}

const lvl = (): CompiledLevel => game().level!;

function caption(text: string, tone: CaptionTone = 'info', action?: { label: string; onClick: () => void }) {
  game().setCaption({ text, tone, action });
}

/** A state as inline code in captions, e.g. `n = 0, i = 1`. */
const fmt = (s: State) => '`' + showState(lvl(), s) + '`';

/** Mark the tile where a check failed, with a short reason. */
function markFailure(x: number, y: number, label: string) {
  game().patch({ failMark: { x, y, label, t0: performance.now() } });
}

function inArea(s: State): boolean {
  const v = game().valid;
  return !!v && holds(v.expr, s);
}

/** World position just above a tile in the focused pond. */
function above(x: number, y: number) {
  return { x, z: -y };
}

// ---------------------------------------------------------------------------
// The hand
// ---------------------------------------------------------------------------

export async function handIn(x: number, y: number, h = 1.8, pose: Partial<typeof handState> = {}) {
  const p = above(x, y);
  if (handState.visible < 0.05) {
    Object.assign(handState, { x: p.x + 1.5, y: h + 5, z: p.z - 3, curl: 0.25, point: 0, shrug: 0, tap: 0, yaw: 0, tilt: 0 });
  }
  await tween(handState, { visible: 1, x: p.x, y: h, z: p.z, duration: 0.7, ease: 'power3.out', ...pose });
}

export async function handOut() {
  await tween(handState, { visible: 0, y: handState.y + 4, z: handState.z - 2, point: 0, shrug: 0, tap: 0, yaw: 0, tilt: 0, palmUp: 0, duration: 0.6, ease: 'power2.in' });
}

/**
 * The hand brings a test frog sitting in its cupped, upturned palm, lowers it
 * just behind the target tile, and the frog hops forward off the palm — over
 * the curled fingertips — onto the tile. Then the hand withdraws.
 */
const PALM_TOP = 0.125; // palm surface above the hand's origin when palm-up
const SET_DOWN = 0.42; // palm surface height above the tile when releasing
const BEHIND = 0.6; // the palm waits this far behind the tile (away from the camera)
async function placeTestFrog(tok: Token, s: State): Promise<FrogSim | null> {
  const L = lvl();
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  const base = field.heightAt(x, y) * SLAB_H;
  const p = above(x, y);
  // the frog rides on the palm: its height follows the hand
  const f = frogWorld.add(L, 'test', s, { carried: 6, carryOff: { dx: 0, dy: BEHIND } });
  const follow = () => {
    f.carried = handState.y + PALM_TOP - base;
  };
  Object.assign(handState, { x: p.x, y: base + 6, z: p.z - BEHIND, curl: 0.45, point: 0, shrug: 0, tap: 0, yaw: 0, tilt: 0.3, palmUp: 1, visible: 0 });
  follow();
  await tween(handState, { visible: 1, y: base + SET_DOWN - PALM_TOP + 0.6, duration: 0.65, ease: 'power3.out', onUpdate: follow });
  if (!tok.alive) return null;
  await tween(handState, { y: base + SET_DOWN - PALM_TOP, curl: 0.3, duration: 0.35, ease: 'power2.inOut', onUpdate: follow });
  if (!tok.alive) return null;
  // the frog hops forward and down onto the tile, clearing the fingertips
  f.carried = undefined;
  f.carryOff = undefined;
  f.drop = { t0: now(), dur: 0.5, from: SET_DOWN, arc: 0.32, dx: 0, dy: BEHIND };
  await sleep(380);
  if (!tok.alive) return null;
  await tween(handState, { palmUp: 0, tilt: 0, curl: 0.15, y: base + 2.2, z: p.z - BEHIND - 0.8, duration: 0.45, ease: 'power2.inOut' });
  return f;
}

/** Point at a tile from its right side, so the hand never hides the frog. */
// The pointing pose, and where the index fingertip sits relative to the hand's
// origin in it. From the glove in Hand.tsx: the index finger's base is at
// (-0.235, -0.01, -0.24), it is splayed out by 0.12 rad, and straight it reaches
// 0.395 further (two segments plus the rounded tip); the glove is drawn at 0.95.
const POINT_POSE = { point: 1, curl: 0.2, tilt: -0.32, yaw: -1.45 };
const INDEX_DIR = new THREE.Vector3(-Math.sin(0.12), 0, -Math.cos(0.12));
const FINGERTIP = new THREE.Vector3(-0.235, -0.01, -0.24).addScaledVector(INDEX_DIR, 0.395).multiplyScalar(0.95);
function fingertipFrame() {
  const e = new THREE.Euler(-0.3 + POINT_POSE.tilt, Math.PI + POINT_POSE.yaw, 0, 'YXZ');
  return { tip: FINGERTIP.clone().applyEuler(e), dir: INDEX_DIR.clone().applyEuler(e) };
}

/**
 * Point at whatever sits on tile (x, y) — an egg or a frog: the fingertip stops
 * just short of it, angled down at its middle, then jabs at it a few times.
 */
export async function pointAt(x: number, y: number) {
  const slot = occupancy.eggSlots.get(`${x},${y}`);
  const ground = field.heightAt(x, y) * SLAB_H;
  const target = new THREE.Vector3(x + (slot?.dx ?? 0), ground + 0.2, -y - (slot?.dy ?? 0));
  const { tip, dir } = fingertipFrame();
  // fingertip a little way back from the target's middle, along the finger
  const at = target.clone().addScaledVector(dir, -0.3).sub(tip);
  const back = at.clone().addScaledVector(dir, -0.12);
  await tween(handState, { visible: 1, x: back.x, y: back.y, z: back.z, ...POINT_POSE, duration: 0.5, ease: 'power2.out' });
  await tween(handState, { x: at.x, y: at.y, z: at.z, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' });
}

// ---------------------------------------------------------------------------
// Camera / ponds
// ---------------------------------------------------------------------------

async function focusState(s: State, far = false) {
  const L = lvl();
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  if (L.pond) {
    const p = Number(s[L.pond]);
    if (p !== game().pond) {
      game().setPond(p);
      await sleep(80);
      while (game().elevating) await sleep(60);
    }
  }
  if (far) {
    await cameraRig.zoomTo(45);
    await cameraRig.lookAtTile(x, y);
    await cameraRig.zoomTo(13);
  } else {
    const t = cameraRig.target();
    const dist = Math.hypot(t.x - x, -t.z - y);
    if (dist > 3 || cameraRig.distance() > 22) await cameraRig.lookAtTile(x, y, Math.min(cameraRig.distance(), 16));
  }
}

// ---------------------------------------------------------------------------
// Real frogs: hatching, stepping, running
// ---------------------------------------------------------------------------

function eggStatesNear(maxCount: number, radius: number): State[] {
  const L = lvl();
  const t = cameraRig.target();
  const tx = t.x;
  const ty = -t.z;
  const R = Math.ceil(radius);
  return eggsNear(L, game().pond, Math.round(tx), Math.round(ty), R)
    .filter(([x, y]) => !frogWorld.hatched.has(`${x},${y}`) && Math.hypot(x - tx, y - ty) <= radius)
    .sort((a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty))
    .slice(0, maxCount)
    .map(([x, y]) => toBig(tileState(L, x, y, game().pond)));
}

function hatch(s: State): FrogSim {
  const L = lvl();
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  // the egg cracks open and the frog climbs out from where the egg sat
  const slot = occupancy.eggSlots.get(`${x},${y}`) ?? { dx: 0, dy: 0, scale: 1 };
  hatchFx.push({ x, y, pond: L.pond ? Number(s[L.pond]) : undefined, dx: slot.dx, dy: slot.dy, s: slot.scale });
  frogWorld.markHatched(x, y);
  const f = frogWorld.add(L, 'real', s, { hatchT0: now() + HATCH_EMERGE, ox: slot.dx, oy: slot.dy, os: slot.scale });
  f.stopped = !running(L, s);
  return f;
}

function activeReal(): FrogSim[] {
  const L = lvl();
  const pond = game().pond;
  return frogWorld.frogs.filter((f) => f.kind === 'real' && !f.stopped && (!L.pond || f.pond === pond));
}

/**
 * One hop for every moving frog. `stepping` stays on while they are in the
 * air, so nothing else (Step, Run, an egg) can start hops that would fight
 * over the same frogs — e.g. Step pressed right after Pause.
 */
async function hopAllOnce(dur = 0.42): Promise<number> {
  const L = lvl();
  const frogs = activeReal();
  if (frogs.length === 0) return 0;
  game().patch({ stepping: true });
  try {
    await Promise.all(
      frogs.map((f) => {
        const n = hop(L, f.state);
        return frogWorld.hopTo(L, f, n, dur).then(() => {
          f.stopped = !running(L, n);
        });
      }),
    );
  } finally {
    game().patch({ stepping: false });
  }
  const sel = game().selected;
  if (frogs.length === 1 || sel) game().patch({ selected: frogs[0].state });
  return frogs.length;
}


export const director = {
  /** Called when a level opens. */
  reset() {
    begin();
    frogWorld.clear();
    field.reset();
    occupancy.eggs = new Set();
    hatchFx.clear();
    Object.assign(handState, { visible: 0 });
    bridgeState.active = false;
    game().patch({ busy: false, running: false, selected: null, lastFailure: null, cinematic: false, failMark: null });
  },

  clearFrogs() {
    begin();
    frogWorld.clear();
    game().patch({ running: false, selected: null, failMark: null });
  },

  /** Hatch one real frog (tutorial beat 1). */
  spawnReal(s: State): FrogSim {
    const f = hatch(s);
    game().patch({ selected: s });
    return f;
  },

  async step(scripted = false) {
    const g = game();
    if (g.busy || g.running || g.stepping) return;
    if (!scripted && g.mode === 'tutorial' && !g.tutorialAllow.step) return;
    if (activeReal().length === 0 && !frogWorld.frogs.some((f) => f.kind === 'real')) {
      const eggs = eggStatesNear(1, 6);
      if (eggs.length) director.spawnReal(eggs[0]);
      return;
    }
    await hopAllOnce();
    events.emit('stepped');
  },

  async run() {
    const g = game();
    if (g.busy || g.running || g.stepping) return;
    if (g.mode === 'tutorial' && !g.tutorialAllow.run) return;
    const tok = begin();
    frogWorld.clear('test');
    // running from the first moment (Step is disabled while eggs hatch)
    game().patch({ failMark: null, running: true });
    gsap.to(handState, { visible: 0, duration: 0.3 });
    if (activeReal().length === 0) {
      frogWorld.clear('real');
      const eggs = eggStatesNear(140, Math.max(8, Math.min(22, cameraRig.distance() * 0.9)));
      eggs.forEach((s, i) => setTimeout(() => tok.alive && hatch(s), i * 6));
      await sleep(Math.min(900, 300 + eggs.length * 6) + HATCH_EMERGE * 1000);
    }
    let beats = 0;
    while (tok.alive && game().running && beats < 80) {
      const n = await hopAllOnce(0.34);
      if (n === 0) break;
      beats++;
      await sleep(90);
    }
    if (tok.alive) {
      game().patch({ running: false });
      // only a run where every frog has stopped counts as done (not a pause)
      if (activeReal().length === 0) events.emit('runDone');
    }
  },

  pause() {
    game().patch({ running: false });
  },

  /** Run a single egg's frog (clicking an egg). */
  async runEgg(s: State) {
    const g = game();
    if (g.busy || g.stepping) return;
    const f = hatch(s);
    game().patch({ selected: s });
    // during a run, the run moves the new frog along with the others
    if (g.running) return;
    game().patch({ stepping: true });
    try {
      await sleep(350);
      const L = lvl();
      let k = 0;
      while (!f.stopped && k < 60 && frogWorld.frogs.includes(f)) {
        const n = hop(L, f.state);
        await frogWorld.hopTo(L, f, n, 0.36);
        f.stopped = !running(L, n);
        if (game().selected) game().patch({ selected: n });
        k++;
      }
    } finally {
      game().patch({ stepping: false });
    }
    events.emit('eggRun');
  },

  clickTile(x: number, y: number) {
    const g = game();
    if (g.busy || !g.reveal.eggs) return;
    if (g.mode === 'tutorial' && !g.tutorialAllow.eggs) return;
    const isEgg = eggsNear(lvl(), g.pond, x, y, 0).some(([ex, ey]) => ex === x && ey === y);
    if (!isEgg || frogWorld.hatched.has(`${x},${y}`)) {
      game().patch({ selected: null });
      return;
    }
    void director.runEgg(toBig(tileState(lvl(), x, y, g.pond)));
  },

  // -------------------------------------------------------------------------
  // Checking
  // -------------------------------------------------------------------------

  async runChecker(rules: Rule[] = RULES, formula?: Formula): Promise<CheckResult | null> {
    const g = game();
    const inv = formula ?? g.valid;
    if (!g.level || !inv) return null;
    if (!formula && g.formula && !g.formula.ok) return null;
    const t = cameraRig.target();
    const box = { cx: Math.round(t.x), cy: Math.round(-t.z), r: 20, pondR: 20, pond: g.pond };
    const keep = { ...game().verdicts };
    for (const r of rules) delete keep[r];
    if (!formula) game().patch({ checking: true, verdicts: keep, failMark: null });
    let tapping = false;
    const tapTimer = setTimeout(() => {
      tapping = true;
      const tt = cameraRig.target();
      void handIn(tt.x / 1 + 2.5, -tt.z + 1.5, 2.4, { tap: 1, curl: 0.15, tilt: 0.1 });
    }, 350);
    try {
      const ctx = await browserZ3();
      const res = await checkFormula(ctx, g.level, inv, box, { rules, timeout: 4000 });
      if (!formula) game().patch({ verdicts: { ...keep, ...res.verdicts }, pitfallMessage: res.pitfall?.message ?? null });
      return res;
    } catch (e) {
      caption(`The solver could not start: ${(e as Error).message}`, 'fail');
      return null;
    } finally {
      clearTimeout(tapTimer);
      if (tapping) gsap.to(handState, { tap: 0, duration: 0.2 });
      if (!formula) game().patch({ checking: false });
    }
  },

  /** Play the hand's demonstration of one counterexample. */
  async playCounterexample(cex: Counterexample, opts: { prefix?: string; extra?: string; reserveNext?: boolean } = {}) {
    const tok = begin();
    const L = lvl();
    game().patch({ busy: true, lastFailure: cex, running: false, failMark: null });
    frogWorld.clear();
    const x = Number(cex.state[L.view.x]);
    const y = Number(cex.state[L.view.y]);
    try {
      if (handState.visible > 0.1) await handOut();
      await focusState(cex.state, cex.far);
      if (!tok.alive) return;
      const prefix = opts.prefix ?? (cex.far ? 'Everything nearby looked fine — but far away: ' : '');
      const broken = cex.broken ? ` \`${cex.broken}\` ${cex.rule === 'pres' ? 'no longer holds' : 'is false there'}.` : '';
      let text = '';
      if (cex.rule === 'init') {
        await handIn(x + 0.4, y - 1.3, 1.6, { curl: 0.2 });
        if (!tok.alive) return;
        await pointAt(x, y);
        const f = hatch(cex.state);
        await sleep(450);
        void f;
        markFailure(x, y, 'starts outside your area');
        game().patch({ selected: cex.state });
        text = `${prefix}This frog starts at ${fmt(cex.state)} — outside your area.${broken}`;
      } else {
        const f = await placeTestFrog(tok, cex.state);
        if (!f || !tok.alive) return;
        game().patch({ selected: cex.state });
        await sleep(380);
        if (cex.rule === 'pres' && cex.next) {
          await frogWorld.hopTo(L, f, cex.next, 0.55);
          game().patch({ selected: cex.next });
          markFailure(Number(cex.next[L.view.x]), Number(cex.next[L.view.y]), 'lands outside your area');
          if (!tok.alive) return;
          await pointAt(Number(cex.next[L.view.x]), Number(cex.next[L.view.y]));
          text = `${prefix}From ${fmt(cex.state)}, one hop lands at ${fmt(cex.next)} — outside your area.${broken}`;
        } else {
          markFailure(x, y, 'stops, but not on a goal');
          await pointAt(x, y);
          text = `${prefix}A frog that stops at ${fmt(cex.state)} doesn't meet the postcondition.`;
        }
      }
      if (opts.extra) text += `\n\n${opts.extra}`;
      const replay = { label: 'Replay', onClick: () => void director.playCounterexample(cex, opts) };
      if (opts.reserveNext) {
        // The tutorial adds Next here: if it's already waiting (this is a replay),
        // keep its live button; otherwise reserve the space so nothing shifts.
        const waiting = game().nextAction;
        game().setCaption({
          text,
          tone: 'fail',
          action: waiting ?? { label: 'Next', onClick: () => {}, pending: true },
          secondary: replay,
        });
      } else caption(text, 'fail', replay);
      await sleep(600);
      if (tok.alive) await handOut();
    } finally {
      if (tok.alive) game().patch({ busy: false });
    }
  },

  async playShrug(text: string) {
    const tok = begin();
    game().patch({ busy: true });
    try {
      const t = cameraRig.target();
      await handIn(t.x + 0.5, -t.z + 1.5, 2.0, { curl: 0.05, point: 0, tilt: 0.2 });
      if (!tok.alive) return;
      await tween(handState, { palmUp: 1, curl: 0.15, duration: 0.35, ease: 'back.out(1.6)' });
      await tween(handState, { shrug: 1, duration: 0.2 });
      await sleep(1300);
      await tween(handState, { shrug: 0, palmUp: 0, duration: 0.3 });
      caption(text, 'muted');
      await handOut();
    } finally {
      if (tok.alive) game().patch({ busy: false });
    }
  },

  /** Success: the hand scatters frogs everywhere on the area. */
  async playRain() {
    const tok = begin();
    const L = lvl();
    game().patch({ busy: true, running: false, selected: null });
    frogWorld.clear();
    try {
      const t0 = cameraRig.target();
      await cameraRig.zoomTo(Math.max(cameraRig.distance(), 18));
      const inv = game().valid;
      if (!inv) return;
      const t = cameraRig.target();
      const tx = t.x;
      const ty = -t.z;
      const tiles: State[] = areaNear(L, game().pond, inv.fast, Math.round(tx), Math.round(ty), 16)
        .filter(([x, y]) => Math.hypot(x - tx, y - ty) <= 15)
        .map(([x, y]) => toBig(tileState(L, x, y, game().pond)));
      // shuffle and cap
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      const pick = tiles.slice(0, 160);
      // hand sweeps across while sprinkling
      Object.assign(handState, { x: tx - 9, y: 5, z: -ty + 2, curl: 0.55, tap: 0.6, point: 0, shrug: 0, palmUp: 0, yaw: 0 });
      void tween(handState, { visible: 1, duration: 0.3 });
      void tween(handState, { x: tx + 9, z: -ty - 2, duration: 1.8, ease: 'sine.inOut' });
      const frogs: FrogSim[] = [];
      pick.forEach((s, i) => {
        setTimeout(() => {
          if (!tok.alive) return;
          const f = frogWorld.add(L, 'test', s, { drop: { t0: now(), dur: 0.5 + Math.random() * 0.3, from: 5 + Math.random() * 2 } });
          frogs.push(f);
        }, (i / pick.length) * 1600 + Math.random() * 120);
      });
      await sleep(2400);
      if (!tok.alive) return;
      void handOut();
      // Every frog on the continue region hops once — and lands on the area again.
      const movers = frogs.filter((f) => running(L, f.state));
      await Promise.all(movers.map((f) => frogWorld.hopTo(L, f, hop(L, f.state), 0.45)));
      void t0;
    } finally {
      if (tok.alive) game().patch({ busy: false });
    }
  },

  /** Tutorial "why" beat: one real frog, slab after slab. */
  async whyBeat(start: State, lines: { hop: string; stop: string }) {
    const tok = begin();
    const L = lvl();
    game().patch({ busy: true });
    frogWorld.clear();
    try {
      await focusState(start);
      const f = hatch(start);
      game().patch({ selected: start });
      caption('It hatches on your area (Init).', 'info');
      await sleep(1400);
      let k = 0;
      while (!f.stopped && k < 12 && tok.alive) {
        const n = hop(L, f.state);
        await frogWorld.hopTo(L, f, n, 0.5);
        f.stopped = !running(L, n);
        game().patch({ selected: n });
        caption(k === 0 ? lines.hop : `${lines.hop} Again — still on your area.`, 'info');
        await sleep(900);
        k++;
      }
      if (tok.alive) caption(lines.stop, 'info');
    } finally {
      if (tok.alive) game().patch({ busy: false });
    }
  },

  async bridge() {
    const tok = begin();
    game().patch({ busy: true, cinematic: true });
    bridgeState.active = true;
    bridgeState.t = 0;
    try {
      // the cinematic lives at y = 0, independent of the level's pond floors
      const c = cameraRig.controls;
      await c?.setLookAt(4.5, 9, 10, 2, -1.2, -2.5, false);
      caption('Remember the tutorial? Each row was one input n.', 'info');
      await sleep(2000);
      if (!tok.alive) return;
      caption('Frogs never change rows — so each row is its own world. Let’s lift them apart.', 'info');
      void c?.setLookAt(14.5, 11, 13.5, 2, 2.9, -2.5, true);
      await tween(bridgeState, { t: 1, duration: 3, ease: 'power1.inOut' });
      caption('From now on, each input is its own pond, stacked on top of each other.', 'info');
      await sleep(1600);
    } finally {
      bridgeState.active = false;
      game().patch({ cinematic: false });
      if (tok.alive) {
        game().patch({ busy: false });
        const cam = lvl().camera ?? { x: 0, y: 0 };
        void cameraRig.resetAngle();
        await cameraRig.lookAtTile(cam.x, cam.y, cam.distance ?? 14);
      }
    }
  },

  isInArea: inArea,
  sleep,
};

// ---------------------------------------------------------------------------
// Events (the tutorial listens to these)
// ---------------------------------------------------------------------------

type EventName = 'stepped' | 'runDone' | 'eggRun';
const listeners = new Set<(e: EventName) => void>();
export const events = {
  emit(e: EventName) {
    listeners.forEach((l) => l(e));
  },
  on(l: (e: EventName) => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};
