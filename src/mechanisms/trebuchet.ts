/** A trebuchet that learns the distance. It fires, measures where the shot landed, moves the
 *  counterweight, and fires again, until the ball drops into the bucket; drag the bucket and it starts
 *  over. The release has a little scatter in it, as a real one does, which is why it takes more than
 *  one correction. Every build misses first. New. */
import { axis, stepAxis, type Axis } from '../lib/motor';
import { bar, bolt, disc, fit, metals, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { localPoint, capture } from '../lib/pointer';
import { onVisible, reducedMotion } from '../lib/visible';

export interface TrebuchetHandle {
  reset(): void;
}

const G = 1500;

export function mountTrebuchet(cv: HTMLCanvasElement, log: HTMLElement | null): TrebuchetHandle {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  let ground = 10;
  const base = { x: 80, y: 0 }; // the pivot
  let targetX = 500;
  let dragging = false;
  let visible = true;
  const beam: Axis = axis(-1.05, 9, 60); // angle of the long arm, rad; rest is down and back
  let mass = 60; // the counterweight, in made-up kilos
  let shots: { x: number; n: number }[] = [];
  let shotNo = 0;
  let phase: 'idle' | 'wind' | 'swing' | 'fly' | 'settle' | 'done' = 'idle';
  let wait = 1.2;
  const ball = { x: 0, y: 0, vx: 0, vy: 0, show: false, inBucket: false };
  let prev: { mass: number; range: number } | null = null;

  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    ground = H - 34;
    base.x = Math.max(70, W * 0.1);
    base.y = ground - Math.min(150, H * 0.42);
    if (targetX === 500 || targetX > W - 40) targetX = W * 0.7;
  };
  new ResizeObserver(layout).observe(cv);
  layout();

  const armLen = (): number => Math.min(130, H * 0.36);
  const tip = (a: number): [number, number] => [base.x + Math.cos(a) * armLen(), base.y + Math.sin(a) * armLen()];
  const say = (line: string, strong = false): void => {
    if (!log) return;
    const li = document.createElement('li');
    li.textContent = line;
    if (strong) li.classList.add('is-hit');
    log.appendChild(li);
    while (log.children.length > 6) log.removeChild(log.firstChild!);
  };

  function fire(): void {
    phase = 'wind';
    wait = 0.5;
    beam.p = -1.05;
    beam.v = 0;
    shotNo++;
  }
  function release(): void {
    // the launch speed grows with the counterweight; the sling adds a little scatter
    const scatter = 1 + (Math.random() - 0.5) * 0.06;
    const v = 34 * Math.sqrt(mass) * scatter;
    const a = -Math.PI / 4;
    const [tx, ty] = tip(beam.p);
    ball.x = tx;
    ball.y = ty;
    ball.vx = Math.cos(a) * v;
    ball.vy = Math.sin(a) * v;
    ball.show = true;
    ball.inBucket = false;
    phase = 'fly';
  }
  function landed(x: number): void {
    const err = x - targetX;
    shots.push({ x, n: shotNo });
    const hit = Math.abs(err) < 22;
    if (hit) {
      ball.inBucket = true;
      say(`Shot ${shotNo}: in. ${shotNo === 1 ? 'First try.' : `${shotNo} shots.`}`, true);
      phase = 'done';
      return;
    }
    // range is proportional to the counterweight in this model, so correct by the ratio, damped;
    // with the previous shot in hand, use the secant through both
    const range = x - base.x;
    const want = targetX - base.x;
    let next = mass * (want / Math.max(40, range));
    if (prev && Math.abs(prev.range - range) > 8) {
      const slope = (range - prev.range) / (mass - prev.mass);
      if (slope > 0) next = mass + (want - range) / slope;
    }
    prev = { mass, range };
    next = Math.max(8, Math.min(400, mass + (next - mass) * 0.85));
    say(`Shot ${shotNo}: ${err < 0 ? 'short' : 'long'} by ${Math.round(Math.abs(err))} px. Counterweight ${Math.round(mass)} → ${Math.round(next)}.`);
    mass = next;
    phase = 'settle';
    wait = 0.9;
  }

  function step(dt: number): void {
    if (dragging) return;
    if (phase === 'idle') {
      wait -= dt;
      if (wait <= 0) fire();
    } else if (phase === 'wind') {
      wait -= dt;
      if (wait <= 0) phase = 'swing';
    } else if (phase === 'swing') {
      stepAxis(beam, 0.75, dt);
      if (beam.p >= 0.74) release();
    } else if (phase === 'fly') {
      stepAxis(beam, 0.95, dt);
      ball.vy += G * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      if (ball.y >= ground - 8) {
        ball.y = ground - 8;
        landed(ball.x);
      }
    } else if (phase === 'settle') {
      stepAxis(beam, -1.05, dt);
      wait -= dt;
      if (wait <= 0) fire();
    } else {
      stepAxis(beam, -1.05, dt);
    }
  }

  // keyboard: arrows move the bucket; the machine starts learning again when the key is released
  cv.tabIndex = 0;
  cv.setAttribute('aria-label', 'A trebuchet learning the range to a bucket. Left and right arrow keys move the bucket.');
  let keyTimer = 0;
  cv.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    targetX = Math.max(base.x + 160, Math.min(W - 36, targetX + (e.key === 'ArrowRight' ? 24 : -24)));
    dragging = true;
    window.clearTimeout(keyTimer);
    keyTimer = window.setTimeout(() => {
      dragging = false;
      restart('Bucket moved. Learning again.');
    }, 450);
  });

  // drag the bucket and the machine starts learning again
  cv.addEventListener('pointerdown', (e) => {
    const p = localPoint(cv, e, W, H);
    if (Math.abs(p.x - targetX) > 50 || p.y < ground - 90) return;
    capture(cv, e);
    e.preventDefault();
    dragging = true;
  });
  cv.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = localPoint(cv, e, W, H);
    targetX = Math.max(base.x + 160, Math.min(W - 36, p.x));
  });
  const drop = (): void => {
    if (!dragging) return;
    dragging = false;
    restart('Bucket moved. Learning again.');
  };
  cv.addEventListener('pointerup', drop);
  cv.addEventListener('pointercancel', drop);

  function restart(note: string): void {
    shots = [];
    shotNo = 0;
    prev = null;
    ball.show = false;
    ball.inBucket = false;
    phase = 'idle';
    wait = 0.6;
    if (log) log.textContent = '';
    say(note);
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    // the ground and the marks of earlier shots
    ctx.fillStyle = P.steelDark;
    ctx.fillRect(0, ground, W, 3);
    for (const s of shots) {
      ctx.fillStyle = P.steelDark;
      ctx.fillRect(s.x - 1, ground - 10, 2, 10);
      ctx.font = '700 11px Chivo, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(s.n), s.x, ground - 14);
    }
    // the bucket
    ctx.save();
    ctx.translate(targetX, ground);
    ctx.fillStyle = dragging ? P.accent : P.ink;
    ctx.beginPath();
    ctx.moveTo(-24, -40);
    ctx.lineTo(24, -40);
    ctx.lineTo(18, 0);
    ctx.lineTo(-18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = P.steel;
    ctx.fillRect(-26, -44, 52, 6);
    ctx.restore();
    // the frame: two legs to the pivot, a cross brace
    const L = armLen();
    bar(ctx, base.x - 34, ground - 8, 68, 8, M.anod, 2);
    const leg = (dx: number): void => {
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(Math.atan2(ground - base.y, dx));
      bar(ctx, 0, -5, Math.hypot(dx, ground - base.y), 10, M.steel, 2);
      ctx.restore();
    };
    leg(-30);
    leg(30);
    // the beam: short arm back to the counterweight, long arm out to the sling
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.rotate(beam.p);
    bar(ctx, -L * 0.42, -6, L + L * 0.42, 12, M.alu, 3);
    ctx.restore();
    // the counterweight hangs from the short arm
    const cwx = base.x - Math.cos(beam.p) * L * 0.42;
    const cwy = base.y - Math.sin(beam.p) * L * 0.42;
    const box = 16 + Math.sqrt(mass) * 2.2;
    ctx.strokeStyle = P.steelDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cwx, cwy);
    ctx.lineTo(cwx, cwy + 18);
    ctx.stroke();
    bar(ctx, cwx - box / 2, cwy + 18, box, box * 0.8, M.anod, 3);
    ctx.fillStyle = P.paper;
    ctx.font = `700 ${Math.max(10, box * 0.32)}px Chivo, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(mass)}`, cwx, cwy + 18 + box * 0.5);
    bolt(ctx, base.x, base.y, 7, M.steel);
    // the sling and the ball before release, the ball in flight after
    const [tx, ty] = tip(beam.p);
    if (phase === 'wind' || phase === 'swing' || phase === 'idle' || phase === 'settle') {
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 10, ty + 26);
      ctx.stroke();
      disc(ctx, tx + 10, ty + 30, 8, M.steel);
      ctx.fillStyle = P.ball;
      ctx.beginPath();
      ctx.arc(tx + 10, ty + 30, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    if (ball.show) {
      ctx.fillStyle = P.ball;
      ctx.beginPath();
      ctx.arc(ball.x, ball.inBucket ? ground - 22 : ball.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (reducedMotion()) {
    draw();
    say('Reduced motion: the trebuchet sits still.');
    return { reset: () => undefined };
  }
  onVisible(cv, (v) => (visible = v), 0.15);
  addTicker((dt) => {
    if (!visible) return;
    step(dt);
    draw();
  });
  say('Finding the range.');

  return {
    reset() {
      mass = 60;
      restart('Starting from the first guess again.');
    },
  };
}
