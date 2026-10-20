import { useLang } from '../i18n/i18n';
import { groupsKo as groupsKoAtLoad, levelsKo as levelsKoAtLoad } from './catalog.ko';
import type { LevelDef } from './level';

let groupsKo = groupsKoAtLoad;
let levelsKo = levelsKoAtLoad;

export interface LevelText {
  title: string;
  intro?: string;
  hints?: string[];
  pitfalls?: string[];
}

export function localizeLevel(def: LevelDef): LevelDef {
  const text = useLang.getState().lang === 'ko' ? levelsKo[def.id] : undefined;
  if (!text) return def;
  return {
    ...def,
    title: text.title,
    intro: text.intro ?? def.intro,
    hints: text.hints ?? def.hints,
    pitfalls: def.pitfalls?.map((p, k) => ({ ...p, message: text.pitfalls?.[k] ?? p.message })),
  };
}

export function groupName(name: string): string {
  return (useLang.getState().lang === 'ko' && groupsKo[name]) || name;
}

if (import.meta.hot) {
  import.meta.hot.accept('./catalog.ko', (m) => {
    if (!m) return;
    groupsKo = m.groupsKo;
    levelsKo = m.levelsKo;
    useLang.setState((s) => ({ rev: s.rev + 1 }));
  });
}
