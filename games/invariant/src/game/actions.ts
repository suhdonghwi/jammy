import { sfx } from '../audio/sfx';
import { RULES } from '../checker/types';
import { dismissFrogs, resetLevel } from '../director/frogs';
import { playVerification, runChecker, showUndecided } from '../director/verdicts';
import { t } from '../i18n/i18n';
import { levels, tutorialLevel } from '../levels/catalog';
import type { LevelDef } from '../levels/level';
import { localizeLevel } from '../levels/localize';
import { switchScene } from '../scene/sceneTime';
import { startTutorial, stopTutorial, tutorialCheck } from '../tutorial/tutorial';
import { markCleared } from './progress';
import { useGame } from './store';

export function openLevel(def: LevelDef) {
  switchScene(() => {
    stopTutorial();
    resetLevel();
    useGame.getState().openLevel(def, 'level');
  });
}

export function openTutorial() {
  switchScene(() => {
    resetLevel();
    useGame.getState().openLevel(tutorialLevel, 'tutorial');
    const from = Number(new URLSearchParams(location.search).get('step') ?? 0);
    startTutorial(() => openLevel(levels[0]), from);
  });
}

export function goMenu(view: 'home' | 'levels' = 'home') {
  switchScene(() => {
    stopTutorial();
    resetLevel();
    useGame.getState().backToMenu(view);
  });
}

export function showLevelHint() {
  const g = useGame.getState();
  if (g.busy || !g.level?.hints?.length) return;
  showHints(Math.max(g.hintsShown, 1));
}

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
      close: () => useGame.setState({ caption: null }),
    },
  });
}

export async function check(): Promise<'refused' | void> {
  const g = useGame.getState();
  if (g.busy || g.checking || !g.level) return;
  if (g.mode === 'tutorial') return tutorialCheck();
  if (!g.formula || !g.formula.ok) return 'refused';
  void dismissFrogs('test');
  const res = await runChecker(RULES);
  if (!res) return;
  const out = await playVerification(res, RULES, () => ({ extra: res.pitfall?.message }));
  if (!out || out.failing) return;
  const now = useGame.getState();
  if (now.level !== g.level || now.valid !== g.valid) return;
  if (out.undecided) {
    const tip = g.formulaText.includes('/') ? t().level.avoidDivision : '';
    showUndecided(`${t().level.undecided}${tip}`);
    return;
  }
  const level = g.level;
  markCleared(level.id);
  const others = otherAnswers(level.solutions, g.formulaText);
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

function otherAnswers(solutions: string[], typed: string): string | null {
  const squash = (s: string) => s.replace(/\s+/g, '');
  const rest = solutions.filter((s) => squash(s) !== squash(typed));
  return rest.length ? `${t().level.otherAnswers(rest.length)}\n\n${rest.map((s) => `- \`${s}\``).join('\n')}` : null;
}
