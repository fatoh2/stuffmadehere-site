/** Mechanism 13: the self-correcting putter. A green seen from above. The visitor sets a stroke by
 *  dragging back from the ball; the club swings along that line, but in the last milliseconds its face
 *  motor turns the head toward the hole and a governor sets the pace, so the ball drops however bad
 *  the aim. The face turns at most FACE_MAX each way; past that even this club misses. Every make
 *  moves the hole further off. From "My self correcting golf club makes me a better golfer" (2020),
 *  "Making an autocorrect mini golf club" and "Robot golf vs holes that keep getting harder" (2026). */
import { cue } from '../lib/sound';
import { axis, stepAxis, clamp } from '../lib/motor';
import { fit, palette, metals, bar, disc, bolt } from '../lib/canvas';
import { sprite, drawSprite, near } from '../lib/sprites';
import { localPoint, capture } from '../lib/pointer';
import { addTicker } from '../lib/loop';
import { startGhost, stepGhost, drawGhost, type GhostState } from '../lib/ghost';
import { onVisible, reducedMotion, narrow } from '../lib/visible';

export interface PutterHandle {
  /** putt with a deliberately bad aim, as the machine does when nobody plays */
  putt(): void;
  stats(): { made: number; shots: number; level: number };
}

const FACE_MAX = (40 * Math.PI) / 180; // the face motor's travel each way
const MU = 230; // rolling deceleration on the felt, px/s²
let BALL = 11; // scaled with the green in layout()
let HOLE = 15;
const DEG = 180 / Math.PI;

type Phase = 'idle' | 'aim' | 'back' | 'down' | 'roll' | 'drop' | 'miss';

interface Stroke {
  /** unit direction of the visitor's line (the way the ball would go with a square face) */
  ux: number;
  uy: number;
  power: number; // 0..1
  back: number; // px the head sits behind the ball
  back0: number;
  speed: number; // head speed, px/s
  user: number; // head speed the visitor asked for
  corr: number; // the face turn the hole needs, rad, signed
  off: number; // how far the visitor's line is off the hole, rad
}

const turf = { a: '#4a8550', b: '#437a49', fringe: '#355f3a', cup: '#141414', rim: '#dcdcdc', pin: '#e9e9e9' };

