import { create } from 'zustand';
import { storage } from '../storage';
import { en, type Messages } from './en';
import { ko } from './ko';

export type Lang = 'en' | 'ko';

const MESSAGES: Record<Lang, Messages> = { en, ko };
const KEY = 'invariant-frog:lang';
const inBrowser = typeof window !== 'undefined';

function initialLang(): Lang {
  if (!inBrowser) return 'en';
  const saved = storage.get(KEY);
  if (saved === 'en' || saved === 'ko') return saved;
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export const useLang = create<{
  lang: Lang;
  rev: number;
}>(() => ({ lang: initialLang(), rev: 0 }));

function applyToDocument(lang: Lang) {
  if (inBrowser) document.documentElement.lang = lang;
}
applyToDocument(useLang.getState().lang);

export function setLang(lang: Lang) {
  useLang.setState({ lang });
  applyToDocument(lang);
  storage.set(KEY, lang);
}

export const t = (): Messages => MESSAGES[useLang.getState().lang];

export function useT(): Messages {
  useLang((s) => s.rev);
  return MESSAGES[useLang((s) => s.lang)];
}

if (import.meta.hot) {
  import.meta.hot.accept(['./en', './ko'], ([newEn, newKo]) => {
    if (newEn) MESSAGES.en = newEn.en;
    if (newKo) MESSAGES.ko = newKo.ko;
    useLang.setState((s) => ({ rev: s.rev + 1 }));
  });
}
