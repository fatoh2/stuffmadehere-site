/** Mechanism 16: the explosive bat. A blank cartridge swings the bat; the charge sets the bat speed, the
 *  pitch comes in, and the collision is worked out properly: effective bat mass, ball mass, coefficient
 *  of restitution, exit speed, carry. Shown at one eighth speed, the way his high-speed camera showed
 *  it. Load too much and the bat fails at the handle, as his did, and is rebuilt. From "World's most
 *  powerful bat goes boom" and "Explosive Bat: crushing MLB records" (2020). */
import { cue } from '../lib/sound';
import { clamp } from '../lib/motor';
import { fit, palette, metals, bar, disc, bolt, fontFor } from '../lib/canvas';
import { sprite, drawSprite, near } from '../lib/sprites';
import { capture } from '../lib/pointer';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion } from '../lib/visible';

export interface BatHandle {
  /** swing at a given charge 0..1 */
  swing(charge: number): void;
}

// the physics, in SI, drawn at 1 px = 1 cm and one eighth speed
const SLOW = 0.125;
const G = 9.81;
const BAT_M = 1.0; // effective mass at the sweet spot, kg
const BALL_M = 0.145;
const E = 0.5; // coefficient of restitution of a baseball
const BAT_L = 0.9; // m
const PITCH = 30; // m/s, the pitching machine
const OMEGA_MAX = 52; // rad/s at full charge
const HANDLE_LIMIT = 11000; // N: past this the bat fails (about 85% charge)

type Phase = 'idle' | 'pitch' | 'flight' | 'broken';

