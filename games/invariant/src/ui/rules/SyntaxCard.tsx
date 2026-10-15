import { Check } from 'lucide-react';
import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { displayNames } from '../../levels/level';
import { button } from '../classes';
import { HighlightedCode } from '../codeColors';
import { closeDialog, Dialog } from '../Dialog';

// What can be typed into the area box, as a card over everything (from the
// top bar): examples only, coloured like the code, using the open level's own
// variables.

export function SyntaxCard() {
  const level = useGame((s) => s.level);
  const [a, b] = level ? displayNames(level) : ['i', 'n'];
  const s = useT().syntax;
  return (
    <Dialog flag="showSyntax">
      <h2 className="mb-1.5 font-display text-2xl font-semibold">{s.title}</h2>
      <div className="my-4.5 grid gap-2 text-left">
        <Row name={s.compare} code={[`${a} == ${b}`, `${a} != ${b}`, `${a} < ${b}`, `${a} <= ${b}`, `${a} > ${b}`, `${a} >= ${b}`, `0 <= ${a} <= ${b}`]} />
        <Row name={s.combine} code={[`${a} >= 0 && ${a} <= ${b}`, `${a} == 0 || ${a} == ${b}`, `!(${a} > ${b})`]} />
        <Row
          name={s.arithmetic}
          code={[`${b} == 2 * ${a}`, `${a} + ${b} < 10`, `${b} - ${a} >= 1`, `(${a} + ${b}) % 2 == 0`, `${a} / 3 == 1`]}
        />
        <Row name={s.functions} code={[`abs(${a}) <= ${b}`, `min(${a}, ${b}) >= 0`, `max(${a}, ${b}) == ${b}`]} />
        <Row name={s.constants} code={['true', 'false']} />
      </div>
      <button className={button('primary')} onClick={() => closeDialog('showSyntax')}>
        <Check size={17} strokeWidth={2.6} /> {s.gotIt}
      </button>
    </Dialog>
  );
}

function Row({ name, code }: { name: string; code: string[] }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-baseline gap-3 rounded-2xl bg-sky px-4 py-2.5 max-sm:grid-cols-1 max-sm:gap-1">
      <div className="font-display text-md font-semibold">{name}</div>
      <div className="flex flex-wrap gap-x-2 gap-y-1.5">
        {code.map((c) => (
          <code key={c} className="rounded-md bg-white px-1.5 py-px font-mono text-sm whitespace-nowrap">
            <HighlightedCode src={c} />
          </code>
        ))}
      </div>
    </div>
  );
}
