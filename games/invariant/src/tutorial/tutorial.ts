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

/** Show a caption. `reserve`: the label of a button that will appear later —
 *  its space is kept from the start so the caption never reflows. */
function say(text: string, spot: Spot = null, tone: 'info' | 'fail' | 'success' | 'muted' = 'info', reserve?: string) {
  game().setCaption({ text, tone, action: reserve ? { label: reserve, onClick: () => {}, pending: true } : undefined });
  game().patch({ spotlight: spot });
}

/** Show a caption with a button and wait for it. */
function next(gen: number, text: string, label = 'Next', spot: Spot = null, tone: 'info' | 'fail' | 'success' = 'info'): Promise<void> {
  return new Promise((resolve, reject) => {
    const shownAt = performance.now();
    pendingNext = () => {
      // a fast double click must not also press the next caption's button
      if (performance.now() - shownAt < 350) return;
      pendingNext = null;
      game().patch({ spotlight: null, nextAction: null });
      if (gen !== generation) reject(new Aborted());
      else resolve();
    };
    const secondary = game().caption?.text === text ? game().caption?.secondary : undefined;
    const action = { label, onClick: () => pendingNext?.() };
    game().setCaption({ text, tone, action, secondary });
    game().patch({ spotlight: spot, nextAction: action });
  });
}

/**
 * One beat of the story: the caption appears right away with its final text,
 * `prepare` runs the scene change it describes, and only then does the Next
 * button appear (same text, so the caption doesn't re-animate).
 */
async function beat(
  gen: number,
  text: string,
  opts: { prepare?: () => Promise<void> | void; label?: string; spot?: Spot; settle?: number; callouts?: Game['callouts'] } = {},
): Promise<void> {
  // small labelled tags in the scene for what this beat talks about (cleared otherwise)
  useGame.setState({ callouts: opts.callouts ?? [] });
  say(text, opts.spot ?? null, 'info', opts.label ?? 'Next');
  if (opts.prepare) await opts.prepare();
  guard(gen);
  await director.sleep(opts.settle ?? 300);
  guard(gen);
  await next(gen, text, opts.label ?? 'Next', opts.spot ?? null);
}

/** Let the learner use a control during one beat. */
function allow(a: Partial<Game['tutorialAllow']>) {
  useGame.setState({ tutorialAllow: { step: false, run: false, eggs: false, ...a } });
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
  if (g.formula && !g.formula.ok) {
    useGame.setState((st) => ({ errorNudge: st.errorNudge + 1 }));
    return;
  }
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
  useGame.setState({ awaitingCheck: false, spotlight: null, nextAction: null, tutorialAllow: { step: false, run: false, eggs: false } });
}

