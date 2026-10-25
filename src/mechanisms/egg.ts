/** Mechanism 14: the egg cracker. The section's title is inside an egg. Two gripper fingers hold it,
 *  a blade comes down and cracks it round the middle, the grippers pull the halves apart and the
 *  words fall out and land on the line, letter by letter, with the yolk as the full stop. From
 *  "A simple human task that's insanely hard for a robot" (2022, 413 eggs) and "Why is this task so
 *  difficult for machines?" (2025). */
import { cue } from '../lib/sound';
import { axis, stepAxis, clamp } from '../lib/motor';
import { fit, palette, metals, bar, disc } from '../lib/canvas';
import { sprite, drawSprite, drawLink } from '../lib/sprites';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion } from '../lib/visible';
import { stepSpring, type SpringState } from '../lib/spring';

export interface EggHandle {
  reset(): void;
}

interface Letter {
  el: HTMLElement;
  tx: number;
  ty: number;
  w: number;
  h: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  state: 'in' | 'fly' | 'rest';
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
}

type Phase = 'wait' | 'hold' | 'strike' | 'crack' | 'open' | 'away' | 'done';

const G = 2800;
const shell = { light: '#f1e7d0', dark: '#ddcdab', edge: '#fbf7ee', crack: '#4a3a28', white: 'rgba(255,255,255,0.92)', yolk: '#f2b233', yolkHi: '#fbd27a' };

