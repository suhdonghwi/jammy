import { sfx } from '../audio/sfx';
import { RULES, type Rule } from '../checker/types';
import { stepFrogs } from '../director/controls';
import { hatch, HATCH_MS, loopFrogs, placeFrog, sendFrogsHome, testEggs } from '../director/frogs';
import { previewHop } from '../director/ghosts';
import { eggRegion, endingsRegion } from '../director/regions';
import { resetFrogs } from '../director/reset';
import type { Token } from '../director/sequence';
import { playProof } from '../director/verdicts';
import { useGame, type Reveal } from '../game/store';
import { EXIT_MS } from '../ui/timing';
import { t } from '../i18n/i18n';
import { toBig } from '../levels/level';
import { eggsNear, tileState } from '../levels/tiles';
import type { Tile, View } from '../scene/cameraRig';
import { frogWorld } from '../scene/frogs/frogWorld';
import { sceneNow, sleep } from '../scene/sceneTime';
import { allow, ask, beat, demo, say, sayWaiting, stage, waitEvent, waitStore } from './script';

export const st = (i: number, n: number) => ({ i: BigInt(i), n: BigInt(n) });
const realFrogsStopped = () => frogWorld.frogs.filter((f) => f.kind === 'real').every((f) => f.stopped);

export interface Scene {
  example?: boolean;
  reveal: Partial<Reveal>;
  frogs?: [number, number][];
  tags?: boolean;
  formula?: string | 'learner';
  camera?: View;
  focus?: readonly Tile[];
  labels?: readonly Tile[];
  loop?: boolean;
}

interface Step {
  scene: Scene;
  run: (gen: Token) => Promise<void>;
}

export let learnerFormula = '';
const witnessed = new Set<Rule>();
let weakArea = '';

export function resetProgress() {
  learnerFormula = '';
  witnessed.clear();
  weakArea = '';
}

const upTo = (r: Rule): Rule[] => RULES.slice(0, RULES.indexOf(r) + 1);

const SHOW_AXES = { axes: true } as const;
const SHOW_CODE = { ...SHOW_AXES, code: true } as const;
const SHOW_STEP = { ...SHOW_CODE, step: true } as const;
const SHOW_RUN = { ...SHOW_STEP, run: true } as const;
const SHOW_STOPS = { ...SHOW_RUN, stop: true, hover: true } as const;
const SHOW_EGGS = { ...SHOW_STOPS, eggs: true } as const;
const WORLD = { ...SHOW_EGGS, goals: true } as const;
const DRAW = { ...WORLD, formula: true, area: true, lights: RULES };
const AWAKE_INITIALIZATION = { ...DRAW, awake: upTo('initialization') };
const AWAKE_MAINTENANCE = { ...DRAW, awake: upTo('maintenance') };
const AWAKE_ALL = { ...DRAW, awake: RULES };
export const VIEW: View = [2, 2, 15.6];
const PROOF_VIEW: View = [2, 2, 18];
const BOARD: Tile[] = [[0, 0], [0, 4], [4, 4]];

const EXAMPLE = { axes: true, stop: true, hover: true, eggs: true, goals: true } as const;
const EXAMPLE_AREA = '0 <= x <= 4';
const EXAMPLE_DRAWN = { ...EXAMPLE, area: true } as const;
const EXAMPLE_CAM: View = [2.5, 2, 14.4];
const EXAMPLE_WIDE: View = [3, 2, 17];
const EXAMPLE_BOARD: Tile[] = [[0, 0], [0, 4], [5, 0], [5, 4]];

const TESTED = Array.from({ length: 10 }, (_, n): [number, number] => [n, n]);

const T = () => t().tutorial;
const holds = () => t().verdicts.holdsTag;

const mine = () => `\`${useGame.getState().formulaText.trim()}\``;


export function loopExampleFrogs() {
  const L = useGame.getState().level!;
  const { inputs } = useGame.getState();
  const eggs = eggsNear(L, inputs, 0, 2, 2).sort((a, b) => [2, 0, 4, 1, 3].indexOf(a[1]) - [2, 0, 4, 1, 3].indexOf(b[1]));
  loopFrogs(eggs.map(([x, y]) => toBig(tileState(L, x, y, inputs))));
}

