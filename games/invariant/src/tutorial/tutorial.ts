import { compileFormula, type Rule } from '../levels/level';
import { game, useGame } from '../store/game';
import { director, events } from '../director/director';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld } from '../scene/frogSim';
import { levels } from '../levels/defs';
import type { CheckResult } from '../checker/check';

// The tutorial is a scripted story on the counter program. It advances on
// conditions (a rule failed, lights turned green), never on exact strings,
// and makes sure every rule's failure is witnessed once — by the learner's own
// formula or by a short "what if you'd written…" replay.

class Aborted extends Error {}

let generation = 0;
let pendingCheck: (() => void) | null = null;
let pendingNext: (() => void) | null = null;

function guard(gen: number) {
  if (gen !== generation) throw new Aborted();
}

const say = (text: string, tone: 'info' | 'fail' | 'success' | 'muted' = 'info') => game().setCaption({ text, tone });

function waitNext(gen: number, text: string, label = 'Next'): Promise<void> {
  return new Promise((resolve, reject) => {
    pendingNext = () => {
      pendingNext = null;
      if (gen !== generation) reject(new Aborted());
      else resolve();
    };
    game().setCaption({ text, tone: 'info', action: { label, onClick: () => pendingNext?.() } });
  });
}

function waitEvent(gen: number, name: 'stepped' | 'runDone' | 'eggRun', until?: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const off = events.on((e) => {
      if (gen !== generation) {
        off();
        reject(new Aborted());
        return;
      }
      if (e === name && (!until || until())) {
        off();
        resolve();
      }
    });
  });
}

/** Wait until the learner presses Check with a valid formula. */
function waitCheck(gen: number): Promise<void> {
  return new Promise((resolve, reject) => {
    pendingCheck = () => {
      pendingCheck = null;
      if (gen !== generation) reject(new Aborted());
      else resolve();
    };
  });
}

export function tutorialCheck() {
  const g = game();
  if (!g.formula || !g.formula.ok) {
    g.setCaption({ text: g.formula ? g.formula.error.message : 'Type a formula for your area first.', tone: 'fail' });
    return;
  }
  pendingCheck?.();
}

export function stopTutorial() {
  generation++;
  pendingCheck = null;
  pendingNext = null;
}

async function check(gen: number, rules: Rule[]): Promise<CheckResult> {
  for (;;) {
    await waitCheck(gen);
    frogWorld.clear('test');
    say('Checking…', 'muted');
    const res = await director.runChecker(rules);
    guard(gen);
    if (res) return res;
  }
}

async function whatIf(gen: number, text: string, rule: Rule, extra?: string) {
  const level = game().level!;
  const f = compileFormula(level, text);
  if (!f.ok) return;
  const res = await director.runChecker([rule], { expr: f.expr, fast: f.fast, text });
  guard(gen);
  const v = res?.verdicts[rule];
  if (v?.status === 'fail') {
    await director.playCounterexample(v.cex, { prefix: `What if you'd written \`${text}\`? `, extra });
    guard(gen);
  }
}

const firstFailure = (res: CheckResult, rules: Rule[]) =>
  rules.map((r) => res.verdicts[r]).find((v) => v?.status === 'fail');

function setGhost(ghost: string | null, showMe: string | null = ghost) {
  game().patch({ ghost, showMe });
}

export function startTutorial() {
  const gen = ++generation;
  void script(gen).catch((e) => {
    if (!(e instanceof Aborted)) console.error(e);
  });
}

