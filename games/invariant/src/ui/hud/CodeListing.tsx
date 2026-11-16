import { Check, Play, X } from 'lucide-react';
import { useGame, type CodeCursor } from '../../game/store';
import { planeExists } from '../../levels/inputs';
import type { CompiledLevel } from '../../levels/level';
import { HighlightedCode } from '../codeColors';

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
  const hoverLine = marks.inputHover ? lineOf(level.program.inputs.find((d) => d.name === marks.inputHover)?.span.from ?? -1) : -1;
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

export function CodeListing({ level, hasInputs }: { level: CompiledLevel; hasInputs: boolean }) {
  const cursor = useGame((s) => s.codeCursor);
  const spotLines = useGame((s) => s.tutorial.spotLines);
  const inputHover = useGame((s) => s.inputHover);
  const impossible = useGame((s) => !planeExists(level, s.inputs));
  const stops = cursor?.loops === false;
  const { rows, cursorLine, cursorLines } = highlightSource(level, { spotLines, inputHover, impossible, cursor });
  return (
    <pre
      className={`m-0 min-h-0 overflow-auto px-4 pt-0.5 max-md:px-2.5 ${hasInputs ? 'pb-2.5 max-md:pb-2' : 'rounded-b-2xl pb-3 max-md:pb-2.5'} font-mono text-sm whitespace-pre text-[#4a5368] max-md:text-[11px]`}
      style={{ lineHeight: LEADING }}
    >
      <div className="relative w-max min-w-full">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 -mx-4 transition-[translate,height,opacity,background-color] duration-120 ease-out max-md:-mx-2.5 ${cursorLine < 0 ? 'opacity-0' : ''} ${stops ? 'bg-warn/15 text-warn' : 'bg-pass/15 text-pass'}`}
          style={{ translate: `0 ${inLines(Math.max(0, cursorLine))}`, height: inLines(cursorLines) }}
        >
          <span className="absolute left-0.5 -translate-y-1/2 leading-none max-md:left-px" style={{ top: inLines(0.5) }}>
            {cursor?.loops === true ? <Check className="size-2.75 max-md:size-2" strokeWidth={3.2} /> : cursor?.loops === false ? <X className="size-2.75 max-md:size-2" strokeWidth={3.2} /> : <Play className="size-2 max-md:size-1.5" fill="currentColor" strokeWidth={0} />}
          </span>
        </div>
        {rows}
      </div>
    </pre>
  );
}