export function mountEgg(head: HTMLElement): EggHandle {
  const text = head.querySelector<HTMLElement>('.egg__text');
  if (!text || reducedMotion()) return { reset() {} };
  const P = palette();
  const M = metals();

  /* ---------- the title, letter by letter ---------- */
  const raw = (text.textContent ?? '').replace(/\s+/g, ' ').trim();
  text.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = raw;
  const wrap = document.createElement('span');
  wrap.className = 'egg__letters';
  wrap.setAttribute('aria-hidden', 'true');
  const letters: Letter[] = [];
  // letters are boxes of their own, so each word is wrapped to keep the line breaks at the spaces
  raw.split(' ').forEach((word, wi) => {
    if (wi) wrap.appendChild(document.createTextNode(' '));
    const w = document.createElement('span');
    w.className = 'egg__word';
    for (const ch of word) {
      const el = document.createElement('span');
      el.className = 'egg__ch';
      el.textContent = ch;
      el.style.opacity = '0';
      w.appendChild(el);
      letters.push({ el, tx: 0, ty: 0, w: 0, h: 0, x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, state: 'in' });
    }
    wrap.appendChild(w);
  });
  text.append(sr, wrap);
  const cv = document.createElement('canvas');
  cv.className = 'egg__canvas';
  cv.setAttribute('aria-hidden', 'true');
  head.appendChild(cv);
  head.classList.add('is-live');

  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  let top = 0; // canvas top, above the heading, px
  let ex = 0;
  let ey = 0;
  let eggW = 100;
  let eggH = 70;
  let lineH = 40;
  let endX = 0; // where the yolk lands, after the last letter
  let baseY = 0;
  let crackPts: { x: number; y: number }[] = [];
  let phase: Phase = 'wait';
  let visible = false;
  let t = 0; // seconds in the current phase
  let crack = 0;
  let next = 0; // letters released so far
  let release = 0; // seconds until the next letter
  const grip: SpringState = { x: 30, v: 0 };
  const gap: SpringState = { x: 0, v: 0 };
  const lift: SpringState = { x: 0, v: 0 };
  const jig: SpringState = { x: 0, v: 0 };
  const blade = axis(4, 520, 3200);
  let bladeTarget = 4;
  const drops: Drop[] = [];
  const yolk = { x: 0, y: 0, vx: 0, vy: 0, r: 8, state: 'in' as 'in' | 'fly' | 'rest', squash: { x: 1, v: 0 } as SpringState };
  let safety = 0;
  sprite('egg');
  sprite('servo');
  sprite('armlink');

  function layout(): void {
    const hr = head.getBoundingClientRect();
    lineH = parseFloat(getComputedStyle(head).lineHeight) || hr.height;
    const oneLine = Math.min(hr.height, lineH * 1.05);
    eggH = clamp(oneLine * 1.08, 48, 112);
    eggW = eggH * 1.42;
    top = eggH + 34 + oneLine * 0.5;
    cv.style.top = `${-top}px`;
    cv.style.height = `${top + hr.height + oneLine * 0.6}px`;
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const L of letters) {
      const keep = L.el.style.transform;
      L.el.style.transform = '';
      const r = L.el.getBoundingClientRect();
      L.el.style.transform = keep;
      L.w = r.width;
      L.h = r.height;
      L.tx = r.left - hr.left + r.width / 2;
      L.ty = r.top - hr.top + top + r.height / 2;
      minX = Math.min(minX, r.left - hr.left);
      maxX = Math.max(maxX, r.right - hr.left);
      baseY = r.bottom - hr.top + top - r.height * 0.16;
      if (L.state === 'rest') {
        L.x = L.tx;
        L.y = L.ty;
      }
    }
    ex = clamp((minX + maxX) / 2, eggW / 2 + 70, W - eggW / 2 - 70);
    if (!isFinite(ex)) ex = W / 2;
    ey = eggH / 2 + 30;
    yolk.r = clamp(lineH * 0.13, 5, 14);
    endX = maxX + yolk.r * 1.9;
    if (yolk.state === 'rest') {
      yolk.x = endX;
      yolk.y = baseY - yolk.r;
    }
    // the crack: a jagged line down the egg's waist, drawn once per egg
    crackPts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const y = ey - eggH / 2 - 4 + ((eggH + 8) * i) / n;
      const x = i === 0 || i === n ? ex : ex + (Math.sin(i * 2.7) * 0.5 + (Math.random() - 0.5)) * eggH * 0.1;
      crackPts.push({ x, y });
    }
  }
  layout();
  new ResizeObserver(layout).observe(head);
  if (document.fonts?.ready) void document.fonts.ready.then(layout);
  onVisible(head, (v) => (visible = v), 0.35);

  /** nothing of the title may stay hidden whatever happens to the machine */
  function show(): void {
    for (const L of letters) {
      L.state = 'rest';
      L.x = L.tx;
      L.y = L.ty;
      L.rot = 0;
      L.el.style.opacity = '';
      L.el.style.transform = '';
    }
  }
  const arm = (): void => {
    window.clearTimeout(safety);
    safety = window.setTimeout(() => {
      if (letters.some((L) => L.state === 'in')) show();
    }, 7000);
  };

  function start(): void {
    for (const L of letters) {
      L.state = 'in';
      L.el.style.opacity = '0';
      L.el.style.transform = '';
      L.rot = 0;
    }
    grip.x = 30;
    grip.v = 0;
    gap.x = 0;
    gap.v = 0;
    lift.x = 0;
    lift.v = 0;
    jig.x = 0;
    jig.v = 0;
    blade.p = 4;
    blade.v = 0;
    bladeTarget = 4;
    crack = 0;
    next = 0;
    release = 0.1;
    drops.length = 0;
    yolk.state = 'in';
    yolk.squash.x = 1;
    yolk.squash.v = 0;
    layout();
    phase = 'hold';
    t = 0;
    arm();
  }

  function releaseLetter(L: Letter): void {
    L.state = 'fly';
    L.el.style.opacity = '';
    L.x = ex + (Math.random() - 0.5) * 10;
    L.y = ey + 6;
    L.vy = -40 - Math.random() * 90;
    // ballistic: the sideways speed is whatever lands it on its spot exactly when it comes down
    const T = (-L.vy + Math.sqrt(L.vy * L.vy + 2 * G * Math.max(8, L.ty - L.y))) / G;
    L.vx = (L.tx - L.x) / T;
    L.rot = (Math.random() - 0.5) * 0.9;
    L.vr = (Math.random() - 0.5) * 4;
  }

  function releaseYolk(): void {
    yolk.state = 'fly';
    yolk.x = ex;
    yolk.y = ey + 4;
    yolk.vy = -30;
    const ty = baseY - yolk.r;
    const T = (-yolk.vy + Math.sqrt(yolk.vy * yolk.vy + 2 * G * Math.max(8, ty - yolk.y))) / G;
    yolk.vx = (endX - yolk.x) / T;
    for (let i = 0; i < 6; i++) drops.push({ x: ex + (Math.random() - 0.5) * 16, y: ey + eggH * 0.2, vx: (Math.random() - 0.5) * 60, vy: 40 + Math.random() * 80, r: 1.5 + Math.random() * 2.5, life: 0.7 });
  }

  function stepLetters(dt: number): void {
    let landed = false;
    for (const L of letters) {
      if (L.state === 'fly') {
        L.vy += G * dt;
        L.x += L.vx * dt;
        L.y += L.vy * dt;
        L.rot += L.vr * dt;
        if (L.y >= L.ty) {
          L.y = L.ty;
          if (L.vy > 170) {
            L.vy = -L.vy * 0.22;
            L.vr *= 0.4;
            landed = true;
          } else {
            L.state = 'rest';
            L.x = L.tx;
            L.vx = L.vy = 0;
          }
        }
        L.el.style.transform = `translate(${(L.x - L.tx).toFixed(1)}px, ${(L.y - L.ty).toFixed(1)}px) rotate(${L.rot.toFixed(3)}rad)`;
      } else if (L.state === 'rest' && L.rot !== 0) {
        L.rot *= Math.pow(0.0005, dt);
        if (Math.abs(L.rot) < 0.004) {
          L.rot = 0;
          L.el.style.transform = '';
        } else L.el.style.transform = `rotate(${L.rot.toFixed(3)}rad)`;
      }
    }
    if (landed) cue.index();
    if (yolk.state === 'fly') {
      yolk.vy += G * dt;
      yolk.x += yolk.vx * dt;
      yolk.y += yolk.vy * dt;
      const ty = baseY - yolk.r;
      if (yolk.y >= ty) {
        yolk.y = ty;
        yolk.x = endX;
        yolk.state = 'rest';
        yolk.squash.x = 0.62;
        yolk.squash.v = 0;
      }
    } else if (yolk.state === 'rest') stepSpring(yolk.squash, 1, dt, 0.22, 0.7);
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.vy += G * 0.5 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt;
      if (d.life <= 0) drops.splice(i, 1);
    }
  }

  /* ---------- drawing ---------- */
  function wholeEgg(dy: number): void {
    const img = sprite('egg');
    if (img) {
      drawSprite(ctx, img, ex, ey + dy, eggW, 0.5, 0.5, -Math.PI / 2);
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey + dy, eggW / 2, eggH / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = shell.light;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = shell.dark;
    ctx.beginPath();
    ctx.ellipse(ex, ey + dy + eggH * 0.22, eggW / 2, eggH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function crackLine(progress: number): void {
    if (progress <= 0) return;
    const total = crackPts.length - 1;
    const upto = progress * total;
    ctx.strokeStyle = shell.crack;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(crackPts[0].x, crackPts[0].y + jig.x);
    for (let i = 1; i <= total; i++) {
      const a = crackPts[i - 1];
      const b = crackPts[i];
      if (i <= upto) ctx.lineTo(b.x, b.y + jig.x);
      else {
        const f = upto - (i - 1);
        ctx.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f + jig.x);
        break;
      }
    }
    ctx.stroke();
  }

  function half(side: -1 | 1): void {
    const dx = side * gap.x;
    const dy = lift.x;
    const rot = side * -0.08 * Math.min(1, gap.x / (eggW * 0.3));
    ctx.save();
    ctx.translate(ex + dx, ey + dy);
    ctx.rotate(rot);
    ctx.translate(-ex, -ey);
    ctx.beginPath();
    const far = ex + side * (eggW * 0.6 + 20);
    ctx.moveTo(far, ey - eggH);
    ctx.lineTo(crackPts[0].x, ey - eggH);
    for (const p of crackPts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(crackPts[crackPts.length - 1].x, ey + eggH);
    ctx.lineTo(far, ey + eggH);
    ctx.closePath();
    ctx.clip();
    wholeEgg(0);
    // the broken edge: the shell is thick and pale inside
    ctx.strokeStyle = shell.edge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(crackPts[0].x, crackPts[0].y);
    for (const p of crackPts) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();
  }

  function grippers(): void {
    const servo = sprite('servo');
    const link = sprite('armlink');
    const dy = lift.x;
    for (const side of [-1, 1] as const) {
      const tipX = ex + side * (eggW / 2 + 3 + grip.x + gap.x);
      const tipY = ey + dy;
      const hornX = side < 0 ? 22 : W - 22;
      if (servo) drawSprite(ctx, servo, hornX, ey, 46, 0.73, 0.5, 0, side > 0);
      else bar(ctx, side < 0 ? 0 : W - 40, ey - 16, 40, 32, M.anod, 3);
      if (link) drawLink(ctx, link, hornX, ey, tipX, tipY, 11);
      else {
        ctx.strokeStyle = M.alu.face;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(hornX, ey);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }
      // the rubber pad that holds the shell
      ctx.fillStyle = P.ink;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
      ctx.fill();
      disc(ctx, hornX, ey, 5, M.steel);
    }
  }

  function bladeDraw(): void {
    const y = blade.p;
    bar(ctx, ex - 6, y - 78, 12, 62, M.steel, 1);
    ctx.fillStyle = M.steel.face;
    ctx.beginPath();
    ctx.moveTo(ex - 6, y - 16);
    ctx.lineTo(ex + 6, y - 16);
    ctx.lineTo(ex, y);
    ctx.closePath();
    ctx.fill();
    bar(ctx, ex - 16, y - 92, 32, 16, M.anod, 2);
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    if (phase === 'done') {
      drawYolk();
      return;
    }
    if (phase === 'hold' || phase === 'strike' || phase === 'crack') {
      wholeEgg(jig.x);
      crackLine(crack);
    } else {
      half(-1);
      half(1);
    }
    grippers();
    bladeDraw();
    ctx.fillStyle = shell.white;
    for (const d of drops) {
      ctx.globalAlpha = clamp(d.life / 0.4, 0, 1);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawYolk();
  }

  function drawYolk(): void {
    if (yolk.state === 'in') return;
    const sq = yolk.state === 'rest' ? yolk.squash.x : 1;
    ctx.save();
    ctx.translate(yolk.x, yolk.y + yolk.r * (1 - sq));
    ctx.scale(1 / Math.sqrt(sq), sq);
    ctx.fillStyle = shell.yolk;
    ctx.beginPath();
    ctx.arc(0, 0, yolk.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shell.yolkHi;
    ctx.beginPath();
    ctx.arc(-yolk.r * 0.3, -yolk.r * 0.3, yolk.r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- the loop ---------- */
  addTicker(function egg(dt) {
    if (phase === 'wait') {
      if (visible) {
        t += dt;
        if (t > 0.5) start();
      }
      return;
    }
    if (!visible && phase !== 'done') {
      // out of view: finish quietly so the title is never half out of the egg
      if (letters.some((L) => L.state !== 'rest')) show();
      return;
    }
    if (phase === 'done') return;
    t += dt;
    stepSpring(jig, 0, dt, 0.14, 0.35);
    stepAxis(blade, bladeTarget, dt);
    switch (phase) {
      case 'hold':
        stepSpring(grip, 2, dt, 0.32, 0.9);
        if (t > 0.5) {
          phase = 'strike';
          t = 0;
          bladeTarget = ey - eggH / 2 + 3;
        }
        break;
      case 'strike':
        stepSpring(grip, 2, dt, 0.32, 0.9);
        if (blade.p >= bladeTarget - 0.5) {
          cue.pawl();
          jig.v = 260;
          bladeTarget = 4;
          phase = 'crack';
          t = 0;
        }
        break;
      case 'crack':
        crack = Math.min(1, crack + dt / 0.32);
        if (crack >= 1 && t > 0.4) {
          phase = 'open';
          t = 0;
          release = 0.05;
        }
        break;
      case 'open':
        stepSpring(gap, eggW * 0.42, dt, 0.5, 0.85);
        stepSpring(grip, 2, dt, 0.32, 0.9);
        release -= dt;
        if (release <= 0) {
          if (next < letters.length) {
            releaseLetter(letters[next++]);
            release = 0.048;
          } else if (yolk.state === 'in') releaseYolk();
        }
        stepLetters(dt);
        if (next >= letters.length && yolk.state === 'rest' && letters.every((L) => L.state === 'rest') && t > 1.2) {
          phase = 'away';
          t = 0;
        }
        break;
      case 'away':
        stepLetters(dt);
        stepSpring(lift, -(ey + eggH), dt, 0.6, 1);
        stepSpring(grip, 2, dt, 0.32, 0.9);
        if (t > 1.1) {
          phase = 'done';
          window.clearTimeout(safety);
          show();
        }
        break;
    }
    draw();
  });

  return {
    reset() {
      if (phase === 'wait') return;
      start();
    },
  };
}
