import { ArrowLeft, BookOpen, CircleCheck, CircleDashed, CircleHelp, CircleX, LoaderCircle } from 'lucide-react';
import { playCounterexample } from '../../director/verdicts';
import { goMenu } from '../../game/actions';
import { useGame } from '../../game/store';
import { RULE_NAMES, RULES } from '../../levels/level';

// The top bar: back, the level's name, the three rule lights (a failed one
// replays its counterexample) and the rules card.

export function TopBar() {
  const level = useGame((s) => s.level);
  const mode = useGame((s) => s.mode);
  const lights = useGame((s) => s.reveal.lights);
  const verdicts = useGame((s) => s.verdicts);
  const checking = useGame((s) => s.checking);
  const busy = useGame((s) => s.busy);
  const spot = useGame((s) => s.spotlight);
  if (!level) return null;
  return (
    <div className="topbar">
      <div className="pill-group">
        {/* just an arrow: the level's name is what this pill is about */}
        <button
          className="btn ghost icon-btn round-btn"
          title={mode === 'tutorial' ? 'Home' : 'All levels'}
          aria-label={mode === 'tutorial' ? 'Home' : 'All levels'}
          onClick={() => goMenu(mode === 'tutorial' ? 'home' : 'levels')}
        >
          <ArrowLeft size={17} strokeWidth={2.4} />
        </button>
        <div className="level-title">
          {mode === 'level' && <span className="level-id">{level.id}</span>}
          {level.title}
        </div>
      </div>
      <div className={`pill-group ${spot === 'lights' ? 'spotlight' : ''}`}>
        {RULES
          .filter((r) => lights.includes(r))
          .map((r) => {
            const v = verdicts[r];
            const status = checking && !v ? 'checking' : (v?.status ?? 'idle');
            return (
              <button
                key={r}
                className={`light ${status}`}
                disabled={busy || v?.status !== 'fail'}
                title={v?.status === 'fail' ? 'Replay the counterexample' : RULE_NAMES[r]}
                onClick={() => v?.status === 'fail' && void playCounterexample(v.cex)}
              >
                <LightIcon status={status} />
                {RULE_NAMES[r]}
              </button>
            );
          })}
        <button className="btn ghost icon-btn" onClick={() => useGame.setState({ showRules: true })}>
          <BookOpen size={16} strokeWidth={2.2} /> Rules
        </button>
      </div>
    </div>
  );
}

function LightIcon({ status }: { status: string }) {
  if (status === 'pass') return <CircleCheck size={16} strokeWidth={2.4} />;
  if (status === 'fail') return <CircleX size={16} strokeWidth={2.4} />;
  if (status === 'undecided') return <CircleHelp size={16} strokeWidth={2.4} />;
  if (status === 'checking') return <LoaderCircle size={16} strokeWidth={2.4} className="spin" />;
  return <CircleDashed size={16} strokeWidth={2.2} />;
}
