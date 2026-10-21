import { Check, ChevronDown, Play, X } from 'lucide-react';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame, type CodeCursor } from '../../game/store';
import { COMPACT, useMedia } from '../../hooks/media';
import { useT } from '../../i18n/i18n';
import { planeExists, type CompiledLevel } from '../../levels/level';
import { storage } from '../../storage';
import { CARD, CARD_LABEL } from '../classes';
import { HighlightedCode } from '../codeColors';
import { inputRows, InputsSection } from './Inputs';

const ROW = '-mx-4 flex px-4 max-md:-mx-2.5 max-md:pr-2.5 max-md:pl-3';
const LEADING = 1.62;
const inLines = (n: number) => `${n * LEADING}em`;

interface Marks {
  spotLines: number[];
  inputHover: string | null;
  impossible: boolean;
  cursor: CodeCursor | null;
}

function highlightSource(level: CompiledLevel, marks: Marks) {
  const src = level.program.source;
  const lines: { from: number; to: number }[] = [];
  for (let from = 0; ; ) {
    const k = src.indexOf('\n', from);
    lines.push({ from, to: k < 0 ? src.length : k });
    if (k < 0) break;
    from = k + 1;
  }
  const lineOf = (pos: number) => lines.findIndex((l) => pos >= l.from && pos <= l.to);
  const hoverLine = marks.inputHover ? lineOf(level.program.inputDecls.find((d) => d.name === marks.inputHover)?.span.from ?? -1) : -1;
  const requiresLines = marks.impossible ? level.program.requires.map((r) => lineOf(r.span.from)) : [];
  const rows = lines.map((l, i) => {
    let cls = ROW;
    if (marks.spotLines.includes(i + 1) || i === hoverLine) cls += ' bg-brand-soft';
    if (requiresLines.includes(i)) cls += ' bg-warn-soft';
    return (
      <div key={i} className={cls} style={{ minHeight: inLines(1) }}>
        <span>
          <HighlightedCode src={src.slice(l.from, l.to)} />
        </span>
      </div>
    );
  });
  const cursorLine = marks.cursor ? lineOf(marks.cursor.at) : -1;
  const cursorLines = marks.cursor?.until === undefined ? 1 : lineOf(marks.cursor.until) - cursorLine + 1;
  return { rows, cursorLine, cursorLines };
}

const widthKey = (levelId: string) => `invariant-frog:code-width:${levelId}`;
const MIN_WIDTH = 150;
const KEY_STEP = 24;
const FOLD_MS = 300;
const FOLD_EASE = 'cubic-bezier(0.2,0.8,0.2,1)';
const FOLD = 'duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none';

function storedWidth(levelId: string): number | null {
  const w = Number(storage.get(widthKey(levelId)));
  return w >= MIN_WIDTH ? w : null;
}

