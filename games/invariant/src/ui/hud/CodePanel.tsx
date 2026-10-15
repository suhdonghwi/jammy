import { Fragment, useMemo } from 'react';
import { useGame } from '../../game/store';
import { BUILTINS, KEYWORDS, tokenize } from '../../lang/parser';
import { showState, type CompiledLevel } from '../../levels/level';

// The program, with the loop lighting up as frogs hop, and the selected frog's
// values shown underneath like a debugger.

interface Beat {
  hopTick: number;
  hopDur: number;
  landTick: number;
  landGuard: 'true' | 'false' | 'mixed';
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
      const cls = t.kind === 'num' ? 'tok-num' : t.kind === 'ident' ? (KEYWORDS.has(t.text) || BUILTINS.has(t.text) ? 'tok-kw' : 'tok-var') : 'tok-op';
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
  return lines.map((l, i) => {
    let cls = 'code-line';
    let key = `l${i}`;
    let style: React.CSSProperties | undefined;
    if (i === headerLine) {
      cls += ` loop-header${beat.landTick > 0 ? ` check-${beat.landGuard}` : ''}`;
      key += `h${beat.landTick}`;
    } else if (i >= bodyFirst && i <= bodyLast) {
      cls += ` loop-body${beat.hopTick > 0 ? ' running' : ''}${i === bodyFirst ? ' first' : ''}${i === bodyLast ? ' last' : ''}`;
      key += `b${beat.hopTick}`;
      style = { animationDuration: `${Math.max(0.3, beat.hopDur + 0.15)}s` };
    }
    return (
      <div key={key} className={cls} style={style}>
        <span className="code-ln">{i + 1}</span>
        <span className="code-text">{piece(l.from, l.to, `l${i}`)}</span>
      </div>
    );
  });
}

export function CodePanel() {
  const level = useGame((s) => s.level)!;
  const hopTick = useGame((s) => s.hopTick);
  const hopDur = useGame((s) => s.hopDur);
  const landTick = useGame((s) => s.landTick);
  const landGuard = useGame((s) => s.landGuard);
  const selected = useGame((s) => s.selected);
  const reveal = useGame((s) => s.reveal);
  const nodes = useMemo(
    () => highlightSource(level, { hopTick, hopDur, landTick, landGuard }),
    [level, hopTick, hopDur, landTick, landGuard],
  );
  const spot = useGame((s) => s.spotlight);
  if (!reveal.code) return null;
  return (
    <div className={`card code-card ${spot === 'code' ? 'spotlight' : ''}`}>
      <div className="card-label">Program</div>
      <pre className="code">{nodes}</pre>
      <div className={`debugger ${selected ? '' : 'empty'}`}>
        {selected ? (
          <>
            <span className="frog-dot" /> {showState(level, selected)}
          </>
        ) : (
          'Click a frog to see its values'
        )}
      </div>
    </div>
  );
}