async function passed(gen: Token, rule: Rule) {
  const text = { initialization: T().passedInitialization, maintenance: T().passedMaintenance, exit: T().passedExit }[rule];
  await beat(gen, text, { spot: 'lights', tone: 'success', keep: true });
  void sendFrogsHome('test');
}

async function witness(gen: Token, rule: Rule, pitfall: string, o: { question: string; afterDemo?: string; afterOwn?: string; ghost?: string }) {
  if (!witnessed.has(rule)) {
    const mine = useGame.getState().formulaText;
    useGame.getState().setFormula(pitfall);
    const yes = await ask(gen, T().whatIf(pitfall, o.question));
    gen.guard();
    await demo(gen, pitfall, upTo(rule), { ghostExtra: o.ghost, restore: mine, guessedRight: !yes });
    gen.guard();
    if (o.afterDemo) await beat(gen, o.afterDemo, { spot: 'lights' });
  } else if (o.afterOwn) {
    await beat(gen, o.afterOwn, { spot: 'lights' });
  }
}

export const STEPS: Step[] = [
  {
    scene: { reveal: {} },
    run: (gen) => beat(gen, T().hello, { label: T().letsGo, settle: 0 }),
  },
  {
    scene: { reveal: {}, labels: [[0, 3]] },
    run: (gen) =>
      beat(gen, T().frog, {
        prepare: async () => {
          useGame.getState().setReveal(SHOW_AXES);
          useGame.setState({ frogTags: true });
          hatch(st(0, 3));
          await sleep(HATCH_MS + 150);
        },
      }),
  },
  {
    scene: { reveal: SHOW_AXES, frogs: [[0, 3]], tags: true, labels: [[0, 3]] },
    run: (gen) =>
      beat(gen, T().program, {
        spot: 'code',
        prepare: () => useGame.getState().setReveal(SHOW_CODE),
      }),
  },
  {
    scene: { reveal: SHOW_CODE, frogs: [[0, 3]], tags: true, labels: [[0, 3], [3, 3]] },
    run: async (gen) => {
      useGame.getState().setReveal(SHOW_STEP);
      allow({ step: true });
      say(T().pressStep, 'step');
      await waitEvent(gen, ['stepped']);
      useGame.getState().setReveal(SHOW_RUN);
      allow({ step: true, run: true });
      say(T().pressRun, 'run');
      await waitEvent(gen, ['stepped', 'runDone'], realFrogsStopped);
      allow({});
    },
  },
  {
    scene: { reveal: SHOW_RUN, frogs: [[3, 3]], tags: true, labels: [[3, 3]] },
    run: (gen) =>
      beat(gen, T().stops, {
        prepare: () => useGame.getState().setReveal(SHOW_STOPS),
        settle: 1000,
        callouts: [{ x: 3, y: 3, text: T().stopsTag, tone: 'info' }],
      }),
  },
  {
    scene: { reveal: SHOW_STOPS, frogs: [[3, 3]], tags: true, focus: [[0, 0], [0, 4], [3, 3]] },
    run: (gen) =>
      beat(gen, T().eggs, {
        lines: [2, 4],
        callouts: [{ x: 0, y: 2, text: T().eggsTag, tone: 'info' }],
        prepare: () => {
          resetFrogs();
          useGame.setState({ frogTags: false });
          useGame.getState().setReveal(SHOW_EGGS);
        },
        settle: 1100,
      }),
  },
  {
    scene: { reveal: SHOW_EGGS, frogs: [[3, 3]], focus: BOARD },
    run: (gen) =>
      beat(gen, T().goals, {
        lines: [9],
        callouts: [{ x: 3, y: 3, text: T().goalsTag, tone: 'good' }],
        prepare: () => {
          if (!frogWorld.frogs.some((f) => f.kind === 'real')) placeFrog(st(3, 3));
          useGame.getState().setReveal(WORLD);
        },
        settle: 1000,
      }),
  },
  {
    scene: { reveal: WORLD, frogs: [[3, 3]], focus: [...BOARD, [3, 1]] },
    run: async (gen) => {
      await beat(gen, T().bug, {
        prepare: () => useGame.setState({ failMark: { x: 3, y: 1, label: T().bugTag, t0: sceneNow() } }),
        settle: 800,
      });
      useGame.setState({ failMark: null });
    },
  },
  {
    scene: { reveal: WORLD, focus: BOARD },
    run: async (gen) => {
      await beat(gen, T().testTen, { label: T().hatchTen });
      say(T().testTen);
      void testEggs();
      await waitEvent(gen, ['runDone'], realFrogsStopped);
      await beat(gen, T().allTen);
    },
  },
  {
    scene: { reveal: WORLD, frogs: TESTED, camera: [4, 10, 55], focus: [[0, 0], [9, 9], [0, 18]] },
    run: async (gen) => {
      await beat(gen, T().endless, {
        callouts: [
          { x: 9, y: 9, text: T().testedTag, tone: 'good' },
          { x: 0, y: 18, text: T().endlessTag, tone: 'info' },
        ],
        prepare: () => allow({ eggs: true, step: true, run: true }),
      });
      allow({});
    },
  },
  {
    scene: { reveal: WORLD, focus: BOARD },
    run: (gen) => beat(gen, T().detour, { prepare: resetFrogs }),
  },

  {
    scene: { example: true, reveal: EXAMPLE, camera: EXAMPLE_CAM, loop: true, focus: EXAMPLE_BOARD },
    run: (gen) => beat(gen, T().exWorld, { settle: 1200 }),
  },
  {
    scene: { example: true, reveal: EXAMPLE, camera: EXAMPLE_CAM, loop: true, focus: EXAMPLE_BOARD },
    run: (gen) =>
      beat(gen, T().exArea, {
        prepare: () => {
          useGame.getState().setFormula(EXAMPLE_AREA);
          useGame.getState().setReveal(EXAMPLE_DRAWN);
        },
        settle: 800,
      }),
  },
  {
    scene: { example: true, reveal: EXAMPLE_DRAWN, formula: EXAMPLE_AREA, camera: EXAMPLE_WIDE, focus: [...EXAMPLE_BOARD, [6, 0], [6, 3]] },
    run: (gen) =>
      beat(gen, T().exWhy, {
        callouts: [
          { x: 6, y: 3, text: T().exBadTag, tone: 'fail' },
          { x: 6, y: 0, text: T().exBadTag, tone: 'fail' },
        ],
        prepare: resetFrogs,
      }),
  },
  {
    scene: { example: true, reveal: EXAMPLE_DRAWN, formula: EXAMPLE_AREA, camera: EXAMPLE_CAM, focus: EXAMPLE_BOARD },
    run: (gen) =>
      beat(gen, T().exEndings, {
        region: endingsRegion('good'),
        callouts: [{ x: 4, y: 3, text: T().exEndingTag, tone: 'good' }],
      }),
  },
  {
    scene: { example: true, reveal: EXAMPLE_DRAWN, formula: EXAMPLE_AREA, camera: EXAMPLE_CAM, focus: EXAMPLE_BOARD },
    run: (gen) =>
      beat(gen, T().exRules, {
        label: T().backToOurs,
        callouts: [
          { x: 0, y: 2, text: holds().initialization, tone: 'good' },
          { x: 4, y: 3, text: holds().exit, tone: 'good' },
        ],
        prepare: async () => {
          await sleep(400);
          gen.guard();
          sfx.ghost();
          const f = previewHop({ x: 1n, y: 0n });
          useGame.setState((g) => ({ callouts: [...g.callouts, { x: f.x, y: f.y, frog: f.id, text: holds().maintenance, tone: 'good' }] }));
        },
      }),
  },

  {
    scene: { reveal: WORLD, focus: BOARD },
    run: async (gen) => {
      useGame.getState().setReveal(DRAW);
      allow({ formula: true });
      sayWaiting(T().draw, 'formula');
      await waitStore(gen, (g) => g.valid !== null && g.formulaText.trim() !== '');
      await sleep(900);
      gen.guard();
      await beat(gen, T().draw, { spot: 'formula' });
      allow({});
      learnerFormula = useGame.getState().formulaText;
    },
  },

  {
    scene: { reveal: DRAW, formula: 'learner', focus: BOARD },
    run: async (gen) => {
      useGame.getState().setReveal(AWAKE_INITIALIZATION);
      await stage(gen, {
        ask: T().askInitialization,
        region: eggRegion('info'),
        rules: ['initialization'],
        nudge: T().nudgeInitialization,
        onFail: (r) => witnessed.add(r),
      });
      learnerFormula = useGame.getState().formulaText;
      await passed(gen, 'initialization');
    },
  },
  {
    scene: { reveal: AWAKE_INITIALIZATION, formula: 'learner', focus: BOARD },
    run: (gen) =>
      witness(gen, 'initialization', 'i == n', {
        question: T().questionInitialization,
        afterDemo: T().afterDemoInitialization(mine()),
        afterOwn: T().afterOwnInitialization(mine()),
      }),
  },
  {
    scene: { reveal: AWAKE_INITIALIZATION, formula: 'learner', focus: BOARD },
    run: async (gen) => {
      useGame.getState().setReveal(AWAKE_MAINTENANCE);
      await beat(gen, T().ruleMaintenance);
      await stage(gen, {
        ask: T().askMaintenance,
        rules: ['initialization', 'maintenance'],
        nudge: T().nudgeMaintenance,
        ghost: { maintenance: T().ghostMaintenance },
        onFail: (r) => witnessed.add(r),
      });
      learnerFormula = useGame.getState().formulaText;
      await passed(gen, 'maintenance');
    },
  },
  {
    scene: { reveal: AWAKE_MAINTENANCE, formula: 'learner', focus: BOARD },
    run: (gen) =>
      witness(gen, 'maintenance', 'i == 0 || i == n', {
        question: T().questionMaintenance,
      }),
  },
  {
    scene: { reveal: AWAKE_MAINTENANCE, formula: 'learner', camera: [1.5, 3, 12], labels: [[0, 3], [3, 3]] },
    run: async (gen) => {
      await beat(gen, T().together, {
        prepare: async () => {
          resetFrogs();
          const f = hatch(st(0, 3));
          await sleep(HATCH_MS + 200);
          gen.guard();
          useGame.setState({ callouts: [{ x: f.x, y: f.y, frog: f.id, text: T().stillOnTag, tone: 'good' }] });
          for (let k = 0; k < 6 && !f.stopped; k++) {
            await stepFrogs(true);
            gen.guard();
            await sleep(450);
            gen.guard();
          }
        },
        settle: 200,
      });
    },
  },
  {
    scene: { reveal: AWAKE_MAINTENANCE, formula: 'learner', focus: BOARD },
    run: async (gen) => {
      await beat(gen, T().leadExit, {
        region: endingsRegion('info'),
        prepare: resetFrogs,
      });
      useGame.getState().setReveal(AWAKE_ALL);
      weakArea = '';
      await stage(gen, {
        ask: T().askExit,
        rules: RULES,
        nudge: T().nudgeExit,
        ghost: { maintenance: T().ghostMaintenance, exit: T().objection },
        onFail: (r) => {
          witnessed.add(r);
          if (r === 'exit' && !weakArea) weakArea = mine();
        },
      });
      learnerFormula = useGame.getState().formulaText;
      await passed(gen, 'exit');
    },
  },
  {
    scene: { reveal: AWAKE_ALL, formula: 'learner', focus: BOARD },
    run: (gen) =>
      witness(gen, 'exit', 'i >= 0', {
        question: T().questionExit,
        afterDemo: T().afterDemoExit(mine()),
        afterOwn: T().afterOwnExit(weakArea, mine()),
        ghost: T().objectionDemo,
      }),
  },
  {
    scene: { reveal: AWAKE_ALL, formula: 'learner', focus: BOARD },
    run: (gen) =>
      beat(gen, T().twoWays, {
        spot: 'lights',
        callouts: [
          { x: 0, y: 2, text: T().notProvedTag, tone: 'info' },
          { x: 3, y: 2, text: T().tooWeakTag, tone: 'info' },
        ],
      }),
  },
  {
    scene: { reveal: AWAKE_ALL, formula: 'learner', camera: PROOF_VIEW, focus: BOARD },
    run: async (gen) => {
      await beat(gen, T().wrapUp(mine()), { label: T().finish, prepare: () => playProof() });
      useGame.setState({ showRules: true });
      await waitStore(gen, (g) => !g.showRules);
      await sleep(EXIT_MS + 60);
    },
  },
];
