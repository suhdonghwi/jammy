import { Fragment, type ReactNode } from 'react';
import { HighlightedCode } from './codeColors';

export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n[ \t]*\n/);
  return <>{blocks.map((b, i) => renderBlock(b, i))}</>;
}

const gap = (key: number) => (key > 0 ? 'mt-2.5 compact:mt-2' : '');

function renderBlock(block: string, key: number): ReactNode {
  const lines = block.split('\n');
  const bullet = /^\s*[-*]\s+/;
  const numbered = /^\s*\d+[.)]\s+/;
  const marker = [bullet, numbered].find((m) => lines.every((l) => m.test(l)));
  if (marker) {
    const Tag = marker === bullet ? 'ul' : 'ol';
    return (
      <Tag key={key} className={`${marker === bullet ? 'list-disc' : 'list-decimal'} pl-5.5 ${gap(key)}`}>
        {lines.map((l, j) => (
          <li key={j} className={LI}>
            {renderInline(l.replace(marker, ''))}
          </li>
        ))}
      </Tag>
    );
  }
  return (
    <p key={key} className={gap(key)}>
      {lines.map((l, j) => (
        <Fragment key={j}>
          {j > 0 && <br />}
          {renderInline(l)}
        </Fragment>
      ))}
    </p>
  );
}

const LI = 'marker:text-muted [&+li]:mt-0.5';

const INLINE = /`[^`]+`|\*\*.+?\*\*|\*(?!\s)[^*]+?\*(?!\w)|_(?!\s)[^_]+?_(?!\w)/g;
const NOT_AFTER: Record<string, RegExp> = { '*': /[\w*]/, _: /\w/ };

function splitInline(text: string): string[] {
  const parts: string[] = [];
  let last = 0;
  INLINE.lastIndex = 0;
  for (let m; (m = INLINE.exec(text)); ) {
    const guard = m[0][1] === '*' ? undefined : NOT_AFTER[m[0][0]];
    if (guard?.test(text[m.index - 1] ?? '')) {
      INLINE.lastIndex = m.index + 1;
      continue;
    }
    parts.push(text.slice(last, m.index), m[0]);
    last = INLINE.lastIndex;
  }
  parts.push(text.slice(last));
  return parts;
}

function wrapPoints(src: string): string[] {
  return (src.match(/.+?(?:(?:&&|\|\|) +|$)/g) ?? [src]).map((c) => c.trimEnd()).filter(Boolean);
}

function renderInline(text: string): ReactNode[] {
  return splitInline(text).map((part, i) => {
    if (!part) return null;
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={i} className="rounded-md bg-shade/6 box-decoration-clone px-1.5 py-px font-mono text-[0.9em]">
          {wrapPoints(part.slice(1, -1)).map((chunk, j) => (
            <Fragment key={j}>
              {j > 0 && ' '}
              <span className="whitespace-nowrap">
                <HighlightedCode src={chunk} />
              </span>
            </Fragment>
          ))}
        </code>
      );
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**'))
      return (
        <strong key={i} className="font-bold text-ink">
          {renderInline(part.slice(2, -2))}
        </strong>
      );
    if (part.length > 2 && ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))))
      return <em key={i}>{renderInline(part.slice(1, -1))}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
