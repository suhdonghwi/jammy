export const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

export const smoothstep = (u: number) => u * u * (3 - 2 * u);

export const smootherstep = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

export const easeOut = (u: number) => 1 - (1 - u) ** 3;

export const easeIn = (u: number) => u * u * u;

export const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

export const popIn = (u: number, overshoot = 1.7) => (u <= 0 ? 0 : u >= 1 ? 1 : 1 + (overshoot + 1) * (u - 1) ** 3 + overshoot * (u - 1) ** 2);

export const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));

export const swell = (u: number) => (u <= 0 || u >= 1 ? 0 : 16 * u * u * (1 - u) * (1 - u));

export class Toward {
  private from: number;
  private to: number;
  private t0 = -Infinity;

  constructor(
    value: number,
    private readonly dur: number,
  ) {
    this.from = this.to = value;
  }

  at(target: number, t: number): number {
    if (target !== this.to) {
      this.from = this.value(t);
      this.to = target;
      this.t0 = t;
    }
    return this.value(t);
  }

  private value(t: number): number {
    return this.from + (this.to - this.from) * smootherstep(clamp01((t - this.t0) / this.dur));
  }
}
