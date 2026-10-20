import { ArrowLeft, ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import { useGame, type CaptionTone } from '../../game/store';
import { useT } from '../../i18n/i18n';
import { button } from '../classes';
import { Markdown } from '../Markdown';
import { useLingering } from '../../hooks/presence';

const TONE: Record<CaptionTone, string> = {
  info: 'border-line',
  muted: 'border-line text-muted',
  fail: 'border-fail/35',
  success: 'border-pass/40',
};

export function CaptionBar() {
  const { value: caption, leaving } = useLingering(useGame((s) => s.caption));
  const pitfall = useGame((s) => s.pitfallMessage);
  const back = useGame((s) => (s.mode === 'tutorial' ? s.back : null));
  const tr = useT();
  if (!caption) return null;
  const replay = caption.action?.label === tr.caption.replay;
  return (
    <div
      key={caption.text}
      data-caption
      className={`flex flex-col gap-2.5 rounded-2xl border-2 bg-card py-3.5 pr-4 pl-4.5 text-md shadow-card backdrop-blur-md transition-colors duration-200 max-sm:gap-2 max-sm:py-2.75 max-sm:pr-3 max-sm:pl-3.5 max-sm:text-sm max-sm:leading-[1.45] ${TONE[caption.tone]} ${leaving ? 'pointer-events-none animate-sink-out' : 'animate-rise'}`}
    >
      <div>
        <Markdown text={caption.text} />
        {pitfall && caption.tone === 'fail' && !caption.text.includes(pitfall) && (
          <div className="mt-1.5 text-sm text-muted">
            <Markdown text={pitfall} />
          </div>
        )}
      </div>
      {(caption.secondary || caption.action || caption.choices || back) && (
        <div className="flex min-h-8.5 flex-wrap items-center justify-end gap-1.5">
          {back && (
            <button className={button('quiet', 'sm')} onClick={back}>
              <ArrowLeft size={15} strokeWidth={2.4} /> {tr.caption.back}
            </button>
          )}
          <span className="flex-1" />
          {caption.choices?.map((c) => (
            <button key={c.label} className={button('plain', 'sm')} onClick={c.onClick}>
              {c.tone === 'yes' && <Check size={15} strokeWidth={2.6} className="text-pass" />}
              {c.tone === 'no' && <X size={15} strokeWidth={2.6} className="text-fail" />}
              {c.label}
            </button>
          ))}
          {caption.secondary && (
            <button className={button('quiet', 'sm')} onClick={caption.secondary.onClick}>
              <RotateCcw size={15} strokeWidth={2.4} />
              {caption.secondary.label}
            </button>
          )}
          {caption.action && (
            <button className={button('primary', 'sm')} disabled={caption.action.disabled} onClick={() => caption.action!.onClick()}>
              {replay ? <RotateCcw size={15} strokeWidth={2.4} /> : null}
              {caption.action.label}
              {!replay ? <ArrowRight size={15} strokeWidth={2.4} /> : null}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
