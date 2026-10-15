import { compareToModel, type ModelMatch } from '../checker/check';
import { browserZ3 } from '../checker/z3-browser';
import { resetLevel } from '../director/frogs';
import { playCounterexample, playRain, playShrug, runChecker } from '../director/verdicts';
import { levels, tutorialLevel } from '../levels/catalog';
import { RULES, type LevelDef } from '../levels/level';
import { frogWorld } from '../scene/frogs/frogWorld';
import { startTutorial, stopTutorial, tutorialCheck } from '../tutorial/tutorial';
import { useGame } from './store';

// What the app's buttons do: open a level or the tutorial, go back to the
// menu, and check the learner's area.

export function openLevel(def: LevelDef) {
  stopTutorial();
  resetLevel();
  useGame.getState().openLevel(def, 'level');
}

export function openTutorial() {
  resetLevel();
  useGame.getState().openLevel(tutorialLevel, 'tutorial');
  // when it's done, on to the first level; `?step=N` starts partway in (playtesting)
  const from = Number(new URLSearchParams(location.search).get('step') ?? 0);
  startTutorial(() => openLevel(levels[0]), from);
}

export function goMenu(view: 'home' | 'levels' = 'home') {
  stopTutorial();
  resetLevel();
  useGame.getState().backToMenu(view);
}

/** The Hint button in a level: the first hint, or (pressed again) the ones already asked for, in the caption. */
export function showLevelHint() {
  const g = useGame.getState();
  if (g.busy || !g.level?.hints?.length) return;
  // a check's caption may have replaced them since; the button brings them back
  showHints(Math.max(g.hintsShown, 1));
}

/** The first `shown` hints, one under another, with a button for the next. */
function showHints(shown: number) {
  const hints = useGame.getState().level?.hints ?? [];
  const text = hints
    .slice(0, shown)
    .map((h, k) => `**Hint ${k + 1} of ${hints.length}.** ${h}`)
    .join('\n\n');
  useGame.setState({
    hintsShown: shown,
    caption: {
      text,
      tone: 'info',
      action: shown < hints.length ? { label: 'Another hint', onClick: () => showHints(shown + 1) } : undefined,
    },
  });
}

export async function check() {
  const g = useGame.getState();
  if (g.busy || g.checking || !g.level) return;
  if (g.mode === 'tutorial') {
    tutorialCheck();
    return;
  }
  if (!g.formula || !g.formula.ok) {
    // the formula box shows the error itself; don't duplicate it in the caption
    useGame.setState((s) => ({ errorNudge: s.errorNudge + 1 }));
    return;
  }
  // the caption stays as it is while the check runs (most finish at once);
  // the Check button's spinner and the lights show a slow one
  frogWorld.clear('test');
  const res = await runChecker(RULES);
  if (!res) return;
  const failure = RULES.map((r) => res.verdicts[r]).find((v) => v?.status === 'fail');
  if (failure?.status === 'fail') {
    await playCounterexample(failure.cex, { extra: res.pitfall?.message });
    return;
  }
  if (RULES.some((r) => res.verdicts[r]?.status === 'undecided')) {
    const tip = g.formulaText.includes('/') ? ' Try avoiding division — for example `2 * s == …` instead of `s == … / 2`.' : '';
    await playShrug(`I couldn't find a frog that breaks this nearby — but I couldn't prove it either.${tip}`);
    return;
  }
  // compared while the frogs rain, so the caption doesn't wait on it
  const level = g.level;
  const match = browserZ3()
    .then((ctx) => compareToModel(ctx, level, g.valid!))
    .catch((): ModelMatch => 'unknown');
  await playRain();
  const model = modelNote(level.solutions[0], await match);
  // left for another level (or the menu) while it rained
  if (useGame.getState().level !== level) return;
  const next = levels[levels.findIndex((l) => l.id === level.id) + 1];
  useGame.setState({
    caption: {
      text: `Proved. Every frog, everywhere you claimed — for every input.${model ? `\n\n${model}` : ''}`,
      tone: 'success',
      action: next ? { label: `Next: ${next.title}`, onClick: () => openLevel(next) } : { label: 'Back to levels', onClick: () => goMenu('levels') },
    },
  });
}

/** A line about the model answer for the success caption; nothing when the learner typed it. */
function modelNote(model: string, match: ModelMatch): string | null {
  const m = `\`${model}\``;
  switch (match) {
    case 'typed':
      return null;
    case 'same':
      return `The model answer, ${m}, is the same area written another way.`;
    case 'different':
      return `The model answer is ${m} — a different area. Both pass all three rules, so both prove the goal: a loop can have more than one invariant.`;
    case 'unknown':
      return `The model answer: ${m}.`;
  }
}
