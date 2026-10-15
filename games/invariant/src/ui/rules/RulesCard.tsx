import { Check } from 'lucide-react';
import { useGame } from '../../game/store';
import { usePresence } from '../presence';
import { ArtExit, ArtInit, ArtPres } from './RuleArt';

// The three rules, as a card over everything (from the top bar, and at the end of the tutorial).

export function RulesCard() {
  const { mounted, leaving } = usePresence(useGame((s) => s.showRules));
  if (!mounted) return null;
  const close = () => useGame.setState({ showRules: false });
  return (
    <div className={`modal-backdrop ${leaving ? 'leaving' : ''}`} onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>The three rules</h2>
        <p className="modal-sub">If your area passes all three, every frog — for every input — stops on a goal.</p>
        <div className="rules">
          <Rule n={1} name="Init" text="Every egg sits on your area." art={<ArtInit />} />
          <Rule n={2} name="Preservation" text="A frog on your area that hops lands on your area." art={<ArtPres />} />
          <Rule n={3} name="Exit" text="A frog that stops on your area is on a goal." art={<ArtExit />} />
        </div>
        <button className="btn toy primary icon-btn" onClick={close}>
          <Check size={17} strokeWidth={2.6} /> Got it
        </button>
      </div>
    </div>
  );
}

function Rule({ n, name, text, art }: { n: number; name: string; text: string; art: React.ReactNode }) {
  return (
    <div className="rule">
      <div className="rule-art">{art}</div>
      <div className="rule-name">
        <span className="rule-n">{n}</span> {name}
      </div>
      <div className="rule-text">{text}</div>
    </div>
  );
}
