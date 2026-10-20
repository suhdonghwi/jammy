import { sfx } from '../audio/sfx';
import { RULES, type Rule } from '../checker/types';
import { hatch, loopFrogs, placeFrog, resetFrogs, sendFrogsHome, stepFrogs } from '../director/frogs';
import { dismissGhosts, previewHop } from '../director/ghosts';
import { eggRegion, endingsRegion } from '../director/regions';
import { playProof } from '../director/verdicts';
import { useGame, type Reveal } from '../game/store';
import { EXIT_MS } from '../hooks/presence';
import { t } from '../i18n/i18n';
import { toBig } from '../levels/level';
import { eggsNear, tileState } from '../levels/tiles';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld } from '../scene/frogs/frogWorld';
import { sceneNow, sleep } from '../scene/sceneTime';
import { allow, ask, beat, demo, guard, say, sayWaiting, stage, waitEvent, waitStore } from './script';

export const st = (i: number, n: number) => ({ i: BigInt(i), n: BigInt(n) });
const realFrogsStopped = () => frogWorld.frogs.filter((f) => f.kind === 'real').every((f) => f.stopped);

export interface Scene {
  example?: boolean;
  reveal: Partial<Reveal>;
  frogs?: [number, number][];
  tags?: boolean;
  formula?: string | 'learner';
  camera?: [number, number, number];
  loop?: boolean;
}

interface Step {
  scene: Scene;
  run: (gen: number) => Promise<void>;
}

export let learnerFormula = '';
const witnessed = new Set<Rule>();
let weakArea = '';

export function resetProgress() {
  learnerFormula = '';
  witnessed.clear();
  weakArea = '';
}

const WORLD = { axes: true, code: true, step: true, stop: true, hover: true, eggs: true, goals: true, run: true } as const;
const DRAW = { ...WORLD, formula: true, area: true, lights: RULES };
const CAM: [number, number, number] = [2, 2, 15.6];

const EXAMPLE = { axes: true, stop: true, hover: true, eggs: true, goals: true } as const;
const EXAMPLE_AREA = '0 <= x <= 4';
const EXAMPLE_CAM: [number, number, number] = [2.5, 2, 14.4];
const EXAMPLE_WIDE: [number, number, number] = [3, 2, 17];

const TESTED = Array.from({ length: 10 }, (_, n): [number, number] => [n, n]);
const upTo = (r: Rule): Rule[] => RULES.slice(0, RULES.indexOf(r) + 1);

const T = () => t().tutorial;

const mine = () => `\`${useGame.getState().formulaText.trim()}\``;


export function loopExampleFrogs() {
  const L = useGame.getState().level!;
  const { inputs } = useGame.getState();
  const eggs = eggsNear(L, inputs, 0, 2, 2).sort((a, b) => [2, 0, 4, 1, 3].indexOf(a[1]) - [2, 0, 4, 1, 3].indexOf(b[1]));
  loopFrogs(eggs.map(([x, y]) => toBig(tileState(L, x, y, inputs))));
}

async function passed(gen: number, rule: Rule) {
  const text = { initialization: T().passedInitialization, maintenance: T().passedMaintenance, termination: T().passedTermination }[rule];
  await beat(gen, text, { spot: 'lights', tone: 'success', keep: true });
  dismissGhosts();
}

