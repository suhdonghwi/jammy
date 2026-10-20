import { useT } from '../../i18n/i18n';
import { Dialog } from '../Dialog';
import { Markdown } from '../Markdown';
import { ArtTermination, ArtInitialization, ArtMaintenance } from './RuleArt';

export function RulesCard() {
  const tr = useT();
  const card = tr.rulesCard;
  return (
    <Dialog flag="showRules" wide>
      <h2 className="mb-1.5 font-display text-2xl font-semibold max-sm:mb-1 max-sm:text-xl">{card.title}</h2>
      <p className="my-4 leading-[1.55] text-muted max-sm:my-3 max-sm:text-sm max-sm:leading-normal">{card.intro}</p>
      <div className="my-4.5 grid grid-cols-3 gap-3 max-sm:my-3.5 max-sm:grid-cols-1 max-sm:gap-2">
        <Rule n={1} name={tr.rules.initialization} text={card.initialization} code={card.initializationCode} inCode={card.inCode} art={<ArtInitialization />} />
        <Rule n={2} name={tr.rules.maintenance} text={card.maintenance} code={card.maintenanceCode} inCode={card.inCode} art={<ArtMaintenance />} />
        <Rule n={3} name={tr.rules.termination} text={card.termination} code={card.terminationCode} inCode={card.inCode} art={<ArtTermination />} />
      </div>
    </Dialog>
  );
}

function Rule({ n, name, text, code, inCode, art }: { n: number; name: string; text: string; code: string; inCode: string; art: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-sky p-3 max-sm:flex max-sm:items-center max-sm:gap-2.5 max-sm:p-2.5 max-sm:text-left">
      <div className="flex shrink-0 justify-center max-sm:[&_svg]:h-auto max-sm:[&_svg]:w-21">{art}</div>
      <div>
        <div className="mt-1 font-display text-lg font-semibold max-sm:mt-0 max-sm:text-md">
          <span className="mr-1 inline-grid size-5.5 place-items-center rounded-md bg-brand text-sm text-white max-sm:size-5 max-sm:text-xs">{n}</span> {name}
        </div>
        <div className="mt-1 text-sm leading-snug font-semibold text-ink max-sm:mt-0.5">{text}</div>
        <div className="mt-2 border-t border-line pt-1.5 text-xs leading-snug text-muted max-sm:mt-1 max-sm:pt-1">
          <div className="mb-0.5 font-display font-semibold tracking-[0.06em] text-faint uppercase">{inCode}</div>
          <Markdown text={code} />
        </div>
      </div>
    </div>
  );
}
