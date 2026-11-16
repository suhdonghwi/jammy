import { describe, expect, it } from 'vitest';
import { FLIGHT_MAX, FLIGHT_MIN, HIGHEST, plan, sample, STILL, velocity, type Pose } from '../src/scene/flight';
import { BOARD_OUT, boardAt, direction, PLANE_SHIFT } from '../src/scene/planeShift';

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

  it('pull back further the further they go, never past the highest view', () => {
    const lift = (x: number) => plan(at(0, 0), at(x, 0)).lift;
    expect(lift(10)).toBe(0);
    expect(lift(100)).toBeGreaterThan(lift(40));
    const far = plan(at(0, 0), at(1000, 0));
    expect(sample(far, far.dur / 2).pose.d).toBeCloseTo(HIGHEST);
  });

  it('do not pull back when motion is reduced', () => {
    expect(plan(at(0, 0), at(100, 0), STILL, true).lift).toBe(0);
  });
});

describe('board swap', () => {
  it('drops the old board, then brings the new one in from the other side', () => {
    const early = boardAt(BOARD_OUT * 0.5, 1);
    expect(early.prev).toBe(true);
    expect(early.y).toBeLessThan(0);
    const late = boardAt(BOARD_OUT + 0.01, 1);
    expect(late.prev).toBe(false);
    expect(late.y).toBeGreaterThan(0);
    expect(late.fade).toBeGreaterThan(0.9);
    expect(boardAt(PLANE_SHIFT, 1)).toEqual({ prev: false, y: 0, fade: 0 });
  });

  it('goes the other way when the input goes down', () => {
    expect(boardAt(BOARD_OUT * 0.5, -1).y).toBeGreaterThan(0);
    expect(direction({ n: 4 }, { n: 2 })).toBe(-1);
    expect(direction({ n: 4 }, { n: 9 })).toBe(1);
  });

  it('only fades when motion is reduced', () => {
    expect(boardAt(BOARD_OUT * 0.5, 1, 0).y).toBe(-0);
  });
});
