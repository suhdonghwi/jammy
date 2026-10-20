import { useState, type ReactNode } from 'react';

export function RevealSlot({ open, children }: { open: boolean; children: ReactNode }) {
  const [settled, setSettled] = useState(open);
  if (!open && settled) setSettled(false);
  return (
    <div
      className={`grid grid-cols-1 transition-[grid-template-rows,opacity] duration-450 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none! grid-rows-[0fr] opacity-0'}`}
      aria-hidden={!open}
      onTransitionEnd={(e) => e.target === e.currentTarget && e.propertyName === 'grid-template-rows' && setSettled(open)}
    >
      <div className={`-m-2 min-h-0 p-2 ${settled ? 'overflow-visible' : 'overflow-hidden'}`}>{children}</div>
    </div>
  );
}
