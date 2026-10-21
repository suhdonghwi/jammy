import { useEffect } from 'react';
import { useT } from '../i18n/i18n';
import { startScene } from '../scene/sceneTime';
import { button, CARD } from './classes';

export function Trouble({ reason }: { reason: 'webgl' | 'crash' }) {
  const tr = useT().trouble;
  useEffect(() => startScene(), []);
  return (
    <div role="alert" className="fixed inset-0 flex items-center justify-center p-6">
      <div className={`${CARD} max-w-md px-7 py-6 text-center`}>
        <h1 className="mb-2 font-display text-xl font-semibold text-ink">{reason === 'webgl' ? tr.webglTitle : tr.crashTitle}</h1>
        <p className="mb-5 text-md leading-[1.55] text-muted">{reason === 'webgl' ? tr.webgl : tr.crash}</p>
        <button className={button('primary')} onClick={() => location.reload()}>
          {tr.reload}
        </button>
      </div>
    </div>
  );
}