/** Ask for one specific formula, wait for Check, and run the given rules. */
async function attempt(gen: number, formula: string, alternatives: string[], rules: Rule[]): Promise<CheckResult> {
  expected = {
    display: formula,
    accepted: [formula, ...alternatives].map((t) => normalize(t)).filter((t): t is string => !!t),
  };
  game().patch({ ghost: formula, showMe: formula, callouts: [] });
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
  const realFrogsStopped = () => frogWorld.frogs.filter((f) => f.kind === 'real').every((f) => f.stopped);
  allow({});
  await director.sleep(500);
  guard(gen);

  // ---------------- Act 1: The world ----------------
  await beat(gen, 'This frog is a program state. It sits at `i = 0, n = 3` — its position on the plane is its values.', {
    prepare: async () => {
      g().setReveal({ axes: true });
      // the frog's own tag shows its values (and animates them as it hops)
      g().patch({ frogTags: true });
      director.spawnReal(st(0, 3));
      await director.sleep(600);
    },
  });

  await beat(gen, 'Here is the program. The loop runs its body again and again while `i < n`.', {
    spot: 'code',
    prepare: () => g().setReveal({ code: true }),
  });

  g().setReveal({ step: true });
  allow({ step: true });
  say('Press Step to run the loop body once.', 'step');
  await waitEvent(gen, 'stepped');
  say('One hop = one run of the loop body: `i` went from `0` to `1`. Keep pressing Step until the frog stops.', 'step');
  await waitEvent(gen, 'stepped', realFrogsStopped);
  allow({});

  await beat(
    gen,
    'Now `i < n` is false (`3 < 3` fails), so the loop ends and the frog stops. Striped tiles are where the loop stops. Hover over any tile to preview where a frog there would hop.',
    {
      prepare: () => g().setReveal({ stop: true, hover: true }),
      settle: 1000,
      callouts: [{ x: 3, y: 3, text: 'stops: 3 < 3 is false', tone: 'info' }],
    },
  );

  await beat(gen, 'Where can frogs start? Anywhere the precondition allows: `i` starts at `0`, and `n` can be any number `≥ 0`. Each egg is one possible input.', {
    callouts: [{ x: 0, y: 2, text: 'egg: input n = 2', tone: 'info' }],
    prepare: () => {
      director.clearFrogs();
      g().patch({ frogTags: false });
      g().setReveal({ eggs: true });
    },
    settle: 1100,
  });

  await beat(gen, 'What we want when the loop ends: `i == n`. The amber pools are the goals — every frog should finish on one.', {
    callouts: [{ x: 2, y: 2, text: 'goal: i == n', tone: 'info' }],
    prepare: () => g().setReveal({ goals: true }),
    settle: 1000,
  });

  g().setReveal({ run: true });
  useGame.setState({ callouts: [] });
  allow({ run: true });
  say('Press Run to hatch every egg and run all the frogs at once.', 'run');
  await waitEvent(gen, 'runDone', realFrogsStopped);
  allow({});
  await beat(gen, 'Every frog stopped on a goal. Looks correct!');

  await beat(
    gen,
    'But how many eggs are there? `n` can be any number — the eggs never end. Click a few eggs to run them: they all work… but watching them one at a time can never cover them all.',
    {
      label: 'So how can we check them all?',
      prepare: async () => {
        director.clearFrogs();
        await cameraRig.lookAtTile(4, 14, 55);
        allow({ eggs: true });
      },
    },
  );
  allow({});

  await beat(
    gen,
    'Instead of watching frogs, we describe an area with a formula. If we can show three things about one area, every frog is covered — without watching any of them. Let’s take them one at a time.',
    {
      spot: 'formula',
      prepare: async () => {
        director.clearFrogs();
        await cameraRig.lookAtTile(2, 2, 15.6);
        g().setReveal({ formula: true, lights: ['init'] });
      },
      settle: 500,
    },
  );

  // ---------------- Act 2: The area, one rule at a time ----------------
  // A — Init
  say('Simplest idea first: the area is just the goal. Type `i == n` (press Tab to fill it in), then press Check.', 'check');
  let res = await attempt(gen, 'i == n', ['n == i'], ['init']);
  let cex = failureOf(res, 'init');
  if (cex) {
    await director.playCounterexample(cex, { prefix: 'This hand checks your area — it looks for a frog that breaks it. ', reserveNext: true });
    guard(gen);
    await holdCaption(gen);
  }
  await beat(gen, 'Rule 1 — Init: every egg must sit on your area. Only the egg at `n = 0` was on `i == n`.', {
    spot: 'lights',
    callouts: [{ x: 0, y: 0, text: 'on your area', tone: 'good' }],
  });

  // B — Preservation
  g().setReveal({ lights: ['init', 'pres'] });
  say('A frog is either at the start, or done. Type `i == 0 || i == n`, then Check.', 'check');
  res = await attempt(gen, 'i == 0 || i == n', ['i == n || i == 0'], ['init', 'pres']);
  cex = failureOf(res, 'pres');
  if (cex) {
    await director.playCounterexample(cex, { reserveNext: true });
    guard(gen);
    await holdCaption(gen);
  }
  await beat(gen, 'Rule 2 — Preservation: a frog on your area that hops must land on your area. Frogs pass through the tiles in between!', {
    spot: 'lights',
  });

  // C — Init and Preservation hold; follow one frog; then Exit
  say('Frogs start at `i = 0` and only ever move right. Type `i >= 0`, then Check.', 'check');
  await attempt(gen, 'i >= 0', ['0 <= i'], ['init', 'pres']);
  await beat(gen, 'Both rules hold for `i >= 0`. Let’s follow one frog to see what that means.', { spot: 'lights' });

  await beat(gen, 'It starts on your area — that’s Init.', {
    callouts: [{ x: 0, y: 3, text: 'Init', tone: 'good' }],
    prepare: async () => {
      director.clearFrogs();
      await cameraRig.lookAtTile(1.5, 3, 12);
      director.spawnReal(st(0, 3));
      await director.sleep(600);
    },
  });
  say('Every hop lands on your area again — that’s Preservation.');
  for (let k = 0; k < 6 && !realFrogsStopped(); k++) {
    await director.sleep(650);
    await director.step(true);
    guard(gen);
    const f = frogWorld.frogs[0];
    if (f) useGame.setState({ callouts: [{ x: f.x, y: f.y, text: 'still on your area', tone: 'good' }] });
  }
  await director.sleep(500);
  await beat(gen, 'So it can never leave your area, no matter how many hops. When the loop ends, it is still somewhere on your area. Is that enough?', {
    callouts: useGame.getState().callouts,
  });

  g().setReveal({ lights: ['init', 'pres', 'exit'] });
  useGame.setState({ callouts: [] });
  director.clearFrogs();
  say('Rule 3 — Exit: a frog that stops on your area must be on a goal. Let’s check it.', 'lights');
  await director.sleep(1800);
  guard(gen);
  const exitRes = await director.runChecker(['exit']);
  guard(gen);
  const ev = exitRes?.verdicts.exit;
  if (ev?.status === 'fail') {
    await director.playCounterexample(ev.cex, {
      extra: '“But `i` never passes `n`!” — Your area doesn’t say that. It claims a frog could be anywhere on it, and the hand is just taking you at your word.',
      reserveNext: true,
    });
    guard(gen);
    await holdCaption(gen);
  }
  await beat(gen, 'Rule 3 — Exit. To fix it, shrink your area so it stops claiming impossible frogs.');

  // D — all three
  say('Add what every real frog knows: it never passes `n`. Type `0 <= i <= n`, then Check.', 'check');
  await attempt(gen, '0 <= i <= n', ['i >= 0 && i <= n', 'i <= n && i >= 0'], ['init', 'pres', 'exit']);
  await director.playRain();
  guard(gen);
  await beat(
    gen,
    'Every egg starts on your area, no hop leaves it, and every frog that stops on it is on a goal. That area is a loop invariant — and you just proved the loop correct for every `n`.',
    { label: 'Finish' },
  );
  useGame.setState({ showRules: true });
  const { openLevel } = await import('../director/play');
  guard(gen);
  openLevel(levels[0]);
}
