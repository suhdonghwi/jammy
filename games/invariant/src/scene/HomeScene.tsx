import { useHomeDraft } from '../home/drafts';
import { EditorialHome } from './home/Editorial';
import { MiniLevel } from './home/MiniLevel';

// The home screen's 3D scene, in whichever draft is being tried out.

export function HomeScene() {
  const draft = useHomeDraft((s) => s.draft);
  switch (draft) {
    case 'b':
      return <MiniLevel key="b" framing="corner" shift={1.25} />;
    case 'c':
      return <MiniLevel key="c" framing="overview" shift={1.25} />;
    case 'd':
      return <EditorialHome key="d" />;
    default:
      return <MiniLevel key="a" framing="simple" shift={1.25} />;
  }
}
