import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/nunito';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import './styles.css';
import { cameraRig } from './scene/cameraRig';
import { useGame } from './game/store';
import { check, openLevel, openTutorial } from './game/actions';
import { levels } from './levels/catalog';
import { frogWorld } from './scene/frogs/frogWorld';
import { handState } from './scene/hand/handState';

if (import.meta.env.DEV) {
  Object.assign(window, {
    __rig: cameraRig,
    __game: useGame,
    __open: (id: string) => (id === 'tutorial' ? openTutorial() : openLevel(levels.find((l) => l.id === id)!)),
    __check: check,
    __frogs: frogWorld,
    __hand: handState,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
