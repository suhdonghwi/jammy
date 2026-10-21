import { BUILTINS, KEYWORDS, tokenize } from '../lang/parser';

const TOKEN = {
  keyword: 'font-semibold text-[#7c4ddb]',
  name: 'text-[#1f63c4]',
  num: 'text-[#c06a00]',
  op: 'text-muted',
};

type Token = ReturnType<typeof tokenize>[number];

function tokenClass(t: Token): string {
  if (t.kind === 'num') return TOKEN.num;
  if (t.kind === 'ident') return KEYWORDS.has(t.text) || BUILTINS.has(t.text) ? TOKEN.keyword : TOKEN.name;
  return TOKEN.op;
}

export function HighlightedCode({ src }: { src: string }) {
  const out: React.ReactNode[] = [];
  let p = 0;
  for (const t of tokenize(src)) {
    if (t.kind === 'eof') break;
    if (t.span.from > p) out.push(src.slice(p, t.span.from));
    out.push(
      <span key={t.span.from} className={tokenClass(t)}>
        {t.text}
      </span>,
    );
    p = t.span.to;
  }
  out.push(src.slice(p));
  return <>{out}</>;
}

const SCAN = /\s+|[0-9]+|[A-Za-z_][A-Za-z0-9_]*|==|!=|<=|>=|&&|\|\||[^\sA-Za-z0-9_]/g;

export function colorRuns(src: string, boldNames = true): { from: number; to: number; cls: string }[] {
  return [...src.matchAll(SCAN)].map((m) => {
    const text = m[0];
    let cls = '';
    if (/^[0-9]/.test(text)) cls = TOKEN.num;
    else if (/^[A-Za-z_]/.test(text)) cls = KEYWORDS.has(text) || BUILTINS.has(text) ? TOKEN.keyword : boldNames ? `${TOKEN.name} font-semibold` : TOKEN.name;
    else if (/^[-+*/%<>=!&|(){},;]/.test(text)) cls = TOKEN.op;
    return { from: m.index, to: m.index + text.length, cls };
  });
}
