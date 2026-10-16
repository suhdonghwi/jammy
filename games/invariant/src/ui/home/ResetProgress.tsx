import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { resetCleared, useProgress } from '../../game/progress';
import { useT } from '../../i18n/i18n';

// Beside the sound button: forget which levels are cleared. An icon at rest,
// like its neighbour; it takes two presses, the second within a few seconds
// (the button asks in words in between), so a stray click loses nothing.

const CONFIRM_MS = 3000;

export function ResetProgress() {
  const tr = useT();
  const any = useProgress((s) => s.cleared.length > 0);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirming]);
  return (
    <div className="flex items-center rounded-full border border-line bg-card p-1 shadow-card backdrop-blur-md">
      {/* an icon, like the sound button beside it; the first press turns it into a red question that a second press answers */}
      <button
        className={`flex h-7.5 cursor-pointer items-center justify-center gap-1.5 rounded-full font-display text-sm font-medium transition-colors duration-150 disabled:cursor-default disabled:opacity-40 ${
          confirming ? 'bg-fail px-3 text-white' : 'w-7.5 text-muted enabled:hover:bg-shade/6 enabled:hover:text-ink'
        }`}
        disabled={!any}
        aria-label={confirming ? tr.home.resetConfirm : tr.home.resetTitle}
        title={tr.home.resetTitle}
        onClick={() => {
          if (!confirming) return setConfirming(true);
          resetCleared();
          setConfirming(false);
        }}
      >
        <RotateCcw size={confirming ? 14 : 16} strokeWidth={confirming ? 2.4 : 2.2} aria-hidden />
        {confirming && tr.home.resetConfirm}
      </button>
    </div>
  );
}
