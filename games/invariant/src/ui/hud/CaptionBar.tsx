import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { useGame, type CaptionTone } from '../../game/store';
import { button } from '../classes';
import { Markdown } from '../Markdown';
import { useLingering } from '../presence';

// What the game is saying: the caption, with its buttons (and Back, in the tutorial).

const TONE: Record<CaptionTone, string> = {
  info: 'border-line bg-card',
  muted: 'border-line bg-card text-muted',
  fail: 'border-fail/25 bg-[#fff7f7]/94',
  success: 'border-pass/30 bg-[#f5fcf3]/95',
};

export function CaptionBar() {
  // when the caption goes away, the last one fades out
  const { value: caption, leaving } = useLingering(useGame((s) => s.caption));
  const pitfall = useGame((s) => s.pitfallMessage);
  const back = useGame((s) => (s.mode === 'tutorial' ? s.back : null));
  if (!caption) return null;
  return (
    <div
      key={caption.text}
      // the text gets the full width; the buttons sit on their own row below
      className={`flex flex-col gap-2.5 rounded-2xl border py-3.5 pr-4 pl-4.5 text-md shadow-card backdrop-blur-md ${TONE[caption.tone]} ${leaving ? 'pointer-events-none animate-sink-out' : 'animate-rise'}`}
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
        <div className="flex items-center justify-end gap-1.5">
          {/* tutorial: back to the previous step (left), then the step's own buttons */}
          {back && (
            <button className={button('quiet', 'sm')} onClick={back}>
              <ArrowLeft size={15} strokeWidth={2.4} /> Back
            </button>
          )}
          <span className="flex-1" />
          {/* a question: its answers, side by side */}
          {caption.choices?.map((c) => (
            <button key={c.label} className={button('plain', 'sm')} onClick={c.onClick}>
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
            <button className={button('primary', 'sm')} onClick={() => caption.action!.onClick()}>
              {caption.action.label === 'Replay' ? <RotateCcw size={15} strokeWidth={2.4} /> : null}
              {caption.action.label}
              {caption.action.label !== 'Replay' ? <ArrowRight size={15} strokeWidth={2.4} /> : null}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
