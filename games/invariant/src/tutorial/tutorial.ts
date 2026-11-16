import { loopFrogs, placeFrog } from '../director/frogs';
import { interrupt, resetLevel } from '../director/reset';
import { Aborted, type Token } from '../director/sequence';
import { EMPTY_REVEAL, NO_TUTORIAL, setTutorial, useGame, type Game } from '../game/store';
import { exampleLevel, tutorialLevel } from '../levels/catalog';
import { toBig } from '../levels/level';
import { eggsNear, tileState } from '../levels/tiles';
import { cameraRig, type Shot } from '../scene/cameraRig';
import { sleep, switchScene } from '../scene/sceneTime';
import { newGeneration, setSkipStep, settled } from './script';
import { learnerFormula, resetProgress, st, STEPS, VIEW, type Scene } from './steps';

export { tutorialCheck } from './script';

let stepIndex = 0;
let stepCaption: Game['caption'] = null;
const shown = new Set<number>();
let onFinish: () => void = () => {};

const levelOf = (scene: Scene) => (scene.example ? exampleLevel : tutorialLevel);
const shotOf = (scene: Scene): Shot => ({ at: scene.camera ?? VIEW, focus: scene.focus, labels: scene.labels });

function loopExampleFrogs() {
  const L = useGame.getState().level!;
  const { inputs } = useGame.getState();
  const eggs = eggsNear(L, inputs, 0, 2, 2).sort((a, b) => [2, 0, 4, 1, 3].indexOf(a[1]) - [2, 0, 4, 1, 3].indexOf(b[1]));
  loopFrogs(eggs.map(([x, y]) => toBig(tileState(L, x, y, inputs))));
}

function restore(scene: Scene) {
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
  });
  useGame.getState().setFormula(scene.formula === 'learner' ? learnerFormula : (scene.formula ?? ''));
  if (level === tutorialLevel) for (const [i, n] of scene.frogs ?? []) placeFrog(st(i, n));
  if (scene.loop) loopExampleFrogs();
  void cameraRig.frame(shotOf(scene));
}

function crossTo(gen: Token, scene: Scene): Promise<void> {
  return settled(gen, (settle) => {
    const go = () => {
      if (gen.alive) restore(scene);
      settle();
    };
    useGame.setState({ callouts: [], region: null, failMark: null });
    setTutorial({ spotlight: null });
    if (!switchScene(go)) go();
  });
}

function play(from: number, opening = false) {
  const gen = newGeneration();
  void (async () => {
    if (opening) {
      void cameraRig.frame(shotOf(STEPS[0].scene));
      setTutorial({ allow: NO_TUTORIAL.allow });
      await sleep(500);
      gen.guard();
    } else restore(STEPS[from].scene);
    for (let i = from; i < STEPS.length; i++) {
      if (i > from && levelOf(STEPS[i].scene).id !== useGame.getState().level?.id) await crossTo(gen, STEPS[i].scene);
      else if (i > from) void cameraRig.frame(shotOf(STEPS[i].scene));
      stepIndex = i;
      stepCaption = useGame.getState().caption;
      setTutorial({ back: i > 0 ? goBack : null });
      setSkipStep(i + 1 < STEPS.length ? skipAhead : null);
      await STEPS[i].run(gen);
      gen.guard();
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
  const start = Math.min(Math.max(0, from), STEPS.length - 1);
  play(start, start === 0);
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
  play(target);
}