export function mountPutter(cv: HTMLCanvasElement, read: HTMLElement | null, stat: HTMLElement | null): PutterHandle {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  const g = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, r: BALL, scale: 1 };
  const hole = { x: 0, y: 0 };
  const face = axis(0, 7, 140); // rad, rad/s, rad/s²
  let phase: Phase = 'idle';
  let s: Stroke | null = null;
  let drag: { x: number; y: number } | null = null;
  let made = 0;
  let shots = 0;
  let level = 0;
  let wait = 0; // seconds left in a pause between phases
  let idleAt = performance.now() + 2600;
  let visible = false;
  let phone = narrow();
  // a ghost hand pulls back from the ball once or twice until the visitor does it themselves
  let ghost: GhostState | null = null;
  let interacted = false;
  let demos = 0;
  let demoAt = 0;
  const trail: { x: number; y: number }[] = [];
  const still = reducedMotion();
  near(cv, ['putter']);

  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    phone = narrow();
    const m = clamp(W * 0.035, 8, 22);
    g.x0 = m;
    g.y0 = m;
    g.x1 = W - m;
    g.y1 = H - m;
    const unit = clamp(Math.min(W, H) / 30, 9, 17);
    BALL = unit;
    HOLE = unit * 1.45;
    ball.r = BALL;
    if (!hole.x) place(true);
    else {
      hole.x = clamp(hole.x, g.x0 + 40, g.x1 - 40);
      hole.y = clamp(hole.y, g.y0 + 40, g.y1 - 40);
      if (phase === 'idle' || phase === 'aim') {
        ball.x = clamp(ball.x, g.x0 + 30, g.x1 - 30);
        ball.y = clamp(ball.y, g.y0 + 30, g.y1 - 30);
      }
    }
  };
  new ResizeObserver(layout).observe(cv);
  layout();
  onVisible(cv, (v) => {
    visible = v;
    if (v) idleAt = Math.max(idleAt, performance.now() + 1800);
  }, 0.3);

  /** A new hole, and a tee further from it each level. */
  function place(first: boolean): void {
    const inset = 44;
    const span = Math.hypot(g.x1 - g.x0 - 2 * inset, g.y1 - g.y0 - 2 * inset);
    const want = Math.min(span * 0.92, (phone ? 150 : 200) + level * (phone ? 45 : 70));
    let best = { hx: 0, hy: 0, bx: 0, by: 0, d: 0 };
    for (let i = 0; i < 40; i++) {
      const hx = g.x0 + inset + Math.random() * (g.x1 - g.x0 - 2 * inset);
      const hy = g.y0 + inset + Math.random() * (g.y1 - g.y0 - 2 * inset);
      const a = Math.random() * Math.PI * 2;
      const bx = hx - Math.cos(a) * want;
      const by = hy - Math.sin(a) * want;
      const inside = bx > g.x0 + inset && bx < g.x1 - inset && by > g.y0 + inset && by < g.y1 - inset;
      const d = inside ? want : Math.hypot(clamp(bx, g.x0 + inset, g.x1 - inset) - hx, clamp(by, g.y0 + inset, g.y1 - inset) - hy);
      if (d > best.d) best = { hx, hy, bx: clamp(bx, g.x0 + inset, g.x1 - inset), by: clamp(by, g.y0 + inset, g.y1 - inset), d };
      if (inside) break;
    }
    hole.x = best.hx;
    hole.y = best.hy;
    ball.x = best.bx;
    ball.y = best.by;
    ball.vx = ball.vy = 0;
    ball.scale = 1;
    trail.length = 0;
    if (first && still) {
      // no motion: the ball rests by the cup and the club stands square to the hole
      ball.x = hole.x - 46;
      ball.y = hole.y + 8;
    }
  }

  const tell = (): void => {
    if (stat) stat.textContent = `${made} of ${shots} dropped${level ? ` · hole ${level + 1}` : ''}`;
  };
  const say = (t: string): void => {
    if (read) read.textContent = t;
  };
  tell();

  const angleTo = (ux: number, uy: number): number => {
    const dx = hole.x - ball.x;
    const dy = hole.y - ball.y;
    let a = Math.atan2(dy, dx) - Math.atan2(uy, ux);
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  function begin(ux: number, uy: number, power: number, wound: boolean): void {
    const off = angleTo(ux, uy);
    const back0 = (16 + 64 * power) * (BALL / 11);
    const user = 360 + 980 * power;
    s = { ux, uy, power, back: wound ? 0 : back0, back0, speed: 0, user, corr: clamp(off, -FACE_MAX, FACE_MAX), off };
    face.p = 0;
    face.v = 0;
    phase = wound ? 'back' : 'down';
    shots++;
    trail.length = 0;
    tell();
    say(`aim ${Math.abs(off * DEG).toFixed(0)}° off`);
  }

  function impact(): void {
    if (!s) return;
    // the ball leaves along the face, wherever the motor got it to; the governor sets the pace
    const a = Math.atan2(s.uy, s.ux) + face.p;
    const dx = hole.x - ball.x;
    const dy = hole.y - ball.y;
    const d = Math.hypot(dx, dy);
    const need = Math.sqrt(2 * MU * (d + 10));
    const speed = clamp(need, 120, 1500);
    ball.vx = Math.cos(a) * speed;
    ball.vy = Math.sin(a) * speed;
    s.speed = 0;
    phase = 'roll';
    cue.pawl();
    const left = Math.abs(s.off) - Math.abs(face.p);
    const pace = speed / s.user;
    if (left > 0.02) say(`aim ${Math.abs(s.off * DEG).toFixed(0)}° off, the face only turns ${(FACE_MAX * DEG).toFixed(0)}°`);
    else say(`face ${face.p >= 0 ? '+' : '−'}${Math.abs(face.p * DEG).toFixed(0)}°, pace ×${pace.toFixed(1)}`);
  }

  function roll(dt: number): void {
    const sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 0) {
      const ns = Math.max(0, sp - MU * dt);
      ball.vx *= ns / sp;
      ball.vy *= ns / sp;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x < g.x0 + BALL) {
      ball.x = g.x0 + BALL;
      ball.vx = -ball.vx * 0.55;
    } else if (ball.x > g.x1 - BALL) {
      ball.x = g.x1 - BALL;
      ball.vx = -ball.vx * 0.55;
    }
    if (ball.y < g.y0 + BALL) {
      ball.y = g.y0 + BALL;
      ball.vy = -ball.vy * 0.55;
    } else if (ball.y > g.y1 - BALL) {
      ball.y = g.y1 - BALL;
      ball.vy = -ball.vy * 0.55;
    }
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(last.x - ball.x, last.y - ball.y) > 9) {
      trail.push({ x: ball.x, y: ball.y });
      if (trail.length > 90) trail.shift();
    }
    const dh = Math.hypot(ball.x - hole.x, ball.y - hole.y);
    const v = Math.hypot(ball.vx, ball.vy);
    if (dh < HOLE - 4 && v < 560) {
      phase = 'drop';
      wait = 0.9;
      made++;
      level++;
      cue.index();
      say('dropped');
      tell();
    } else if (v < 6) {
      ball.vx = ball.vy = 0;
      phase = 'miss';
      wait = 1.1;
      level = 0;
      tell();
    }
  }

  function putt(): void {
    if (phase !== 'idle' && phase !== 'miss' && phase !== 'drop') return;
    if (phase !== 'idle') settle();
    // a bad golfer: the line is off by 12° to 34°, the stroke too hard or too soft
    const want = Math.atan2(hole.y - ball.y, hole.x - ball.x);
    const sign = Math.random() < 0.5 ? -1 : 1;
    const a = want + sign * ((12 + Math.random() * 22) / DEG);
    begin(Math.cos(a), Math.sin(a), 0.25 + Math.random() * 0.7, true);
  }

  /** after a drop or a miss: a new hole, or the same one again */
  function settle(): void {
    if (phase === 'drop') place(false);
    else {
      ball.scale = 1;
      trail.length = 0;
    }
    phase = 'idle';
    s = null;
    face.p = 0;
    face.v = 0;
  }

  /* ---------- pointer: drag back from the ball, let go ---------- */
  const aimFrom = (p: { x: number; y: number }): { ux: number; uy: number; power: number } | null => {
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) return null;
    return { ux: dx / d, uy: dy / d, power: clamp((d - 10) / (phone ? 120 : 170), 0.12, 1) };
  };
  cv.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    interacted = true;
    if (ghost) {
      ghost = null;
      if (phase === 'aim') phase = 'idle';
    }
    if (phase === 'miss' || phase === 'drop') settle();
    if (phase !== 'idle') return;
    e.preventDefault();
    capture(cv, e);
    drag = localPoint(cv, e, W, H);
    phase = 'aim';
    idleAt = performance.now() + 6000;
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag || phase !== 'aim') return;
    drag = localPoint(cv, e, W, H);
    const a = aimFrom(drag);
    if (a) say(`aim ${Math.abs(angleTo(a.ux, a.uy) * DEG).toFixed(0)}° off`);
  });
  const release = (): void => {
    if (!drag) return;
    const a = aimFrom(drag);
    drag = null;
    if (!a) {
      phase = 'idle';
      say('');
      return;
    }
    begin(a.ux, a.uy, a.power, false);
    idleAt = performance.now() + 7000;
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', () => {
    drag = null;
    if (phase === 'aim') phase = 'idle';
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.tabIndex = 0;
  cv.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      putt();
      idleAt = performance.now() + 7000;
    }
  });

  /* ---------- drawing ---------- */
  function drawGreen(): void {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, 10);
    ctx.clip();
    ctx.fillStyle = turf.a;
    ctx.fillRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0);
    // mown stripes, as a green is cut
    ctx.fillStyle = turf.b;
    const band = phone ? 26 : 34;
    for (let y = g.y0; y < g.y1; y += band * 2) ctx.fillRect(g.x0, y, g.x1 - g.x0, band);
    ctx.restore();
    ctx.lineWidth = 6;
    ctx.strokeStyle = turf.fringe;
    ctx.beginPath();
    ctx.roundRect(g.x0, g.y0, g.x1 - g.x0, g.y1 - g.y0, 10);
    ctx.stroke();
  }

  function drawHole(): void {
    ctx.fillStyle = turf.cup;
    ctx.beginPath();
    ctx.arc(hole.x, hole.y, HOLE, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = turf.rim;
    ctx.stroke();
    // the pin and its flag, seen from above
    ctx.strokeStyle = turf.pin;
    ctx.lineWidth = 2;
    const k = HOLE / 15;
    ctx.beginPath();
    ctx.moveTo(hole.x, hole.y);
    ctx.lineTo(hole.x + 22 * k, hole.y - 26 * k);
    ctx.stroke();
    ctx.fillStyle = P.accent;
    ctx.beginPath();
    ctx.moveTo(hole.x + 22 * k, hole.y - 26 * k);
    ctx.lineTo(hole.x + 40 * k, hole.y - 20 * k);
    ctx.lineTo(hole.x + 24 * k, hole.y - 13 * k);
    ctx.closePath();
    ctx.fill();
    disc(ctx, hole.x, hole.y, 3 * k, M.steel);
  }

  function drawBall(): void {
    if (ball.scale <= 0) return;
    const r = BALL * ball.scale;
    ctx.fillStyle = '#ececec';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x - r * 0.25, ball.y - r * 0.25, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    // the dimples, a few
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.arc(ball.x + Math.cos(a) * r * 0.55, ball.y + Math.sin(a) * r * 0.55, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTrail(): void {
    if (trail.length < 2) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 7]);
    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
    ctx.lineTo(ball.x, ball.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /** the visitor's line while aiming, and the wedge the face can reach */
  function drawAim(): void {
    if (phase !== 'aim' || !drag) return;
    const a = aimFrom(drag);
    if (!a) return;
    const L = (70 + 150 * a.power) * (BALL / 11);
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(Math.atan2(a.uy, a.ux));
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, L, -FACE_MAX, FACE_MAX);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(BALL + 2, 0);
    ctx.lineTo(L, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawClub(): void {
    let ux: number;
    let uy: number;
    let back: number;
    if (phase === 'aim' && drag) {
      const a = aimFrom(drag);
      if (!a) return;
      ux = a.ux;
      uy = a.uy;
      back = (16 + 64 * a.power) * (BALL / 11);
    } else if (s && (phase === 'back' || phase === 'down' || (phase === 'roll' && s.speed > 0))) {
      ux = s.ux;
      uy = s.uy;
      back = s.back;
    } else if (still) {
      const dx = hole.x - ball.x;
      const dy = hole.y - ball.y;
      const d = Math.hypot(dx, dy) || 1;
      ux = dx / d;
      uy = dy / d;
      back = 18;
    } else return;
    const k = BALL / 11;
    const img = sprite('putter');
    // the face sits just off the ball: the render's face plate is its top edge, 0.36 of its height above the anchor
    const faceGap = img ? 0.36 * 22 * k + 1.5 * k : 6 * k;
    const hx = ball.x - ux * (BALL + faceGap + back);
    const hy = ball.y - uy * (BALL + faceGap + back);
    const a = Math.atan2(uy, ux) + face.p;
    // the shaft runs away from the ball to the golfer, who stands off the green
    ctx.strokeStyle = M.steel.light;
    ctx.lineWidth = 4 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - ux * 12 * k, hy - uy * 12 * k);
    ctx.lineTo(hx - ux * 96 * k, hy - uy * 96 * k);
    ctx.stroke();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 7 * k;
    ctx.beginPath();
    ctx.moveTo(hx - ux * 66 * k, hy - uy * 66 * k);
    ctx.lineTo(hx - ux * 98 * k, hy - uy * 98 * k);
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (img) {
      drawSprite(ctx, img, hx, hy, 22 * k, 0.5, 0.36, a + Math.PI / 2);
      return;
    }
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(a);
    ctx.scale(k, k);
    bar(ctx, -9, -24, 14, 48, M.alu, 3);
    bar(ctx, 4, -24, 5, 48, M.steel, 1);
    bolt(ctx, -3, -14, 3, M.steel);
    bolt(ctx, -3, 14, 3, M.steel);
    ctx.restore();
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    drawGreen();
    drawHole();
    drawTrail();
    drawAim();
    drawBall();
    drawClub();
    if (ghost) drawGhost(ctx, ghost, '#ffffff');
  }

  /* ---------- the loop ---------- */
  addTicker(function putter(dt, now) {
    if (!visible && !still) return;
    if (still) {
      draw();
      return;
    }
    if (visible && !demoAt) demoAt = now + 1500;
    if (ghost) {
      stepGhost(ghost, dt);
      if (!ghost.released) {
        drag = { x: ghost.x, y: ghost.y };
        const a = aimFrom(drag);
        if (a) say(`aim ${Math.abs(angleTo(a.ux, a.uy) * DEG).toFixed(0)}° off`);
      }
      if (ghost.done) ghost = null;
    } else if (!interacted && demos < 2 && phase === 'idle' && demoAt && now > demoAt) {
      demos++;
      demoAt = now + 16000;
      const want = Math.atan2(hole.y - ball.y, hole.x - ball.x) + (Math.random() < 0.5 ? -1 : 1) * (24 / DEG);
      const L = 130 * (BALL / 11);
      phase = 'aim';
      drag = { x: ball.x, y: ball.y };
      ghost = startGhost(ball.x, ball.y, ball.x - Math.cos(want) * L, ball.y - Math.sin(want) * L, 0.6, (gh) => {
        drag = { x: gh.x, y: gh.y };
        release();
      });
    }
    if (phase === 'back' && s) {
      s.back = Math.min(s.back0, s.back + s.back0 * dt * 2.2);
      if (s.back >= s.back0 - 0.01) {
        phase = 'down';
        s.speed = 0;
      }
    } else if (phase === 'down' && s) {
      // the head accelerates to the asked speed over the backswing; the face motor turns meanwhile
      const acc = (s.user * s.user) / (2 * s.back0);
      s.speed = Math.min(s.user, s.speed + acc * dt);
      s.back -= s.speed * dt;
      stepAxis(face, s.corr, dt);
      if (s.back <= 0) {
        s.back = 0;
        impact();
      }
    } else if (phase === 'roll' && s) {
      // follow-through: the head carries on a little past the ball, then waits
      s.speed = Math.max(0, s.speed - 2400 * dt);
      s.back = Math.max(-22, s.back - s.speed * dt);
      roll(dt);
    } else if (phase === 'drop') {
      ball.scale = Math.max(0, ball.scale - dt * 4);
      wait -= dt;
      if (wait <= 0) settle();
    } else if (phase === 'miss') {
      wait -= dt;
      if (wait <= 0) settle();
    } else if (phase === 'idle' && now > idleAt) {
      putt();
      idleAt = now + 5200 + Math.random() * 1800;
    }
    draw();
  });

  return {
    putt() {
      putt();
      idleAt = performance.now() + 7000;
    },
    stats: () => ({ made, shots, level }),
  };
}
