import { hatch, placeFrog, resetFrogs, stepFrogs } from '../director/frogs';
import { sleep } from '../director/sequence';
import { playRain } from '../director/verdicts';
import { useGame, type Reveal } from '../game/store';
import { t } from '../i18n/i18n';
import type { Rule } from '../levels/level';
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
// wrap-up. The principles and vocabulary are in docs/design.md ("The
// tutorial"); the words themselves are in i18n/en.ts and ko.ts.

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

/** The tutorial's lines, in the current language. */
const T = () => t().tutorial;

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
  const { plane, valid } = useGame.getState();
  return tilesWhere((x, y) => {
    const s = tileState(L, x, y, plane);
    return L.fast.planeReq(s) === true && L.fast.guard(s) !== true && !!valid && valid.fast(s) === true;
  });
}

/**
 * A stage passed: say so, with the rule's own evidence in the scene — the eggs
 * on the area outlined, a shower of frogs that all land on it again, or the
 * stop tiles on it (all goals) outlined.
 */
async function passed(gen: number, rule: Rule) {
  const L = useGame.getState().level!;
  const { plane } = useGame.getState();
  if (rule === 'initialization') {
    await beat(gen, T().passedInitialization, {
      spot: 'lights',
      tone: 'success',
      callouts: outlines(eggsNear(L, plane, 4, 4, 6)),
    });
  } else if (rule === 'maintenance') {
    await beat(gen, T().passedMaintenance, {
      spot: 'lights',
      tone: 'success',
      prepare: () => playRain({ max: 28, zoomOut: false }),
    });
    frogWorld.clear('test');
  } else {
    await beat(gen, T().passedTermination, {
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
    const yes = await ask(gen, T().whatIf(pitfall, o.question));
    guard(gen);
    await demo(gen, pitfall, upTo(rule), { extra: o.extra, restore: mine, guessedRight: !yes });
    guard(gen);
    await beat(gen, o.afterDemo, { spot: 'lights' });
  } else {
    await beat(gen, o.afterOwn, { spot: 'lights' });
  }
}

export const STEPS: Step[] = [
  // ======================= Act 1: The world =======================
  // 1.0 hello
  {
    scene: { reveal: {} },
    run: (gen) =>
      beat(
        gen,
        T().hello,
        { label: T().letsGo, settle: 0 },
      ),
  },
  // 1.1 a frog and its tile
  {
    scene: { reveal: {} },
    run: (gen) =>
      beat(
        gen,
        T().frog,
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
      beat(gen, T().program, {
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
        T().contracts,
        { spot: 'code', lines: [2, 9] },
      ),
  },
  // 1.3 step
  {
    scene: { reveal: { axes: true, code: true }, frogs: [[0, 3]], tags: true },
    run: async (gen) => {
      useGame.getState().setReveal({ step: true });
      allow({ step: true });
      say(T().pressStep, 'step');
      await waitEvent(gen, 'stepped');
      say(T().keepStepping, 'step');
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
        T().stops,
        {
          prepare: () => useGame.getState().setReveal({ stop: true, hover: true }),
          settle: 1000,
          callouts: [{ x: 3, y: 3, text: T().stopsTag, tone: 'info' }],
        },
      ),
  },
  // 1.5 eggs
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true }, frogs: [[3, 3]], tags: true },
    run: (gen) =>
      beat(
        gen,
        T().eggs,
        {
          callouts: [{ x: 0, y: 2, text: T().eggsTag, tone: 'info' }],
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
        T().goals,
        {
          callouts: [{ x: 3, y: 3, text: T().goalsTag, tone: 'good' }],
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
        T().bug,
        {
          prepare: () => useGame.setState({ failMark: { x: 3, y: 1, label: T().bugTag, t0: sceneNow() } }),
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
      say(T().pressRun, 'run');
      await waitEvent(gen, 'runDone', realFrogsStopped);
      allow({});
      await beat(gen, T().allTen);
    },
  },
  // 1.8 testing can't be enough: the ten tested, and the eggs going on past them
  {
    scene: { reveal: WORLD, frogs: TESTED },
    run: async (gen) => {
      await beat(
        gen,
        T().endless,
        {
          callouts: [
            { x: 9, y: 9, text: T().testedTag, tone: 'good' },
            { x: 0, y: 18, text: T().endlessTag, tone: 'info' },
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
        T().invariant,
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
      sayWaiting(T().draw, 'formula');
      await waitStore(gen, (g) => g.valid !== null && g.formulaText.trim() !== '');
      await sleep(900);
      guard(gen);
      await beat(gen, T().draw, { spot: 'formula' });
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
        ask: T().askInitialization,
        rules: ['initialization'],
        nudge: T().nudgeInitialization,
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
        question: T().questionInitialization,
        afterDemo: T().afterDemoInitialization(mine()),
        afterOwn: T().afterOwnInitialization(mine()),
      }),
  },
  // 2.2 stage 2: every hop
  {
    scene: { reveal: { ...DRAW, awake: ['initialization'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: async (gen) => {
      useGame.getState().setReveal({ awake: ['initialization', 'maintenance'] });
      await stage(gen, {
        ask: T().askMaintenance,
        rules: ['initialization', 'maintenance'],
        nudge: T().nudgeMaintenance,
        explain: { maintenance: T().explainMaintenance },
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
        question: T().questionMaintenance,
        afterDemo: T().afterDemoMaintenance,
        afterOwn: T().afterOwnMaintenance,
        extra: T().extraMaintenance,
      }),
  },
  // 2.3 follow one frog: Initialization
  {
    scene: { reveal: { ...DRAW, awake: ['initialization', 'maintenance'] }, formula: 'learner', camera: [2, 2, 15.6] },
    run: async (gen) => {
      await beat(gen, T().followOne, { spot: 'lights' });
      await beat(gen, T().startsOn, {
        callouts: [{ x: 0, y: 3, text: T().startsOnTag, tone: 'good' }],
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
      say(T().everyHop);
      for (let k = 0; k < 6 && !realFrogsStopped(); k++) {
        await sleep(650);
        guard(gen);
        await stepFrogs(true);
        guard(gen);
        // after the first landing, the label rides along with the frog
        const f = frogWorld.frogs.find((fr) => fr.kind === 'real');
        if (k === 0 && f) useGame.setState({ callouts: [{ x: f.x, y: f.y, frog: f.id, text: T().stillOnTag, tone: 'good' }] });
      }
      await sleep(500);
      guard(gen);
      await beat(
        gen,
        T().neverLeaves,
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
        T().onlyIfGoal,
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
        ask: T().askTermination,
        rules: ALL,
        nudge: T().nudgeTermination,
        // the objection every learner raises at Termination, and its answer
        explain: { termination: T().objection },
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
        question: T().questionTermination,
        afterDemo: T().afterDemoTermination,
        afterOwn: T().afterOwnTermination(mine()),
        extra: T().objectionDemo,
      }),
  },
  // 2.5 too small, too large
  {
    scene: { reveal: DRAW, formula: 'learner', camera: [2, 2, 15.6] },
    run: (gen) =>
      beat(
        gen,
        T().twoWays,
        {
          spot: 'lights',
          callouts: [
            { x: 0, y: 2, text: T().tooSmallTag, tone: 'info' },
            { x: 3, y: 2, text: T().tooLargeTag, tone: 'info' },
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
        T().wrapUp(mine()),
        { label: T().finish, prepare: () => playRain() },
      );
      // the three rules, as a card; the tutorial ends (and the first level
      // opens) once it is closed, after its exit animation, not underneath it
      useGame.setState({ showRules: true });
      await waitStore(gen, (g) => !g.showRules);
      await sleep(EXIT_MS + 60);
    },
  },
];
