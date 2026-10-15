import { hatchFrog, resetFrogs, stepFrogs } from '../director/frogs';
import { handIn, handOut, pointAt } from '../director/hand';
import { sleep } from '../director/sequence';
import { playRain } from '../director/verdicts';
import { useGame, type Reveal } from '../game/store';
import { RULE_NAMES, type Rule } from '../levels/level';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld } from '../scene/frogs/frogWorld';
import { EXIT_MS } from '../ui/presence';
import { allow, beat, choose, demo, guard, say, stage, waitEvent, waitStore } from './script';

// The story, as steps. Each step knows the scene it starts from, so Back can
// rebuild it and replay the step; moving forward just runs the next one.
//
// Acts: the world (what is being proved) → the three rules, one stage each
// (the learner draws an area; whatever passes or fails is the lesson) →
// wrap-up. See docs/tutorial-plan.md for the script and its reasoning.

/** A tutorial state (i, n). */
export const st = (i: number, n: number) => ({ i: BigInt(i), n: BigInt(n) });
const realFrogsStopped = () => frogWorld.frogs.filter((f) => f.kind === 'real').every((f) => f.stopped);

/** What the scene looks like when a step begins. */
export interface Scene {
  reveal: Partial<Reveal>;
  /** Real frogs (as (i, n)) already on the board. */
  frogs?: [number, number][];
  /** Frogs carry their value tags. */
  tags?: boolean;
  /** A fixed formula, or whatever area the learner last had pass a stage. */
  formula?: string | 'learner';
  /** Camera target tile and distance. */
  camera?: [number, number, number];
}

interface Step {
  scene: Scene;
  run: (gen: number) => Promise<void>;
}

// ---- what the learner has done so far (survives Back, cleared when the tutorial starts) ----

/** The learner's area as of the last stage it passed. */
export let learnerFormula = '';
/** Rules the learner has seen fail on an area of their own (then the hand's demo of that rule is skipped). */
const witnessed = new Set<Rule>();

export function resetProgress() {
  learnerFormula = '';
  witnessed.clear();
}

const WORLD = { axes: true, code: true, step: true, stop: true, hover: true, eggs: true, goals: true, run: true } as const;
const DRAW = { ...WORLD, assert: true, formula: true, lights: ['init', 'pres', 'exit'] as Rule[] };

const ALL: Rule[] = ['init', 'pres', 'exit'];
const upTo = (r: Rule): Rule[] => ALL.slice(0, ALL.indexOf(r) + 1);

/** The learner's area, as inline code. */
const mine = () => `\`${useGame.getState().formulaText.trim()}\``;

/**
 * A rule's failure, witnessed: if the learner already saw it on an area of
 * their own, the rule is simply named; otherwise the hand demos the stage's
 * pitfall after the learner predicts the outcome.
 */
async function witness(
  gen: number,
  rule: Rule,
  pitfall: string,
  o: { question: string; afterDemo: string; afterOwn: string; extra?: string },
) {
  if (!witnessed.has(rule)) {
    const guess = await choose(gen, `Your area passes. Before we go on, the hand will try \`${pitfall}\`. ${o.question}`, [
      { key: 'pass', label: 'Passes' },
      { key: 'fail', label: 'Fails' },
    ]);
    guard(gen);
    await demo(gen, pitfall, upTo(rule), o.extra);
    guard(gen);
    const verdict = guess === 'fail' ? 'Right: it fails.' : 'Not quite: it fails.';
    await beat(gen, `${verdict} ${o.afterDemo}`, { spot: 'lights' });
  } else {
    await beat(gen, o.afterOwn, { spot: 'lights' });
  }
}

/** The objection every learner raises at Exit, and its answer. */
const OBJECTION =
  '“But `i` never passes `n`!” — Your area doesn’t say that. It claims a frog could be anywhere on it, and the hand takes you at your word. To fix it, **shrink** your area so it stops claiming impossible frogs.';

