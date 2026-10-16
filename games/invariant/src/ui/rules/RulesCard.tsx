import { Check } from 'lucide-react';
import { useT } from '../../i18n/i18n';
import { button } from '../classes';
import { closeDialog, Dialog } from '../Dialog';
import { ArtTermination, ArtInitialization, ArtMaintenance } from './RuleArt';

// The three rules, as a card over everything (from the top bar, and at the end of the tutorial).

export function RulesCard() {
  const tr = useT();
  const card = tr.rulesCard;
  return (
    <Dialog flag="showRules" wide>
      <h2 className="mb-1.5 font-display text-2xl font-semibold">{card.title}</h2>
      <p className="my-4 leading-[1.55] text-muted">{card.intro}</p>
      <div className="my-4.5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <Rule n={1} name={tr.rules.initialization} text={card.initialization} art={<ArtInitialization />} />
        <Rule n={2} name={tr.rules.maintenance} text={card.maintenance} art={<ArtMaintenance />} />
        <Rule n={3} name={tr.rules.termination} text={card.termination} art={<ArtTermination />} />
      </div>
      <button className={button('primary')} onClick={() => closeDialog('showRules')}>
        <Check size={17} strokeWidth={2.6} /> {card.gotIt}
      </button>
    </Dialog>
  );
}

/** One rule: its art, its name, and what it says. */
function Rule({ n, name, text, art }: { n: number; name: string; text: string; art: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-sky p-3">
      <div className="flex justify-center">{art}</div>
      <div className="mt-1 font-display text-lg font-semibold">
        <span className="mr-1 inline-grid size-5.5 place-items-center rounded-md bg-brand text-sm text-white">{n}</span> {name}
      </div>
      <div className="mt-1 text-sm leading-snug text-muted">{text}</div>
    </div>
  );
}
