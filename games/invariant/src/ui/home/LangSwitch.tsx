import { Languages } from 'lucide-react';
import { setLang, useLang, useT, type Lang } from '../../i18n/i18n';
import { PILL } from './CornerControls';

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'ko', label: '한국어' },
];

const HANGUL_SYSTEM = "font-['Fredoka',ui-rounded,system-ui,sans-serif]";

export function LangSwitch() {
  const current = useLang((s) => s.lang);
  const tr = useT();
  return (
    <div role="group" aria-label={tr.home.language} className={`${PILL} gap-1 pl-2.5`}>
      <Languages size={15} strokeWidth={2.2} className="mr-0.5 text-faint" aria-hidden />
      {OPTIONS.map((o) => (
        <button
          key={o.lang}
          lang={o.lang}
          aria-pressed={o.lang === current}
          className={`cursor-pointer rounded-full px-3 py-1 ${o.lang === 'ko' ? HANGUL_SYSTEM : 'font-display'} text-sm font-medium transition-colors duration-150 ${
            o.lang === current ? 'bg-brand text-white' : 'text-muted hover:bg-shade/6 hover:text-ink'
          }`}
          onClick={() => setLang(o.lang)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
