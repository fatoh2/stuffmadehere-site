/** Days since the last video, kept by an escapement. A pendulum rocks an anchor over a thirty-tooth
 *  escape wheel; every swing lets one tooth past, so the wheel turns once every thirty seconds and the
 *  count below it is true to the second. New. */
import { bolt, disc, fit, metals, palette } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion } from '../lib/visible';
import { drawSprite, sprite } from '../lib/sprites';

export interface EscapementHandle {
  setSince(d: Date): void;
}

export function mountEscapement(cv: HTMLCanvasElement, since: Date, out: { days: HTMLElement | null; clock: HTMLElement | null }): EscapementHandle {
  const handle: EscapementHandle = {
    setSince(d) {
      since = d;
      shownSecond = -1;
      tell(Date.now());
    },
  };
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  let visible = true;
  const TEETH = 30;
  sprite('escape');
  sprite('anchor');
  sprite('bob');
  const layout = (): void => {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
  };
  new ResizeObserver(layout).observe(cv);
  layout();

  let shownSecond = -1;
  const tell = (now: number): void => {
    const total = Math.max(0, Math.floor((now - since.getTime()) / 1000));
    if (total === shownSecond) return;
    shownSecond = total;
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (out.days) out.days.textContent = String(d);
    if (out.clock) out.clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  function draw(now: number): void {
    ctx.clearRect(0, 0, W, H);
    const r = Math.min(W, H) * 0.2;
    const cx = W * 0.5;
    const cy = H * 0.47;
    const t = now / 1000;
    const sec = Math.floor(t);
    const frac = t - sec;
    // the pendulum swings once a second each way; the wheel snaps a tooth at each turn of the swing
    const swing = Math.sin(Math.PI * (t % 2)) * 0.28;
    const snap = Math.min(1, frac / 0.12);
    const ease = 1 - (1 - snap) * (1 - snap);
    const wheelA = ((sec - 1 + ease) * Math.PI * 2) / TEETH;
    // the escape wheel: the brass render when it is loaded, the drawn one until then
    const wheelImg = sprite('escape');
    const anchorImg = sprite('anchor');
    const bobImg = sprite('bob');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelA);
    if (wheelImg) drawSprite(ctx, wheelImg, 0, 0, r * 2.04, 0.5, 0.5);
    else {
      ctx.fillStyle = M.anod.face;
      ctx.beginPath();
      for (let i = 0; i < TEETH; i++) {
        const a0 = (i / TEETH) * Math.PI * 2;
        const a1 = ((i + 0.55) / TEETH) * Math.PI * 2;
        const a2 = ((i + 1) / TEETH) * Math.PI * 2;
        ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
        ctx.lineTo(Math.cos(a1) * r * 0.86, Math.sin(a1) * r * 0.86);
        ctx.lineTo(Math.cos(a2) * r * 0.86, Math.sin(a2) * r * 0.86);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = M.anod.dark;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = P.paper;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    disc(ctx, cx, cy, r * 0.14, M.steel, r * 0.05);
    // the anchor, rocking with the pendulum above the wheel, its pallets on the teeth
    const ax = cx;
    const ay = anchorImg ? cy - r * 1.99 : cy - r * 1.32;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(swing * 0.45);
    if (anchorImg) {
      drawSprite(ctx, anchorImg, 0, 0, r * 1.2, 0.501, 0.132);
    } else {
      ctx.strokeStyle = M.steel.dark;
      ctx.lineWidth = Math.max(5, r * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.95, Math.PI * 0.28, Math.PI * 0.72);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(Math.PI * 0.28) * r * 0.95, Math.sin(Math.PI * 0.28) * r * 0.95);
      ctx.lineTo(Math.cos(Math.PI * 0.2) * r * 1.12, Math.sin(Math.PI * 0.2) * r * 1.12);
      ctx.moveTo(Math.cos(Math.PI * 0.72) * r * 0.95, Math.sin(Math.PI * 0.72) * r * 0.95);
      ctx.lineTo(Math.cos(Math.PI * 0.8) * r * 1.12, Math.sin(Math.PI * 0.8) * r * 1.12);
      ctx.stroke();
    }
    ctx.restore();
    bolt(ctx, ax, ay, r * 0.09, M.steel);
    // the pendulum hangs from the anchor's pivot, down past the wheel, the bob at its end
    const bobH = r * 0.62;
    const len = H - ay - bobH * 0.6;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(swing);
    ctx.strokeStyle = M.steel.face;
    ctx.lineWidth = Math.max(3, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, len - bobH * 0.4);
    ctx.stroke();
    if (bobImg) drawSprite(ctx, bobImg, 0, len, bobH, 0.5, 0.47);
    else disc(ctx, 0, len, r * 0.3, M.anod, r * 0.08);
    ctx.restore();
  }

  if (reducedMotion()) {
    tell(Date.now());
    draw(Date.now());
    window.setInterval(() => tell(Date.now()), 1000);
    return handle;
  }
  onVisible(cv, (v) => (visible = v), 0.1);
  addTicker(() => {
    const now = Date.now();
    tell(now);
    if (visible) draw(now);
  });
  return handle;
}
