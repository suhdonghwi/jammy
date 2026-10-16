import { Volume2, VolumeX } from 'lucide-react';
import { setMuted, useSound } from '../../audio/sfx';
import { useT } from '../../i18n/i18n';

// Beside the language switch: sound on or off, remembered in this browser.

export function SoundToggle() {
  const tr = useT();
  const muted = useSound((s) => s.muted);
  return (
    <div className="flex items-center rounded-full border border-line bg-card p-1 shadow-card backdrop-blur-md">
      <button
        className="grid size-7.5 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-shade/6 hover:text-ink"
        aria-pressed={!muted}
        aria-label={muted ? tr.home.soundOff : tr.home.soundOn}
        title={muted ? tr.home.soundOff : tr.home.soundOn}
        onClick={() => setMuted(!muted)}
      >
        {muted ? <VolumeX size={16} strokeWidth={2.2} /> : <Volume2 size={16} strokeWidth={2.2} />}
      </button>
    </div>
  );
}
