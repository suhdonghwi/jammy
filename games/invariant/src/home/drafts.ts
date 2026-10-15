import { create } from 'zustand';

// Home screen drafts, switchable live so they can be compared in the real
// scene. The choice is remembered per browser; ?home=<id> picks one directly.

export const HOME_DRAFTS = [
  { id: 'a', name: 'Classic', note: 'The current title over a loop of slabs.' },
  { id: 'b', name: 'Pixel title', note: 'The title is spelled in area slabs; frogs never step off the letters.' },
  { id: 'c', name: 'Night pond', note: 'A dark world of glowing goal pools.' },
  { id: 'd', name: 'Floating island', note: 'A little island of slabs drifting in a pastel sky.' },
  { id: 'e', name: 'Editorial', note: 'Big type on the left; one curious frog and the skeptical hand on the right.' },
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
