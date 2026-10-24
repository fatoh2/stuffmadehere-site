/** A motor-driven axis: position and velocity under a speed limit and an acceleration limit.
 *  Trapezoidal profile with a braking curve, no overshoot, snaps home when it arrives. */
export interface Axis {
  p: number;
  v: number;
  vmax: number;
  amax: number;
}

export function axis(p: number, vmax: number, amax: number): Axis {
  return { p, v: 0, vmax, amax };
}

export function stepAxis(a: Axis, target: number, dt: number): void {
  const d = target - a.p;
  const vdes = Math.sign(d) * Math.min(a.vmax, Math.sqrt(2 * a.amax * Math.abs(d)));
  const m = a.amax * dt;
  const dv = vdes - a.v;
  a.v += dv < -m ? -m : dv > m ? m : dv;
  const step = a.v * dt;
  if (Math.abs(step) >= Math.abs(d) && Math.abs(a.v) < m * 1.5) {
    a.p = target;
    a.v = 0;
  } else {
    a.p += step;
  }
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
