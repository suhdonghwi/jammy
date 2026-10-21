import { create } from 'zustand';
import { storage } from '../storage';

const KEY = 'invariant-frog:cleared';

function load(): string[] {
  try {
    const saved: unknown = JSON.parse(storage.get(KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function save(cleared: string[]) {
  storage.set(KEY, cleared.length ? JSON.stringify(cleared) : null);
}

export const useProgress = create<{ cleared: string[] }>(() => ({ cleared: load() }));

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
