import { ArrowLeft } from 'lucide-react';
import { goMenu } from '../../game/actions';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { levelNumber } from '../../levels/catalog';
import { button } from '../classes';

// The top bar: back and the level's name, in one pill. The rule lights are
// under the formula (RuleLights), next to the Check they report on; the rules
// card opens from the controls, beside the syntax card.

export function TopBar() {
  const level = useGame((s) => s.level);
  const mode = useGame((s) => s.mode);
  const tr = useT();
  if (!level) return null;
  return (
    // .topbar and .pill-group: HoverReadout measures them to lift itself into this row when the middle is free
    <div className="topbar pointer-events-none! flex animate-slide-in items-center" data-frame="top">
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
        {/* "6. Tag Along", in one font, with the number muted: the arrow is the pill's one button */}
        <div className="min-w-0 truncate pr-3.5 pl-1 font-display text-lg font-semibold">
          {mode === 'level' && <span className="text-faint">{levelNumber(level.id)}. </span>}
          {level.title}
        </div>
      </div>
    </div>
  );
}

/** A rounded bar of controls floating over the scene. */
const PILLS = 'pill-group pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-full border border-line bg-card p-1.25 shadow-card backdrop-blur-md';
