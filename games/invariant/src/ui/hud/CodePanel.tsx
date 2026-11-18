import { ChevronDown } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useGame } from '../../game/store';
import { COMPACT, useMedia } from '../../hooks/media';
import { useT } from '../../i18n/i18n';
import { CARD, CARD_LABEL, FOLD, FOLD_EASE, FOLD_MS } from '../classes';
import { CodeListing } from './CodeListing';
import { inputRows, InputsSection } from './Inputs';
import { ResizeHandle, useStoredWidth } from './ResizeHandle';

export function CodePanel() {
  const level = useGame((s) => s.level)!;
  const shown = useGame((s) => s.reveal.code);
  const spotLines = useGame((s) => s.tutorial.spotLines);
  const spot = useGame((s) => s.tutorial.spotlight);
  const tutorial = useGame((s) => s.mode === 'tutorial');
  const compact = useMedia(COMPACT);
  const [folded, setFolded] = useState<boolean | null>(null);
  const size = useStoredWidth(level.id);
  const card = useRef<HTMLDivElement>(null);
  const lastWidth = useRef<number | null>(null);
  const bodyId = useId();
  const tr = useT();
  const pointedAt = spot === 'code' || spotLines.length > 0 || (tutorial && compact && spot === 'step');
  const pointing = pointedAt ? `${spot}|${spotLines.join(',')}` : null;
  const [seenPointing, setSeenPointing] = useState(pointing);
  if (pointing !== seenPointing) {
    setSeenPointing(pointing);
    if (pointing !== null) setFolded(null);
  }
  const open = folded === null ? pointedAt || !(tutorial && compact) : !folded;
  const hasInputs = inputRows(level).length > 0;
  const sized = open && size.width !== null;

  useLayoutEffect(() => {
    const el = card.current;
    const from = lastWidth.current;
    if (!el || from === null || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const to = el.getBoundingClientRect().width;
    if (Math.abs(to - from) < 1) return;
    const grow = el.animate({ width: [`${from}px`, `${to}px`] }, { duration: FOLD_MS, easing: FOLD_EASE });
    return () => grow.cancel();
  }, [open]);

  if (!shown) return null;

  return (
    <div
      ref={(el) => {
        card.current = el;
        if (!el) return;
        const watch = new ResizeObserver(([e]) => void (lastWidth.current = e.borderBoxSize[0].inlineSize));
        watch.observe(el);
        return () => watch.disconnect();
      }}
      data-frame={compact ? 'soft' : ''}
      className={`${CARD} relative flex min-h-0 flex-col animate-slide-in px-4 [animation-delay:70ms] pt-3.25 pb-3 max-md:p-2.5 ${sized ? 'max-w-max' : 'max-w-105 max-md:max-w-64'} ${spot === 'code' ? 'spotlight' : ''}`}
      style={sized ? { width: `min(${size.width}px, 100%)` } : undefined}
    >
      <button
        className={`group -mx-1.5 -mt-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-1.5 py-1 transition-[margin,background-color] hover:bg-shade/6 ${FOLD} ${open || hasInputs ? '' : '-mb-1'}`}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setFolded(open)}
      >
        <span className={`${CARD_LABEL} mb-0!`}>{tr.code.title}</span>
        <span className="flex items-center gap-0.5 rounded-full bg-shade/5 py-0.5 pr-1.5 pl-2 font-display text-xs font-medium text-muted transition-colors group-hover:bg-shade/10 group-hover:text-ink">
          {open ? tr.code.hide : tr.code.show}
          <ChevronDown size={13} strokeWidth={2.6} className={`transition-transform ${FOLD} ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <div
        id={bodyId}
        inert={!open}
        className={`-mx-4 grid min-h-0 transition-[grid-template-rows,opacity,margin] max-md:-mx-2.5 ${FOLD} ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 contain-inline-size'} ${open && !hasInputs ? '-mb-3 max-md:-mb-2.5' : ''}`}
      >
        <div className="flex min-h-0 flex-col overflow-hidden">
          <CodeListing level={level} hasInputs={hasInputs} />
        </div>
      </div>
      <InputsSection key={level.id} folded={!open} />
      <ResizeHandle cardRef={card} size={size} hidden={!open} />
    </div>
  );
}
