import { Check, ChevronDown, Play, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useGame, type CodeCursor } from '../../game/store';
import { COMPACT, useMedia } from '../../hooks/media';
import { useT } from '../../i18n/i18n';
import { planeExists, type CompiledLevel } from '../../levels/level';
import { CARD, CARD_LABEL } from '../classes';
import { HighlightedCode } from '../codeColors';
import { inputRows, InputsSection } from './Inputs';

const ROW = '-mx-4 flex px-4 max-md:-mx-2.5 max-md:px-2.5';
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

export function CodePanel() {
  const level = useGame((s) => s.level)!;
  const cursor = useGame((s) => s.codeCursor);
  const shown = useGame((s) => s.reveal.code);
  const spotLines = useGame((s) => s.spotLines);
  const inputHover = useGame((s) => s.inputHover);
  const impossible = useGame((s) => !planeExists(level, s.inputs));
  const stops = cursor?.loops === false;
  const { rows, cursorLine, cursorLines } = useMemo(
    () => highlightSource(level, { spotLines, inputHover, impossible, cursor }),
    [level, spotLines, inputHover, impossible, cursor],
  );
  const spot = useGame((s) => s.spotlight);
  const tutorial = useGame((s) => s.mode === 'tutorial');
  const compact = useMedia(COMPACT);
  const [folded, setFolded] = useState<boolean | null>(null);
  const tr = useT();
  const pointedAt = spot === 'code' || spotLines.length > 0 || (tutorial && compact && spot === 'step');
  const open = pointedAt || !(folded ?? (tutorial && compact));
  const hasInputs = inputRows(level).length > 0;
  if (!shown) return null;
  return (
    <div
      data-frame="top"
      className={`${CARD} flex min-h-0 animate-slide-in px-4 pt-3.25 pb-3 max-md:p-2.5 ${open ? 'flex-col' : 'flex-wrap items-center gap-x-3 gap-y-2'} ${spot === 'code' ? 'spotlight' : ''}`}
    >
      <button
        className={`${CARD_LABEL} -mx-1.5 -mt-1 flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-shade/6 hover:text-muted ${open ? 'mb-0.5! self-start' : '-mb-1!'}`}
        aria-expanded={open}
        onClick={() => setFolded(open)}
      >
        {tr.code.title}
        <ChevronDown size={14} strokeWidth={2.6} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <pre
          className={`m-0 -mx-4 min-h-0 overflow-auto px-4 max-md:-mx-2.5 max-md:px-2.5 ${hasInputs ? 'pb-2.5 max-md:pb-2' : '-mb-3 rounded-b-2xl pb-3 max-md:-mb-2.5 max-md:pb-2.5'} font-mono text-sm whitespace-pre text-[#4a5368] max-md:text-[11px]`}
          style={{ lineHeight: LEADING }}
        >
          <div className="relative w-max min-w-full">
            <div
              aria-hidden
              className={`pointer-events-none absolute inset-x-0 top-0 -mx-4 transition-[translate,height,opacity,background-color] duration-150 ease-out max-md:-mx-2.5 ${cursorLine < 0 ? 'opacity-0' : ''} ${stops ? 'bg-warn/15 text-warn' : 'bg-pass/15 text-pass'}`}
              style={{ translate: `0 ${inLines(Math.max(0, cursorLine))}`, height: inLines(cursorLines) }}
            >
              <span className="absolute left-0.5 -translate-y-1/2 leading-none max-md:left-0" style={{ top: inLines(0.5) }}>
                {cursor?.loops === true ? <Check size={11} strokeWidth={3.2} /> : cursor?.loops === false ? <X size={11} strokeWidth={3.2} /> : <Play size={8} fill="currentColor" strokeWidth={0} />}
              </span>
            </div>
            {rows}
          </div>
        </pre>
      )}
      <InputsSection key={level.id} inline={!open} />
    </div>
  );
}
