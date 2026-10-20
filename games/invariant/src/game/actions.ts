import { sfx } from '../audio/sfx';
import { RULES } from '../checker/types';
import { resetLevel } from '../director/frogs';
import { playCounterexample, playRain, playShrug, runChecker } from '../director/verdicts';
import { listNames, t } from '../i18n/i18n';
import { levels, tutorialLevel } from '../levels/catalog';
import type { LevelDef } from '../levels/level';
import { localizeLevel } from '../levels/localize';
import { frogWorld } from '../scene/frogs/frogWorld';
import { startTutorial, stopTutorial, tutorialCheck } from '../tutorial/tutorial';
import { markCleared } from './progress';
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
    .map((h, k) => `${t().level.hint(k + 1, hints.length)} ${h}`)
    .join('\n\n');
  useGame.setState({
    hintsShown: shown,
    caption: {
      text,
      tone: 'info',
      action: shown < hints.length ? { label: t().level.anotherHint, onClick: () => showHints(shown + 1) } : undefined,
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
    const tip = g.formulaText.includes('/') ? t().level.avoidDivision : '';
    await playShrug(`${t().level.undecided}${tip}`);
    return;
  }
  const level = g.level;
  markCleared(level.id);
  const others = otherAnswers(level.solutions, g.formulaText);
  await playRain();
  // left for another level (or the menu) while it rained
  if (useGame.getState().level !== level) return;
  const next = levels[levels.findIndex((l) => l.id === level.id) + 1];
  sfx.cleared();
  useGame.setState({
    caption: {
      text: others ? `${t().level.proved}\n\n${others}` : t().level.proved,
      tone: 'success',
      action: next
        ? { label: t().level.next(localizeLevel(next).title), onClick: () => openLevel(next) }
        : { label: t().level.backToLevels, onClick: () => goMenu('levels') },
    },
  });
}

/** The success caption's line listing the level's other known answers (all but the one typed, if it was one); none left, no line. */
function otherAnswers(solutions: string[], typed: string): string | null {
  const squash = (s: string) => s.replace(/\s+/g, '');
  const rest = solutions.filter((s) => squash(s) !== squash(typed));
  return rest.length ? t().level.otherAnswers(listNames(rest.map((s) => `\`${s}\``))) : null;
}
