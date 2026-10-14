import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { cameraRig } from './scene/cameraRig';
import { useGame } from './store/game';

if (import.meta.env.DEV) Object.assign(window, { __rig: cameraRig, __game: useGame });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
