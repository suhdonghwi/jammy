import { Fragment, useMemo } from 'react';
import { useGame } from '../../game/store';
import { BUILTINS, KEYWORDS, tokenize } from '../../lang/parser';
import { showState, type CompiledLevel } from '../../levels/level';
import { CARD, CARD_LABEL } from '../classes';

// The program, with the loop lighting up as frogs hop, a ghost `assert` line
// showing the area as the condition it is, and the selected frog's values
// shown underneath like a debugger.

const TOKEN = {
  keyword: 'font-semibold text-[#7c4ddb]',
  name: 'text-[#1f63c4]',
  num: 'text-[#c06a00]',
  op: 'text-muted',
};

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
  /** The ghost assert line's condition (null: no assert line). */
  assert: string | null;
  /** Lines the tutorial's caption is talking about (1-based). */
  spotLines: number[];
}

/**
 * Syntax-highlighted program, one row per line with line numbers. While frogs
 * hop, the loop body's lines light up (that is what a hop runs); when they
 * land, the condition's line flashes green (keep looping) or amber (stop).
 * Highlights cover whole rows, so they all share the same width.
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
      const cls = t.kind === 'num' ? TOKEN.num : t.kind === 'ident' ? (KEYWORDS.has(t.text) || BUILTINS.has(t.text) ? TOKEN.keyword : TOKEN.name) : TOKEN.op;
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
  const bodyFirst = stmts.length ? lineOf(stmts[0].span.from) : -1;
  const bodyLast = stmts.length ? lineOf(stmts[stmts.length - 1].span.to) : -2;
  const rows = lines.map((l, i) => {
    let cls = '-mx-2 flex px-2';
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
    if (beat.spotLines.includes(i + 1)) cls += ' rounded-md bg-brand-soft';
    return (
      <div key={key} className={cls} style={style}>
        <span className="mr-3 w-[2ch] flex-none text-right text-[#b8bfcc] select-none">{i + 1}</span>
        <span>{piece(l.from, l.to, `l${i}`)}</span>
      </div>
    );
  });
  // the invariant, as the assert it stands for: a ghost line at the top of the loop body
  if (beat.assert !== null && headerLine >= 0) {
    const indent = stmts.length ? src.slice(lines[bodyFirst].from).match(/^\s*/)?.[0] ?? '  ' : '  ';
    // w-0 + min-w-full: the line takes the panel's width but never widens
    // it, so a long area doesn't make the panel grow; it is clipped instead
    rows.splice(headerLine + 1, 0, (
      <div key="assert" className="-mx-2 flex w-0 min-w-full animate-row-open overflow-hidden px-2 text-faint">
        <span className="mr-3 w-[2ch] flex-none select-none" />
        <span className="truncate">
          {indent}
          <span className="font-semibold">assert</span>({beat.assert});
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
  const selected = useGame((s) => s.selected);
  const reveal = useGame((s) => s.reveal);
  const spotLines = useGame((s) => s.spotLines);
  // the assert line shows the area once there is one to show, and ??? before
  const assert = useGame((s) => (s.reveal.assert ? (s.reveal.formula && s.formulaText.trim() ? s.formulaText.trim() : '???') : null));
  const nodes = useMemo(
    () => highlightSource(level, { hopTick, hopDur, landTick, landGuard, assert, spotLines }),
    [level, hopTick, hopDur, landTick, landGuard, assert, spotLines],
  );
  const spot = useGame((s) => s.spotlight);
  if (!reveal.code) return null;
  return (
    <div className={`${CARD} max-w-85 animate-slide-in px-4 pt-3.25 pb-3 max-md:max-w-52 max-md:p-2.5 ${spot === 'code' ? 'spotlight' : ''}`}>
      <div className={CARD_LABEL}>Program</div>
      <pre className="m-0 font-mono text-sm leading-[1.62] whitespace-pre text-[#4a5368] max-md:text-[11px]">{nodes}</pre>
      {/* one fixed height for both texts, so selecting a frog doesn't grow the panel */}
      <div
        className={`mt-2.5 flex h-7.25 items-center gap-1.5 border-t border-dashed border-shade/12 ${selected ? 'font-mono text-sm font-semibold text-pass' : 'text-xs text-faint'}`}
      >
        {selected ? (
          <>
            <span className="size-2.25 flex-none rounded-full bg-frog" /> {showState(level, selected)}
          </>
        ) : (
          'Click a frog to see its values'
        )}
      </div>
    </div>
  );
}
