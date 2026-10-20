import { World } from '../../scene/World';
import { Title3D } from '../home/title/Title3D';

// The link preview image (og.png), drawn by the game itself: the 3D title,
// large, centred and standing straight (without its wave), over the home
// screen's scene softened behind a white haze. In development only, at
// `?poster`; scripts/make-og.ts opens it, screenshots it and writes
// public/og.png.

export function Poster() {
  return (
    <div className="fixed inset-0">
      <div className="fixed inset-0 bg-linear-to-b from-sky via-horizon via-60% to-[#e3e8ef]">
        <World />
      </div>
      <div className="fixed inset-0 grid place-items-center bg-white/45 backdrop-blur-[3px]">
        <h1>
          <span className="sr-only">Invariant Frog</span>
          <Title3D width="w-[62vw]" align="center" still />
        </h1>
      </div>
    </div>
  );
}
