import { ArrowLeft } from 'lucide-react';
import { goMenu } from '../../game/actions';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { levelNumber } from '../../levels/catalog';
import { button } from '../classes';

export function TopBar() {
  const level = useGame((s) => s.level);
  const mode = useGame((s) => s.mode);
  const tr = useT();
  if (!level) return null;
  return (
    <div className="pointer-events-none! flex animate-slide-in items-center" data-frame data-topbar>
      <div className={PILLS} data-pill>
        <button
          className={`${button('quiet', 'none')} size-7.5`}
          title={mode === 'tutorial' ? tr.topBar.home : tr.topBar.allLevels}
          aria-label={mode === 'tutorial' ? tr.topBar.home : tr.topBar.allLevels}
          onClick={() => goMenu(mode === 'tutorial' ? 'home' : 'levels')}
        >
          <ArrowLeft size={15} strokeWidth={2.4} />
        </button>
        <div className="min-w-0 truncate pr-3 pl-0.5 font-display text-base font-semibold">
          {mode === 'level' && <span className="text-faint">{levelNumber(level.id)}. </span>}
          {level.title}
        </div>
      </div>
    </div>
  );
}

const PILLS = 'pointer-events-auto flex min-w-0 items-center gap-1 rounded-full border border-line bg-card p-1 shadow-card backdrop-blur-md';
