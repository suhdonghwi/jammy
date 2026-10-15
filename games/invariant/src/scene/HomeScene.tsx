import { useHomeDraft } from '../home/drafts';
import { ClassicHome } from './home/Classic';
import { EditorialHome } from './home/Editorial';
import { IslandHome } from './home/Island';
import { NightPondHome } from './home/NightPond';
import { PixelTitleHome } from './home/PixelTitle';

// The home screen's 3D scene, in whichever draft is being tried out.

export function HomeScene() {
  const draft = useHomeDraft((s) => s.draft);
  switch (draft) {
    case 'b':
      return <PixelTitleHome key="b" />;
    case 'c':
      return <NightPondHome key="c" />;
    case 'd':
      return <IslandHome key="d" />;
    case 'e':
      return <EditorialHome key="e" />;
    default:
      return <ClassicHome key="a" />;
  }
}