async function witness(gen: number, rule: Rule, pitfall: string, o: { question: string; afterDemo?: string; afterOwn?: string; ghost?: string }) {
  if (!witnessed.has(rule)) {
    const mine = useGame.getState().formulaText;
    useGame.getState().setFormula(pitfall);
    const yes = await ask(gen, T().whatIf(pitfall, o.question));
    guard(gen);
    await demo(gen, pitfall, upTo(rule), { ghostExtra: o.ghost, restore: mine, guessedRight: !yes });
    guard(gen);
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
    scene: { reveal: {} },
    run: (gen) =>
      beat(gen, T().frog, {
        prepare: async () => {
          useGame.getState().setReveal({ axes: true });
          useGame.setState({ frogTags: true });
          hatch(st(0, 3));
          await sleep(600);
        },
      }),
  },
  {
    scene: { reveal: { axes: true }, frogs: [[0, 3]], tags: true },
    run: (gen) =>
      beat(gen, T().program, {
        spot: 'code',
        prepare: () => useGame.getState().setReveal({ code: true }),
      }),
  },
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
  {
    scene: { reveal: { axes: true, code: true, step: true }, frogs: [[3, 3]], tags: true },
    run: (gen) =>
      beat(gen, T().stops, {
        prepare: () => useGame.getState().setReveal({ stop: true, hover: true }),
        settle: 1000,
        callouts: [{ x: 3, y: 3, text: T().stopsTag, tone: 'info' }],
      }),
  },
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true }, frogs: [[3, 3]], tags: true },
    run: (gen) =>
      beat(gen, T().eggs, {
        lines: [2, 4],
        callouts: [{ x: 0, y: 2, text: T().eggsTag, tone: 'info' }],
        prepare: () => {
          resetFrogs();
          useGame.setState({ frogTags: false });
          useGame.getState().setReveal({ eggs: true });
        },
        settle: 1100,
      }),
  },
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true }, frogs: [[3, 3]], camera: CAM },
    run: (gen) =>
      beat(gen, T().goals, {
        lines: [9],
        callouts: [{ x: 3, y: 3, text: T().goalsTag, tone: 'good' }],
        prepare: () => {
          if (!frogWorld.frogs.some((f) => f.kind === 'real')) placeFrog(st(3, 3));
          useGame.getState().setReveal({ goals: true });
        },
        settle: 1000,
      }),
  },
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true, goals: true }, frogs: [[3, 3]], camera: CAM },
    run: async (gen) => {
      await beat(gen, T().bug, {
        prepare: () => useGame.setState({ failMark: { x: 3, y: 1, label: T().bugTag, t0: sceneNow() } }),
        settle: 800,
      });
      useGame.setState({ failMark: null });
    },
  },
  {
    scene: { reveal: { axes: true, code: true, step: true, stop: true, hover: true, eggs: true, goals: true }, camera: CAM },
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
  {
    scene: { reveal: WORLD, frogs: TESTED },
    run: async (gen) => {
      await beat(gen, T().endless, {
        callouts: [
          { x: 9, y: 9, text: T().testedTag, tone: 'good' },
          { x: 0, y: 18, text: T().endlessTag, tone: 'info' },
        ],
        prepare: async () => {
          await cameraRig.lookAtTile(4, 10, 55);
          guard(gen);
          allow({ eggs: true });
        },
      });
      allow({});
    },
  },
  {
    scene: { reveal: WORLD, camera: [4, 10, 55] },
    run: (gen) =>
      beat(gen, T().detour, {
        prepare: () => {
          resetFrogs();
          void cameraRig.lookAtTile(...CAM);
        },
      }),
  },

  {
    scene: { example: true, reveal: EXAMPLE, camera: EXAMPLE_CAM, loop: true },
    run: (gen) => beat(gen, T().exWorld, { settle: 1200 }),
  },
  {
    scene: { example: true, reveal: EXAMPLE, camera: EXAMPLE_CAM, loop: true },
    run: (gen) =>
      beat(gen, T().exArea, {
        prepare: () => {
          useGame.getState().setFormula(EXAMPLE_AREA);
          useGame.getState().setReveal({ area: true });
        },
        settle: 800,
      }),
  },
  {
    scene: { example: true, reveal: { ...EXAMPLE, area: true }, formula: EXAMPLE_AREA, camera: EXAMPLE_CAM },
    run: (gen) =>
      beat(gen, T().exWhy, {
        callouts: [
          { x: 6, y: 3, text: T().exBadTag, tone: 'fail' },
          { x: 6, y: 0, text: T().exBadTag, tone: 'fail' },
        ],
        prepare: () => {
          sendFrogsHome();
          void cameraRig.lookAtTile(...EXAMPLE_WIDE);
        },
      }),
  },
  {
    scene: { example: true, reveal: { ...EXAMPLE, area: true }, formula: EXAMPLE_AREA, camera: EXAMPLE_WIDE },
    run: (gen) =>
      beat(gen, T().exEndings, {
        region: endingsRegion(() => 'good', EXAMPLE_CAM),
        callouts: [{ x: 4, y: 3, text: T().exEndingTag, tone: 'good' }],
        prepare: () => void cameraRig.lookAtTile(...EXAMPLE_CAM),
      }),
  },
  {
    scene: { example: true, reveal: { ...EXAMPLE, area: true }, formula: EXAMPLE_AREA, camera: EXAMPLE_CAM },
    run: (gen) =>
      beat(gen, T().exRules, {
        label: T().backToOurs,
        callouts: [
          { x: 0, y: 2, text: T().exRule1Tag, tone: 'info' },
          { x: 4, y: 3, text: T().exRule3Tag, tone: 'good' },
        ],
        prepare: async () => {
          await sleep(400);
          guard(gen);
          sfx.ghost();
          const f = previewHop({ x: 1n, y: 0n });
          useGame.setState((g) => ({ callouts: [...g.callouts, { x: f.x, y: f.y, frog: f.id, text: T().exRule2Tag, tone: 'info' }] }));
        },
      }),
  },

  {
    scene: { reveal: WORLD, camera: CAM },
    run: async (gen) => {
      useGame.getState().setReveal({ formula: true, area: true, lights: RULES });
      allow({ formula: true });
      sayWaiting(T().draw, 'formula');
      await waitStore(gen, (g) => g.valid !== null && g.formulaText.trim() !== '');
      await sleep(900);
      guard(gen);
      await beat(gen, T().draw, { spot: 'formula' });
      allow({});
      learnerFormula = useGame.getState().formulaText;
    },
  },

  {
    scene: { reveal: DRAW, formula: 'learner', camera: CAM },
    run: async (gen) => {
      useGame.getState().setReveal({ awake: ['initialization'] });
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
    scene: { reveal: { ...DRAW, awake: ['initialization'] }, formula: 'learner', camera: CAM },
    run: (gen) =>
      witness(gen, 'initialization', 'i == n', {
        question: T().questionInitialization,
        afterDemo: T().afterDemoInitialization(mine()),
        afterOwn: T().afterOwnInitialization(mine()),
      }),
  },
  {
    scene: { reveal: { ...DRAW, awake: ['initialization'] }, formula: 'learner', camera: CAM },
    run: async (gen) => {
      useGame.getState().setReveal({ awake: ['initialization', 'maintenance'] });
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
    scene: { reveal: { ...DRAW, awake: ['initialization', 'maintenance'] }, formula: 'learner', camera: CAM },
    run: (gen) =>
      witness(gen, 'maintenance', 'i == 0 || i == n', {
        question: T().questionMaintenance,
      }),
  },
  {
    scene: { reveal: { ...DRAW, awake: ['initialization', 'maintenance'] }, formula: 'learner', camera: CAM },
    run: async (gen) => {
      await beat(gen, T().together, {
        prepare: async () => {
          resetFrogs();
          await cameraRig.lookAtTile(1.5, 3, 12);
          guard(gen);
          const f = hatch(st(0, 3));
          await sleep(700);
          guard(gen);
          useGame.setState({ callouts: [{ x: f.x, y: f.y, frog: f.id, text: T().stillOnTag, tone: 'good' }] });
          for (let k = 0; k < 6 && !f.stopped; k++) {
            await stepFrogs(true);
            guard(gen);
            await sleep(450);
            guard(gen);
          }
        },
        settle: 200,
      });
    },
  },
  {
    scene: { reveal: { ...DRAW, awake: ['initialization', 'maintenance'] }, formula: 'learner', camera: CAM },
    run: async (gen) => {
      await beat(gen, T().leadTermination, {
        region: endingsRegion(() => 'info'),
        prepare: () => {
          resetFrogs();
          void cameraRig.lookAtTile(...CAM);
        },
      });
      useGame.getState().setReveal({ awake: RULES });
      weakArea = '';
      await stage(gen, {
        ask: T().askTermination,
        rules: RULES,
        nudge: T().nudgeTermination,
        ghost: { maintenance: T().ghostMaintenance, termination: T().objection },
        onFail: (r) => {
          witnessed.add(r);
          if (r === 'termination' && !weakArea) weakArea = mine();
        },
      });
      learnerFormula = useGame.getState().formulaText;
      await passed(gen, 'termination');
    },
  },
  {
    scene: { reveal: DRAW, formula: 'learner', camera: CAM },
    run: (gen) =>
      witness(gen, 'termination', 'i >= 0', {
        question: T().questionTermination,
        afterDemo: T().afterDemoTermination(mine()),
        afterOwn: T().afterOwnTermination(weakArea, mine()),
        ghost: T().objectionDemo,
      }),
  },
  {
    scene: { reveal: DRAW, formula: 'learner', camera: CAM },
    run: (gen) =>
      beat(gen, T().twoWays, {
        spot: 'lights',
        callouts: [
          { x: 0, y: 2, text: T().tooSmallTag, tone: 'info' },
          { x: 3, y: 2, text: T().tooLargeTag, tone: 'info' },
        ],
      }),
  },
  {
    scene: { reveal: DRAW, formula: 'learner', camera: CAM },
    run: async (gen) => {
      await beat(gen, T().wrapUp(mine()), { label: T().finish, prepare: () => playProof() });
      useGame.setState({ showRules: true });
      await waitStore(gen, (g) => !g.showRules);
      await sleep(EXIT_MS + 60);
    },
  },
];
