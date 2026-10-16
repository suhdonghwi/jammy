import { interrupt, placeFrog } from '../director/frogs';
import { sleep } from '../director/sequence';
import { EMPTY_REVEAL, useGame } from '../game/store';
import { cameraRig } from '../scene/cameraRig';
import { Aborted, allow, currentGeneration, guard, newGeneration } from './script';
import { learnerFormula, resetProgress, st, STEPS, type Scene } from './steps';

// Running the tutorial: its steps in order, with Back (rewind a step) and
// skipping ahead (Next pressed while a step is still playing).

export { tutorialCheck } from './script';

const TUTORIAL_CAMERA: [number, number, number] = [2, 2, 13];

let stepIndex = 0;
let onFinish: () => void = () => {};

/** Put the board in the state a step starts from. */
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
  // instant: frogs are simply put back, and the camera glides back while the
  // step's caption is already showing
  for (const [i, n] of scene.frogs ?? []) placeFrog(st(i, n));
  const [x, y, d] = scene.camera ?? TUTORIAL_CAMERA;
  void cameraRig.lookAtTile(x, y, d);
  guard(gen);
}

/** Play the steps from `from` on. `rewound`: back at the very start (the board is already fresh). */
function play(from: number, rewound = false) {
  const gen = newGeneration();
  void (async () => {
    if (from > 0) restore(gen, STEPS[from].scene);
    else if (!rewound) {
      // a moment to take in the empty plane before the story starts
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

/** Start the tutorial from its first step (or `from`, for playtesting); `finish` runs once the learner has gone through it all. */
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
    tutorialAllow: { step: false, run: false, eggs: false, formula: false },
  });
}

/** Next pressed while a step is still playing: go straight to the next step, its scene rebuilt at once. */
function skipAhead() {
  const target = stepIndex + 1;
  if (target >= STEPS.length) return;
  stopTutorial();
  play(target);
}

/** Back: rewind to the start of the previous step and replay it. */
function goBack() {
  const target = Math.max(0, stepIndex - 1);
  stopTutorial();
  if (target === 0) {
    // the very beginning: a fresh board
    restore(currentGeneration(), STEPS[0].scene);
    play(0, true);
  } else play(target);
}
