export const MICRO = 0.12;
export const SHORT = 0.2;
export const EXIT = 0.15;
export const BASE = 0.34;
export const LONG = 0.5;

export const TICK = 0.09;
export const BEAT = 0.25;
export const HOLD = 1;

// keep in step with --duration-exit in styles.css
export const EXIT_MS = EXIT * 1000;

export const ms = (seconds: number) => seconds * 1000;

const REDUCE = '(prefers-reduced-motion: reduce)';
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia(REDUCE).matches;
