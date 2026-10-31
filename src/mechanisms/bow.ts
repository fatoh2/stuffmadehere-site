/** Mechanism 17: the bow aimed by cameras. Two cameras at the top corners each see a bearing to the
 *  flying target; where the two rays cross is the fix, with the error a bearing's noise gives it. A
 *  tracker fits a velocity to the last fixes, predicts the target's path under gravity, solves the lead
 *  (how long the arrow takes to get where the target will be), and the bow's pan motor turns there under
 *  its limits. It fires when the lead solve settles. The first target of a visit is missed: one camera
 *  is 2.5° out of calibration, the miss is measured and the bearing corrected. From "Auto-aiming bow vs.
 *  FLYING targets" (2021). */
import { cue } from '../lib/sound';
import { axis, stepAxis } from '../lib/motor';
import { fit, palette, metals, bar, disc, bolt, fontFor } from '../lib/canvas';
import { sprite, drawSprite, near } from '../lib/sprites';
import { VelocityTracker, localPoint, capture } from '../lib/pointer';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion } from '../lib/visible';
import { startGhost, stepGhost, drawGhost, type GhostState } from '../lib/ghost';

export interface BowHandle {
  launch(): void;
}

const G = 1500;
const ARROW_V = 1900;
const NOISE = 0.5 * (Math.PI / 180); // a camera's bearing noise
const BIAS0 = 2.5 * (Math.PI / 180); // camera 2's calibration error on the first target
const DEG = 180 / Math.PI;

interface Target {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hit: boolean;
  t: number;
  halves?: { x: number; y: number; vx: number; vy: number; a: number }[];
}

