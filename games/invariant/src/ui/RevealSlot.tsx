import { useEffect, useState, type ReactNode } from 'react';

/**
 * Opens smoothly (height + fade) instead of popping in and shoving the layout.
 * Content stays clipped while animating, then may overflow (shadows, outlines).
 */
export function RevealSlot({ open, children }: { open: boolean; children: ReactNode }) {
  const [settled, setSettled] = useState(open);
  useEffect(() => {
    if (!open) {
      setSettled(false);
      return;
    }
    const t = setTimeout(() => setSettled(true), 480);
    return () => clearTimeout(t);
  }, [open]);
  return (
    <div className={`reveal-slot ${open ? 'open' : ''} ${settled ? 'settled' : ''}`} aria-hidden={!open}>
      <div className="reveal-inner">{children}</div>
    </div>
  );
}
