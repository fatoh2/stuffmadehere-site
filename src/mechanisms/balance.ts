/** A table that will not let the ball fall off. Two servos tilt a round plate; a controller reads the
 *  ball's position and speed and tilts the plate to roll it back to the centre. Flick the ball and the
 *  table catches it; leave it alone and the table shoves the ball itself to show off. The servos have a
 *  speed and an acceleration limit, which is where the wobble comes from. New. */
import { axis, stepAxis, type Axis } from '../lib/motor';
import { bar, bolt, disc, fit, metals, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { VelocityTracker, capture, localPoint } from '../lib/pointer';
import { onVisible, reducedMotion } from '../lib/visible';

export interface BalanceHandle {
  shove(): void;
}

const G = 2000; // px/s² per radian of tilt, roughly
const BALL = 13;

export function mountBalance(cv: HTMLCanvasElement, stat: HTMLElement | null): BalanceHandle {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  let cx = 0;
  let cy = 0;
  let R = 100;
  const tilt: { x: Axis; y: Axis } = { x: axis(0, 2.2, 16), y: axis(0, 2.2, 16) };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, off: false, drop: 0, respawn: 0 };
  let saves = 0;
  let falls = 0;
  let disturbed = false;
  let lastShove = performance.now() + 1500;
  let visible = true;
  let drag: VelocityTracker | null = null;

  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    cx = W * 0.5;
    cy = H * 0.5;
    R = Math.min(W, H) * 0.36;
  };
  new ResizeObserver(layout).observe(cv);
  layout();

  const tell = (): void => {
    if (stat) stat.textContent = `${saves} caught, ${falls} dropped`;
  };
  const kick = (vx: number, vy: number): void => {
    if (ball.off) return;
    ball.vx = vx;
    ball.vy = vy;
    disturbed = true;
    lastShove = performance.now();
  };
  const shove = (): void => {
    const a = Math.random() * Math.PI * 2;
    const s = 220 + Math.random() * 200;
    kick(Math.cos(a) * s, Math.sin(a) * s);
  };

  // keyboard: space or enter shoves the ball
  cv.tabIndex = 0;
  cv.setAttribute('aria-label', 'A table balancing a ball. Press space to shove the ball; the table catches it.');
  cv.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      shove();
    }
  });

  // flick: press anywhere on the table, move, release; the ball takes the release velocity
  cv.addEventListener('pointerdown', (e) => {
    capture(cv, e);
    drag = new VelocityTracker(110);
    const p = localPoint(cv, e, W, H);
    drag.push(p.x, p.y);
    lastShove = performance.now();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = localPoint(cv, e, W, H);
    drag.push(p.x, p.y);
  });
  const release = (): void => {
    if (!drag) return;
    const v = drag.velocity();
    drag = null;
    const s = Math.hypot(v.vx, v.vy);
    if (s < 40) return;
    const cap = 620;
    const k = s > cap ? cap / s : 1;
    kick(v.vx * k, v.vy * k);
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', () => (drag = null));

  function step(dt: number, now: number): void {
    if (ball.off) {
      // over the edge: it drops away, then a fresh ball is placed in the middle
      ball.drop += dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.vy += 1200 * dt;
      if (ball.drop > 0.9) {
        ball.off = false;
        ball.x = 0;
        ball.y = 0;
        ball.vx = 0;
        ball.vy = 0;
        tilt.x.p = tilt.y.p = 0;
        tilt.x.v = tilt.y.v = 0;
        lastShove = now + 800;
      }
      return;
    }
    // the controller: a tilt that opposes where the ball is and where it is going
    const want = (p: number, v: number): number => Math.max(-0.45, Math.min(0.45, -(0.012 * p + 0.009 * v)));
    stepAxis(tilt.x, want(ball.x, ball.vx), dt);
    stepAxis(tilt.y, want(ball.y, ball.vy), dt);
    ball.vx += G * tilt.x.p * dt;
    ball.vy += G * tilt.y.p * dt;
    ball.vx *= 1 - 0.25 * dt; // rolling resistance
    ball.vy *= 1 - 0.25 * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const r = Math.hypot(ball.x, ball.y);
    if (r > R - BALL * 0.5) {
      ball.off = true;
      ball.drop = 0;
      falls++;
      disturbed = false;
      tell();
    } else if (disturbed && r < 18 && Math.hypot(ball.vx, ball.vy) < 25) {
      disturbed = false;
      saves++;
      tell();
    }
    if (!drag && now - lastShove > 4200 && !disturbed) shove();
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    const tx = tilt.x.p;
    const ty = tilt.y.p;
    // the stand and the two servos, one on each axis
    bar(ctx, cx - 10, cy + R * 0.2, 20, H - (cy + R * 0.2) - 10, M.steel, 3);
    bar(ctx, cx - 60, H - 14, 120, 10, M.anod, 2);
    const servo = (x: number, y: number, a: number, vertical: boolean): void => {
      ctx.save();
      ctx.translate(x, y);
      if (vertical) ctx.rotate(Math.PI / 2);
      bar(ctx, -18, -11, 36, 22, M.anod, 3);
      disc(ctx, 0, 0, 6, M.steel, 1.5);
      ctx.rotate(a * 2.4);
      bar(ctx, -3, -22, 6, 28, M.alu, 1.5);
      ctx.restore();
    };
    servo(cx + R + 34, cy, tx, false);
    servo(cx, cy + R + 34, ty, true);
    // the plate, seen from above: the high side catches the light, the low side falls into shadow
    ctx.save();
    ctx.translate(cx, cy);
    const g = ctx.createLinearGradient(-R * tx * 4, -R * ty * 4, R * tx * 4, R * ty * 4);
    g.addColorStop(0, '#f1f1ee');
    g.addColorStop(1, '#bdbeb8');
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = Math.abs(tx) + Math.abs(ty) > 0.004 ? g : '#dedfdb';
    ctx.fill();
    ctx.strokeStyle = P.steelDark;
    ctx.lineWidth = 4;
    ctx.stroke();
    // the centre mark
    ctx.strokeStyle = P.steelDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(26, 0);
    ctx.moveTo(0, -26);
    ctx.lineTo(0, 26);
    ctx.stroke();
    // the ball and its shadow, which slides with the tilt
    ctx.globalAlpha = ball.off ? Math.max(0, 1 - ball.drop) : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.arc(ball.x + tx * 40 + 3, ball.y + ty * 40 + 5, BALL, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL - 3, 0.5, 2.6);
    ctx.stroke();
    ctx.restore();
    bolt(ctx, cx, cy + R * 0.2 + 6, 4, M.steel);
  }

  if (reducedMotion()) {
    draw();
    return { shove() {} };
  }
  onVisible(cv, (v) => (visible = v), 0.15);
  addTicker((dt, now) => {
    if (!visible) return;
    const n = 2;
    for (let i = 0; i < n; i++) step(dt / n, now);
    draw();
  });
  tell();
  return { shove };
}