export function mountBow(cv: HTMLCanvasElement, stat: HTMLElement | null): BowHandle {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  const cam = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  const bow = { x: 0, y: 0, pan: axis(-Math.PI / 2, 6, 60) };
  let target: Target | null = null;
  const fixes: { x: number; y: number; t: number }[] = [];
  let fix: { x: number; y: number; err: number } | null = null;
  let lead: { tau: number; aim: number; px: number; py: number } | null = null;
  let arrow: { x: number; y: number; vx: number; vy: number; live: boolean; t: number } | null = null;
  let bias = BIAS0;
  let shots = 0;
  let hits = 0;
  let lastMiss: number | null = null;
  let visible = false;
  let idleAt = performance.now() + 2000;
  let interacted = false;
  let ghost: GhostState | null = null;
  let demos = 0;
  let drag: { tracker: VelocityTracker; x: number; y: number } | null = null;
  const still = reducedMotion();
  near(cv, ['mocam', 'servo']);

  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    cam[0] = { x: 28, y: 30 };
    cam[1] = { x: W - 28, y: 30 };
    bow.x = W * 0.5;
    bow.y = H - 34;
  };
  layout();
  new ResizeObserver(layout).observe(cv);
  onVisible(cv, (v) => {
    visible = v;
    if (v) idleAt = Math.max(idleAt, performance.now() + 1400);
  }, 0.3);

  const tell = (text: string): void => {
    if (stat) stat.textContent = text;
  };

  /* ---------- targets: the machine throws one, or the visitor does ---------- */
  function throwTarget(x: number, y: number, vx: number, vy: number): void {
    target = { x, y, vx, vy, hit: false, t: 0 };
    fixes.length = 0;
    fix = null;
    lead = null;
    arrow = null;
    lastMiss = null;
    shots++;
    tell(shots === 1 ? 'first target: camera 2 is 2.5° out of calibration' : `${hits} of ${shots - 1} hit so far`);
  }
  function launch(): void {
    // from the right edge, up and across, as a clay thrower would
    const x = W - 50;
    const y = H * 0.75;
    const vx = -(W * 0.55 + Math.random() * W * 0.25);
    const vy = -(H * 1.2 + Math.random() * H * 0.5);
    throwTarget(x, y, vx, vy);
  }

  cv.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    interacted = true;
    ghost = null;
    capture(cv, e);
    const p = localPoint(cv, e, W, H);
    const tr = new VelocityTracker(110);
    tr.push(p.x, p.y);
    drag = { tracker: tr, x: p.x, y: p.y };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = localPoint(cv, e, W, H);
    drag.x = p.x;
    drag.y = p.y;
    drag.tracker.push(p.x, p.y);
  });
  const release = (): void => {
    if (!drag) return;
    const v = drag.tracker.velocity();
    const sp = Math.hypot(v.vx, v.vy);
    const x = drag.x;
    const y = drag.y;
    drag = null;
    if (sp < 160) return;
    const cap = 2200;
    const k = sp > cap ? cap / sp : 1;
    throwTarget(x, y, v.vx * k, v.vy * k);
    idleAt = performance.now() + 7000;
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', () => (drag = null));
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.tabIndex = 0;
  cv.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      interacted = true;
      launch();
      idleAt = performance.now() + 7000;
    }
  });

  /* ---------- the cameras: two bearings, one fix ---------- */
  function observe(tg: Target): void {
    const b0 = Math.atan2(tg.y - cam[0].y, tg.x - cam[0].x) + (Math.random() - 0.5) * NOISE;
    const b1 = Math.atan2(tg.y - cam[1].y, tg.x - cam[1].x) + (Math.random() - 0.5) * NOISE + bias;
    // intersect the two rays
    const d0x = Math.cos(b0);
    const d0y = Math.sin(b0);
    const d1x = Math.cos(b1);
    const d1y = Math.sin(b1);
    const den = d0x * d1y - d0y * d1x;
    if (Math.abs(den) < 1e-4) return;
    const rx = cam[1].x - cam[0].x;
    const ry = cam[1].y - cam[0].y;
    const t0 = (rx * d1y - ry * d1x) / den;
    const x = cam[0].x + d0x * t0;
    const y = cam[0].y + d0y * t0;
    // the fix's error: the bearing noise at that range, across the rays
    const range = Math.hypot(x - cam[0].x, y - cam[0].y);
    const err = (range * NOISE) / Math.max(0.2, Math.abs(Math.sin(b1 - b0)));
    fix = { x, y, err };
    fixes.push({ x, y, t: tg.t });
    if (fixes.length > 8) fixes.shift();
  }

  /** velocity from the last fixes by least squares, then the lead: when and where the arrow meets it */
  function solve(): void {
    if (fixes.length < 3) {
      lead = null;
      return;
    }
    const n = fixes.length;
    const mt = fixes.reduce((a, f) => a + f.t, 0) / n;
    const mx = fixes.reduce((a, f) => a + f.x, 0) / n;
    const my = fixes.reduce((a, f) => a + (f.y - 0.5 * G * f.t * f.t), 0) / n; // gravity taken out of y
    let sxx = 0;
    let sxy = 0;
    let syy = 0;
    for (const f of fixes) {
      const dt = f.t - mt;
      sxx += dt * dt;
      sxy += dt * (f.x - mx);
      syy += dt * (f.y - 0.5 * G * f.t * f.t - my);
    }
    const vx = sxy / Math.max(1e-6, sxx);
    const vy0 = syy / Math.max(1e-6, sxx);
    const last = fixes[n - 1];
    const tnow = last.t;
    const yAt = (tau: number): number => my + vy0 * (tnow + tau - mt) + 0.5 * G * (tnow + tau) * (tnow + tau);
    const xAt = (tau: number): number => mx + vx * (tnow + tau - mt);
    // the arrow is treated as straight and fast; iterate the meeting time
    let tau = 0.3;
    for (let i = 0; i < 8; i++) {
      const px = xAt(tau);
      const py = yAt(tau);
      tau = Math.min(1.5, Math.hypot(px - bow.x, py - bow.y) / ARROW_V);
    }
    if (tau >= 1.5) {
      lead = null; // the target is out of the arrow's reach: no solution
      return;
    }
    const px = xAt(tau);
    const py = yAt(tau);
    lead = { tau, aim: Math.atan2(py - bow.y, px - bow.x), px, py };
  }

  function fire(): void {
    const a = bow.pan.p;
    arrow = { x: bow.x, y: bow.y, vx: Math.cos(a) * ARROW_V, vy: Math.sin(a) * ARROW_V, live: true, t: 0 };
    cue.flap();
  }

  /* ---------- the loop ---------- */
  addTicker(function bowTick(dt, now) {
    if (!visible) return;
    if (still) {
      draw();
      return;
    }
    if (visible && !interacted && !ghost && !target && demos < 2 && now > idleAt) {
      demos++;
      idleAt = now + 16000;
      // the ghost hand throws a target from the right, the way a visitor would
      const x0 = W - 70;
      const y0 = H * 0.7;
      ghost = startGhost(x0, y0, x0 - 120, y0 - 200, 0.3, (g) => throwTarget(g.x, g.y, g.vx * 0.9, g.vy * 0.9));
    } else if (!target && !ghost && now > idleAt) {
      launch();
      idleAt = now + 7000;
    }
    if (ghost) {
      stepGhost(ghost, dt);
      if (ghost.done) ghost = null;
    }
    if (target) {
      const tg = target;
      tg.t += dt;
      if (!tg.hit) {
        tg.vy += G * dt;
        tg.x += tg.vx * dt;
        tg.y += tg.vy * dt;
        // the cameras sample at 120 Hz
        if (Math.floor(tg.t * 120) !== Math.floor((tg.t - dt) * 120)) {
          observe(tg);
          solve();
        }
        if (lead) {
          stepAxis(bow.pan, lead.aim, dt);
          const settled = Math.abs(bow.pan.p - lead.aim) < 0.6 / DEG && fixes.length >= 5;
          if (settled && !arrow && lead.py > 20 && lead.py < bow.y - 40) fire();
        }
      } else if (tg.halves) {
        for (const h of tg.halves) {
          h.vy += G * dt;
          h.x += h.vx * dt;
          h.y += h.vy * dt;
          h.a += 4 * dt;
        }
      }
      if (arrow && arrow.live) {
        arrow.t += dt;
        arrow.vy += G * 0.25 * dt; // a fast arrow drops a little
        arrow.x += arrow.vx * dt;
        arrow.y += arrow.vy * dt;
        if (!tg.hit && Math.hypot(arrow.x - tg.x, arrow.y - tg.y) < 16) {
          tg.hit = true;
          hits++;
          arrow.live = false;
          cue.index();
          tg.halves = [
            { x: tg.x, y: tg.y, vx: tg.vx * 0.6 - 120, vy: tg.vy * 0.5 - 100, a: 0 },
            { x: tg.x, y: tg.y, vx: tg.vx * 0.6 + 120, vy: tg.vy * 0.5 - 60, a: Math.PI },
          ];
          tell(`hit · fix error ±${fix ? Math.round(fix.err) : 0} px · lead ${lead ? lead.tau.toFixed(2) : '–'} s · ${hits} of ${shots} hit`);
        } else if (arrow.y < -40 || arrow.x < -40 || arrow.x > W + 40 || arrow.y > H + 40) {
          arrow.live = false;
          // a miss: how far the arrow passed from the target when their paths crossed
          const miss = Math.round(Math.hypot(arrow.x - tg.x, arrow.y - tg.y));
          lastMiss = miss;
          if (bias !== 0) {
            tell(`missed by ${miss} px: camera 2 read ${(bias * DEG).toFixed(1)}° high. Calibrated.`);
            bias = 0;
          } else tell(`missed by ${miss} px · ${hits} of ${shots} hit`);
        }
      }
      if (tg.y > H + 60 || tg.x < -80 || tg.t > 6) {
        target = null;
        arrow = null;
        idleAt = Math.min(idleAt, now + 1800);
      }
    }
    draw();
  });

  /* ---------- drawing ---------- */
  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    // the floor and the bow's pan head
    ctx.fillStyle = P.surface;
    ctx.fillRect(0, H - 18, W, 18);
    const servo = sprite('servo');
    if (servo) drawSprite(ctx, servo, bow.x, H - 22, 40, 0.5, 1, 0);
    else bar(ctx, bow.x - 28, H - 48, 56, 30, M.anod, 3);
    // cameras and their rays
    const camImg = sprite('mocam');
    for (let i = 0; i < 2; i++) {
      const c = cam[i];
      const toward = target ? Math.atan2(target.y - c.y, target.x - c.x) : Math.PI / 2 + (i === 0 ? -0.5 : 0.5);
      ctx.save();
      ctx.translate(c.x, c.y);
      if (camImg) drawSprite(ctx, camImg, 0, 0, 30, 0.22, 0.5, toward + (i === 1 ? 0 : 0));
      else {
        ctx.rotate(toward);
        bar(ctx, -10, -8, 30, 16, M.anod, 2);
      }
      ctx.restore();
      if (target && !target.hit && fix) {
        ctx.strokeStyle = i === 1 && bias !== 0 ? P.accent : 'rgba(0,0,0,0.35)';
        ctx.setLineDash([3, 6]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(fix.x, fix.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // the fix and its error, the fitted path and the lead point
    if (fix && target && !target.hit) {
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(fix.x, fix.y, Math.max(3, fix.err), Math.max(3, fix.err * 0.5), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (lead && target && !target.hit) {
      ctx.strokeStyle = P.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(lead.px, lead.py, 7, 0, Math.PI * 2);
      ctx.moveTo(lead.px - 12, lead.py);
      ctx.lineTo(lead.px + 12, lead.py);
      ctx.moveTo(lead.px, lead.py - 12);
      ctx.lineTo(lead.px, lead.py + 12);
      ctx.stroke();
    }
    // the bow on its pan: a bar with a string, the arrow on it until it flies
    ctx.save();
    ctx.translate(bow.x, bow.y);
    ctx.rotate(bow.pan.p);
    ctx.strokeStyle = M.alu.face;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(-6, 0, 30, -Math.PI / 2 - 0.3, Math.PI / 2 + 0.3);
    ctx.stroke();
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6 + 30 * Math.cos(-Math.PI / 2 - 0.3), 30 * Math.sin(-Math.PI / 2 - 0.3));
    ctx.lineTo(arrow && arrow.live ? -6 : -22, 0);
    ctx.lineTo(-6 + 30 * Math.cos(Math.PI / 2 + 0.3), 30 * Math.sin(Math.PI / 2 + 0.3));
    ctx.stroke();
    if (!arrow || !arrow.live) {
      bar(ctx, -22, -2, 54, 4, M.steel, 1);
    }
    ctx.restore();
    disc(ctx, bow.x, bow.y, 7, M.steel);
    bolt(ctx, bow.x, bow.y, 2.5, M.steel);
    if (arrow && arrow.live) {
      ctx.save();
      ctx.translate(arrow.x, arrow.y);
      ctx.rotate(Math.atan2(arrow.vy, arrow.vx));
      bar(ctx, -26, -2, 52, 4, M.steel, 1);
      ctx.fillStyle = P.accent;
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(16, -5);
      ctx.lineTo(16, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // the target: an orange disc, or its two halves
    if (target) {
      ctx.fillStyle = P.ball;
      if (!target.hit) {
        ctx.beginPath();
        ctx.arc(target.x, target.y, 11, 0, Math.PI * 2);
        ctx.fill();
      } else if (target.halves) {
        for (const h of target.halves) {
          ctx.beginPath();
          ctx.arc(h.x, h.y, 11, h.a, h.a + Math.PI);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // the readout
    ctx.font = fontFor(12, 700);
    ctx.textBaseline = 'top';
    ctx.fillStyle = P.muted;
    ctx.fillText(`cameras at 120 Hz, noise ±${(NOISE * DEG).toFixed(1)}° · arrow ${ARROW_V} px/s · pan ${bow.pan.vmax} rad/s`, 58, 8);
    ctx.fillStyle = P.ink;
    const line = lead && target && !target.hit ? `fix ±${fix ? Math.round(fix.err) : 0} px · lead ${lead.tau.toFixed(2)} s · pan ${(bow.pan.p * DEG).toFixed(0)}° → ${(lead.aim * DEG).toFixed(0)}°` : lastMiss != null ? `last miss ${lastMiss} px` : '';
    if (line) ctx.fillText(line, 58, 24);
    if (ghost) drawGhost(ctx, ghost, P.ink);
  }

  return {
    launch() {
      interacted = true;
      if (!target) launch();
      idleAt = performance.now() + 7000;
    },
  };
}
