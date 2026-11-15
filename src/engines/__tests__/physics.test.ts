import { describe, expect, it } from 'vitest';
import {
  BALL_RADIUS,
  GRAVITY,
  NET_HEIGHT_CENTER,
  NET_HEIGHT_POST,
  NET_POST_X,
  SURFACES,
  acceleration,
  bounce,
  kmhToMs,
  netHeightAt,
  rpmToRadS,
  simulateFlight,
  solveLaunch,
  spinVector,
  topspinAxis,
} from '../physics';
import { dot, length, vec } from '../vector';

describe('acceleration', () => {
  it('is pure gravity for a ball at rest', () => {
    expect(acceleration(vec(), vec())).toEqual(vec(0, -GRAVITY, 0));
  });

  it('drag opposes motion', () => {
    const a = acceleration(vec(0, 0, 30), vec());
    expect(a.z).toBeLessThan(0);
    expect(a.x).toBeCloseTo(0);
  });

  it('topspin pushes the ball down, backspin lifts it', () => {
    const v = vec(0, 0, 25);
    const top = acceleration(v, spinVector(v, 2500));
    const back = acceleration(v, spinVector(v, -2500));
    expect(top.y).toBeLessThan(-GRAVITY);
    expect(back.y).toBeGreaterThan(-GRAVITY);
  });
});

describe('topspinAxis', () => {
  it('is horizontal and perpendicular to the direction of travel', () => {
    const dir = vec(1, 0.4, 2);
    const axis = topspinAxis(dir);
    expect(axis.y).toBeCloseTo(0);
    expect(dot(axis, vec(dir.x, 0, dir.z))).toBeCloseTo(0);
    expect(length(axis)).toBeCloseTo(1);
  });
});

describe('simulateFlight', () => {
  it('matches the analytic drop time in (almost) still air', () => {
    const h = 2;
    const flight = simulateFlight(
      { pos: vec(0, h + BALL_RADIUS, 0), vel: vec(), spin: vec() },
      { surface: SURFACES.hard, stop: (_s, _t, b) => b > 0 },
    );
    expect(flight.bounces[0].t).toBeCloseTo(Math.sqrt((2 * h) / GRAVITY), 2);
  });

  it('records the net crossing with clearance above the tape', () => {
    const flight = simulateFlight(
      { pos: vec(0, 2, 5), vel: vec(0, 0, -20), spin: vec() },
      { surface: SURFACES.hard, maxTime: 0.5 },
    );
    expect(flight.netCrossing).not.toBeNull();
    expect(flight.netCrossing!.pos.z).toBeCloseTo(0, 6);
    expect(flight.netCrossing!.clearance).toBeGreaterThan(0.5);
  });

  it('produces strictly increasing sample times', () => {
    const flight = simulateFlight(
      { pos: vec(0, 1, 10), vel: vec(0, 3, -25), spin: spinVector(vec(0, 0, -1), 2000) },
      { surface: SURFACES.clay, maxTime: 3 },
    );
    for (let i = 1; i < flight.samples.length; i++) {
      expect(flight.samples[i].t).toBeGreaterThan(flight.samples[i - 1].t);
    }
    expect(flight.bounces.length).toBeGreaterThan(0);
  });
});

describe('bounce', () => {
  const incoming = { pos: vec(0, BALL_RADIUS, 0), vel: vec(0, -8, 20) };

  it('reverses vertical speed scaled by restitution', () => {
    const out = bounce({ ...incoming, spin: vec() }, SURFACES.hard);
    expect(out.vel.y).toBeCloseTo(8 * SURFACES.hard.restitution);
  });

  it('friction slows a ball without spin and gives it topspin', () => {
    const out = bounce({ ...incoming, spin: vec() }, SURFACES.hard);
    expect(out.vel.z).toBeLessThan(20);
    expect(dot(out.spin, topspinAxis(incoming.vel))).toBeGreaterThan(0);
  });

  it('a slice ball skids slower than a topspin ball', () => {
    const top = bounce({ ...incoming, spin: spinVector(incoming.vel, 3000) }, SURFACES.hard);
    const slice = bounce({ ...incoming, spin: spinVector(incoming.vel, -3000) }, SURFACES.hard);
    expect(top.vel.z).toBeGreaterThan(slice.vel.z);
  });

  it('clay grabs the ball more than grass', () => {
    const clay = bounce({ ...incoming, spin: vec() }, SURFACES.clay);
    const grass = bounce({ ...incoming, spin: vec() }, SURFACES.grass);
    expect(clay.vel.z).toBeLessThan(grass.vel.z);
  });
});

describe('netHeightAt', () => {
  it('is lowest in the centre and reaches post height at the posts', () => {
    expect(netHeightAt(0)).toBeCloseTo(NET_HEIGHT_CENTER);
    expect(netHeightAt(NET_POST_X)).toBeCloseTo(NET_HEIGHT_POST);
    expect(netHeightAt(-20)).toBeCloseTo(NET_HEIGHT_POST);
  });
});

describe('solveLaunch', () => {
  it.each([
    { speedKmh: 90, spinRpm: 0 },
    { speedKmh: 110, spinRpm: 2800 },
    { speedKmh: 80, spinRpm: -2200 },
  ])('lands within 5 cm of the target ($speedKmh km/h, $spinRpm rpm)', ({ speedKmh, spinRpm }) => {
    const sol = solveLaunch({
      start: vec(-1, 1, -12),
      target: { x: 2.5, z: 9 },
      speed: kmhToMs(speedKmh),
      spinRpm,
      surface: SURFACES.hard,
    });
    expect(sol.reachable).toBe(true);
    expect(Math.hypot(sol.landing.x - 2.5, sol.landing.z - 9)).toBeLessThan(0.05);
    expect(length(sol.vel)).toBeCloseTo(kmhToMs(speedKmh));
    expect(length(sol.spin)).toBeCloseTo(rpmToRadS(Math.abs(spinRpm)));
  });

  it('topspin needs a higher launch angle than flat for the same target', () => {
    const base = { start: vec(0, 1, -12), target: { x: 0, z: 9 }, speed: kmhToMs(100), surface: SURFACES.hard };
    const flat = solveLaunch({ ...base, spinRpm: 0 });
    const top = solveLaunch({ ...base, spinRpm: 3000 });
    expect(top.elevation).toBeGreaterThan(flat.elevation);
  });

  it('reports an unreachable target', () => {
    const sol = solveLaunch({
      start: vec(0, 1, -12),
      target: { x: 0, z: 11 },
      speed: kmhToMs(25),
      spinRpm: 0,
      surface: SURFACES.hard,
    });
    expect(sol.reachable).toBe(false);
  });
});
