import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/nunito';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import './styles.css';
import { cameraRig } from './scene/cameraRig';
import { useGame } from './store/game';
import { openLevel, openTutorial, check } from './director/play';
import { allLevels } from './levels/defs';
import { director } from './director/director';

if (import.meta.env.DEV) {
  Object.assign(window, {
    __rig: cameraRig,
    __game: useGame,
    __open: (id: string) => (id === 'tutorial' ? openTutorial() : openLevel(allLevels.find((l) => l.id === id)!)),
    __check: check,
    __director: director,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
