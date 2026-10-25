/** Mechanism 3: the camshaft drum. The 41 rows sit on a roll inside a fixed-height window; one cam per
 *  video runs down the left, lobe height is the view count, phase runs in upload order. Turning the shaft
 *  sweeps a wave of lobes down the list and the window follows the lifted row, so the whole archive is
 *  read by turning one shaft. Left alone it idles.
 *  Mechanism F, the auto-aim launcher, solves a ballistic shot for a random video and throws its card into
 *  the preview slot. */
import { axis, stepAxis, clamp } from '../lib/motor';
import { fit, palette, metals, bar, disc, bolt } from '../lib/canvas';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion, finePointer } from '../lib/visible';
import { capture } from '../lib/pointer';
import { stepSpring } from '../lib/spring';
import { sprite, drawSprite } from '../lib/sprites';

const TAU = Math.PI * 2;
const R0 = 13;
const LOBE_HALF = 0.42; // rad

interface Cam {
  row: HTMLAnchorElement;
  inline: HTMLElement | null;
  id: string;
  title: string;
  h: number;
  phase: number;
  cy: number; // row centre, relative to the roll
  lift: number;
  visible: boolean;
}

export interface CamshaftOptions {
  ledger: HTMLElement;
  shaftEl: HTMLElement;
  preview: HTMLElement;
  landing: HTMLElement;
  launcherCanvas: HTMLCanvasElement;
  fireButton: HTMLButtonElement;
  card: HTMLElement;
  scrollTo: (y: number) => void;
}

