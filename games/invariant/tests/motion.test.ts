import { describe, expect, it } from 'vitest';
import { DIP, FLIGHT_MAX, FLIGHT_MIN, plan, sample, STILL, velocity, type Pose } from '../src/scene/flight';
import { planeWave, waveLength, waveMix } from '../src/scene/planeShift';

const at = (x: number, y: number, d = 14): Pose => ({ x, y, d, az: 0.26, po: 0.8 });

describe('camera flights', () => {
  it('take longer for longer trips, within bounds', () => {
    const near = plan(at(0, 0), at(1, 0)).dur;
    const mid = plan(at(0, 0), at(14, 0)).dur;
    const far = plan(at(0, 0), at(60, 0)).dur;
    expect(near).toBeGreaterThanOrEqual(FLIGHT_MIN);
    expect(mid).toBeGreaterThan(near);
    expect(far).toBeGreaterThanOrEqual(mid);
    expect(far).toBeLessThanOrEqual(FLIGHT_MAX);
  });

  it('keep peak speed proportionate to the distance travelled', () => {
    const f = plan(at(0, 0), at(30, 0));
    let peak = 0;
    for (let t = 0; t <= f.dur; t += 0.01) peak = Math.max(peak, Math.abs(velocity(f, t).x));
    expect(peak).toBeLessThan((30 / f.dur) * 2);
  });

  it('start and end at rest and land exactly', () => {
    const f = plan(at(0, 0), at(10, 4));
    expect(Math.abs(velocity(f, 0).x)).toBeLessThan(0.5);
    const end = sample(f, f.dur);
    expect(end.done).toBe(true);
    expect(end.pose.x).toBeCloseTo(10);
    expect(end.pose.y).toBeCloseTo(4);
    expect(end.pose.d).toBeCloseTo(14);
  });

  it('pull back on long trips and come down again', () => {
    const f = plan(at(0, 0), at(40, 0));
    expect(f.lift).toBeGreaterThan(0);
    expect(sample(f, f.dur / 2).pose.d).toBeGreaterThan(14);
    expect(sample(f, f.dur).pose.d).toBeCloseTo(14);
  });

  it('turn the short way round', () => {
    const f = plan({ ...at(0, 0), az: 3 }, { ...at(0, 0), az: -3 });
    expect(Math.abs(f.to.az - f.from.az)).toBeLessThan(Math.PI);
  });

  it('carry the old velocity into a retarget without a kink', () => {
    const first = plan(at(0, 0), at(20, 0));
    const t = first.dur * 0.4;
    const from = sample(first, t).pose;
    const v0 = velocity(first, t);
    const second = plan(from, at(0, 20), v0);
    expect(sample(second, 0).pose.x).toBeCloseTo(from.x);
    expect(velocity(second, 0.001).x).toBeCloseTo(v0.x, 0);
  });

  it('fade through fog for trips past the fog', () => {
    const f = plan(at(0, 0), at(400, 0));
    expect(f.dip).toBe(true);
    expect(f.dur).toBe(DIP);
    expect(sample(f, DIP * 0.39).fog).toBeLessThan(0.1);
    expect(sample(f, DIP * 0.39).pose.x).toBe(0);
    expect(sample(f, DIP * 0.41).pose.x).toBe(400);
    expect(sample(f, DIP).fog).toBe(1);
  });

  it('dip sooner when motion is reduced', () => {
    expect(plan(at(0, 0), at(20, 0), STILL, true).dip).toBe(true);
    expect(plan(at(0, 0), at(20, 0), STILL, false).dip).toBe(false);
  });
});

describe('plane wave', () => {
  const w = planeWave(false);

  it('reaches the centre first and everything by its end', () => {
    expect(waveMix(w, 0.2, 0)).toBeGreaterThan(waveMix(w, 0.2, 6));
    expect(waveMix(w, waveLength(w), 100)).toBe(1);
    expect(waveMix(w, 0, 0)).toBe(0);
  });

  it('is one crossfade when motion is reduced', () => {
    const r = planeWave(true);
    expect(waveMix(r, 0.1, 0)).toBe(waveMix(r, 0.1, 50));
  });
});
