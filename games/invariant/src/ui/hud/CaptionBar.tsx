import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { useGame } from '../../game/store';
import { Markdown } from '../Markdown';
import { useLingering } from '../presence';

// What the game is saying: the caption, with its buttons (and Back, in the tutorial).

export function CaptionBar() {
  // when the caption goes away, the last one fades out
  const { value: caption, leaving } = useLingering(useGame((s) => s.caption));
  const pitfall = useGame((s) => s.pitfallMessage);
  const back = useGame((s) => (s.mode === 'tutorial' ? s.back : null));
  if (!caption) return null;
  return (
    <div className={`caption ${caption.tone} ${leaving ? 'leaving' : ''}`} key={caption.text}>
      <div className="caption-text">
        <Markdown text={caption.text} />
        {pitfall && caption.tone === 'fail' && !caption.text.includes(pitfall) && (
          <div className="caption-pitfall">
            <Markdown text={pitfall} />
          </div>
        )}
      </div>
      {(caption.secondary || caption.action || back) && (
        <div className="caption-actions">
          {/* tutorial: back to the previous step (left), then the step's own buttons */}
          {back && (
            <button className="btn ghost small icon-btn caption-back" onClick={back}>
              <ArrowLeft size={15} strokeWidth={2.4} /> Back
            </button>
          )}
          <span className="spacer" />
          {caption.secondary && (
            <button className="btn ghost small icon-btn" onClick={caption.secondary.onClick}>
              <RotateCcw size={15} strokeWidth={2.4} />
              {caption.secondary.label}
            </button>
          )}
          {caption.action && (
            <button
              className="btn toy primary small icon-btn caption-main"
              onClick={() => caption.action!.onClick()}
            >
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
