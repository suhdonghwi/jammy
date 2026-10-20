import { RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { setMuted, useSound } from '../../audio/sfx';
import { resetCleared, useProgress } from '../../game/progress';
import { useT } from '../../i18n/i18n';

export const PILL = 'flex items-center rounded-full border border-line bg-card p-1 shadow-card backdrop-blur-md';

const ICON = 'grid size-7.5 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-shade/6 hover:text-ink';

const SOURCE_URL = 'https://github.com/suhdonghwi/jammy/tree/main/games/invariant';

const CONFIRM_MS = 3000;

export function CornerControls() {
  const tr = useT();
  const muted = useSound((s) => s.muted);
  return (
    <>
      <div className={PILL}>
        <a className={ICON} href={SOURCE_URL} target="_blank" rel="noopener noreferrer" aria-label={tr.home.source} title={tr.home.source}>
          <GitHubMark />
        </a>
      </div>
      <ResetProgress />
      <div className={PILL}>
        <button
          className={`${ICON} cursor-pointer`}
          aria-pressed={!muted}
          aria-label={muted ? tr.home.soundOff : tr.home.soundOn}
          title={muted ? tr.home.soundOff : tr.home.soundOn}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeX size={16} strokeWidth={2.2} /> : <Volume2 size={16} strokeWidth={2.2} />}
        </button>
      </div>
    </>
  );
}

function GitHubMark() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .32.21.69.82.57A12 12 0 0 0 12 .3" />
    </svg>
  );
}

function ResetProgress() {
  const tr = useT();
  const any = useProgress((s) => s.cleared.length > 0);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirming]);
  return (
    <div className={PILL}>
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
