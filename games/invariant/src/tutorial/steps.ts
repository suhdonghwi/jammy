import { hatch, placeFrog, resetFrogs, stepFrogs } from '../director/frogs';
import { sleep } from '../director/sequence';
import { playRain } from '../director/verdicts';
import { useGame, type Reveal } from '../game/store';
import { RULE_NAMES, type Rule } from '../levels/level';
import { cameraRig } from '../scene/cameraRig';
import { sceneNow } from '../scene/sceneTime';
import { frogWorld } from '../scene/frogs/frogWorld';
import { eggsNear, tileState } from '../scene/tiles';
import { EXIT_MS } from '../ui/presence';
import { allow, ask, beat, demo, guard, preview, say, sayWaiting, stage, waitEvent, waitStore } from './script';

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
const DRAW = { ...WORLD, assert: true, formula: true, lights: ['initialization', 'maintenance', 'termination'] as Rule[] };

const ALL: Rule[] = ['initialization', 'maintenance', 'termination'];

/** Run hatches the first ten eggs: n = 0 to 9, each frog stopping on its goal (n, n). */
const TESTED = Array.from({ length: 10 }, (_, n): [number, number] => [n, n]);
const upTo = (r: Rule): Rule[] => ALL.slice(0, ALL.indexOf(r) + 1);

/** The learner's area, as inline code. */
const mine = () => `\`${useGame.getState().formulaText.trim()}\``;

/** Tiles in the tutorial's view that satisfy `test`. */
function tilesWhere(test: (x: number, y: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y <= 9; y++) for (let x = 0; x <= 11; x++) if (test(x, y)) out.push([x, y]);
  return out;
}

/** Outlines on tiles (no text: the caption says what they show); green unless `tone` says otherwise. */
const outlines = (tiles: [number, number][], tone: 'good' | 'info' = 'good') => tiles.map(([x, y]) => ({ x, y, text: '', tone }));

/** Stop tiles on the learner's area, in the tutorial's view: the only places a run on the area can end. */
function stopsOnArea(): [number, number][] {
  const L = useGame.getState().level!;
  const { pond, valid } = useGame.getState();
  return tilesWhere((x, y) => {
    const s = tileState(L, x, y, pond);
    return L.fast.pondReq(s) === true && L.fast.guard(s) !== true && !!valid && valid.fast(s) === true;
  });
}

/**
 * A stage passed: say so, with the rule's own evidence in the scene — the eggs
 * on the area outlined, a shower of frogs that all land on it again, or the
 * stop tiles on it (all goals) outlined.
 */
async function passed(gen: number, rule: Rule) {
  const L = useGame.getState().level!;
  const { pond } = useGame.getState();
  if (rule === 'initialization') {
    await beat(gen, 'Correct! Every egg sits on your area: the first rule holds.', {
      spot: 'lights',
      tone: 'success',
      callouts: outlines(eggsNear(L, pond, 4, 4, 6)),
    });
  } else if (rule === 'maintenance') {
    await beat(gen, 'Correct! No hop leaves your area: the second rule holds. A frog anywhere on it lands on it again.', {
      spot: 'lights',
      tone: 'success',
      prepare: () => playRain({ max: 28, zoomOut: false }),
    });
    frogWorld.clear('test');
  } else {
    await beat(gen, 'Correct! Every frog that stops on your area is on a goal: the third rule holds.', {
      spot: 'lights',
      tone: 'success',
      callouts: outlines(stopsOnArea()),
    });
  }
}

/**
 * A rule's failure, witnessed: if the learner already saw it on an area of
 * their own, the rule is simply named; otherwise a pitfall formula is tried
 * before their eyes, after they predict the outcome.
 */
async function witness(
  gen: number,
  rule: Rule,
  pitfall: string,
  o: { question: string; afterDemo: string; afterOwn: string; extra?: string },
) {
  if (!witnessed.has(rule)) {
    // the pitfall is shown in the box and on the plane while the learner decides
    const mine = useGame.getState().formulaText;
    preview(pitfall);
    const yes = await ask(gen, `Before we move on: what if we had tried \`${pitfall}\`? ${o.question}`);
    guard(gen);
    await demo(gen, pitfall, upTo(rule), { extra: o.extra, restore: mine, guessedRight: !yes });
    guard(gen);
    await beat(gen, o.afterDemo, { spot: 'lights' });
  } else {
    await beat(gen, o.afterOwn, { spot: 'lights' });
  }
}

