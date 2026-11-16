import { useRef, useState, type RefObject } from 'react';
import { useT } from '../../i18n/i18n';
import { storage } from '../../storage';

const widthKey = (levelId: string) => `invariant-frog:code-width:${levelId}`;
const MIN_WIDTH = 150;
const KEY_STEP = 24;

function storedWidth(levelId: string): number | null {
  const w = Number(storage.get(widthKey(levelId)));
  return w >= MIN_WIDTH ? w : null;
}

export function useStoredWidth(levelId: string) {
  const [width, setWidth] = useState(() => storedWidth(levelId));
  const save = (w: number | null) => storage.set(widthKey(levelId), w === null ? null : String(w));
  return { width, setWidth, save };
}

export function ResizeHandle({ cardRef, size, hidden }: { cardRef: RefObject<HTMLDivElement | null>; size: ReturnType<typeof useStoredWidth>; hidden: boolean }) {
  const { width, setWidth, save } = size;
  const drag = useRef<{ x: number; width: number; max: number } | null>(null);
  const tr = useT();

  const naturalWidth = () => {
    const el = cardRef.current!;
    const { width, maxWidth } = el.style;
    Object.assign(el.style, { width: 'max-content', maxWidth: 'none' });
    const natural = el.getBoundingClientRect().width;
    Object.assign(el.style, { width, maxWidth });
    return natural;
  };
  const maxWidth = () => Math.min(naturalWidth(), window.innerWidth - cardRef.current!.getBoundingClientRect().left - 16);
  const resize = (to: number, max = maxWidth()) => {
    const w = Math.round(Math.min(max, Math.max(MIN_WIDTH, to)));
    setWidth(w);
    return w;
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={tr.code.resize}
      aria-valuenow={width ?? undefined}
      tabIndex={0}
      title={tr.code.resize}
      hidden={hidden}
      className="group absolute inset-y-3 -right-[8.5px] z-10 flex w-4 cursor-col-resize touch-none items-center justify-center rounded-full outline-none"
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, width: cardRef.current!.getBoundingClientRect().width, max: maxWidth() };
      }}
      onPointerMove={(e) => {
        if (drag.current) resize(drag.current.width + e.clientX - drag.current.x, drag.current.max);
      }}
      onLostPointerCapture={() => {
        if (drag.current) save(Math.round(cardRef.current!.getBoundingClientRect().width));
        drag.current = null;
      }}
      onDoubleClick={() => {
        setWidth(null);
        save(null);
      }}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowRight' ? KEY_STEP : e.key === 'ArrowLeft' ? -KEY_STEP : 0;
        if (!step) return;
        e.preventDefault();
        save(resize(cardRef.current!.getBoundingClientRect().width + step));
      }}
    >
      <span className="h-10 w-1.5 rounded-full bg-white shadow-[0_0_0_1px_rgb(32_44_70/0.2)] transition-colors group-hover:bg-brand group-focus-visible:bg-brand group-active:bg-brand" />
    </div>
  );
}