export const STEPS: Step[] = [
  // ======================= Act 1: The world =======================
  // 1.1 a frog and its tile
  {
    scene: { reveal: {} },
    run: (gen) =>
      beat(
        gen,
        'This frog is one run of the program. The tile it sits on is its **state**: `i = 0, n = 3`.\n\nAlong one way `i` changes; along the other, `n`.',
        {
          callouts: [
            { x: 2, y: 0, text: 'i grows this way', tone: 'info' },
            { x: 0, y: 1, text: 'n grows this way', tone: 'info' },
          ],
          prepare: async () => {
            useGame.getState().setReveal({ axes: true });
            // the frog's own tag shows its values (and animates them as it hops)
            useGame.setState({ frogTags: true });
            hatchFrog(st(0, 3));
            await sleep(600);
          },
        },
      ),
  },
  // 1.2a the program
  {
    scene: { reveal: { axes: true }, frogs: [[0, 3]], tags: true },
    run: (gen) =>
      beat(gen, 'Here is the **program**. The loop runs its body again and again while `i < n`.', {
        spot: 'code',
        prepare: () => useGame.getState().setReveal({ code: true }),
      }),
  },
  // 1.2b requires and ensures
  {
    scene: { reveal: { axes: true, code: true }, frogs: [[0, 3]], tags: true },
    run: (gen) =>
      beat(
        gen,
        'Two lines you may not have seen.\n\n- `requires` is the **precondition**: what we assume about the input. Here, `n` is never negative.\n- `ensures` is the **postcondition**: what must be true once the loop has finished. Here, `i` must have reached `n`.',
        { spot: 'code', lines: [2, 9] },
      ),
  },
  // 1.3 step
  {
    scene: { reveal: { axes: true, code: true }, frogs: [[0, 3]], tags: true },
    run: async (gen) => {
      useGame.getState().setReveal({ step: true });
      allow({ step: true });
      say('Press **Step** to run the loop body once.', 'step');
      await waitEvent(gen, 'stepped');
      say('One hop = one run of the loop body: `i` went from `0` to `1`.\n\nKeep pressing **Step** until the frog stops.', 'step');
      await waitEvent(gen, 'stepped', realFrogsStopped);
      allow({});
    },
  },
  // 1.4 stops
  {
    scene: { reveal: { axes: true, code: true, step: true }, frogs: [[3, 3]], tags: true },
    run: (gen) =>
      beat(
        gen,
        'Now `i < n` is false (`3 < 3`), so the loop ends and the frog **stops**.\n\n- The shaded tiles are where the loop stops.\n- Hover over any tile to preview where a frog there would hop.',
        {
          prepare: () => useGame.getState().setReveal({ stop: true, hover: true }),
          settle: 1000,
          callouts: [{ x: 3, y: 3, text: 'stops: 3 < 3 is false', tone: 'info' }],
        },
      ),
  },
  // 1.5 eggs
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true }, frogs: [[3, 3]], tags: true },
    run: (gen) =>
      beat(
        gen,
        'Where can a run start? The program sets `i` to `0`, and the precondition lets `n` be any number `≥ 0`.\n\nEach **egg** is one starting state: a place a real run begins.',
        {
          callouts: [{ x: 0, y: 2, text: 'starting state: i = 0, n = 2', tone: 'info' }],
          prepare: () => {
            resetFrogs();
            useGame.setState({ frogTags: false });
            useGame.getState().setReveal({ eggs: true });
          },
          settle: 1100,
        },
      ),
  },
  // 1.6 goals
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true } },
    run: (gen) =>
      beat(gen, 'The amber pools are the **goals**: the tiles where the postcondition `i == n` holds.\n\nEvery run should stop on one.', {
        callouts: [{ x: 2, y: 2, text: 'goal: i == n', tone: 'info' }],
        prepare: () => useGame.getState().setReveal({ goals: true }),
        settle: 1000,
      }),
  },
  // 1.7 run
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true, goals: true } },
    run: async (gen) => {
      useGame.getState().setReveal({ run: true });
      useGame.setState({ callouts: [] });
      allow({ run: true });
      say('Press **Run** to hatch every egg and run all the frogs at once.', 'run');
      await waitEvent(gen, 'runDone', realFrogsStopped);
      allow({});
      await beat(gen, 'Every frog stopped on a goal. Looks correct!');
    },
  },
  // 1.8 watching can't be enough
  {
    scene: { reveal: WORLD },
    run: async (gen) => {
      await beat(
        gen,
        'But how many eggs are there? `n` can be any number, so the eggs never end.\n\nClick a few eggs to run them: they all work… but watching them one at a time can never cover them all. **So how can we check them all?**',
        {
          prepare: async () => {
            resetFrogs();
            await cameraRig.lookAtTile(4, 14, 55);
            allow({ eggs: true });
          },
        },
      );
      allow({});
    },
  },
  // 1.9 the bridge: an assert at the top of the loop
  {
    scene: { reveal: WORLD, camera: [4, 14, 55] },
    run: (gen) =>
      beat(
        gen,
        'If you could *prove* it instead of watching, you’d want a condition that is true every time a run reaches the top of the loop, for every run. An `assert` there that never fires.\n\nThat condition is called a **loop invariant**. In this world it is an **area** of the plane: the tiles where the condition is true. An area has to pass three checks; we’ll take them one at a time.',
        {
          spot: 'code',
          prepare: async () => {
            resetFrogs();
            await cameraRig.lookAtTile(2, 2, 15.6);
            useGame.getState().setReveal({ assert: true, lights: ALL });
          },
          settle: 500,
        },
      ),
  },
  // 1.10 draw before you check
  {
    scene: { reveal: { ...WORLD, assert: true, lights: ALL }, camera: [2, 2, 15.6] },
    run: async (gen) => {
      useGame.getState().setReveal({ formula: true });
      allow({ formula: true });
      say('Type any condition on `i` and `n`: the tiles where it’s true rise as **slabs**, and the `assert` line follows.\n\nTry two or three, and watch the plane.', 'formula');
      // Next once there is something to look at
      await waitStore(gen, (g) => g.valid !== null && g.formulaText.trim() !== '');
      await sleep(900);
      guard(gen);
      await beat(gen, 'Type any condition on `i` and `n`: the tiles where it’s true rise as **slabs**, and the `assert` line follows.\n\nTry two or three, and watch the plane.', { spot: 'formula' });
      allow({});
    },
  },

  // ======================= Act 2: The three rules, one at a time =======================
  // 2.1 stage 1: every egg
  {
    scene: { reveal: DRAW, formula: 'learner', camera: [2, 2, 15.6] },
    run: async (gen) => {
      useGame.getState().setReveal({ awake: ['init'] });
      say('This **hand** checks your area. It looks for a frog that breaks a rule.', 'lights');
      const t = cameraRig.target();
      await handIn(t.x + 1.5, -t.z + 2, 2.2, { curl: 0.2 });
      guard(gen);
      await pointAt(0, 2);
      guard(gen);
      await sleep(300);
      guard(gen);
      void handOut();
      await stage(gen, {
        ask: 'First rule: every egg must sit on your area, because the assert runs before the first hop.\n\nDraw an area every egg sits on, then press **Check**.',
        rules: ['init'],
        nudge: 'What do all the eggs have in common? Look at their `i`.',
        hint: 'i >= 0',
        onFail: (r) => witnessed.add(r),
      });
      learnerFormula = useGame.getState().formulaText;
    },
  },
  // 2.1b witness: Init
  {
    scene: { reveal: { ...DRAW, awake: ['init'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: (gen) =>
      witness(gen, 'init', 'i == n', {
        question: 'Does every egg sit on it?',
        afterDemo: `**Rule 1 · Init** (initialization): every egg sits on your area. \`i == n\` only covers the egg at \`n = 0\`; yours, ${mine()}, covers them all.`,
        afterOwn: `**Rule 1 · Init** (initialization): every egg sits on your area. Your first try missed one; ${mine()} covers them all.`,
      }),
  },
  // 2.2 stage 2: every hop
  {
    scene: { reveal: { ...DRAW, awake: ['init'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: async (gen) => {
      useGame.getState().setReveal({ awake: ['init', 'pres'] });
      await stage(gen, {
        ask: 'Now the hop. A frog on your area must land on your area, every time.\n\nKeep every egg on it, and make sure no hop leaves it. **Check** now runs rules 1 and 2.',
        rules: ['init', 'pres'],
        nudge: 'Frogs only ever move right. What stays true after `i = i + 1`?',
        hint: 'i >= 0',
        explain: { pres: 'The purple frog is a **test frog**: a state the hand imagines, not a real run. Your area said a frog could be there.' },
        onFail: (r) => witnessed.add(r),
      });
      learnerFormula = useGame.getState().formulaText;
    },
  },
  // 2.2b witness: Preservation
  {
    scene: { reveal: { ...DRAW, awake: ['init', 'pres'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: (gen) =>
      witness(gen, 'pres', 'i == 0 || i == n', {
        question: 'Does every hop from it land on it?',
        afterDemo:
          '**Rule 2 · Preservation**: a frog on your area that hops lands on your area. Frogs pass through the tiles in between!\n\nThe hand may start its purple **test frog** on *any* tile of your area, not only ones a real run reaches. Your area is a claim, and the hand tests the claim.',
        afterOwn:
          '**Rule 2 · Preservation**: a frog on your area that hops lands on your area.\n\nThe hand may start its purple **test frog** on *any* tile of your area, not only ones a real run reaches. Your area is a claim, and the hand tests the claim.',
        extra: 'The purple frog is a **test frog**: a state the hand imagines, not a real run.',
      }),
  },
  // 2.3 follow one frog: Init
  {
    scene: { reveal: { ...DRAW, awake: ['init', 'pres'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: async (gen) => {
      await beat(gen, 'Both rules hold for your area. Let’s follow one frog to see what that means.', { spot: 'lights' });
      await beat(gen, 'It starts on your area: that’s **Init**.', {
        callouts: [{ x: 0, y: 3, text: 'Init', tone: 'good' }],
        prepare: async () => {
          resetFrogs();
          await cameraRig.lookAtTile(1.5, 3, 12);
          hatchFrog(st(0, 3));
          await sleep(600);
        },
      });
    },
  },
  // 2.3 follow one frog: Preservation, and what the two together mean
  {
    scene: { reveal: { ...DRAW, awake: ['init', 'pres'] }, formula: 'learner', frogs: [[0, 3]], camera: [1.5, 3, 12] },
    run: async (gen) => {
      say('Every hop lands on your area again: that’s **Preservation**.');
      for (let k = 0; k < 6 && !realFrogsStopped(); k++) {
        await sleep(650);
        guard(gen);
        await stepFrogs(true);
        guard(gen);
        // after the first landing, the label rides along with the frog
        const f = frogWorld.frogs.find((fr) => fr.kind === 'real');
        if (k === 0 && f) useGame.setState({ callouts: [{ x: f.x, y: f.y, frog: f.id, text: 'still on your area', tone: 'good' }] });
      }
      await sleep(500);
      guard(gen);
      await beat(
        gen,
        'So it can never leave your area, no matter how many hops. That makes your area an **invariant**: true every time a run reaches the top of the loop.\n\nWhen the loop stops, the frog is still somewhere on your area. Is that enough?',
        { callouts: useGame.getState().callouts },
      );
    },
  },
  // 2.4 stage 3: stopping on a goal
  {
    scene: { reveal: { ...DRAW, awake: ['init', 'pres'] }, formula: 'learner', camera: [1.5, 3, 12] },
    run: async (gen) => {
      useGame.getState().setReveal({ awake: ALL });
      useGame.setState({ callouts: [] });
      resetFrogs();
      void cameraRig.lookAtTile(2, 2, 15.6);
      say('Third rule: a frog that stops on your area must be on a **goal**. Let’s check yours.', 'lights');
      await sleep(1800);
      guard(gen);
      await stage(gen, {
        ask: 'Make your area stop claiming frogs that stop off a goal, then press **Check**. All three rules run.',
        rules: ALL,
        nudge: 'A real frog never passes `n`. Does your area say so?',
        hint: '0 <= i <= n',
        checkFirst: true,
        explain: { exit: OBJECTION },
        onFail: (r) => witnessed.add(r),
      });
      learnerFormula = useGame.getState().formulaText;
    },
  },
  // 2.4b witness: Exit
  {
    scene: { reveal: DRAW, formula: 'learner', camera: [2, 2, 15.6] },
    run: (gen) =>
      witness(gen, 'exit', 'i >= 0', {
        question: 'Does it pass all three?',
        afterDemo:
          '**Rule 3 · Exit**: a frog that stops on your area is on a goal. `i >= 0` is a true invariant — every run really does keep `i ≥ 0` — but too weak to prove the goal.',
        afterOwn: `**Rule 3 · Exit**: a frog that stops on your area is on a goal. Your earlier area was a true invariant, but too weak to prove the goal; ${mine()} is strong enough.`,
        extra: OBJECTION,
      }),
  },
  // 2.5 too small, too large
  {
    scene: { reveal: DRAW, formula: 'learner', camera: [2, 2, 15.6] },
    run: (gen) =>
      beat(
        gen,
        'Notice the two ways to be wrong.\n\n- Too **small** an area, and an egg or a hop falls outside: Init or Preservation fails.\n- Too **large**, and it claims frogs that stop off a goal: Exit fails.\n\nThe invariant sits between. Shrinking an area is called **strengthening** it.',
        {
          spot: 'lights',
          callouts: [
            { x: 0, y: 2, text: 'too small: egg outside', tone: 'info' },
            { x: 3, y: 2, text: 'too large: stops off a goal', tone: 'info' },
          ],
        },
      ),
  },

  // ======================= Act 3: Wrap-up =======================
  {
    scene: { reveal: DRAW, formula: 'learner', camera: [2, 2, 15.6] },
    run: async (gen) => {
      useGame.setState({ callouts: [] });
      await playRain();
      guard(gen);
      await beat(
        gen,
        `Your area ${mine()} passes all three rules:\n\n- **${RULE_NAMES.init}:** every egg sits on it.\n- **${RULE_NAMES.pres}:** no hop leaves it.\n- **${RULE_NAMES.exit}:** every frog that stops on it is on a goal.\n\nIt is a loop invariant strong enough to prove the postcondition: every run that stops, stops on a goal — for every \`n\`, without watching any of them.`,
        { label: 'Finish' },
      );
      // the three rules, as a card; the tutorial ends (and the first level
      // opens) once it is closed, after its exit animation, not underneath it
      useGame.setState({ showRules: true });
      await waitStore(gen, (g) => !g.showRules);
      await sleep(EXIT_MS + 60);
    },
  },
];
