import { create } from 'zustand';

// Home screen drafts, switchable live so they can be compared in the real
// scene. The choice is remembered per browser; ?home=<id> picks one directly.

export const HOME_DRAFTS = [
  { id: 'a', name: 'Edge', note: 'The striped zone starts right at the edge of the area, with two goal pools on it.' },
  { id: 'b', name: 'Through', note: "The area's last column lies in the striped zone; frogs splash through its pools every lap." },
  { id: 'c', name: 'Ring', note: 'Frogs circle a ring of slabs around a small striped pond with two pools.' },
  { id: 'd', name: 'Diagonal', note: "The counter's world: stripes below a diagonal of pools, the loop above it." },
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
