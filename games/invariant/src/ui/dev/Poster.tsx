import { Title3D } from '../home/title/Title3D';

export function Poster() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-white/45 backdrop-blur-[3px]">
      <h1>
        <span className="sr-only">Invariant Frog</span>
        <Title3D width="w-[62vw]" align="center" still />
      </h1>
    </div>
  );
}
