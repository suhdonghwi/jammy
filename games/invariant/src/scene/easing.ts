// Small curves for animations on [0, 1].

export const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

/** Eases in and out: 0 → 1 with zero speed at both ends. */
export const smoothstep = (u: number) => u * u * (3 - 2 * u);

/** Pops in: 0 → 1, overshooting a little before it settles. */
export const popIn = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2);

/** 0 at both ends of [0, 1] and 1 in the middle. */
export const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
