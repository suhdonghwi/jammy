import { BUILTINS, KEYWORDS, tokenize } from '../lang/parser';

// The colours code is shown in: keywords and functions, names, numbers and
// operators. The code panel, the syntax card and the area box use them.

const TOKEN = {
  keyword: 'font-semibold text-[#7c4ddb]',
  name: 'text-[#1f63c4]',
  num: 'text-[#c06a00]',
  op: 'text-muted',
};

type Token = ReturnType<typeof tokenize>[number];

/** A token's colour class. */
function tokenClass(t: Token): string {
  if (t.kind === 'num') return TOKEN.num;
  if (t.kind === 'ident') return KEYWORDS.has(t.text) || BUILTINS.has(t.text) ? TOKEN.keyword : TOKEN.name;
  return TOKEN.op;
}

/** A short piece of code, coloured, keeping its spaces. */
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

// one token at a time; anything else (a stray character) is one character on its own
const SCAN = /\s+|[0-9]+|[A-Za-z_][A-Za-z0-9_]*|==|!=|<=|>=|&&|\|\||[^\sA-Za-z0-9_]/g;

/**
 * Colour runs for text being typed, each with its class ('' for none): like
 * tokenize, but it never throws, so half-typed text and stray characters
 * still colour. In the area box names are bold too.
 */
export function colorRuns(src: string): { from: number; to: number; cls: string }[] {
  return [...src.matchAll(SCAN)].map((m) => {
    const text = m[0];
    let cls = '';
    if (/^[0-9]/.test(text)) cls = TOKEN.num;
    else if (/^[A-Za-z_]/.test(text)) cls = KEYWORDS.has(text) || BUILTINS.has(text) ? TOKEN.keyword : `${TOKEN.name} font-semibold`;
    else if (/^[-+*/%<>=!&|(){},;]/.test(text)) cls = TOKEN.op;
    return { from: m.index, to: m.index + text.length, cls };
  });
}
