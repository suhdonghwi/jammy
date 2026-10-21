import { BUILTINS, KEYWORDS, tokenize } from '../lang/parser';

const TOKEN = {
  keyword: 'font-semibold text-[#7c4ddb]',
  name: 'text-[#1f63c4]',
  num: 'text-[#c06a00]',
  op: 'text-muted',
};

type Token = ReturnType<typeof tokenize>[number];

function tokenClass(t: Token, boldNames: boolean): string {
  if (t.kind === 'num') return TOKEN.num;
  if (t.kind === 'op') return TOKEN.op;
  if (t.kind !== 'ident') return '';
  if (KEYWORDS.has(t.text) || BUILTINS.has(t.text)) return TOKEN.keyword;
  return boldNames ? `${TOKEN.name} font-semibold` : TOKEN.name;
}

export interface ColorRun {
  from: number;
  to: number;
  cls: string;
}

export function colorRuns(src: string, boldNames = true): ColorRun[] {
  const out: ColorRun[] = [];
  let p = 0;
  for (const t of tokenize(src, { lenient: true })) {
    if (t.span.from > p) out.push({ from: p, to: t.span.from, cls: '' });
    if (t.kind !== 'eof') out.push({ from: t.span.from, to: t.span.to, cls: tokenClass(t, boldNames) });
    p = t.span.to;
  }
  return out;
}

export function HighlightedCode({ src, boldNames = false }: { src: string; boldNames?: boolean }) {
  return colorRuns(src, boldNames).map((r) => (
    <span key={r.from} className={r.cls}>
      {src.slice(r.from, r.to)}
    </span>
  ));
}
