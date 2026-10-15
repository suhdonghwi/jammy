import { useHomeDraft } from '../home/drafts';
import { LoopArea } from './home/LoopArea';

// The home screen's 3D scene, in whichever draft is being tried out.

export function HomeScene() {
  const draft = useHomeDraft((s) => s.draft);
  switch (draft) {
    case 'b':
      return <LoopArea key="b" variant="through" />;
    case 'c':
      return <LoopArea key="c" variant="ring" />;
    case 'd':
      return <LoopArea key="d" variant="diagonal" />;
    default:
      return <LoopArea key="a" variant="edge" />;
  }
}
