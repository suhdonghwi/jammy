import { show } from '../lang/ast';
import { compileFormula, type Rule } from '../levels/level';
import { game, useGame, type Game } from '../store/game';
import { director, events } from '../director/director';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld } from '../scene/frogSim';
import { levels } from '../levels/defs';
import type { CheckResult } from '../checker/check';

// The tutorial is a scripted story on the counter program.
//
// Pacing rules:
//  - a caption always appears *before* the scene changes it describes, and the
//    Next button only appears once the change has finished;
//  - nothing the learner should read is replaced automatically — explanations
//    wait for Next;
//  - each attempt asks for one specific formula (offered as Tab-to-fill ghost
//    text), so what happens next is always what the caption promises;
//  - whatever a caption refers to (the code, Step, Check…) is spotlighted.

class Aborted extends Error {}

let generation = 0;
let pendingCheck: (() => void) | null = null;
let pendingNext: (() => void) | null = null;
/** Formulas the current attempt accepts (normalized). */
let expected: { accepted: string[]; display: string } | null = null;

function guard(gen: number) {
  if (gen !== generation) throw new Aborted();
}

type Spot = Game['spotlight'];

/** Show a caption (no button). */
function say(text: string, spot: Spot = null, tone: 'info' | 'fail' | 'success' | 'muted' = 'info') {
  game().setCaption({ text, tone });
  game().patch({ spotlight: spot });
}

/** Show a caption with a button and wait for it. */
function next(gen: number, text: string, label = 'Next', spot: Spot = null, tone: 'info' | 'fail' | 'success' = 'info'): Promise<void> {
  return new Promise((resolve, reject) => {
    pendingNext = () => {
      pendingNext = null;
      game().patch({ spotlight: null });
      if (gen !== generation) reject(new Aborted());
      else resolve();
    };
    game().setCaption({ text, tone, action: { label, onClick: () => pendingNext?.() } });
    game().patch({ spotlight: spot });
  });
}

