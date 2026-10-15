import { create } from 'zustand';

// Home screen drafts, switchable live so they can be compared in the real
// scene. The choice is remembered per browser; ?home=<id> picks one directly.

export const HOME_DRAFTS = [
  { id: 'a', name: 'Mini level', note: 'Standing 3D title; on the right, eggs hatch and frogs hop to the goals of the tutorial level.' },
  { id: 'b', name: 'Platforms', note: 'Title words on area slabs; a close-up of a goal corner.' },
  { id: 'c', name: 'Plaque', note: 'Title on a blue sign the frog peeks over; a wider view of many frogs reaching the goals.' },
  { id: 'd', name: 'Before', note: 'The previous Editorial draft, for comparison.' },
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
