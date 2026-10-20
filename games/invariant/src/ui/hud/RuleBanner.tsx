import { CircleCheck, CircleHelp, CircleX, LoaderCircle } from 'lucide-react';
import { useGame } from '../../game/store';
import { useLingering } from '../../hooks/presence';
import { useT } from '../../i18n/i18n';

const TONE = {
  checking: 'bg-ink/86',
  pass: 'bg-tag-good',
  fail: 'bg-tag-fail',
  undecided: 'bg-warn',
};

export function RuleBanner() {
  const { value: banner, leaving } = useLingering(useGame((s) => s.ruleBanner));
  const tr = useT();
  if (!banner) return null;
  const { rule, status } = banner;
  return (
    <div
      key={rule}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-white shadow-card transition-colors duration-200 max-sm:mx-4 max-sm:px-3 max-sm:py-1.5 ${TONE[status]} ${leaving ? 'animate-tag-out' : 'animate-tag-in'}`}
    >
      <span key={status} className="grid animate-[pop_0.35s_ease-out] place-items-center">
        {status === 'checking' && <LoaderCircle size={18} strokeWidth={2.6} className="animate-spin" />}
        {status === 'pass' && <CircleCheck size={18} strokeWidth={2.6} />}
        {status === 'fail' && <CircleX size={18} strokeWidth={2.6} />}
        {status === 'undecided' && <CircleHelp size={18} strokeWidth={2.6} />}
      </span>
      <span className="font-display text-md font-semibold">{tr.rules[rule]}</span>
      <span className="text-sm opacity-85 max-sm:hidden">{tr.rulesCard[rule]}</span>
    </div>
  );
}
