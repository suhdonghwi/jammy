import { Check } from 'lucide-react';
import { button } from '../classes';
import { closeDialog, Dialog } from '../Dialog';
import { ArtExit, ArtInit, ArtPres } from './RuleArt';

// The three rules, as a card over everything (from the top bar, and at the end of the tutorial).

export function RulesCard() {
  return (
    <Dialog flag="showRules" wide>
      <h2 className="mb-1.5 font-display text-2xl font-semibold">The three rules</h2>
      <p className="my-4 leading-[1.55] text-muted">
        An area that passes all three is a loop invariant strong enough to prove the postcondition: every run that stops, stops on a goal — for every
        input.
      </p>
      <div className="my-4.5 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <Rule n={1} name="Init" aka="Initialization" text="Every egg sits on your area." art={<ArtInit />} />
        <Rule
          n={2}
          name="Preservation"
          aka="Maintenance"
          text="A frog on your area that hops lands on your area — any frog, not only ones a real run reaches."
          art={<ArtPres />}
        />
        <Rule n={3} name="Exit" aka="Termination (of the loop)" text="A frog that stops on your area is on a goal." art={<ArtExit />} />
      </div>
      <button className={button('primary')} onClick={() => closeDialog('showRules')}>
        <Check size={17} strokeWidth={2.6} /> Got it
      </button>
    </Dialog>
  );
}

/** One rule: its art, its name (and the textbook name underneath), and what it says. */
function Rule({ n, name, aka, text, art }: { n: number; name: string; aka: string; text: string; art: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-sky p-3">
      <div className="flex justify-center">{art}</div>
      <div className="mt-1 font-display text-lg font-semibold">
        <span className="mr-1 inline-grid size-5.5 place-items-center rounded-md bg-brand text-sm text-white">{n}</span> {name}
      </div>
      <div className="font-display text-xs font-medium tracking-[0.04em] text-faint uppercase">{aka}</div>
      <div className="mt-1 text-sm leading-snug text-muted">{text}</div>
    </div>
  );
}