/** The objection every learner raises at Termination, and its answer (for the learner's own area, and for one the tutorial tries). */
const OBJECTION =
  '“But `i` never passes `n`!” — Your area doesn’t say that. It claims a frog could be anywhere on it, and the hand takes you at your word. To fix it, **shrink** your area so it stops claiming impossible frogs.';
const OBJECTION_DEMO =
  '“But `i` never passes `n`!” — The area doesn’t say that. It claims a frog could be anywhere on it, and the hand takes the claim at its word. The fix would be to **shrink** it so it stops claiming impossible frogs.';

export const STEPS: Step[] = [
  // ======================= Act 1: The world =======================
  // 1.0 hello
  {
    scene: { reveal: {} },
    run: (gen) =>
      beat(
        gen,
        'Hi. This is a game about **loop invariants**: the way to prove a loop correct for *every* input, not just the ones you happened to try.\n\nIn about fifteen minutes you’ll write one and have it checked. First, the world it lives in.',
        { label: 'Let’s go', settle: 0 },
      ),
  },
  // 1.1 a frog and its tile
  {
    scene: { reveal: {} },
    run: (gen) =>
      beat(
        gen,
        'This frog is one run of the program. The tile it sits on is its **state**: `i = 0, n = 3`.\n\nThe plane’s two axes are the two variables, so where the frog sits *is* its values.',
        {
          prepare: async () => {
            useGame.getState().setReveal({ axes: true });
            // the frog's own tag shows its values (and animates them as it hops)
            useGame.setState({ frogTags: true });
            hatch(st(0, 3));
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
  // 1.6 goals: the frog from 1.3 stopped on one
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true }, frogs: [[3, 3]], camera: [2, 2, 15.6] },
    run: (gen) =>
      beat(
        gen,
        'The amber pools are the **goals**: the tiles where the postcondition `i == n` holds.\n\nThe frog you stepped stopped on one, at `i = 3, n = 3`. That run did what `ensures` promises.',
        {
          callouts: [{ x: 3, y: 3, text: 'stopped on a goal', tone: 'good' }],
          prepare: () => {
            if (!frogWorld.frogs.some((f) => f.kind === 'real')) placeFrog(st(3, 3));
            useGame.getState().setReveal({ goals: true });
          },
          settle: 1000,
        },
      ),
  },
  // 1.6b what a bug would look like, and the question the whole game asks
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true, goals: true }, frogs: [[3, 3]], camera: [2, 2, 15.6] },
    run: async (gen) => {
      await beat(
        gen,
        'Not every place to stop is a goal. A run that stopped here, at `i = 3, n = 1`, would leave the loop with `i ≠ n`: the program would be wrong.\n\nSo the question is: **does every run stop on a goal?**',
        {
          prepare: () => useGame.setState({ failMark: { x: 3, y: 1, label: 'stops, but i ≠ n', t0: sceneNow() } }),
          settle: 800,
        },
      );
      useGame.setState({ failMark: null });
    },
  },
  // 1.7 test some
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true, goals: true }, camera: [2, 2, 15.6] },
    run: async (gen) => {
      useGame.getState().setReveal({ run: true });
      useGame.setState({ callouts: [], failMark: null });
      allow({ run: true });
      say('Let’s test it. Press **Run** to hatch the first ten eggs and run their frogs at once.', 'run');
      await waitEvent(gen, 'runDone', realFrogsStopped);
      allow({});
      await beat(gen, 'All ten stopped on a goal. For `n` = 0 to 9, the program is correct.');
    },
  },
  // 1.8 testing can't be enough: the ten tested, and the eggs going on past them
  {
    scene: { reveal: WORLD, frogs: TESTED },
    run: async (gen) => {
      await beat(
        gen,
        'But that was ten inputs. `n` can be any number, so the eggs never end: however many you test, infinitely many are left.\n\nClick a few more eggs to run them. They all work… but testing can never cover them all. **So how can we be sure about every one?**',
        {
          callouts: [
            { x: 9, y: 9, text: 'tested: n = 0 to 9', tone: 'good' },
            { x: 0, y: 18, text: 'n = 18, 19, … never end', tone: 'info' },
          ],
          prepare: async () => {
            await cameraRig.lookAtTile(4, 10, 55);
            // a fast Next may have moved on during the glide: a stale allow() would lock the next step's box
            guard(gen);
            allow({ eggs: true });
          },
        },
      );
      allow({});
    },
  },
  // 1.9 the bridge: an assert at the top of the loop
  {
    scene: { reveal: WORLD, camera: [4, 10, 55] },
    run: (gen) =>
      beat(
        gen,
        'If you could *prove* it instead of watching, you’d want a condition that is true every time a run reaches the top of the loop, for every run. An `assert(?)` there that never fires.\n\nThat condition is called a **loop invariant**. In this world it is an **area** of the plane: the tiles where the condition is true. An area has to pass three checks; we’ll take them one at a time.',
        {
          spot: 'code',
          prepare: async () => {
            resetFrogs();
            await cameraRig.lookAtTile(2, 2, 15.6);
            guard(gen);
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
      // Next is there from the start, greyed until there is something to look at
      sayWaiting('Type any condition on `i` and `n`: the tiles where it’s true rise as **slabs**. That is the `assert(?)` drawn on the plane.\n\nTry something like `i == 2`, `i % 2 == 0` or `i < n`. **Syntax**, below the box, lists what you can write.', 'formula');
      await waitStore(gen, (g) => g.valid !== null && g.formulaText.trim() !== '');
      await sleep(900);
      guard(gen);
      await beat(gen, 'Type any condition on `i` and `n`: the tiles where it’s true rise as **slabs**. That is the `assert(?)` drawn on the plane.\n\nTry something like `i == 2`, `i % 2 == 0` or `i < n`. **Syntax**, below the box, lists what you can write.', { spot: 'formula' });
      allow({});
    },
  },

  // ======================= Act 2: The three rules, one at a time =======================
  // 2.1 stage 1: every egg
  {
    scene: { reveal: DRAW, formula: 'learner', camera: [2, 2, 15.6] },
    run: async (gen) => {
      useGame.getState().setReveal({ awake: ['initialization'] });
      await stage(gen, {
        ask: 'First rule: every egg must sit on your area, because the assert runs before the first hop.\n\nDraw an area every egg sits on, then press **Check**.',
        rules: ['initialization'],
        nudge: 'Every egg has the same `i`. What is it?',
        onFail: (r) => witnessed.add(r),
      });
      learnerFormula = useGame.getState().formulaText;
      await passed(gen, 'initialization');
    },
  },
  // 2.1b witness: Initialization
  {
    scene: { reveal: { ...DRAW, awake: ['initialization'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: (gen) =>
      witness(gen, 'initialization', 'i == n', {
        question: 'Would every egg sit on it?',
        afterDemo: `**Rule 1 · Initialization**: every egg sits on your area. \`i == n\` only covers the egg at \`n = 0\`; yours, ${mine()}, covers them all.`,
        afterOwn: `**Rule 1 · Initialization**: every egg sits on your area. Your first try missed one; ${mine()} covers them all.`,
      }),
  },
  // 2.2 stage 2: every hop
  {
    scene: { reveal: { ...DRAW, awake: ['initialization'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: async (gen) => {
      useGame.getState().setReveal({ awake: ['initialization', 'maintenance'] });
      await stage(gen, {
        ask: 'Now the hop. A frog on your area must land on your area, every time.\n\nKeep every egg on it, and make sure no hop leaves it. **Check** now runs rules 1 and 2.',
        rules: ['initialization', 'maintenance'],
        nudge: 'Every frog starts at `i = 0`, and a hop only ever increases `i`.',
        explain: { maintenance: 'The purple frog is a **test frog**: a state the hand imagines, not a real run. Your area said a frog could be there.' },
        onFail: (r) => witnessed.add(r),
      });
      learnerFormula = useGame.getState().formulaText;
      await passed(gen, 'maintenance');
    },
  },
  // 2.2b witness: Maintenance
  {
    scene: { reveal: { ...DRAW, awake: ['initialization', 'maintenance'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: (gen) =>
      witness(gen, 'maintenance', 'i == 0 || i == n', {
        question: 'Would every hop from it land on it?',
        afterDemo:
          '**Rule 2 · Maintenance**: a frog on your area that hops lands on your area. Frogs pass through the tiles in between!\n\nThe hand may start its purple **test frog** on *any* tile of your area, not only ones a real run reaches. Your area is a claim, and the hand tests the claim.',
        afterOwn:
          '**Rule 2 · Maintenance**: a frog on your area that hops lands on your area.\n\nThe hand may start its purple **test frog** on *any* tile of your area, not only ones a real run reaches. Your area is a claim, and the hand tests the claim.',
        extra: 'The purple frog is a **test frog**: a state the hand imagines, not a real run.',
      }),
  },
  // 2.3 follow one frog: Initialization
  {
    scene: { reveal: { ...DRAW, awake: ['initialization', 'maintenance'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: async (gen) => {
      await beat(gen, 'Both rules hold for your area. Let’s follow one frog to see what that means.', { spot: 'lights' });
      await beat(gen, 'It starts on your area: that’s **Initialization**.', {
        callouts: [{ x: 0, y: 3, text: 'Initialization', tone: 'good' }],
        prepare: async () => {
          resetFrogs();
          await cameraRig.lookAtTile(1.5, 3, 12);
          guard(gen);
          hatch(st(0, 3));
          await sleep(600);
        },
      });
    },
  },
  // 2.3 follow one frog: Maintenance, and what the two together mean
  {
    scene: { reveal: { ...DRAW, awake: ['initialization', 'maintenance'] }, formula: 'learner', frogs: [[0, 3]], camera: [1.5, 3, 12] },
    run: async (gen) => {
      say('Every hop lands on your area again: that’s **Maintenance**.');
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
  // 2.4 stage 3: stopping on a goal. First the answer to 2.3's "Is that
  // enough?", with the tiles it is about outlined; then the learner checks.
  {
    scene: { reveal: { ...DRAW, awake: ['initialization', 'maintenance'] }, formula: 'learner', frogs: [[3, 3]], camera: [1.5, 3, 12] },
    run: async (gen) => {
      await beat(
        gen,
        'Only if that tile is a goal. A run ends where the loop stops: on a shaded tile, and on your area — one of the outlined tiles.\n\nThird rule: every one of them must be a goal.',
        {
          spot: 'lights',
          callouts: outlines(stopsOnArea(), 'info'),
          prepare: () => {
            useGame.getState().setReveal({ awake: ALL });
            void cameraRig.lookAtTile(2, 2, 15.6);
          },
        },
      );
      resetFrogs();
      await stage(gen, {
        ask: 'Is every one a goal? Press **Check**: it now runs all three rules.\n\nIf a frog stops off a goal, change your area and Check again.',
        rules: ALL,
        nudge: 'A real frog never passes `n`, so `i` is never greater than `n`.',
        explain: { termination: OBJECTION },
        onFail: (r) => witnessed.add(r),
      });
      learnerFormula = useGame.getState().formulaText;
      await passed(gen, 'termination');
    },
  },
  // 2.4b witness: Termination
  {
    scene: { reveal: DRAW, formula: 'learner', camera: [2, 2, 15.6] },
    run: (gen) =>
      witness(gen, 'termination', 'i >= 0', {
        question: 'Would it pass all three rules?',
        afterDemo:
          '**Rule 3 · Termination**: a frog that stops on your area is on a goal. `i >= 0` is a true invariant — every run really does keep `i ≥ 0` — but too weak to prove the goal.',
        afterOwn: `**Rule 3 · Termination**: a frog that stops on your area is on a goal. Your earlier area was a true invariant, but too weak to prove the goal; ${mine()} is strong enough.`,
        extra: OBJECTION_DEMO,
      }),
  },
  // 2.5 too small, too large
  {
    scene: { reveal: DRAW, formula: 'learner', camera: [2, 2, 15.6] },
    run: (gen) =>
      beat(
        gen,
        'Notice the two ways to be wrong.\n\n- Too **small** an area, and an egg or a hop falls outside: Initialization or Maintenance fails.\n- Too **large**, and it claims frogs that stop off a goal: Termination fails.\n\nThe invariant sits between. Shrinking an area is called **strengthening** it.',
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
      // the caption first, then the rain it celebrates; Finish once the rain has fallen
      await beat(
        gen,
        `Your area ${mine()} passes all three rules:\n\n- **${RULE_NAMES.initialization}:** every egg sits on it.\n- **${RULE_NAMES.maintenance}:** no hop leaves it.\n- **${RULE_NAMES.termination}:** every frog that stops on it is on a goal.\n\nIt is a loop invariant strong enough to prove the postcondition: every run that stops, stops on a goal — for every \`n\`, without watching any of them.`,
        { label: 'Finish', prepare: () => playRain() },
      );
      // the three rules, as a card; the tutorial ends (and the first level
      // opens) once it is closed, after its exit animation, not underneath it
      useGame.setState({ showRules: true });
      await waitStore(gen, (g) => !g.showRules);
      await sleep(EXIT_MS + 60);
    },
  },
];
