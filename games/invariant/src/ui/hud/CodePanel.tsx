import { ChevronDown } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { tokenize } from '../../lang/parser';
import { planeExists, type CompiledLevel } from '../../levels/level';
import { CARD, CARD_LABEL } from '../classes';
import { tokenClass } from '../codeColors';

// The program, with the loop lighting up as frogs hop and a ghost `assert(?)`
// line standing for the invariant at the top of the loop. On phones it folds
// away to its title, so it doesn't hide the scene.

/** The loop condition's flash when frogs land: keep looping, stop, or some of each. */
const LANDED = {
  true: 'animate-[check-true_0.9s_ease-out]',
  false: 'animate-[check-false_1.4s_ease-out_forwards]',
  mixed: 'animate-[check-mixed_0.9s_ease-out]',
};

interface Beat {
  hopTick: number;
  hopDur: number;
  landTick: number;
  landGuard: 'true' | 'false' | 'mixed';
  /** Show the ghost `assert(?)` line at the top of the loop body. */
  assert: boolean;
  /** Lines the tutorial's caption is talking about (1-based). */
  spotLines: number[];
  /** The input whose row in the inputs card is hovered: its declaration lights up. */
  inputHover: string | null;
  /** The inputs in view are ruled out by the precondition: its lines say so. */
  impossible: boolean;
}

/**
 * Syntax-highlighted program, one row per line. While frogs hop, the loop
 * body's lines light up (that is what a hop runs); when they land, the
 * condition's line flashes green (keep looping) or amber (stop). Highlights
 * cover whole rows, so they all share the same width.
 */
function highlightSource(level: CompiledLevel, beat: Beat) {
  const src = level.program.source;
  const header = level.program.loop.headerSpan;
  const stmts = level.program.loop.body;
  const toks = tokenize(src).filter((t) => t.kind !== 'eof');
  const piece = (from: number, to: number, keyBase: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let p = from;
    toks.forEach((t, i) => {
      if (t.span.from < from || t.span.to > to) return;
      if (t.span.from > p) out.push(<Fragment key={`${keyBase}g${i}`}>{src.slice(p, t.span.from)}</Fragment>);
      const cls = tokenClass(t);
      out.push(
        <span key={`${keyBase}t${i}`} className={cls}>
          {t.text}
        </span>,
      );
      p = t.span.to;
    });
    if (to > p) out.push(<Fragment key={`${keyBase}end`}>{src.slice(p, to)}</Fragment>);
    return out;
  };
  const lines: { from: number; to: number }[] = [];
  for (let from = 0; ; ) {
    const k = src.indexOf('\n', from);
    lines.push({ from, to: k < 0 ? src.length : k });
    if (k < 0) break;
    from = k + 1;
  }
  const lineOf = (pos: number) => lines.findIndex((l) => pos >= l.from && pos <= l.to);
  const headerLine = lineOf(header.from);
  const hoverLine = beat.inputHover ? lineOf(level.program.inputDecls.find((d) => d.name === beat.inputHover)?.span.from ?? -1) : -1;
  const requiresLines = beat.impossible ? level.program.requires.map((r) => lineOf(r.span.from)) : [];
  const bodyFirst = stmts.length ? lineOf(stmts[0].span.from) : -1;
  const bodyLast = stmts.length ? lineOf(stmts[stmts.length - 1].span.to) : -2;
  const rows = lines.map((l, i) => {
    // a line's height even when it is blank
    let cls = '-mx-2 flex min-h-lh px-2';
    let key = `l${i}`;
    let style: React.CSSProperties | undefined;
    if (i === headerLine) {
      cls += ` rounded-md ${beat.landTick > 0 ? LANDED[beat.landGuard] : ''}`;
      key += `h${beat.landTick}`;
    } else if (i >= bodyFirst && i <= bodyLast) {
      cls += `${i === bodyFirst ? ' rounded-t-md' : ''}${i === bodyLast ? ' rounded-b-md' : ''}`;
      key += `b${beat.hopTick}`;
      // as long as the hop itself
      if (beat.hopTick > 0) style = { animation: `body-run ${Math.max(0.3, beat.hopDur + 0.15)}s ease-out` };
    }
    if (beat.spotLines.includes(i + 1) || i === hoverLine) cls += ' rounded-md bg-brand-soft';
    if (requiresLines.includes(i)) cls += ' rounded-md bg-warn-soft';
    return (
      <div key={key} className={cls} style={style}>
        <span>{piece(l.from, l.to, `l${i}`)}</span>
      </div>
    );
  });
  // the invariant, as the assert it stands for: a ghost line at the top of the
  // loop body, indented like the body (the area itself lives in the box below)
  if (beat.assert && headerLine >= 0) {
    const indent = stmts.length ? src.slice(lines[bodyFirst].from).match(/^\s*/)?.[0] ?? '  ' : '  ';
    rows.splice(headerLine + 1, 0, (
      <div key="assert" className="-mx-2 flex animate-row-open overflow-hidden px-2 text-faint">
        <span>
          {indent}
          <span className="font-semibold">assert</span>(?);
        </span>
      </div>
    ));
  }
  return rows;
}

