import { useCompactHome } from '../home/compact';
import { HomeLoop } from './home/HomeLoop';

// The home screen's 3D scene (none on very small screens: just the title and buttons).
export function HomeScene() {
  const compact = useCompactHome();
  return compact ? null : <HomeLoop />;
}
