import { useGame } from '../../game/store';
import { useLingering } from '../../hooks/presence';

export function GhostCursor() {
  const { value: ghost, leaving } = useLingering(useGame((s) => s.ghost));
  if (!ghost) return null;
  return (
    <div
      className="pointer-events-none! fixed top-0 left-0 z-40 transition-[translate] duration-(--duration-base) ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
      style={{ translate: `${ghost.x}px ${ghost.y}px` }}
      aria-hidden
    >
      <svg
        width="22"
        height="26"
        viewBox="0 0 22 26"
        className={`-translate-x-[3px] -translate-y-[2px] origin-[3px_2px] drop-shadow-[0_3px_6px_rgb(32_44_70/0.3)] transition-[scale] duration-(--duration-micro) ${ghost.down ? 'scale-85' : ''} ${leaving ? 'animate-fade-out' : 'animate-[ghost-in_var(--duration-short)_var(--ease-entrance)]'}`}
      >
        <path d="M3 2 L3 20 L8 15.5 L11.5 23.5 L15 22 L11.5 14.2 L18 14 Z" fill="white" stroke="var(--color-ink)" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
