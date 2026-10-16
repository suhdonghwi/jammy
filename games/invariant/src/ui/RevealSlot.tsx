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
    <div
      className={`grid grid-cols-1 transition-[grid-template-rows,opacity] duration-450 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none! grid-rows-[0fr] opacity-0'}`}
      aria-hidden={!open}
    >
      {/* clipped while it opens; once settled, room for focus rings and shadows */}
      <div className={`-m-2 min-h-0 p-2 ${settled ? 'overflow-visible' : 'overflow-hidden'}`}>{children}</div>
    </div>
  );
}
