import { interrupt, placeFrog, resetLevel } from '../director/frogs';
import { EMPTY_REVEAL, NO_TUTORIAL, setTutorial, useGame, type Game } from '../game/store';
import { exampleLevel, tutorialLevel } from '../levels/catalog';
import { cameraRig, type Shot } from '../scene/cameraRig';
import { sleep, switchScene } from '../scene/sceneTime';
import { Aborted, currentGeneration, guard, newGeneration } from './script';
import { learnerFormula, loopExampleFrogs, resetProgress, st, STEPS, VIEW, type Scene } from './steps';

export { tutorialCheck } from './script';

let stepIndex = 0;
let stepCaption: Game['caption'] = null;
const shown = new Set<number>();
let onFinish: () => void = () => {};

const levelOf = (scene: Scene) => (scene.example ? exampleLevel : tutorialLevel);
const shotOf = (scene: Scene): Shot => ({ at: scene.camera ?? VIEW, focus: scene.focus, labels: scene.labels });

function restore(gen: number, scene: Scene) {
  const level = levelOf(scene);
  const switched = useGame.getState().level?.id !== level.id;
  if (switched) {
    resetLevel();
    useGame.getState().openLevel(level, 'tutorial');
  } else interrupt();
  useGame.setState({
    reveal: { ...EMPTY_REVEAL, ...scene.reveal },
    frogTags: !!scene.tags,
    callouts: [],
    region: null,
    tutorial: NO_TUTORIAL,
    verdicts: {},
    pitfallMessage: null,
  });
  useGame.getState().setFormula(scene.formula === 'learner' ? learnerFormula : (scene.formula ?? ''));
  if (level === tutorialLevel) for (const [i, n] of scene.frogs ?? []) placeFrog(st(i, n));
  if (scene.loop) loopExampleFrogs();
  void cameraRig.frame(shotOf(scene));
  guard(gen);
}

function crossTo(gen: number, scene: Scene): Promise<void> {
  return new Promise((resolve, reject) => {
    const go = () => {
      if (gen !== currentGeneration()) return reject(new Aborted());
      restore(gen, scene);
      resolve();
    };
    useGame.setState({ callouts: [], region: null, failMark: null });
    setTutorial({ spotlight: null });
    if (!switchScene(go)) go();
  });
}

function play(from: number, rewound = false) {
  const gen = newGeneration();
  void (async () => {
    if (from > 0) restore(gen, STEPS[from].scene);
    else if (!rewound) {
      void cameraRig.frame(shotOf(STEPS[0].scene));
      setTutorial({ allow: NO_TUTORIAL.allow });
      await sleep(500);
      guard(gen);
    }
    for (let i = from; i < STEPS.length; i++) {
      if (i > from && levelOf(STEPS[i].scene).id !== useGame.getState().level?.id) await crossTo(gen, STEPS[i].scene);
      else if (i > from) void cameraRig.frame(shotOf(STEPS[i].scene));
      stepIndex = i;
      stepCaption = useGame.getState().caption;
      setTutorial({ back: i > 0 ? goBack : null, skip: i + 1 < STEPS.length ? skipAhead : null });
      await STEPS[i].run(gen);
      guard(gen);
      noteShown();
    }
    onFinish();
  })().catch((e) => {
    if (!(e instanceof Aborted)) console.error(e);
  });
}

export function startTutorial(finish: () => void, from = 0) {
  onFinish = finish;
  resetProgress();
  shown.clear();
  play(Math.min(Math.max(0, from), STEPS.length - 1));
}

export function stopTutorial() {
  newGeneration();
  useGame.setState({ region: null, tutorial: NO_TUTORIAL });
}

function noteShown() {
  if (useGame.getState().caption !== stepCaption) shown.add(stepIndex);
}

function skipAhead() {
  noteShown();
  const target = stepIndex + 1;
  if (target >= STEPS.length) return;
  stopTutorial();
  play(target);
}

function goBack() {
  noteShown();
  const earlier = [...shown].filter((i) => i < stepIndex);
  const target = earlier.length ? Math.max(...earlier) : Math.max(0, stepIndex - 1);
  stopTutorial();
  if (target === 0) {
    restore(currentGeneration(), STEPS[0].scene);
    play(0, true);
  } else play(target);
}
