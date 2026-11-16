import type { Span } from '../lang/ast';
import { BUILTINS, KEYWORDS, tokenize } from '../lang/parser';

export const TOKEN = {
  keyword: 'font-semibold text-[#7c4ddb]',
  name: 'text-[#1f63c4]',
  num: 'text-[#c06a00]',
  op: 'text-muted',
};

const MARK = 'underline decoration-fail decoration-wavy underline-offset-4';

type Token = ReturnType<typeof tokenize>[number];

function tokenClass(t: Token, boldNames: boolean): string {
  if (t.kind === 'num') return TOKEN.num;
  if (t.kind === 'op') return TOKEN.op;
  if (t.kind !== 'ident') return '';
  if (KEYWORDS.has(t.text) || BUILTINS.has(t.text)) return TOKEN.keyword;
  return boldNames ? `${TOKEN.name} font-semibold` : TOKEN.name;
}

function colorRuns(src: string, boldNames: boolean): (Span & { cls: string })[] {
  const out: (Span & { cls: string })[] = [];
  let p = 0;
  for (const t of tokenize(src, { lenient: true })) {
    if (t.span.from > p) out.push({ from: p, to: t.span.from, cls: '' });
    if (t.kind !== 'eof') out.push({ from: t.span.from, to: t.span.to, cls: tokenClass(t, boldNames) });
    p = t.span.to;
  }
  return out;
}

function visibleMark(src: string, mark: Span | null): Span | null {
  if (!mark) return null;
  const from = Math.min(mark.from, src.length);
  const to = Math.min(Math.max(mark.to, from + 1), src.length);
  return from < to ? { from, to } : null;
}

export function HighlightedCode({ src, boldNames = false, mark = null }: { src: string; boldNames?: boolean; mark?: Span | null }) {
  const marked = visibleMark(src, mark);
  return colorRuns(src, boldNames).flatMap((r) => {
    const cuts = [r.from, r.to];
    if (marked) for (const c of [marked.from, marked.to]) if (c > r.from && c < r.to) cuts.splice(-1, 0, c);
    return cuts.slice(1).map((to, i) => {
      const from = cuts[i];
      const cls = marked && from >= marked.from && to <= marked.to ? `${r.cls} ${MARK}` : r.cls;
      return (
        <span key={from} className={cls}>
          {src.slice(from, to)}
        </span>
      );
    });
  });
}
