import { useGame } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { scalarNames } from '../../levels/level';
import { HighlightedCode } from '../codeColors';
import { Dialog } from '../Dialog';

export function SyntaxCard() {
  const level = useGame((s) => s.level);
  const [a, b] = level ? scalarNames(level) : ['i', 'n'];
  const arr = level ? Object.entries(level.arrays)[0] : undefined;
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
        {arr && (
          <Row
            name={s.arrays}
            code={[`${arr[0]}[${a}] == ${b}`, `forall 0 <= k < ${a}: ${arr[0]}[k] <= ${b}`, `exists 0 <= k < ${arr[1]}: ${arr[0]}[k] == ${b}`, `forall 0 <= j <= k < ${arr[1]}: ${arr[0]}[j] <= ${arr[0]}[k]`]}
          />
        )}
        <Row name={s.constants} code={['true', 'false']} />
      </div>
    </Dialog>
  );
}

function Row({ name, code }: { name: string; code: string[] }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-baseline gap-3 rounded-2xl bg-sky px-4 py-2.5 max-sm:grid-cols-1 max-sm:gap-1">
      <div className="font-display text-md font-semibold">{name}</div>
      <div className="flex min-w-0 flex-wrap gap-x-2 gap-y-1.5">
        {code.map((c) => (
          <code key={c} className="max-w-full rounded-md bg-white px-1.5 py-px font-mono text-sm">
            <HighlightedCode src={c} />
          </code>
        ))}
      </div>
    </div>
  );
}
