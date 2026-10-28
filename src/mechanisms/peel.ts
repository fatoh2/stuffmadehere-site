/** Mechanism A: the apple-peel reveal. The text block is covered by a skin; as the section scrolls in,
 *  a blade peels it off in one continuous strip that runs back and forth, the strip rolling up behind
 *  the blade. From "I made an apple peel itself" (2026). */
import { DPR, fit, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion, narrow } from '../lib/visible';
import { clamp } from '../lib/motor';
import { stepSpring } from '../lib/spring';
import { sprite, drawSprite, near } from '../lib/sprites';

export interface PeelHandle {
  reset(): void;
}

export function mountPeel(section: HTMLElement, textEl: HTMLElement, canvas: HTMLCanvasElement): PeelHandle {
  if (reducedMotion()) {
    canvas.remove();
    return { reset() {} };
  }
  const P = palette();
  let ctx!: CanvasRenderingContext2D;
  let W = 0;
  let H = 0;
  let skin!: HTMLCanvasElement;
  let sctx!: CanvasRenderingContext2D;
  let box = { x: 0, y: 0, w: 0, h: 0 };
  let strip = 28;
  let rowsN = 0;
  let total = 0;
  let cut = 0; // length already peeled (px along the path)
  const blade = { x: 0, v: 0 };
  let visible = false;
  let dropT = -1;
  let roll = { x: 0, y: 0, r: 0 };

  function layout(): void {
    const f = fit(canvas);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    const sr = section.getBoundingClientRect();
    const tr = textEl.getBoundingClientRect();
    box = { x: tr.left - sr.left - 8, y: tr.top - sr.top - 8, w: tr.width + 16, h: tr.height + 16 };
    strip = narrow() ? 38 : 30;
    rowsN = Math.ceil(box.h / strip);
    total = rowsN * box.w;
    skin = document.createElement('canvas');
    const d = DPR();
    skin.width = Math.ceil(W * d);
    skin.height = Math.ceil(H * d);
    sctx = skin.getContext('2d')!;
    sctx.setTransform(d, 0, 0, d, 0, 0);
    sctx.fillStyle = P.surface;
    sctx.fillRect(box.x, box.y, box.w, box.h);
    // re-cut what was already peeled
    const was = cut;
    cut = 0;
    erase(was);
  }
  layout();
  new ResizeObserver(layout).observe(section);
  onVisible(section, (v) => (visible = v), 0.01);
  near(section, ['peeler']);

  /** position along the path -> point and direction */
  function at(s: number): { x: number; y: number; dir: number; row: number } {
    const row = clamp(Math.floor(s / box.w), 0, rowsN - 1);
    const u = s - row * box.w;
    const dir = row % 2 === 0 ? 1 : -1;
    const x = dir > 0 ? box.x + u : box.x + box.w - u;
    const y = box.y + row * strip + strip / 2;
    return { x, y, dir, row };
  }

  function erase(to: number): void {
    to = clamp(to, 0, total);
    if (to <= cut) return;
    sctx.save();
    sctx.globalCompositeOperation = 'destination-out';
    sctx.fillStyle = '#000';
    for (let s = cut; s < to; s += 4) {
      const p = at(s);
      sctx.fillRect(p.x - 3, p.y - strip / 2 - 0.5, 7, strip + 1);
    }
    const p = at(to);
    sctx.fillRect(p.x - 3, p.y - strip / 2 - 0.5, 7, strip + 1);
    sctx.restore();
    cut = to;
  }

  addTicker((dt) => {
    if (!visible) return;
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight;
    // peel progress: starts when the block enters, done when it is three-quarters up the screen
    const prog = clamp((vh * 0.92 - r.top - box.y) / (box.h + vh * 0.28), 0, 1);
    const target = prog * total;
    stepSpring(blade, target, dt, 0.5, 1);
    const s = clamp(blade.x, 0, total);
    erase(s);
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(skin, 0, 0, W, H);
    const p = at(s);
    if (cut < total - 1) {
      // the roll of peeled skin just behind the blade
      roll.r = 8 + 10 * (cut / total);
      roll.x = p.x - p.dir * (roll.r + 10);
      roll.y = p.y;
      drawRoll(roll.x, roll.y, roll.r, p.dir);
      // the blade: the rendered peeler head, pointing along the cut
      const bladeImg = sprite('peeler');
      if (bladeImg) drawSprite(ctx, bladeImg, p.x, p.y, strip * 1.05, 0.72, 0.5, 0, p.dir < 0);
      else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.dir, 1);
        ctx.fillStyle = P.steel;
        ctx.beginPath();
        ctx.moveTo(-4, -strip / 2);
        ctx.lineTo(14, 0);
        ctx.lineTo(-4, strip / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else {
      // finished: the roll drops off the bottom corner and is gone
      if (dropT < 0) dropT = 0;
      dropT += dt;
      if (dropT < 1.2) {
        const y = roll.y + 0.5 * 1600 * dropT * dropT;
        ctx.globalAlpha = 1 - dropT / 1.2;
        drawRoll(roll.x + p.dir * 40 * dropT, y, roll.r, p.dir, dropT * 6);
        ctx.globalAlpha = 1;
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    }
  });

  function drawRoll(x: number, y: number, r: number, dir: number, spin = 0): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.strokeStyle = P.surface;
    ctx.lineWidth = strip * 0.42;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    const turns = 2.6;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const a = t * turns * Math.PI * 2;
      const rr = r * (0.25 + 0.75 * t);
      const px = Math.cos(a) * rr * dir;
      const py = Math.sin(a) * rr;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.strokeStyle = P.steelDark;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  return {
    reset() {
      cut = 0;
      blade.x = 0;
      blade.v = 0;
      dropT = -1;
      layout();
    },
  };
}
