import { useGame, type Game } from '../game/store';
import { usePresence } from './presence';

// A card over everything, closed by its button, a click outside, or Escape's
// sibling: the overlay. Opened by a boolean in the store (showRules,
// showSyntax), so any button anywhere can open it.

type Flag = 'showRules' | 'showSyntax';

export function Dialog({ flag, wide, children }: { flag: Flag; wide?: boolean; children: React.ReactNode }) {
  const { mounted, leaving } = usePresence(useGame((s) => s[flag]));
  if (!mounted) return null;
  const close = () => useGame.setState({ [flag]: false } as Partial<Game>);
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-horizon/55 p-4 backdrop-blur-xs max-sm:p-2.5 ${leaving ? 'pointer-events-none animate-fade-out' : 'animate-[fade_0.15s]'}`}
      onClick={close}
    >
      <div
        className={`max-h-full w-full ${wide ? 'max-w-185' : 'max-w-150'} overflow-y-auto rounded-3xl bg-white px-7.5 pt-7 pb-6 text-center max-sm:px-5 max-sm:pt-6 shadow-float ${leaving ? 'animate-pop-out' : 'animate-[pop_0.18s_ease-out]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** The dialog's closing button. */
export function closeDialog(flag: Flag) {
  useGame.setState({ [flag]: false } as Partial<Game>);
}
