import { Fragment, type ReactNode } from 'react';

// A tiny Markdown subset for captions, rendered straight to styled React
// elements (no HTML strings):
//   blank line → new paragraph, single newline → line break
//   "- item" lines → bullet list, "1. item" lines → numbered list
//   `code`, **bold**, *italic* / _italic_

export function Markdown({ text }: { text: string }) {
  const blocks = text.trim().split(/\n[ \t]*\n/);
  return <>{blocks.map((b, i) => renderBlock(b, i))}</>;
}

/** Space between paragraphs and lists. */
const gap = (key: number) => (key > 0 ? 'mt-2.5' : '');

function renderBlock(block: string, key: number): ReactNode {
  const lines = block.split('\n');
  const bullet = /^\s*[-*]\s+/;
  const numbered = /^\s*\d+[.)]\s+/;
  if (lines.every((l) => bullet.test(l))) {
    return (
      <ul key={key} className={`list-disc pl-5.5 ${gap(key)}`}>
        {lines.map((l, j) => (
          <li key={j} className={LI}>
            {renderInline(l.replace(bullet, ''))}
          </li>
        ))}
      </ul>
    );
  }
  if (lines.every((l) => numbered.test(l))) {
    return (
      <ol key={key} className={`list-decimal pl-5.5 ${gap(key)}`}>
        {lines.map((l, j) => (
          <li key={j} className={LI}>
            {renderInline(l.replace(numbered, ''))}
          </li>
        ))}
      </ol>
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

// code first, so nothing inside backticks is treated as emphasis
const INLINE = /(`[^`]+`|\*\*.+?\*\*|(?<![\w*])\*(?!\s)[^*]+?\*(?!\w)|(?<!\w)_(?!\s)[^_]+?_(?!\w))/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    // inline code (states, formulas) never breaks across lines
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={i} className="rounded-md bg-shade/6 px-1.5 py-px font-mono text-[0.9em] whitespace-nowrap">
          {part.slice(1, -1)}
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
