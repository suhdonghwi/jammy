import { allLevels, levels } from '../levels/defs';
import { RULES, type LevelDef } from '../levels/level';
import { useGame } from '../store/game';
import { frogWorld } from '../scene/frogSim';
import { director } from './director';
import { startTutorial, stopTutorial, tutorialCheck } from '../tutorial/tutorial';

export function openLevel(def: LevelDef) {
  stopTutorial();
  director.reset();
  useGame.getState().openLevel(def, 'level');
  if (def.bridge) {
    void (async () => {
      await director.bridge();
      useGame.setState({ caption: def.intro ? { text: def.intro, tone: 'info' } : null });
    })();
  }
}

export function openTutorial() {
  director.reset();
  useGame.getState().openLevel(allLevels[0], 'tutorial');
  startTutorial();
}

export function goMenu(view: 'home' | 'levels' = 'home') {
  stopTutorial();
  director.reset();
  useGame.getState().backToMenu(view);
}

function nextLevelDef(id: string): LevelDef | null {
  const i = levels.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < levels.length ? levels[i + 1] : null;
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
  frogWorld.clear('test');
  useGame.setState({ caption: { text: 'Checking…', tone: 'muted' } });
  const res = await director.runChecker(RULES);
  if (!res) return;
  const failure = RULES.map((r) => res.verdicts[r]).find((v) => v?.status === 'fail');
  if (failure && failure.status === 'fail') {
    await director.playCounterexample(failure.cex, { extra: res.pitfall?.message });
    return;
  }
  if (RULES.some((r) => res.verdicts[r]?.status === 'undecided')) {
    const usesDivision = g.formulaText.includes('/');
    const tip = usesDivision ? ' Try avoiding division — for example `2 * s == …` instead of `s == … / 2`.' : '';
    await director.playShrug(`I couldn't find a frog that breaks this nearby — but I couldn't prove it either.${tip}`);
    return;
  }
  const level = g.level;
  await director.playRain();
  const next = nextLevelDef(level.id);
  useGame.setState({ caption: {
    text: 'Proved. Every frog, everywhere you claimed — for every input.',
    tone: 'success',
    action: next ? { label: `Next: ${next.title}`, onClick: () => openLevel(next) } : { label: 'Back to levels', onClick: () => goMenu('levels') },
  } });
}
