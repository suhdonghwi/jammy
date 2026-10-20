import { interrupt, placeFrog } from '../director/frogs';
import { ALLOW_NONE, EMPTY_REVEAL, useGame } from '../game/store';
import { cameraRig } from '../scene/cameraRig';
import { sleep } from '../scene/sceneTime';
import { Aborted, allow, currentGeneration, guard, newGeneration } from './script';
import { learnerFormula, resetProgress, st, STEPS, type Scene } from './steps';

export { tutorialCheck } from './script';

const TUTORIAL_CAMERA: [number, number, number] = [2, 2, 13];

let stepIndex = 0;
let onFinish: () => void = () => {};

function restore(gen: number, scene: Scene) {
  interrupt();
  allow({});
  useGame.setState({
    reveal: { ...EMPTY_REVEAL, ...scene.reveal },
    frogTags: !!scene.tags,
    callouts: [],
    spotLines: [],
    spotlight: null,
    hint: null,
    awaitingCheck: false,
    verdicts: {},
    pitfallMessage: null,
  });
  useGame.getState().setFormula(scene.formula === 'learner' ? learnerFormula : (scene.formula ?? ''));
  for (const [i, n] of scene.frogs ?? []) placeFrog(st(i, n));
  const [x, y, d] = scene.camera ?? TUTORIAL_CAMERA;
  void cameraRig.lookAtTile(x, y, d);
  guard(gen);
}

function play(from: number, rewound = false) {
  const gen = newGeneration();
  void (async () => {
    if (from > 0) restore(gen, STEPS[from].scene);
    else if (!rewound) {
      allow({});
      await sleep(500);
      guard(gen);
    }
    for (let i = from; i < STEPS.length; i++) {
      stepIndex = i;
      useGame.setState({ back: i > 0 ? goBack : null, skip: i + 1 < STEPS.length ? skipAhead : null });
      await STEPS[i].run(gen);
      guard(gen);
    }
    onFinish();
  })().catch((e) => {
    if (!(e instanceof Aborted)) console.error(e);
  });
}

export function startTutorial(finish: () => void, from = 0) {
  onFinish = finish;
  resetProgress();
  play(Math.min(Math.max(0, from), STEPS.length - 1));
}

export function stopTutorial() {
  newGeneration();
  useGame.setState({
    awaitingCheck: false,
    spotlight: null,
    spotLines: [],
    hint: null,
    nextAction: null,
    back: null,
    skip: null,
    tutorialAllow: ALLOW_NONE,
  });
}

function skipAhead() {
  const target = stepIndex + 1;
  if (target >= STEPS.length) return;
  stopTutorial();
  play(target);
}

function goBack() {
  const target = Math.max(0, stepIndex - 1);
  stopTutorial();
  if (target === 0) {
    restore(currentGeneration(), STEPS[0].scene);
    play(0, true);
  } else play(target);
}
