/** A hand-cranked film projector. The crank turns a Geneva driver; the four-slot wheel it indexes pulls
 *  the film one frame per turn, with the real dwell between frames, and the shutter covers the gate while
 *  the film moves. Each frame is a chapter of this site's own build. Crank it by dragging the handle,
 *  winding the film, the wheel, the arrow keys or the buttons. New; the Geneva is the method section's. */
import { axis, stepAxis, type Axis } from '../lib/motor';
import { bar, bolt, disc, fit, metals, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { localPoint, capture } from '../lib/pointer';
import { onVisible, reducedMotion } from '../lib/visible';
import { drawSprite, sprite } from '../lib/sprites';
import { cue } from '../lib/sound';

export interface Frame {
  src: string;
  title: string;
  text: string;
}

export interface ProjectorHandle {
  step(n: number): void;
}

const TAU = Math.PI * 2;

/** the film position, in frames, for a driver angle: dwell, then a quarter-turn transfer each revolution */
function film(theta: number): number {
  const turn = Math.floor(theta / TAU);
  const a = theta - turn * TAU - Math.PI; // engagement centred at half a turn
  let frac = 0;
  if (a > Math.PI / 4) frac = 1;
  else if (a >= -Math.PI / 4) {
    const d = Math.atan2(Math.sin(a), Math.SQRT2 - Math.cos(a));
    frac = (d + Math.PI / 4) / (Math.PI / 2);
  }
  return turn + frac;
}

export function mountProjector(cv: HTMLCanvasElement, frames: Frame[], onFrame: (i: number, moving: boolean) => void): ProjectorHandle {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  const imgs = frames.map((f) => {
    const im = new Image();
    im.decoding = 'async';
    im.src = f.src;
    return im;
  });
  sprite('geneva');
  sprite('driver');
  sprite('crank');
  const crank: Axis = axis(0, 11, 70);
  let target = 0;
  const maxTheta = (frames.length - 1) * TAU;
  let shownFrame = -1;
  let lastPos = 0;
  let visible = true;
  let drag: { kind: 'crank' | 'film'; a: number; y: number; t: number; v: number } | null = null;

  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
  };
  new ResizeObserver(layout).observe(cv);
  layout();

  const geom = () => {
    const narrow = W < 700;
    const gateW = narrow ? W * 0.9 : Math.min(W * 0.6, (H - 40) * (16 / 9));
    const gateH = (gateW * 9) / 16;
    const gx = narrow ? (W - gateW) / 2 : 24;
    const gy = narrow ? 12 : (H - gateH) / 2 - (narrow ? 0 : 10);
    const r = narrow ? Math.min(44, W * 0.11) : Math.min(60, H * 0.12);
    const mech = narrow ? { x: W * 0.72, y: gy + gateH + r * 1.25 } : { x: gx + gateW + (W - gx - gateW) * 0.5, y: H * 0.36 };
    const handle = narrow ? { x: W * 0.28, y: gy + gateH + r * 1.25 } : { x: mech.x, y: H * 0.78 };
    return { gateW, gateH, gx, gy, r, mech, handle, narrow };
  };

  function setTarget(t: number): void {
    target = Math.max(0, Math.min(maxTheta, t));
  }

  /* ---------- input: the handle, the film, the wheel, the keys ---------- */
  cv.addEventListener('pointerdown', (e) => {
    const p = localPoint(cv, e, W, H);
    const g = geom();
    const d = Math.hypot(p.x - g.handle.x, p.y - g.handle.y);
    capture(cv, e);
    e.preventDefault();
    if (d < g.r * 2.2) drag = { kind: 'crank', a: Math.atan2(p.y - g.handle.y, p.x - g.handle.x), y: p.y, t: performance.now(), v: 0 };
    else drag = { kind: 'film', a: 0, y: p.y, t: performance.now(), v: 0 };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = localPoint(cv, e, W, H);
    const g = geom();
    const now = performance.now();
    const dt = Math.max(1, now - drag.t) / 1000;
    let d = 0;
    if (drag.kind === 'crank') {
      const a = Math.atan2(p.y - g.handle.y, p.x - g.handle.x);
      d = a - drag.a;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      drag.a = a;
    } else {
      d = (drag.y - p.y) * 0.022; // winding the film up pulls the next frame down into the gate
      drag.y = p.y;
    }
    setTarget(target + d);
    drag.v = drag.v * 0.6 + (d / dt) * 0.4;
    drag.t = now;
  });
  const release = (): void => {
    if (!drag) return;
    // a flick carries on: the flywheel's momentum, projected and settled on a whole frame
    const carry = Math.max(-TAU * 3, Math.min(TAU * 3, drag.v * 0.25));
    setTarget(Math.round((target + carry) / TAU) * TAU);
    drag = null;
  };
  cv.addEventListener('pointerup', release);
  cv.addEventListener('pointercancel', release);
  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      setTarget(target + e.deltaY * 0.012);
      window.clearTimeout(settle);
      settle = window.setTimeout(() => setTarget(Math.round(target / TAU) * TAU), 180);
    },
    { passive: false },
  );
  let settle = 0;
  cv.tabIndex = 0;
  cv.setAttribute('aria-label', 'A film projector showing the build of this site. Left and right arrow keys move one frame.');
  cv.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    }
  });
  function step(n: number): void {
    setTarget(Math.round(target / TAU) * TAU + n * TAU);
  }

  /* ---------- drawing ---------- */
  function draw(moving: number): void {
    const { gateW, gateH, gx, gy, r, mech, handle, narrow } = geom();
    const pos = film(crank.p);
    ctx.clearRect(0, 0, W, H);
    // the projector body: a dark plate with the gate cut in it
    ctx.fillStyle = P.recess;
    ctx.fillRect(0, 0, W, H);
    // the film path: the strip runs top to bottom through the gate, frames stacked with sprocket holes
    const frameH = gateH + 16;
    const stripX = gx - 18;
    const stripW = gateW + 36;
    ctx.save();
    ctx.beginPath();
    ctx.rect(stripX, 0, stripW, H);
    ctx.clip();
    ctx.fillStyle = '#2a2b30';
    ctx.fillRect(stripX, 0, stripW, H);
    const first = Math.max(0, Math.floor(pos) - 2);
    const last = Math.min(frames.length - 1, Math.ceil(pos) + 2);
    for (let i = first; i <= last; i++) {
      const y = gy + (i - pos) * frameH;
      const im = imgs[i];
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(gx, y, gateW, gateH);
      if (im.complete && im.naturalWidth) ctx.drawImage(im, gx, y, gateW, gateH);
      // the frame number in the margin
      ctx.fillStyle = P.steelDark;
      ctx.font = '700 10px Chivo, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1).padStart(2, '0'), stripX + 4, y + gateH - 4);
    }
    // sprocket holes, four per frame each side, moving with the film
    ctx.fillStyle = '#0a0a0c';
    const holeStep = frameH / 4;
    const offset = ((-pos * frameH) % holeStep) - holeStep;
    for (let y = offset; y < H + holeStep; y += holeStep) {
      ctx.fillRect(stripX + 5, y + holeStep * 0.3, 8, holeStep * 0.4);
      ctx.fillRect(stripX + stripW - 13, y + holeStep * 0.3, 8, holeStep * 0.4);
    }
    ctx.restore();
    // the gate: everything outside it is the body, dimmed; the shutter darkens the gate as the film moves
    ctx.fillStyle = 'rgba(13,14,16,0.82)';
    ctx.fillRect(stripX, 0, stripW, gy - 4);
    ctx.fillRect(stripX, gy + gateH + 4, stripW, H - gy - gateH - 4);
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.92, moving * 0.92)})`;
    ctx.fillRect(gx, gy, gateW, gateH);
    bar(ctx, stripX - 6, gy - 10, 6, gateH + 20, M.steel, 1.5);
    bar(ctx, stripX + stripW, gy - 10, 6, gateH + 20, M.steel, 1.5);
    bolt(ctx, stripX - 3, gy - 4, 2.5, M.anod);
    bolt(ctx, stripX - 3, gy + gateH + 4, 2.5, M.anod);
    bolt(ctx, stripX + stripW + 3, gy - 4, 2.5, M.anod);
    bolt(ctx, stripX + stripW + 3, gy + gateH + 4, 2.5, M.anod);
    // the Geneva: the driver with its pin, the four-slot wheel it indexes; the wheel's sprite sits at +45°
    const gw = sprite('geneva');
    const dr = sprite('driver');
    const wheelA = (pos * Math.PI) / 2;
    const wx = mech.x - r * 0.95;
    const wy = mech.y;
    const dx = mech.x + r * 0.75;
    const dy = mech.y;
    ctx.fillStyle = '#222328';
    ctx.beginPath();
    ctx.roundRect(mech.x - r * 2.2, mech.y - r * 1.3, r * 4.4, r * 2.6, 6);
    ctx.fill();
    if (gw) drawSprite(ctx, gw, wx, wy, r * 2.1, 0.5, 0.5, wheelA + Math.PI / 4);
    else disc(ctx, wx, wy, r, M.alu, r * 0.2);
    if (dr) drawSprite(ctx, dr, dx, dy, r * 1.5, 0.5, 0.5, crank.p);
    else disc(ctx, dx, dy, r * 0.7, M.anod, r * 0.1);
    bolt(ctx, wx, wy, r * 0.12, M.steel);
    // the belt from the crank to the driver, and the crank itself
    if (!narrow) {
      ctx.strokeStyle = M.steel.dark;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(dx - r * 0.5, dy + r * 0.3);
      ctx.lineTo(handle.x - r * 0.5, handle.y - r * 0.3);
      ctx.moveTo(dx + r * 0.5, dy + r * 0.3);
      ctx.lineTo(handle.x + r * 0.5, handle.y - r * 0.3);
      ctx.stroke();
    }
    // the flywheel, and the crank on its hub; a red ring round the grip while it is being turned
    disc(ctx, handle.x, handle.y, r, M.anod, r * 0.12);
    const crankImg = sprite('crank');
    ctx.save();
    ctx.translate(handle.x, handle.y);
    ctx.rotate(crank.p);
    if (crankImg) {
      drawSprite(ctx, crankImg, 0, 0, r * 0.9, 0.115, 0.792);
      if (drag?.kind === 'crank') {
        ctx.strokeStyle = P.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r * 0.9 * (360 / 209) * 0.82, -r * 0.9 * 0.45, r * 0.22, 0, TAU);
        ctx.stroke();
      }
    } else {
      bar(ctx, -r * 0.08, -r * 0.08, r * 0.95, r * 0.16, M.alu, 2);
      disc(ctx, r * 0.8, 0, r * 0.22, M.steel, r * 0.06);
      ctx.fillStyle = drag?.kind === 'crank' ? P.accent : P.ball;
      ctx.beginPath();
      ctx.arc(r * 0.8, 0, r * 0.14, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  if (reducedMotion()) {
    draw(0);
    onFrame(0, false);
    return {
      step(n) {
        crank.p = Math.max(0, Math.min(maxTheta, crank.p + n * TAU));
        target = crank.p;
        draw(0);
        onFrame(Math.round(film(crank.p)), false);
      },
    };
  }
  onVisible(cv, (v) => (visible = v), 0.1);
  addTicker((dt) => {
    if (!visible) return;
    stepAxis(crank, target, dt);
    const pos = film(crank.p);
    const moving = Math.min(1, Math.abs(pos - lastPos) / Math.max(1e-3, dt) / 2.5);
    lastPos = pos;
    const idx = Math.max(0, Math.min(frames.length - 1, Math.round(pos)));
    if (idx !== shownFrame && Math.abs(pos - idx) < 0.08) {
      shownFrame = idx;
      cue.index();
      onFrame(idx, false);
    }
    draw(moving);
  });
  onFrame(0, false);
  return { step };
}
