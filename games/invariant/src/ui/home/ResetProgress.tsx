import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { resetCleared, useProgress } from '../../game/progress';
import { useT } from '../../i18n/i18n';

// Beside the language switch: forget which levels are cleared. It takes two
// presses, the second within a few seconds, so a stray click loses nothing.

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
      <button
        className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 font-display text-sm font-medium transition-colors duration-150 disabled:cursor-default disabled:opacity-40 ${
          confirming ? 'bg-fail text-white' : 'text-muted enabled:hover:bg-shade/6 enabled:hover:text-ink'
        }`}
        disabled={!any}
        title={tr.home.resetTitle}
        onClick={() => {
          if (!confirming) return setConfirming(true);
          resetCleared();
          setConfirming(false);
        }}
      >
        <RotateCcw size={14} strokeWidth={2.4} aria-hidden />
        {confirming ? tr.home.resetConfirm : tr.home.reset}
      </button>
    </div>
  );
}