export function CodePanel() {
  const level = useGame((s) => s.level)!;
  const cursor = useGame((s) => s.codeCursor);
  const shown = useGame((s) => s.reveal.code);
  const spotLines = useGame((s) => s.tutorial.spotLines);
  const inputHover = useGame((s) => s.inputHover);
  const impossible = useGame((s) => !planeExists(level, s.inputs));
  const stops = cursor?.loops === false;
  const { rows, cursorLine, cursorLines } = useMemo(
    () => highlightSource(level, { spotLines, inputHover, impossible, cursor }),
    [level, spotLines, inputHover, impossible, cursor],
  );
  const spot = useGame((s) => s.tutorial.spotlight);
  const tutorial = useGame((s) => s.mode === 'tutorial');
  const compact = useMedia(COMPACT);
  const [folded, setFolded] = useState<boolean | null>(null);
  const [width, setWidth] = useState(() => storedWidth(level.id));
  const card = useRef<HTMLDivElement>(null);
  const lastWidth = useRef<number | null>(null);
  const drag = useRef<{ x: number; width: number; max: number } | null>(null);
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
  const sized = open && width !== null;

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

  const naturalWidth = () => {
    const el = card.current!;
    const { width, maxWidth } = el.style;
    Object.assign(el.style, { width: 'max-content', maxWidth: 'none' });
    const natural = el.getBoundingClientRect().width;
    Object.assign(el.style, { width, maxWidth });
    return natural;
  };
  const maxWidth = () => Math.min(naturalWidth(), window.innerWidth - card.current!.getBoundingClientRect().left - 16);
  const resize = (to: number, max = maxWidth()) => {
    const w = Math.round(Math.min(max, Math.max(MIN_WIDTH, to)));
    setWidth(w);
    return w;
  };
  const save = (w: number | null) => storage.set(widthKey(level.id), w === null ? null : String(w));

  return (
    <div
      ref={(el) => {
        card.current = el;
        if (!el) return;
        const watch = new ResizeObserver(([e]) => void (lastWidth.current = e.borderBoxSize[0].inlineSize));
        watch.observe(el);
        return () => watch.disconnect();
      }}
      data-frame
      className={`${CARD} relative flex min-h-0 flex-col animate-slide-in px-4 [animation-delay:70ms] pt-3.25 pb-3 max-md:p-2.5 ${sized ? 'max-w-max' : 'max-w-105 max-md:max-w-64'} ${spot === 'code' ? 'spotlight' : ''}`}
      style={sized ? { width: `min(${width}px, 100%)` } : undefined}
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
          <pre
            className={`m-0 min-h-0 overflow-auto px-4 pt-0.5 max-md:px-2.5 ${hasInputs ? 'pb-2.5 max-md:pb-2' : 'rounded-b-2xl pb-3 max-md:pb-2.5'} font-mono text-sm whitespace-pre text-[#4a5368] max-md:text-[11px]`}
            style={{ lineHeight: LEADING }}
          >
            <div className="relative w-max min-w-full">
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-x-0 top-0 -mx-4 transition-[translate,height,opacity,background-color] duration-150 ease-out max-md:-mx-2.5 ${cursorLine < 0 ? 'opacity-0' : ''} ${stops ? 'bg-warn/15 text-warn' : 'bg-pass/15 text-pass'}`}
                style={{ translate: `0 ${inLines(Math.max(0, cursorLine))}`, height: inLines(cursorLines) }}
              >
                <span className="absolute left-0.5 -translate-y-1/2 leading-none max-md:left-px" style={{ top: inLines(0.5) }}>
                  {cursor?.loops === true ? <Check className="size-2.75 max-md:size-2" strokeWidth={3.2} /> : cursor?.loops === false ? <X className="size-2.75 max-md:size-2" strokeWidth={3.2} /> : <Play className="size-2 max-md:size-1.5" fill="currentColor" strokeWidth={0} />}
                </span>
              </div>
              {rows}
            </div>
          </pre>
        </div>
      </div>
      <InputsSection key={level.id} folded={!open} />
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={tr.code.resize}
        aria-valuenow={width ?? undefined}
        tabIndex={0}
        title={tr.code.resize}
        hidden={!open}
        className="group absolute inset-y-3 -right-[8.5px] z-10 flex w-4 cursor-col-resize touch-none items-center justify-center rounded-full outline-none"
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, width: card.current!.getBoundingClientRect().width, max: maxWidth() };
        }}
        onPointerMove={(e) => {
          if (drag.current) resize(drag.current.width + e.clientX - drag.current.x, drag.current.max);
        }}
        onLostPointerCapture={() => {
          if (drag.current) save(Math.round(card.current!.getBoundingClientRect().width));
          drag.current = null;
        }}
        onDoubleClick={() => {
          setWidth(null);
          save(null);
        }}
        onKeyDown={(e) => {
          const step = e.key === 'ArrowRight' ? KEY_STEP : e.key === 'ArrowLeft' ? -KEY_STEP : 0;
          if (!step) return;
          e.preventDefault();
          save(resize(card.current!.getBoundingClientRect().width + step));
        }}
      >
        <span className="h-10 w-1.5 rounded-full bg-white shadow-[0_0_0_1px_rgb(32_44_70/0.2)] transition-colors group-hover:bg-brand group-focus-visible:bg-brand group-active:bg-brand" />
      </div>
    </div>
  );
}