/** Keep the caption currently shown (e.g. a counterexample) until Next. */
function holdCaption(gen: number, label = 'Next'): Promise<void> {
  const c = game().caption;
  return next(gen, c?.text ?? '', label, null, (c?.tone as 'info' | 'fail' | 'success') ?? 'info');
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

function normalize(text: string): string | null {
  const level = game().level;
  if (!level) return null;
  const f = compileFormula(level, text);
  return f.ok ? show(f.expr) : null;
}

/** Called by the Check button in tutorial mode. */
export function tutorialCheck() {
  const g = game();
  if (!pendingCheck || !expected) return;
  const got = normalize(g.formulaText);
  if (!got || !expected.accepted.includes(got)) {
    g.setCaption({
      text: `For this step, type exactly \`${expected.display}\` — press Tab to fill it in.`,
      tone: 'fail',
    });
    g.patch({ spotlight: 'formula' });
    return;
  }
  pendingCheck();
}

export function stopTutorial() {
  generation++;
  pendingCheck = null;
  pendingNext = null;
  expected = null;
  useGame.setState({ awaitingCheck: false, spotlight: null });
}

/** Ask for one specific formula, wait for Check, and run the given rules. */
async function attempt(gen: number, formula: string, alternatives: string[], rules: Rule[]): Promise<CheckResult> {
  expected = {
    display: formula,
    accepted: [formula, ...alternatives].map((t) => normalize(t)).filter((t): t is string => !!t),
  };
  game().patch({ ghost: formula, showMe: formula });
  for (;;) {
    await new Promise<void>((resolve, reject) => {
      pendingCheck = () => {
        pendingCheck = null;
        useGame.setState({ awaitingCheck: false });
        if (gen !== generation) reject(new Aborted());
        else resolve();
      };
      useGame.setState({ awaitingCheck: true });
    });
    game().patch({ spotlight: null });
    frogWorld.clear('test');
    say('Checking…', null, 'muted');
    const res = await director.runChecker(rules);
    guard(gen);
    if (res) {
      expected = null;
      game().patch({ ghost: null, showMe: null });
      return res;
    }
  }
}

const failureOf = (res: CheckResult, rule: Rule) => {
  const v = res.verdicts[rule];
  return v?.status === 'fail' ? v.cex : null;
};

export function startTutorial() {
  const gen = ++generation;
  void script(gen).catch((e) => {
    if (!(e instanceof Aborted)) console.error(e);
  });
}

async function script(gen: number) {
  const g = game;
  const st = (i: number, n: number) => ({ i: BigInt(i), n: BigInt(n) });
  await director.sleep(500);
  guard(gen);

  // ---------------- Act 1: The world ----------------
  g().setReveal({ axes: true });
  director.spawnReal(st(0, 3));
  await director.sleep(500);
  await next(gen, 'This frog is a program state. It sits at i = 0, n = 3 — its position on the plane is its values.');

  g().setReveal({ code: true });
  await next(gen, 'Here is the program. The loop runs its body over and over while `i < n`.', 'Next', 'code');

  g().setReveal({ step: true });
  say('Press Step to run the loop body once.', 'step');
  await waitEvent(gen, 'stepped');
  say('One hop = one run of the loop body: i went from 0 to 1. Keep pressing Step.', 'step');
  await waitEvent(gen, 'stepped', () => frogWorld.frogs.every((f) => f.stopped));
  say('Here `i < n` is false, so the loop ends and the frog stops.');
  g().setReveal({ stop: true, hover: true });
  await director.sleep(900);
  await next(gen, 'Here `i < n` is false, so the loop ends and the frog stops. Striped tiles are where the loop stops. Hover any tile to preview where a frog there would hop.');

  director.clearFrogs();
  say('Where can frogs start? Anywhere the precondition allows: i starts at 0, and n can be any number ≥ 0.');
  g().setReveal({ eggs: true });
  await director.sleep(900);
  await next(gen, 'Where can frogs start? Anywhere the precondition allows: i starts at 0, and n can be any number ≥ 0. Each egg is one possible input.');

  say('What we want when the loop ends: `i == n`. The amber pools are the goals.');
  g().setReveal({ goals: true });
  await director.sleep(900);
  g().setReveal({ run: true });
  say('What we want when the loop ends: `i == n`. The amber pools are the goals. Press Run to hatch every egg.', 'run');
  await waitEvent(gen, 'runDone');
  await next(gen, 'Every frog stopped on a goal. Looks correct!');

  say('But how many eggs are there? Let’s zoom out…');
  director.clearFrogs();
  await cameraRig.lookAtTile(4, 14, 55);
  guard(gen);
  await next(
    gen,
    'n can be any number — the eggs never end. Click a few eggs to run them. They all work… but watching them one at a time can never cover them all.',
    'So how can we check them all?',
  );

  say('Instead of watching frogs, we’ll describe an area with a formula.');
  director.clearFrogs();
  await cameraRig.lookAtTile(2, 2, 15.6);
  guard(gen);
  g().setReveal({ formula: true, lights: ['init'] });
  await director.sleep(400);
  await next(
    gen,
    'Instead of watching frogs, we describe an area with a formula. If we can show three things about one area, every frog is covered — without watching any of them. One at a time.',
    'Next',
    'formula',
  );

  // ---------------- Act 2: The area, one rule at a time ----------------
  // A — Init
  say('Simplest idea first: the area is just the goal. Type `i == n` (press Tab to fill it in), then press Check.', 'check');
  let res = await attempt(gen, 'i == n', ['n == i'], ['init']);
  let cex = failureOf(res, 'init');
  if (cex) {
    await director.playCounterexample(cex, { prefix: 'This hand checks your area — it looks for a frog that breaks it. ' });
    guard(gen);
    await holdCaption(gen);
  }
  await next(gen, 'Rule 1 — Init: every egg must sit on your area. Only the egg at n = 0 was on `i == n`.', 'Next', 'lights');

  // B — Preservation
  g().setReveal({ lights: ['init', 'pres'] });
  say('A frog is either at the start, or done. Type `i == 0 || i == n`, then Check.', 'check');
  res = await attempt(gen, 'i == 0 || i == n', ['i == n || i == 0'], ['init', 'pres']);
  cex = failureOf(res, 'pres');
  if (cex) {
    await director.playCounterexample(cex);
    guard(gen);
    await holdCaption(gen);
  }
  await next(gen, 'Rule 2 — Preservation: a frog on your area that hops must land on your area. Frogs pass through the tiles in between!', 'Next', 'lights');

  // C — Init + Preservation hold; why that matters; then Exit
  say('Frogs start at i = 0 and only ever move right. Type `i >= 0`, then Check.', 'check');
  res = await attempt(gen, 'i >= 0', ['0 <= i'], ['init', 'pres']);
  await next(gen, 'Both rules hold for `i >= 0`. Let’s follow one frog to see what that means.', 'Next', 'lights');

  director.clearFrogs();
  say('Watch this frog hatch…');
  await cameraRig.lookAtTile(1.5, 3, 12);
  guard(gen);
  director.spawnReal(st(0, 3));
  await director.sleep(700);
  await next(gen, 'It starts on your area — that’s Init.');
  say('Every hop lands on your area again — that’s Preservation.');
  for (let k = 0; k < 6 && !frogWorld.frogs.every((f) => f.stopped); k++) {
    await director.sleep(500);
    await director.step();
    guard(gen);
  }
  await director.sleep(600);
  await next(gen, 'So it can never leave your area, no matter how many hops. When the loop ends, it is still somewhere on your area. Is that enough?');

  g().setReveal({ lights: ['init', 'pres', 'exit'] });
  director.clearFrogs();
  say('Rule 3 — Exit: a frog that stops on your area must be on a goal. Let’s check it.', 'lights');
  await director.sleep(1400);
  guard(gen);
  const exitRes = await director.runChecker(['exit']);
  guard(gen);
  const ev = exitRes?.verdicts.exit;
  if (ev?.status === 'fail') {
    await director.playCounterexample(ev.cex, {
      extra: '“But i never passes n!” — Your area doesn’t say that. It claims a frog could be anywhere on it, and the hand is just taking you at your word.',
    });
    guard(gen);
    await holdCaption(gen);
  }
  await next(gen, 'Rule 3 — Exit. To fix it, shrink your area so it stops claiming impossible frogs.');

  // D — all three
  say('Add what every real frog knows: it never passes n. Type `0 <= i <= n`, then Check.', 'check');
  res = await attempt(gen, '0 <= i <= n', ['i >= 0 && i <= n', 'i <= n && i >= 0'], ['init', 'pres', 'exit']);
  await director.playRain();
  guard(gen);
  await next(
    gen,
    'Every egg starts on your area, no hop leaves it, and every frog that stops on it is on a goal. That area is a loop invariant — and you just proved the loop correct for every n.',
    'Finish',
  );
  useGame.setState({ showRules: true });
  const { openLevel } = await import('../director/play');
  guard(gen);
  openLevel(levels[0]);
}
