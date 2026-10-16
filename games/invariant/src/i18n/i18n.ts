import { create } from 'zustand';
import { en, type Messages } from './en';
import { ko } from './ko';

// The language the game speaks: English or Korean. The choice is remembered;
// a first visit follows the browser's language. Text is looked up when it is
// shown, so a caption already on screen keeps the language it was said in.

export type Lang = 'en' | 'ko';

const MESSAGES: Record<Lang, Messages> = { en, ko };
const KEY = 'invariant-frog:lang';
// outside a browser (tests, level validation) the game speaks English
const inBrowser = typeof window !== 'undefined';

function initialLang(): Lang {
  if (!inBrowser) return 'en';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'ko') return saved;
  } catch {
    // storage blocked: fall back to the browser's language
  }
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export const useLang = create<{
  lang: Lang;
  /** Bumped when text is edited in development (see the bottom of this file), so what is on screen re-renders with it. */
  rev: number;
}>(() => ({ lang: initialLang(), rev: 0 }));

/** The page's `lang` attribute: screen readers, and Korean line breaking (styles.css). */
function applyToDocument(lang: Lang) {
  if (inBrowser) document.documentElement.lang = lang;
}
applyToDocument(useLang.getState().lang);

export function setLang(lang: Lang) {
  useLang.setState({ lang });
  applyToDocument(lang);
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // not remembered, but still switched
  }
}

/** The current language's messages, for text built outside React (captions, errors). */
export const t = (): Messages => MESSAGES[useLang.getState().lang];

/** The current language's messages in a component (it re-renders when the language changes). */
export function useT(): Messages {
  useLang((s) => s.rev);
  return MESSAGES[useLang((s) => s.lang)];
}

/** `a, b and c` in the current language. */
export function listNames(names: string[]): string {
  const and = t().and;
  return names.length > 1 ? `${names.slice(0, -1).join(', ')}${and}${names[names.length - 1]}` : (names[0] ?? '');
}

// Editing a message file swaps its text in, rather than reloading the page
// (which would send a playtester back to the start of the tutorial). Text
// already said, like the caption on screen, keeps its old wording.
if (import.meta.hot) {
  import.meta.hot.accept(['./en', './ko'], ([newEn, newKo]) => {
    if (newEn) MESSAGES.en = newEn.en;
    if (newKo) MESSAGES.ko = newKo.ko;
    useLang.setState((s) => ({ rev: s.rev + 1 }));
  });
}
