export const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

export const smoothstep = (u: number) => u * u * (3 - 2 * u);

export const popIn = (u: number, overshoot = 1.7) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 + (overshoot + 1) * (u - 1) ** 3 + overshoot * (u - 1) ** 2);

export const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