async function script(gen: number) {
  const g = game;
  const level = g().level!;
  const st = (i: number, n: number) => ({ i: BigInt(i), n: BigInt(n) });
  await director.sleep(400);
  guard(gen);

  // ---------------- Act 1: The world ----------------
  g().setReveal({ axes: true });
  director.spawnReal(st(0, 3));
  await waitNext(gen, 'This frog is a program state. It sits at i = 0, n = 3 — its position on the plane is its values.');

  g().setReveal({ code: true, step: true });
  say('Here is the program. Press Step to run the loop body once.');
  await waitEvent(gen, 'stepped');
  say('One hop = one loop iteration: i went from 0 to 1. Keep stepping.');
  await waitEvent(gen, 'stepped', () => frogWorld.frogs.every((f) => f.stopped));
  g().setReveal({ stop: true, hover: true });
  await waitNext(
    gen,
    'Here `i < n` is false, so the loop ends and the frog stops. Gray tiles are where the loop stops. Hover any tile to preview where a frog there would hop.',
  );

  director.clearFrogs();
  g().setReveal({ eggs: true });
  await waitNext(gen, 'Where can frogs start? Anywhere the precondition allows: i starts at 0, and n can be any number ≥ 0. Each egg is one possible input.');

  g().setReveal({ goals: true, run: true });
  say('What we want when the loop ends: `i == n`. Goal tiles are marked with rings. Press Run.');
  await waitEvent(gen, 'runDone');
  await waitNext(gen, 'Every frog stopped on a goal. Looks correct!');

  director.clearFrogs();
  await cameraRig.lookAtTile(4, 14, 55);
  guard(gen);
  await waitNext(
    gen,
    'But how many eggs are there? n can be any number — the eggs never end. Click a few eggs to run them. They all work… but watching them one at a time can never cover them all.',
    'So how can we check them all?',
  );
  director.clearFrogs();
  await cameraRig.lookAtTile(2, 2, 13);
  guard(gen);

  // ---------------- Act 2: The area ----------------
  g().setReveal({ formula: true, lights: ['init'] });
  await waitNext(
    gen,
    'Instead of watching frogs, describe an area with a formula. If we can show three things about one area, every frog is covered — without watching any of them.',
  );

  // Attempt A — Init
  setGhost('i == n');
  say('Simplest idea first: the area is just the goal. Type `i == n` (or press Tab), then press Check.');
  for (;;) {
    const res = await check(gen, ['init']);
    const v = res.verdicts.init;
    if (v?.status === 'fail') {
      await director.playCounterexample(v.cex, { prefix: 'This hand checks your area — it looks for a frog that breaks it. ' });
      guard(gen);
      break;
    }
    if (v?.status === 'pass') {
      await whatIf(gen, 'i == n', 'init');
      break;
    }
  }
  await waitNext(gen, 'Rule 1 — Init: every egg must sit on your area. Only the egg at n = 0 was on `i == n`.');

  // Attempt B — Preservation
  g().setReveal({ lights: ['init', 'pres'] });
  setGhost(null, 'i == 0 || i == n');
  say('A frog is either at the start, or done. Try describing that — then Check.');
  const ghostTimer = setTimeout(() => gen === generation && setGhost('i == 0 || i == n'), 9000);
  for (;;) {
    const res = await check(gen, ['init', 'pres']);
    const f = firstFailure(res, ['init', 'pres']);
    if (f?.status === 'fail' && f.cex.rule === 'init') {
      await director.playCounterexample(f.cex);
      guard(gen);
      continue;
    }
    if (f?.status === 'fail') {
      await director.playCounterexample(f.cex);
      guard(gen);
      break;
    }
    if (res.verdicts.pres?.status === 'pass') {
      await whatIf(gen, 'i == 0 || i == n', 'pres');
      break;
    }
  }
  clearTimeout(ghostTimer);
  await waitNext(gen, 'Rule 2 — Preservation: a frog on your area that hops must land on your area. Frogs pass through the tiles in between!');

  // Attempt C — Init + Preservation, then the "why" beat, then Exit
  setGhost(null, 'i >= 0');
  say('Hint: frogs start at i = 0 and only ever move right. Describe that.');
  for (;;) {
    const res = await check(gen, ['init', 'pres']);
    const f = firstFailure(res, ['init', 'pres']);
    if (f?.status === 'fail') {
      await director.playCounterexample(f.cex);
      guard(gen);
      continue;
    }
    if (res.verdicts.init?.status === 'pass' && res.verdicts.pres?.status === 'pass') break;
  }
  say('Both green. Watch what that means for one frog.', 'success');
  await director.sleep(1200);
  guard(gen);
  await director.whyBeat(st(0, 3), {
    hop: 'It hops and lands on your area (Preservation).',
    stop: 'It started on your area, and no hop can leave it — so it never leaves, no matter how many hops. When the loop ends, it is on your area.',
  });
  guard(gen);
  await waitNext(gen, 'So when the loop ends, the frog is somewhere on your area. Is that enough?');

  g().setReveal({ lights: ['init', 'pres', 'exit'] });
  say('Rule 3 — Exit: a frog that stops on your area must be on a goal. Checking…', 'muted');
  director.clearFrogs();
  const adversary =
    '“But i never passes n!” — Your area doesn’t say that. It claims a frog could be anywhere on it, and the hand is just taking you at your word.';
  const exitRes = await director.runChecker(['exit']);
  guard(gen);
  const ev = exitRes?.verdicts.exit;
  if (ev?.status === 'fail') await director.playCounterexample(ev.cex, { extra: adversary });
  else await whatIf(gen, 'i >= 0', 'exit', adversary);
  guard(gen);
  await waitNext(gen, 'Rule 3 — Exit. To fix it, shrink your area so it stops claiming impossible frogs.');

  // Attempt D — all three
  setGhost(null, '0 <= i <= n');
  g().patch({
    hints: ['What is true of every real frog that rules out the hand’s frog?', 'Real frogs never go past n.'],
    hintsShown: 0,
  });
  say('Add a condition so your area only claims frogs that can really happen. Then Check.');
  for (;;) {
    const res = await check(gen, ['init', 'pres', 'exit']);
    const f = firstFailure(res, ['init', 'pres', 'exit']);
    if (f?.status === 'fail') {
      await director.playCounterexample(f.cex);
      guard(gen);
      continue;
    }
    if ((['init', 'pres', 'exit'] as Rule[]).every((r) => res.verdicts[r]?.status === 'pass')) break;
    await director.playShrug('I couldn’t decide that one. Try a simpler formula.');
    guard(gen);
  }
  await director.playRain();
  guard(gen);
  await waitNext(
    gen,
    'Every egg starts on your area, no hop leaves it, and every frog that stops on it is on a goal. That area is a loop invariant — and you just proved the loop correct for every n.',
    'Finish',
  );
  g().markTutorialDone();
  useGame.setState({ showRules: true });
  const { openLevel } = await import('../director/play');
  guard(gen);
  openLevel(levels[0]);
  void level;
}
