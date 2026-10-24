/** Damped spring on a scalar. Critically damped by default (zeta = 1), velocity carried through. */
export interface SpringState {
  x: number;
  v: number;
}

export function stepSpring(s: SpringState, target: number, dt: number, response = 0.35, zeta = 1): void {
  // response: time to reach ~the target (s). omega from response, Apple-style.
  const omega = (2 * Math.PI) / Math.max(0.01, response);
  const k = omega * omega;
  const c = 2 * zeta * omega;
  // semi-implicit Euler, substepped for stability at stiff settings
  const n = dt > 0.02 ? 2 : 1;
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = k * (target - s.x) - c * s.v;
    s.v += a * h;
    s.x += s.v * h;
  }
}
