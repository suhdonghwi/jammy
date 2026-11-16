import { GraduationCap, LayoutGrid } from 'lucide-react';
import { openTutorial, showLevels } from '../../game/actions';
import { useGame } from '../../game/store';
import { COMPACT_HOME, NARROW_HOME, useMedia } from '../../hooks/media';
import { useT } from '../../i18n/i18n';
import { button } from '../classes';
import { CornerControls } from './CornerControls';
import { LangSwitch } from './LangSwitch';
import { LevelPicker } from './LevelPicker';
import { Title3D } from './title/Title3D';

export function HomeOverlay() {
  const view = useGame((s) => s.menuView);
  const compact = useMedia(COMPACT_HOME);
  const picking = view === 'levels';
  const dim = `transition-opacity duration-180 ${picking ? 'opacity-35' : ''}`;
  return (
    <>
      <div
        className={`pointer-events-none fixed inset-0 isolate flex flex-col items-start justify-center pl-[max(5vw,24px)] [--copy-end:calc(max(5vw,24px)+29.5rem)] narrow:items-center narrow:px-4 narrow:pb-[5vh] ${
          compact ? BACKDROP : `narrow:justify-end ${WASH}`
        } ${dim}`}
      >
        <HeroCopy behind={picking} />
      </div>
      <div
        className={`fixed top-4 right-4 flex max-sm:top-2.5 max-sm:right-2.5 animate-[fade_0.4s_var(--ease-entrance)_0.6s_both] items-center gap-2 ${dim}`}
      >
        <CornerControls />
        <LangSwitch />
      </div>
      <LevelPicker open={picking} />
    </>
  );
}

const BACKDROP = 'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-wash/72';

const WASH =
  'before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-linear-to-r before:from-wash/94 before:via-wash/70 before:via-(length:--copy-end) before:to-wash/0 before:to-[length:calc(var(--copy-end)+15rem)] narrow:before:bg-linear-to-t narrow:before:from-wash/95 narrow:before:via-wash/80 narrow:before:via-42% narrow:before:to-62%';

function HomeButtons() {
  const tr = useT();
  return (
    <div className="flex animate-[rise_0.5s_var(--ease-entrance)_0.45s_both] gap-3.5 narrow:justify-center max-sm:gap-2.5">
      <button className={button('primary', 'lg')} onClick={openTutorial}>
        <GraduationCap size={22} strokeWidth={2.2} /> {tr.home.tutorial}
      </button>
      <button className={button('toy', 'lg')} onClick={showLevels}>
        <LayoutGrid size={22} strokeWidth={2.2} /> {tr.home.levels}
      </button>
    </div>
  );
}

function HeroCopy({ behind }: { behind: boolean }) {
  const tr = useT();
  const narrow = useMedia(NARROW_HOME);
  return (
    <div className={`max-w-118 narrow:text-center ${behind ? '' : 'pointer-events-auto'}`}>
      <p className="mb-3 animate-[rise_0.5s_var(--ease-entrance)_0.1s_both] font-display short:mb-2 text-xs font-semibold tracking-[0.08em] text-muted uppercase">{tr.home.tagline}</p>
      <h1 className="mb-3.5 short:mb-2">
        <span className="sr-only">Invariant Frog</span>
        <Title3D align={narrow ? 'center' : 'left'} />
      </h1>
      <p className="mb-6.5 animate-[rise_0.5s_var(--ease-entrance)_0.35s_both] text-lg leading-[1.55] text-muted max-sm:text-base short:mb-4 short:max-w-[min(29.5rem,48vw)] short:text-base">{tr.home.pitch}</p>
      <HomeButtons />
    </div>
  );
}