export function mountCamshaft(o: CamshaftOptions): void {
  const P = palette();
  const M = metals();
  const still = reducedMotion();
  const fine = finePointer();
  const cv = o.shaftEl.querySelector('canvas')!;
  const roll = o.ledger.querySelector<HTMLElement>('.ledger__roll')!;
  const rows = Array.from(o.ledger.querySelectorAll<HTMLAnchorElement>('.row'));
  const maxViews = Math.max(...rows.map((r) => +r.dataset.views!));
  const cams: Cam[] = rows.map((row, i) => ({
    row,
    inline: row.nextElementSibling instanceof HTMLElement && row.nextElementSibling.classList.contains('row__inline') ? row.nextElementSibling : null,
    id: row.dataset.id!,
    title: row.querySelector('.row__title')!.textContent!,
    h: 5 + 19 * Math.sqrt(+row.dataset.views! / maxViews),
    phase: -i * (TAU / rows.length),
    cy: 0,
    lift: 0,
    visible: true,
  }));
  const previewImg = o.preview.querySelector('img')!;
  const previewCap = o.preview.querySelector('figcaption')!;
  const landingImg = o.landing.querySelector('img')!;
  const landingCap = o.landing.querySelector('figcaption')!;
  const landingLink = o.landing.querySelector('a')!;

  let W = 0;
  let H = 0; // the window
  let rollH = 0;
  let ctx!: CanvasRenderingContext2D;
  let visible = false;
  let theta = 0;
  let omega = 0;
  let idle = true;
  let held: number | null = null;
  const drive = axis(0, 7, 40);
  let drag: { y: number; t: number; v: number } | null = null;
  let lastTouch = 0;
  let onRow = -1;
  const view = { x: 0, v: 0 }; // the roll's offset, spring-followed

  function layout(): void {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    const rr = roll.getBoundingClientRect();
    rollH = rr.height;
    for (const c of cams) {
      const r = c.row.getBoundingClientRect();
      c.cy = r.top - rr.top + r.height / 2;
    }
  }
  layout();
  new ResizeObserver(layout).observe(roll);
  new ResizeObserver(layout).observe(o.ledger);
  onVisible(o.ledger, (v) => (visible = v), 0.02);
  // keyboard focus inside the clipped window must not scroll it natively; the drum follows instead
  o.ledger.addEventListener('scroll', () => (o.ledger.scrollTop = 0), { passive: true });

  const bump = (ps: number): number => {
    ps = Math.atan2(Math.sin(ps), Math.cos(ps));
    return Math.abs(ps) < LOBE_HALF ? 0.5 * (1 + Math.cos((Math.PI * ps) / LOBE_HALF)) : 0;
  };
  const radius = (c: Cam, ps: number): number => R0 + c.h * bump(ps);
  const contact = (c: Cam): number => -(theta + c.phase);

  /* ---------- input ---------- */
  o.shaftEl.addEventListener('pointerdown', (e) => {
    capture(o.shaftEl, e);
    drag = { y: e.clientY, t: performance.now(), v: 0 };
    omega = 0;
    idle = false;
    lastTouch = performance.now();
  });
  o.shaftEl.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const now = performance.now();
    const dy = e.clientY - drag.y;
    const dt = Math.max(1, now - drag.t) / 1000;
    const d = dy * 0.012;
    theta += d;
    drag.v = drag.v * 0.5 + (d / dt) * 0.5;
    drag.y = e.clientY;
    drag.t = now;
    lastTouch = now;
  });
  const endDrag = (): void => {
    if (!drag) return;
    omega = clamp(drag.v, -14, 14);
    drag = null;
    lastTouch = performance.now();
  };
  o.shaftEl.addEventListener('pointerup', endDrag);
  o.shaftEl.addEventListener('pointercancel', endDrag);
  // a finger on the list itself turns the drum too (the shaft is a narrow target on a phone); the page
  // does not scroll under it, and a tap that does not move still opens the row
  let touchStart: { x: number; y: number; id: number } | null = null;
  let swiped = false;
  o.ledger.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || drag) return;
    touchStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
    swiped = false;
  });
  o.ledger.addEventListener('pointermove', (e) => {
    if (!touchStart || e.pointerId !== touchStart.id) return;
    if (!drag) {
      if (Math.hypot(e.clientX - touchStart.x, e.clientY - touchStart.y) < 8) return;
      swiped = true;
      capture(o.ledger, e);
      drag = { y: e.clientY, t: performance.now(), v: 0 };
      omega = 0;
      idle = false;
      return;
    }
    const now = performance.now();
    const dy = e.clientY - drag.y;
    const dt = Math.max(1, now - drag.t) / 1000;
    const d = dy * 0.012;
    theta += d;
    drag.v = drag.v * 0.5 + (d / dt) * 0.5;
    drag.y = e.clientY;
    drag.t = now;
    lastTouch = now;
  });
  const endTouch = (): void => {
    touchStart = null;
    endDrag();
  };
  o.ledger.addEventListener('pointerup', endTouch);
  o.ledger.addEventListener('pointercancel', endTouch);
  o.ledger.addEventListener(
    'click',
    (e) => {
      if (swiped) {
        e.preventDefault();
        e.stopPropagation();
        swiped = false;
      }
    },
    true,
  );
  o.ledger.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      theta += e.deltaY * 0.0022;
      omega = 0;
      idle = false;
      lastTouch = performance.now();
    },
    { passive: false },
  );

  cams.forEach((c, i) => {
    if (fine) {
      c.row.addEventListener('pointerenter', () => {
        held = i;
        o.ledger.classList.add('is-hovering');
      });
      c.row.addEventListener('pointerleave', () => {
        if (held === i) held = null;
        o.ledger.classList.remove('is-hovering');
        lastTouch = performance.now();
      });
    }
    c.row.addEventListener('focus', () => (held = i));
    c.row.addEventListener('blur', () => {
      if (held === i) held = null;
      lastTouch = performance.now();
    });
  });

  function targetFor(i: number): number {
    const base = -cams[i].phase;
    const k = Math.round((theta - base) / TAU);
    return base + k * TAU;
  }

  function setOnRow(i: number): void {
    if (i === onRow) return;
    if (onRow >= 0) cams[onRow].row.classList.remove('is-on');
    onRow = i;
    if (i < 0) {
      o.preview.classList.remove('is-on');
      return;
    }
    const c = cams[i];
    c.row.classList.add('is-on');
    if (!launch.flying) {
      previewImg.src = `https://i.ytimg.com/vi/${c.id}/mqdefault.jpg`;
      previewCap.textContent = c.title;
      o.preview.classList.add('is-on');
    }
    if (c.inline) requestAnimationFrame(layout);
  }

  /* ---------- the launcher ---------- */
  const lcv = o.launcherCanvas;
  const launch = {
    angle: axis(-1.2, 5, 25),
    target: -1.2,
    spin: 0,
    rpm: 0,
    phase: 'idle' as 'idle' | 'aim' | 'spin' | 'fly',
    flying: false,
    cardIdx: -1,
    t: 0,
    T: 0,
    x0: 0,
    y0: 0,
    vx: 0,
    vy: 0,
    landX: 0,
    landY: 0,
    kick: 0,
  };
  const G = 1800;
  let lctx!: CanvasRenderingContext2D;
  let LW = 0;
  let LH = 0;
  const fitLauncher = (): void => {
    const f = fit(lcv);
    lctx = f.ctx;
    LW = f.w;
    LH = f.h;
  };
  fitLauncher();
  new ResizeObserver(fitLauncher).observe(lcv);

  // keyboard: the list takes focus; arrows turn the shaft a row at a time, Enter opens the lifted video
  o.ledger.tabIndex = 0;
  o.ledger.setAttribute('aria-label', 'All 41 videos on the camshaft. Arrow keys turn the shaft, Enter opens the lifted video.');
  o.ledger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      theta += (e.key === 'ArrowDown' ? 1 : -1) * 0.53;
      omega = 0;
      idle = false;
      lastTouch = performance.now();
    } else if (e.key === 'Enter' && onRow >= 0 && cams[onRow]) {
      cams[onRow].row.click();
    }
  });

  // the landed card is the one thumbnail on a phone until the visitor turns the shaft again
  const clearLanding = (): void => o.ledger.classList.remove('is-landing');
  o.ledger.addEventListener('pointerdown', clearLanding, { passive: true });
  o.ledger.addEventListener('wheel', clearLanding, { passive: true });

  o.fireButton.addEventListener('click', () => {
    if (launch.phase !== 'idle') return;
    let i = Math.floor(Math.random() * cams.length);
    if (i === onRow) i = (i + 7) % cams.length;
    launch.cardIdx = i;
    held = i;
    idle = false;
    const useLanding = getComputedStyle(o.preview).display === 'none';
    const inner = o.ledger.parentElement!;
    const ir = inner.getBoundingClientRect();
    const lr = lcv.getBoundingClientRect();
    launch.x0 = lr.left - ir.left + lr.width * 0.5;
    launch.y0 = lr.top - ir.top + lr.height * 0.68;
    if (useLanding) {
      // the slot opens empty; the flying card is the only thumbnail until it lands there
      o.landing.classList.add('is-on', 'is-empty');
      o.ledger.classList.add('is-landing');
      landingImg.src = `https://i.ytimg.com/vi/${cams[i].id}/mqdefault.jpg`;
      landingImg.alt = cams[i].title;
      landingLink.href = `https://www.youtube.com/watch?v=${cams[i].id}`;
      landingCap.textContent = '';
      requestAnimationFrame(layout);
      // the slot opening above the launcher moves the launcher down: measure the muzzle again
      const lr2 = lcv.getBoundingClientRect();
      launch.x0 = lr2.left - ir.left + lr2.width * 0.5;
      launch.y0 = lr2.top - ir.top + lr2.height * 0.68;
      const r = o.landing.getBoundingClientRect();
      launch.landX = r.left - ir.left;
      launch.landY = r.top - ir.top;
    } else {
      const pr = o.preview.getBoundingClientRect();
      launch.landX = pr.left - ir.left;
      launch.landY = pr.top - ir.top;
    }
    const dx = launch.landX - launch.x0;
    const dy = launch.landY - launch.y0;
    // muzzle speed: fast, but no faster than keeps the top of the arc inside the viewport
    const muzzleY = lcv.getBoundingClientRect().top + lcv.getBoundingClientRect().height * 0.68;
    let v = Math.min(1400, Math.sqrt(2 * G * Math.max(120, muzzleY - 24)));
    let ang = NaN;
    // elevation for a shot of speed v that passes through (dx, dy); screen y runs down, so the target's
    // height above the muzzle is -dy. The high arc is taken so the card drops into the slot from above.
    for (let k = 0; k < 12 && Number.isNaN(ang); k++) {
      const disc2 = v ** 4 - G * (G * dx * dx - 2 * dy * v * v);
      if (disc2 >= 0) ang = Math.atan2(v * v + Math.sqrt(disc2), G * dx);
      else v *= 1.25;
    }
    if (Number.isNaN(ang)) ang = Math.PI / 2;
    const vx = v * Math.cos(ang);
    const vyUp = v * Math.sin(ang);
    launch.vx = vx;
    launch.vy = -vyUp;
    // time of flight: when x reaches the slot, or for a vertical shot when y comes back down to it
    launch.T = Math.abs(dx) > 1 ? dx / vx : (vyUp + Math.sqrt(Math.max(0, vyUp * vyUp + 2 * G * dy))) / G;
    launch.target = Math.atan2(launch.vy, launch.vx);
    launch.phase = 'aim';
    launch.t = 0;
    o.fireButton.disabled = true;
    o.card.querySelector('img')!.src = `https://i.ytimg.com/vi/${cams[i].id}/mqdefault.jpg`;
    if (useLanding) {
      // phones: keep the whole shot on screen, slot and launcher together
      const block = lcv.closest<HTMLElement>('.all__side') ?? lcv;
      const br = block.getBoundingClientRect();
      const top = br.top + window.scrollY;
      o.scrollTo(Math.max(0, top - Math.max(16, (window.innerHeight - br.height) / 2)));
    } else {
      const rowTop = o.ledger.getBoundingClientRect().top + window.scrollY;
      o.scrollTo(Math.max(0, rowTop - window.innerHeight * 0.3));
    }
  });

  /* ---------- the loop ---------- */
  addTicker((dt, now) => {
    if (!visible && launch.phase === 'idle') return;
    if (held != null) {
      const tgt = targetFor(held);
      drive.p = theta;
      drive.v = omega;
      stepAxis(drive, tgt, dt);
      theta = drive.p;
      omega = drive.v;
    } else if (!drag) {
      if (Math.abs(omega) > 0.02) {
        theta += omega * dt;
        const dec = 4 * dt;
        omega = Math.abs(omega) <= dec ? 0 : omega - Math.sign(omega) * dec;
      } else if (!still) {
        if (!idle && now - lastTouch > 1500) idle = true;
        if (idle) theta += 0.2 * dt;
      }
    }
    let top = -1;
    let topLift = 0;
    for (let i = 0; i < cams.length; i++) {
      const c = cams[i];
      c.lift = radius(c, contact(c)) - R0;
      c.row.style.transform = c.lift > 0.3 ? `translate3d(${c.lift.toFixed(1)}px, 0, 0)` : '';
      const vis = c.cy - view.x > -50 && c.cy - view.x < H + 50;
      if (vis !== c.visible) {
        c.visible = vis;
        c.row.style.opacity = vis ? '' : '0';
        if (c.inline) c.inline.style.opacity = vis ? '' : '0';
      }
      if (c.lift > topLift) {
        topLift = c.lift;
        top = i;
      }
    }
    setOnRow(top >= 0 && topLift > cams[top].h * 0.55 ? top : -1);
    // the window follows the lifted row
    if (top >= 0) {
      const want = clamp(cams[top].cy - H / 2, 0, Math.max(0, rollH - H));
      stepSpring(view, want, dt, 0.5, 1);
    }
    roll.style.transform = `translate3d(0, ${(-view.x).toFixed(1)}px, 0)`;
    drawShaft();

    // launcher
    if (launch.phase !== 'idle') {
      if (launch.phase === 'aim') {
        stepAxis(launch.angle, launch.target, dt);
        if (launch.angle.p === launch.target) {
          launch.phase = 'spin';
          launch.t = 0;
        }
      } else if (launch.phase === 'spin') {
        launch.t += dt;
        launch.rpm = Math.min(1, launch.t / 0.5);
        if (launch.t > 0.55) {
          launch.phase = 'fly';
          launch.flying = true;
          launch.t = 0;
          launch.kick = 1;
          o.card.classList.add('is-flying');
        }
      } else if (launch.phase === 'fly') {
        launch.t += dt;
        const t = Math.min(launch.t, launch.T);
        const x = launch.x0 + launch.vx * t;
        const y = launch.y0 + launch.vy * t + 0.5 * G * t * t;
        const rot = (1 - t / launch.T) * -12;
        o.card.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(1)}deg)`;
        if (launch.t >= launch.T) {
          launch.phase = 'idle';
          launch.flying = false;
          launch.rpm = 0;
          o.card.classList.remove('is-flying');
          const c = cams[launch.cardIdx];
          previewImg.src = `https://i.ytimg.com/vi/${c.id}/mqdefault.jpg`;
          previewCap.textContent = c.title;
          landingCap.textContent = c.title;
          o.landing.classList.remove('is-empty');
          o.preview.classList.add('is-on');
          o.fireButton.disabled = false;
          window.setTimeout(() => {
            if (held === launch.cardIdx) held = null;
            lastTouch = performance.now();
          }, 1800);
        }
      }
    }
    launch.kick = Math.max(0, launch.kick - dt * 2);
    launch.spin += dt * (launch.rpm * 60 + 1.5);
    if (launch.rpm > 0 && launch.phase === 'idle') launch.rpm = Math.max(0, launch.rpm - dt);
    drawLauncher();
  });

  /* ---------- drawing ---------- */
  function drawShaft(): void {
    ctx.clearRect(0, 0, W, H);
    const cx = W * 0.42;
    const off = view.x;
    // the shaft: a shaded bar running the window's height, bearings top and bottom
    bar(ctx, cx - 5, -4, 10, H + 8, M.steel, 3);
    bar(ctx, cx - 16, -6, 32, 14, M.anod, 3);
    bar(ctx, cx - 16, H - 8, 32, 14, M.anod, 3);
    const camImg = sprite('cam');
    for (const c of cams) {
      const y = c.cy - off;
      if (y < -40 || y > H + 40) continue;
      const a = theta + c.phase; // world angle of the lobe
      if (camImg) {
        // the render's bore sits 59.7% down; the base below it is round, the lobe above it stretches
        const iw = camImg.naturalWidth;
        const ih = camImg.naturalHeight;
        const bore = 0.597 * ih;
        const k = R0 / (0.403 * ih); // base radius -> R0
        const lobeK = ((R0 + c.h) / (0.597 * ih * k)) * k; // lobe length -> R0 + h
        ctx.save();
        ctx.translate(cx, y);
        ctx.rotate(a + Math.PI / 2);
        ctx.drawImage(camImg, 0, bore, iw, ih - bore, (-iw * k) / 2, 0, iw * k, (ih - bore) * k);
        ctx.drawImage(camImg, 0, 0, iw, bore, (-iw * k) / 2, -bore * lobeK, iw * k, bore * lobeK);
        ctx.restore();
      } else {
        ctx.beginPath();
        const n = 48;
        for (let i = 0; i <= n; i++) {
          const ps = (i / n) * TAU;
          const r = radius(c, ps);
          const ang = ps + a;
          const px = cx + Math.cos(ang) * r;
          const py = y + Math.sin(ang) * r;
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = c.lift > c.h * 0.55 ? M.alu.light : M.alu.face;
        ctx.fill();
        ctx.strokeStyle = M.alu.dark;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      disc(ctx, cx, y, 5.5, M.steel, 2);
      // follower: a flat tappet on the profile and its stem to the row
      const fx = cx + R0 + c.lift;
      bar(ctx, fx, y - 9, 6, 18, M.alu, 1.5);
      bar(ctx, fx + 6, y - 2.5, Math.max(0, W - fx - 6), 5, M.steel, 1);
    }
    // a guide block on the right edge for the stems
    bar(ctx, W - 8, -4, 8, H + 8, M.anod, 0);
    bolt(ctx, cx, 4, 3.5, M.steel);
    bolt(ctx, cx, H - 4, 3.5, M.steel);
  }

  function drawLauncher(): void {
    lctx.clearRect(0, 0, LW, LH);
    // the machine is drawn in a 200×190 design space and scaled about its pivot to the canvas it has,
    // so on a phone the whole launcher shows, barrel up included
    const DW = 200;
    const DH = 190;
    const k = Math.min(1, LW / DW, LH / DH);
    const bx = DW * 0.5;
    const by = DH * 0.68;
    lctx.save();
    lctx.translate(LW * 0.5, LH * 0.68);
    lctx.scale(k, k);
    lctx.translate(-bx, -by);
    // base plate and upright
    bar(lctx, bx - 44, DH - 14, 88, 14, M.anod, 2);
    bar(lctx, bx - 6, by, 12, DH - 14 - by, M.steel, 2);
    bolt(lctx, bx - 32, DH - 7, 3, M.steel);
    bolt(lctx, bx + 32, DH - 7, 3, M.steel);
    const img = sprite('launcher');
    lctx.save();
    lctx.translate(bx, by);
    lctx.rotate(launch.angle.p);
    if (img) {
      drawSprite(lctx, img, 0, 0, 66, 0.127, 0.516);
    } else {
      bar(lctx, -14, -6, 78 + launch.kick * 8, 12, M.alu, 2);
      lctx.fillStyle = M.anod.dark;
      lctx.fillRect(22, -2.5, 40, 5);
      for (const s of [-1, 1]) {
        lctx.save();
        lctx.translate(58, s * 17);
        lctx.rotate(launch.spin * s);
        disc(lctx, 0, 0, 13, M.anod, 3);
        lctx.fillStyle = M.alu.face;
        lctx.fillRect(-1.5, -13, 3, 5);
        lctx.restore();
      }
    }
    if (launch.kick > 0) {
      lctx.strokeStyle = P.accent;
      lctx.globalAlpha = launch.kick;
      lctx.lineWidth = 2;
      lctx.beginPath();
      lctx.arc(74, 0, 6 + (1 - launch.kick) * 18, 0, TAU);
      lctx.stroke();
      lctx.globalAlpha = 1;
    }
    lctx.restore();
    disc(lctx, bx, by, 7, M.steel, 2.5);
    if (launch.phase === 'aim' || launch.phase === 'spin') {
      lctx.fillStyle = P.accent;
      lctx.beginPath();
      lctx.arc(bx, by, 3, 0, TAU);
      lctx.fill();
    }
    lctx.restore();
  }
}