export function CodePanel() {
  const level = useGame((s) => s.level)!;
  const hopTick = useGame((s) => s.hopTick);
  const hopDur = useGame((s) => s.hopDur);
  const landTick = useGame((s) => s.landTick);
  const landGuard = useGame((s) => s.landGuard);
  const reveal = useGame((s) => s.reveal);
  const spotLines = useGame((s) => s.spotLines);
  const assert = useGame((s) => s.reveal.assert);
  const inputHover = useGame((s) => s.inputHover);
  const impossible = useGame((s) => !planeExists(level, s.inputs));
  const nodes = useMemo(
    () => highlightSource(level, { hopTick, hopDur, landTick, landGuard, assert, spotLines, inputHover, impossible }),
    [level, hopTick, hopDur, landTick, landGuard, assert, spotLines, inputHover, impossible],
  );
  const spot = useGame((s) => s.spotlight);
  const [folded, setFolded] = useState(false);
  const tr = useT();
  // a new level starts unfolded, and so does anything the tutorial points at in the code
  useEffect(() => setFolded(false), [level]);
  const open = !folded || spot === 'code' || spotLines.length > 0;
  if (!reveal.code) return null;
  return (
    // wide enough for the longest program line in the catalog; anything longer scrolls sideways rather than spilling.
    // No taller than the room between the top bar and the caption (a long caption on a phone): the code scrolls
    // inside it, not the card, whose spotlight ring would be clipped
    <div data-frame="top" className={`${CARD} flex min-h-0 animate-slide-in flex-col px-4 pt-3.25 pb-3 max-md:p-2.5 ${spot === 'code' ? 'spotlight' : ''}`}>
      {/* folding only exists on phones; elsewhere the title is just a label */}
      <button
        className={`${CARD_LABEL} flex w-full items-center justify-between gap-1.5 max-sm:cursor-pointer sm:pointer-events-none ${open ? '' : 'max-sm:mb-0'}`}
        aria-expanded={open}
        onClick={() => setFolded(open)}
      >
        {tr.code.title}
        <ChevronDown size={14} strokeWidth={2.6} className={`transition-transform duration-200 sm:hidden ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* the scroll area runs to the card's edges (the card's padding is inside it, matching the classes above), so a
          scrolling program clips at the rounded edge, with its scrollbar along it, not at a line floating above it */}
      <pre
        className={`m-0 -mx-4 -mb-3 min-h-0 overflow-auto rounded-b-2xl px-4 pb-3 max-md:-mx-2.5 max-md:-mb-2.5 max-md:px-2.5 max-md:pb-2.5 ${open ? '' : 'max-sm:hidden'} font-mono text-sm leading-[1.62] whitespace-pre text-[#4a5368] max-md:text-[11px]`}
      >
        {nodes}
      </pre>
    </div>
  );
}