export function mountBat(cv: HTMLCanvasElement, loadBtn: HTMLButtonElement, out: HTMLElement | null): BatHandle {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  let scale = 100; // px per metre
  let ground = 0;
  const pivot = { x: 0, y: 0 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, live: false };
  const bat = { a: -2.2, w: 0, swinging: false, broken: 0, barrel: { x: 0, y: 0, vx: 0, vy: 0, a: 0, w: 0 } };
  let phase: Phase = 'idle';
  let t = 0;
  let charge = 0.7;
  let startSwingAt = 0;
  let result: { bat: number; exit: number; carry: number; force: number; broke: boolean } | null = null;
  let flash = 0;
  let trail: { x: number; y: number }[] = [];
  let visible = false;
  let idleAt = performance.now() + 2200;
  let demos = 0;
  let interacted = false;
  const still = reducedMotion();
  near(cv, ['pitcher']);

  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    scale = Math.min(W / 7.2, H / 4.2);
    ground = H - 24;
    pivot.x = W * 0.22;
    pivot.y = ground - 1.05 * scale;
    if (!ball.live) {
      ball.x = W - 60;
      ball.y = pivot.y;
    }
  };
  layout();
  new ResizeObserver(layout).observe(cv);
  onVisible(cv, (v) => {
    visible = v;
    if (v) idleAt = Math.max(idleAt, performance.now() + 1500);
  }, 0.3);

  const say = (text: string): void => {
    if (out) out.textContent = text;
  };

  /* ---------- the hold-to-load button: the gauge fills over 1.2 s, release swings ---------- */
  const gauge = loadBtn.querySelector<HTMLElement>('.cartridge__gauge');
  let holding = false;
  let t0 = 0;
  let raf = 0;
  const tick = (): void => {
    if (!holding) return;
    charge = clamp((performance.now() - t0) / 1200, 0.1, 1);
    if (gauge) gauge.style.transform = `scaleX(${charge})`;
    raf = requestAnimationFrame(tick);
  };
  const begin = (e: PointerEvent): void => {
    if (phase !== 'idle' && phase !== 'broken') return;
    e.preventDefault();
    capture(loadBtn, e);
    holding = true;
    interacted = true;
    t0 = performance.now();
    loadBtn.classList.add('is-holding');
    tick();
  };
  const end = (): void => {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(raf);
    loadBtn.classList.remove('is-holding');
    if (gauge) gauge.style.transform = 'scaleX(0)';
    swing(charge);
  };
  loadBtn.addEventListener('pointerdown', begin);
  loadBtn.addEventListener('pointerup', end);
  loadBtn.addEventListener('pointercancel', end);
  loadBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  loadBtn.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!holding) {
        holding = true;
        interacted = true;
        t0 = performance.now();
        tick();
      }
    }
  });
  loadBtn.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') end();
  });

  function swing(c: number): void {
    if (phase !== 'idle' && phase !== 'broken') return;
    charge = clamp(c, 0.1, 1);
    bat.broken = 0;
    bat.a = -2.2;
    bat.w = 0;
    bat.swinging = false;
    result = null;
    trail = [];
    // the pitch leaves the machine; the swing is timed so the bat is level when the ball reaches the plate
    ball.x = W - 60;
    ball.y = pivot.y + 0.1 * scale;
    ball.vx = -PITCH * scale;
    ball.vy = 0;
    ball.live = true;
    const omega = 8 + (OMEGA_MAX - 8) * charge;
    const plateX = pivot.x + BAT_L * 0.8 * scale; // the sweet spot at contact, bat level
    const arrive = (ball.x - plateX) / (PITCH * scale); // real seconds
    startSwingAt = arrive - 2.2 / omega;
    phase = 'pitch';
    t = 0;
    say(`charge ${Math.round(charge * 100)}%: bat tip ${(omega * BAT_L * 0.8).toFixed(0)} m/s`);
  }

  /* ---------- the collision, once, at contact ---------- */
  function contact(): void {
    const omega = bat.w;
    const vbat = omega * BAT_L * 0.8;
    // 1-D collision along the pitch line: the ball comes in at -PITCH, the bat at +vbat
    const vout = ((1 + E) * BAT_M * vbat + (BALL_M - E * BAT_M) * -PITCH) / (BAT_M + BALL_M);
    const angle = (28 * Math.PI) / 180;
    ball.vx = vout * Math.cos(angle) * scale;
    ball.vy = -vout * Math.sin(angle) * scale;
    const carry = (vout * vout * Math.sin(2 * angle)) / G;
    // the handle carries the bat's centripetal load plus the impulse; past the limit it lets go
    const force = BAT_M * omega * omega * BAT_L * 0.5 + (BALL_M * (vout + PITCH)) / 0.0012;
    const broke = force > HANDLE_LIMIT;
    result = { bat: vbat, exit: vout, carry, force, broke };
    flash = 1;
    cue.bang(charge);
    if (broke) {
      bat.broken = 1;
      bat.barrel = { x: pivot.x + Math.cos(bat.a) * BAT_L * 0.55 * scale, y: pivot.y + Math.sin(bat.a) * BAT_L * 0.55 * scale, vx: omega * BAT_L * 0.4 * scale * 0.5, vy: -3 * scale, a: bat.a, w: omega * 0.6 };
      say(`${Math.round(force).toLocaleString()} N at the handle, limit ${HANDLE_LIMIT.toLocaleString()}: the bat failed. Exit ${vout.toFixed(0)} m/s anyway. Rebuilding.`);
    } else {
      say(`bat ${vbat.toFixed(0)} m/s, pitch ${PITCH} m/s, e ${E}: exit ${vout.toFixed(0)} m/s (${(vout * 2.237).toFixed(0)} mph), carry ${carry.toFixed(0)} m, handle ${Math.round(force).toLocaleString()} N`);
    }
    phase = 'flight';
    t = 0;
  }

  /* ---------- the loop, at one eighth speed ---------- */
  addTicker(function batTick(dt, now) {
    if (!visible) return;
    if (still) {
      draw();
      return;
    }
    const sdt = dt * SLOW;
    if (phase === 'pitch') {
      t += sdt;
      ball.x += ball.vx * sdt;
      if (t >= startSwingAt && !bat.swinging) bat.swinging = true;
      if (bat.swinging) {
        const omega = 8 + (OMEGA_MAX - 8) * charge;
        bat.w = omega;
        bat.a += omega * sdt;
        // contact when the sweet spot reaches the ball's line
        const tipX = pivot.x + Math.cos(bat.a) * BAT_L * 0.8 * scale;
        const tipY = pivot.y + Math.sin(bat.a) * BAT_L * 0.8 * scale;
        if (Math.hypot(tipX - ball.x, tipY - ball.y) < 0.09 * scale || (bat.a >= 0 && ball.x < tipX)) {
          ball.x = tipX;
          ball.y = tipY;
          contact();
        }
      }
    } else if (phase === 'flight') {
      t += sdt;
      ball.vy += G * scale * sdt;
      ball.x += ball.vx * sdt;
      ball.y += ball.vy * sdt;
      if (trail.length === 0 || Math.hypot(trail[trail.length - 1].x - ball.x, trail[trail.length - 1].y - ball.y) > 8) trail.push({ x: ball.x, y: ball.y });
      // the bat follows through and slows; a broken barrel tumbles away
      if (!bat.broken) {
        bat.w = Math.max(0, bat.w - 60 * sdt);
        bat.a = Math.min(1.1, bat.a + bat.w * sdt);
      } else {
        const b = bat.barrel;
        b.vy += G * scale * sdt;
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;
        b.a += b.w * sdt;
        if (b.y > ground - 8) {
          b.y = ground - 8;
          b.vy = 0;
          b.vx *= 0.9;
          b.w *= 0.8;
        }
      }
      if (ball.x > W + 40 || ball.y < -60 || t > 1.4) {
        phase = result?.broke ? 'broken' : 'idle';
        ball.live = false;
        t = 0;
        idleAt = now + (result?.broke ? 2600 : 5200);
      }
    } else if (phase === 'broken') {
      // rebuilt after a moment
      t += dt;
      if (t > 1.6) {
        bat.broken = 0;
        bat.a = -2.2;
        phase = 'idle';
        say('Rebuilt. Load a charge.');
      }
    } else if (phase === 'idle' && !interacted && demos < 3 && now > idleAt) {
      // the machine shows itself: full charge first, which fails as his did, then a charge that holds
      demos++;
      swing(demos === 1 ? 0.95 : 0.68);
    }
    flash = Math.max(0, flash - dt * 3);
    draw();
  });

  /* ---------- drawing ---------- */
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    // the ground and the stand
    ctx.fillStyle = P.surface;
    ctx.fillRect(0, ground, W, H - ground);
    bar(ctx, pivot.x - 10, pivot.y, 20, ground - pivot.y, M.steel, 3);
    bar(ctx, pivot.x - 44, ground - 12, 88, 12, M.anod, 2);
    // the pitching machine
    const pitcher = sprite('pitcher');
    const px = W - 60;
    const py = pivot.y + 0.1 * scale;
    if (pitcher) drawSprite(ctx, pitcher, px, py, 1.4 * scale, 0.492, 0.472, 0, true);
    else bar(ctx, px - 30, py - 30, 60, 60, M.anod, 4);
    // the exit arc so far
    if (trail.length > 1) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.setLineDash([3, 7]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(trail[0].x, trail[0].y);
      for (const q of trail) ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // the bat: a tapered barrel on the pivot; the cartridge sits in the knob
    const L = BAT_L * scale;
    const drawBatBody = (x: number, y: number, a: number, from: number, to: number): void => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(from * L, -6);
      ctx.lineTo(to * L, -11 * (0.5 + to));
      ctx.lineTo(to * L, 11 * (0.5 + to));
      ctx.lineTo(from * L, 6);
      ctx.closePath();
      ctx.fillStyle = M.alu.face;
      ctx.fill();
      ctx.strokeStyle = M.alu.dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    };
    if (!bat.broken) drawBatBody(pivot.x, pivot.y, bat.a, 0.05, 1);
    else {
      drawBatBody(pivot.x, pivot.y, bat.a, 0.05, 0.42);
      drawBatBody(bat.barrel.x, bat.barrel.y, bat.barrel.a, 0, 0.58);
    }
    disc(ctx, pivot.x, pivot.y, 12, M.steel, 4);
    bolt(ctx, pivot.x, pivot.y, 3, M.steel);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 170, 40, ${flash * 0.9})`;
      ctx.beginPath();
      ctx.arc(pivot.x - 18, pivot.y, 10 + 30 * (1 - flash), 0, Math.PI * 2);
      ctx.fill();
    }
    // the ball
    if (ball.live || phase === 'idle') {
      ctx.fillStyle = P.ball;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 0.037 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    // the figures, on the canvas where the slow-motion camera would print them
    ctx.font = fontFor(12, 700);
    ctx.fillStyle = P.muted;
    ctx.textBaseline = 'top';
    ctx.fillText(`1/8 speed · bat ${BAT_L} m, ${BAT_M} kg effective · ball ${BALL_M} kg · e ${E}`, 12, 10);
    if (result) {
      ctx.fillStyle = result.broke ? P.accent : P.ink;
      ctx.fillText(`exit ${result.exit.toFixed(1)} m/s · carry ${result.carry.toFixed(0)} m · handle ${Math.round(result.force).toLocaleString()} N`, 12, 28);
    }
  }

  return {
    swing(c) {
      interacted = true;
      swing(c);
    },
  };
}
