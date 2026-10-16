import { ArrowLeft, BookOpen } from 'lucide-react';
import { goMenu } from '../../game/actions';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { levelNumber } from '../../levels/catalog';
import { button } from '../classes';

// The top bar: back, the level's name and the rules card, in one pill. The
// rule lights are under the formula (RuleLights), next to the Check they report on.

export function TopBar() {
  const level = useGame((s) => s.level);
  const mode = useGame((s) => s.mode);
  const tr = useT();
  if (!level) return null;
  return (
    // .topbar and .pill-group: HoverReadout measures them to lift itself into this row when the middle is free
    <div className="topbar pointer-events-none! flex items-center" data-frame="top">
      <div className={PILLS}>
        {/* just an arrow: the level's name is what this pill is about */}
        <button
          className={button('quiet', 'icon')}
          title={mode === 'tutorial' ? tr.topBar.home : tr.topBar.allLevels}
          aria-label={mode === 'tutorial' ? tr.topBar.home : tr.topBar.allLevels}
          onClick={() => goMenu(mode === 'tutorial' ? 'home' : 'levels')}
        >
          <ArrowLeft size={17} strokeWidth={2.4} />
        </button>
        <div className="flex min-w-0 items-center gap-2 pr-1 pl-1.5 font-display text-lg font-semibold">
          {/* the mono digits sit high in their line box: a little more padding on top centres them on the title */}
          {mode === 'level' && <span className="rounded-full bg-shade/6 px-2 pt-0.75 pb-0.25 font-mono text-xs text-muted">{levelNumber(level.id)}</span>}
          <span className="truncate">{level.title}</span>
        </div>
        <button className={button('quiet', 'icon')} title={tr.topBar.rules} aria-label={tr.topBar.rules} onClick={showRules}>
          <BookOpen size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}

const showRules = () => useGame.setState({ showRules: true });

/** A rounded bar of controls floating over the scene. */
const PILLS = 'pill-group pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-card p-1.25 shadow-card backdrop-blur-md';
