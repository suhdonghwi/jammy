import { Languages } from 'lucide-react';
import { setLang, useLang, useT, type Lang } from '../../i18n/i18n';
import { PILL } from './CornerControls';

// The language switch in the home screen's corner: English or 한국어, each
// written in its own language. It lives only on the home screen; a level or
// the tutorial speaks the language it was opened in.

const OPTIONS: { lang: Lang; label: string }[] = [
  { lang: 'en', label: 'English' },
  { lang: 'ko', label: '한국어' },
];

/** Fredoka for Latin letters, then the system's own fonts (no Korean web font) for Hangul. */
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
          // "한국어" is always drawn in a system font: in the display font it
          // alone would download the Korean display font on an English page
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
