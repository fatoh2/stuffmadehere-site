/** Eight motion-capture cameras. Shane aimed his bow at flying targets with eight OptiTrack cameras. Here
 *  eight pan heads on the walls of the shop follow whatever moves in it: your pointer, or, when nobody is
 *  there, a tour of the tools. Each head is on its own motor with a speed and acceleration limit, so they
 *  lag and settle like real pan heads; where their sight lines cross, the point is locked and the tool
 *  nearest to it lights up. New. */
import { axis, stepAxis, type Axis } from '../lib/motor';
import { bar, disc, fit, metals, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { finePointer, onVisible, reducedMotion } from '../lib/visible';

interface Cam {
  fx: number; // position as a fraction of the stage
  fy: number;
  pan: Axis;
}

const SPOTS: [number, number][] = [
  [0.03, 0.05],
  [0.5, 0.03],
  [0.97, 0.05],
  [0.03, 0.5],
  [0.97, 0.5],
  [0.03, 0.95],
  [0.5, 0.97],
  [0.97, 0.95],
];

export function mountMocap(stage: HTMLElement, cv: HTMLCanvasElement, tools: HTMLElement[]): void {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  const cams: Cam[] = SPOTS.map(([fx, fy]) => ({ fx, fy, pan: axis(0, 5, 28) }));
  const centres: { x: number; y: number }[] = [];
  const target = { x: 0, y: 0 };
  let tracked = -1;
  let lastPointer = -1e9;
  let tourAt = 0;
  let tourIdx = 0;
  let visible = true;

  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    const sr = stage.getBoundingClientRect();
    centres.length = 0;
    for (const t of tools) {
      const r = t.getBoundingClientRect();
      centres.push({ x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 });
    }
    if (centres[tourIdx] && performance.now() - lastPointer > 2500) {
      target.x = centres[tourIdx].x;
      target.y = centres[tourIdx].y;
    }
  };
  new ResizeObserver(layout).observe(stage);
  layout();
  if (centres[0]) {
    target.x = centres[0].x;
    target.y = centres[0].y;
  }

  const setTarget = (clientX: number, clientY: number): void => {
    const sr = stage.getBoundingClientRect();
    target.x = clientX - sr.left;
    target.y = clientY - sr.top;
    lastPointer = performance.now();
  };
  if (finePointer()) stage.addEventListener('pointermove', (e) => setTarget(e.clientX, e.clientY), { passive: true });
  stage.addEventListener('pointerdown', (e) => setTarget(e.clientX, e.clientY), { passive: true });
  tools.forEach((t, i) =>
    t.addEventListener('focus', () => {
      if (centres[i]) {
        target.x = centres[i].x;
        target.y = centres[i].y;
        lastPointer = performance.now();
      }
    }),
  );

  const mark = (i: number): void => {
    if (i === tracked) return;
    tools[tracked]?.classList.remove('is-tracked');
    tracked = i;
    tools[tracked]?.classList.add('is-tracked');
  };

  function frame(locked: boolean): void {
    ctx.clearRect(0, 0, W, H);
    for (const c of cams) {
      const cx = c.fx * W;
      const cy = c.fy * H;
      // the sight line from the lens to the target
      ctx.strokeStyle = locked ? P.accent : P.steel;
      ctx.globalAlpha = locked ? 0.55 : 0.22;
      ctx.lineWidth = 1;
      // the line runs along the head's own bearing for the distance to the target, so a head that is
      // still turning points past the mark until it settles
      const dist = Math.hypot(target.x - cx, target.y - cy);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(c.pan.p) * 18, cy + Math.sin(c.pan.p) * 18);
      ctx.lineTo(cx + Math.cos(c.pan.p) * dist, cy + Math.sin(c.pan.p) * dist);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // the pan head: a base, a body turned to the pan angle, a lens, a tally light
      disc(ctx, cx, cy, 11, M.anod);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(c.pan.p);
      bar(ctx, -10, -8, 28, 16, M.steel, 2.5);
      disc(ctx, 18, 0, 6, M.anod, 2.5);
      ctx.fillStyle = locked ? P.accent : P.steelDark;
      ctx.fillRect(-8, -4, 4, 8);
      ctx.restore();
    }
    // the point where the lines cross
    const tx = Math.max(0, Math.min(W, target.x));
    const ty = Math.max(0, Math.min(H, target.y));
    ctx.strokeStyle = locked ? P.accent : P.steel;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tx, ty, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx - 16, ty);
    ctx.lineTo(tx - 6, ty);
    ctx.moveTo(tx + 6, ty);
    ctx.lineTo(tx + 16, ty);
    ctx.moveTo(tx, ty - 16);
    ctx.lineTo(tx, ty - 6);
    ctx.moveTo(tx, ty + 6);
    ctx.lineTo(tx, ty + 16);
    ctx.stroke();
  }

  const aimAll = (dt: number): boolean => {
    let locked = true;
    for (const c of cams) {
      const want = Math.atan2(target.y - c.fy * H, target.x - c.fx * W);
      let diff = want - c.pan.p;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (dt > 0) stepAxis(c.pan, c.pan.p + diff, dt);
      else c.pan.p = want;
      if (Math.abs(diff) > 0.03) locked = false;
    }
    return locked;
  };

  const nearest = (): number => {
    let best = -1;
    let bd = 150;
    centres.forEach((c, i) => {
      const d = Math.hypot(c.x - target.x, c.y - target.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  if (reducedMotion()) {
    aimAll(0);
    mark(0);
    frame(true);
    return;
  }

  onVisible(stage, (v) => (visible = v), 0.1);
  addTicker((dt, now) => {
    if (!visible) return;
    // nobody has moved for a while: the cameras tour the tools one by one
    if (now - lastPointer > 2500 && centres.length) {
      if (now > tourAt) {
        tourAt = now + 2600;
        tourIdx = (tourIdx + 1) % centres.length;
      }
      const c = centres[tourIdx];
      target.x += (c.x - target.x) * Math.min(1, dt * 4);
      target.y += (c.y - target.y) * Math.min(1, dt * 4);
    }
    const locked = aimAll(dt);
    mark(locked ? nearest() : -1);
    frame(locked);
  });
}
