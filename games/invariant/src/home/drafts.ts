import { create } from 'zustand';

// Home screen drafts, switchable live so they can be compared in the real
// scene. The choice is remembered per browser; ?home=<id> picks one directly.

export const HOME_DRAFTS = [
  { id: 'a', name: 'Pools & eggs', note: 'Frogs loop the area and splash through two goal pools on its corners; eggs rest inside.' },
  { id: 'b', name: 'Stripes', note: 'Beside the area, a striped zone where the loop would stop, with goal pools on its edge.' },
  { id: 'c', name: 'Garden', note: 'A pond in the middle of the area, frogs circling it; eggs waiting around the outside.' },
  { id: 'd', name: 'Before', note: 'The previous draft: just the loop.' },
] as const;

export type HomeDraftId = (typeof HOME_DRAFTS)[number]['id'];

const KEY = 'invariant-frog:home-draft';
const isDraft = (v: string | null): v is HomeDraftId => HOME_DRAFTS.some((d) => d.id === v);

function initial(): HomeDraftId {
  try {
    const q = new URLSearchParams(window.location.search).get('home');
    if (isDraft(q)) return q;
    const saved = window.localStorage.getItem(KEY);
    if (isDraft(saved)) return saved;
  } catch {
    // storage can be unavailable; fall back to the default
  }
  return 'a';
}

export const useHomeDraft = create<{ draft: HomeDraftId; setDraft: (d: HomeDraftId) => void }>((set) => ({
  draft: initial(),
  setDraft(draft) {
    try {
      window.localStorage.setItem(KEY, draft);
    } catch {
      // not remembered, but still switches
    }
    set({ draft });
  },
}));
