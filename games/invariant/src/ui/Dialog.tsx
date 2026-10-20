import { Check } from 'lucide-react';
import { useGame, type Game } from '../game/store';
import { usePresence } from '../hooks/presence';
import { useT } from '../i18n/i18n';
import { button } from './classes';

// Cards over everything, on the page dimmed behind them: a click outside
// closes them. Overlay is the card and its backdrop (the level list uses it
// as it is); Dialog is one opened by a boolean in the store (showRules,
// showSyntax), so any button anywhere can open it, and closed by Got it too.

/** A card over the dimmed page, closed by a click outside it; `card`: its size and inside. */
export function Overlay({ open, onClose, card, children }: { open: boolean; onClose: () => void; card: string; children: React.ReactNode }) {
  const { mounted, leaving } = usePresence(open);
  if (!mounted) return null;
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-horizon/55 p-4 backdrop-blur-xs max-sm:p-2.5 ${leaving ? 'pointer-events-none animate-fade-out' : 'animate-[fade_0.15s]'}`}
      onClick={onClose}
    >
      <div
        className={`max-h-full w-full rounded-3xl shadow-float ${card} ${leaving ? 'animate-pop-out' : 'animate-[pop_0.18s_ease-out]'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function Dialog({ flag, wide, children }: { flag: 'showRules' | 'showSyntax'; wide?: boolean; children: React.ReactNode }) {
  const open = useGame((s) => s[flag]);
  const tr = useT();
  const close = () => useGame.setState({ [flag]: false } as Partial<Game>);
  return (
    <Overlay open={open} onClose={close} card={`${wide ? 'max-w-185' : 'max-w-150'} overflow-y-auto bg-white px-7.5 pt-7 pb-6 text-center max-sm:px-5 max-sm:pt-6`}>
      {children}
      <button className={button('primary')} onClick={close}>
        <Check size={17} strokeWidth={2.6} /> {tr.gotIt}
      </button>
    </Overlay>
  );
}
