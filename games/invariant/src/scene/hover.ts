import { create } from 'zustand';

export const useHover = create<{ tile: [number, number] | null }>(() => ({ tile: null }));

export const hover = {
  get tile() {
    return useHover.getState().tile;
  },
  set(t: [number, number] | null) {
    const cur = useHover.getState().tile;
    if (cur === t || (cur && t && cur[0] === t[0] && cur[1] === t[1])) return;
    useHover.setState({ tile: t });
  },
};
