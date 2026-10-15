import { Check } from 'lucide-react';
import { useGame } from '../../game/store';
import { displayNames } from '../../levels/level';
import { button } from '../classes';
import { closeDialog, Dialog } from '../Dialog';
import { MarkdownInline } from '../Markdown';

// What can be typed into the area box, as a card over everything (from the
// top bar). The examples use the open level's own variables.

export function SyntaxCard() {
  const level = useGame((s) => s.level);
  const [a, b] = level ? displayNames(level) : ['i', 'n'];
  const c = level?.names.find((n) => n !== a && n !== b);
  return (
    <Dialog flag="showSyntax">
      <h2 className="mb-1.5 font-display text-2xl font-semibold">Writing a condition</h2>
      <p className="my-4 leading-[1.55] text-muted">
        A condition on the program's variables{c ? ` (${a}, ${b} and ${c})` : ` (${a} and ${b})`}. The tiles where it is true are your area.
      </p>
      <div className="my-4.5 grid gap-2 text-left">
        <Row name="Compare" code={[`${a} == ${b}`, `${a} != ${b}`, `${a} < ${b}`, `${a} <= ${b}`]} note="also `>` and `>=`" />
        <Row name="Chain" code={[`0 <= ${a} <= ${b}`]} note={`the same as \`0 <= ${a} && ${a} <= ${b}\``} />
        <Row name="Combine" code={[`${a} >= 0 && ${a} <= ${b}`, `${a} == 0 || ${a} == ${b}`, `!(${a} > ${b})`]} note="and, or, not" />
        <Row name="Arithmetic" code={[`${b} == 2 * ${a}`, `(${a} + ${b}) % 2 == 0`, `${a} / 3 == 1`]} note="`+` `-` `*` and, by a positive number, `/` and `%`" />
        <Row name="Functions" code={[`abs(${a})`, `min(${a}, ${b})`, `max(${a}, ${b})`]} />
        <Row name="Constants" code={['true', 'false']} note="whole numbers, with no limit and no overflow" />
      </div>
      <button className={button('primary')} onClick={() => closeDialog('showSyntax')}>
        <Check size={17} strokeWidth={2.6} /> Got it
      </button>
    </Dialog>
  );
}

function Row({ name, code, note }: { name: string; code: string[]; note?: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 rounded-2xl bg-sky px-4 py-2.5 max-sm:grid-cols-1 max-sm:gap-1">
      <div className="font-display text-md font-semibold">{name}</div>
      <div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {code.map((s) => (
            <code key={s} className="rounded-md bg-white px-1.5 py-px font-mono text-sm whitespace-nowrap">
              {s}
            </code>
          ))}
        </div>
        {note && (
          <div className="mt-1 text-sm text-muted">
            <MarkdownInline text={note} />
          </div>
        )}
      </div>
    </div>
  );
}
