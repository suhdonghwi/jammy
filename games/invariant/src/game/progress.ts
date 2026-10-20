import { create } from 'zustand';

const KEY = 'invariant-frog:cleared';

function load(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function save(cleared: string[]) {
  try {
    if (cleared.length) localStorage.setItem(KEY, JSON.stringify(cleared));
    else localStorage.removeItem(KEY);
  } catch {
    // not remembered, but still shown for this visit
  }
}

export const useProgress = create<{ cleared: string[] }>(() => ({
  cleared: typeof window === 'undefined' ? [] : load(),
}));

export function markCleared(id: string) {
  const { cleared } = useProgress.getState();
  if (cleared.includes(id)) return;
  const next = [...cleared, id];
  useProgress.setState({ cleared: next });
  save(next);
}

export function resetCleared() {
  useProgress.setState({ cleared: [] });
  save([]);
}
