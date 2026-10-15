import { useLang } from '../i18n/i18n';
import { groupsKo as groupsKoAtLoad, levelsKo as levelsKoAtLoad } from './catalog.ko';
import type { LevelDef } from './level';

// A level in the current language: its title, intro, hints and pitfall
// messages swapped for a translation (catalog.ko.ts). The program, formulas
// and everything else stay as they are; English is the catalog itself.

let groupsKo = groupsKoAtLoad;
let levelsKo = levelsKoAtLoad;

/** What a learner reads of a level; pitfall messages in the order of the level's pitfalls. */
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

/** A level group's name (Beginner, …) in the current language. */
export function groupName(name: string): string {
  return (useLang.getState().lang === 'ko' && groupsKo[name]) || name;
}

// Editing the Korean text swaps it in without reloading the page (see
// i18n.ts); a level already open keeps its text until it is opened again.
if (import.meta.hot) {
  import.meta.hot.accept('./catalog.ko', (m) => {
    if (!m) return;
    groupsKo = m.groupsKo;
    levelsKo = m.levelsKo;
    useLang.setState((s) => ({ rev: s.rev + 1 }));
  });
}
