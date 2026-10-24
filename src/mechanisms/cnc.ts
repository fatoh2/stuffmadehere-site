/** Mechanism 5: titles machined out of a solid bar. The real text stays in the DOM, transparent under the
 *  canvas. The canvas starts as a solid bar of material over each line (the hero's bar is a photograph
 *  of milled aluminium), then a roughing pass with a wide cutter clears everything that is not a letter,
 *  lifting as it nears one, and a finishing pass with a narrow cutter cleans up to the edges. The words
 *  are what is left standing. When the spindle stops, a buffing pad sweeps each bar and polishes the
 *  scalloped part into the crisp letter in the same material, with a sheen that trails the pad. The
 *  finished part stays on screen.
 *  From the pumpkin carver, the chainsaw robot and the Tormach. */
import { DPR, palette } from '../lib/canvas';
import { drawSprite, sprite } from '../lib/sprites';
import { addTicker } from '../lib/loop';
import { onceInView, reducedMotion } from '../lib/visible';

interface Pass {
  r: number;
  step: number;
  feed: number; // px/s while cutting
  rapid: number; // px/s while travelling
  name: 'rough' | 'finish';
}

interface Chip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
}

interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CncOptions {
  /** how long the whole cut takes, in seconds */
  seconds?: number;
  /** the material's colour; defaults to the element's text colour */
  exposed?: string;
  /** a photograph of the material, used instead of the flat colour */
  textureUrl?: string;
  textureScale?: number;
  /** seconds the solid bar sits there before the spindle comes down (default 0.6) */
  dwell?: number;
  /** seconds the polishing pass takes over all the bars (default grows with `seconds`) */
  polish?: number;
}

export interface CncHandle {
  run(): void;
}

export function mountCnc(host: HTMLElement, opts: CncOptions = {}): CncHandle {
  const textMaybe = host.querySelector<HTMLElement>('.cnc__text');
  if (!textMaybe || reducedMotion()) return { run() {} };
  const text: HTMLElement = textMaybe;
  const P = palette();
  let cv: HTMLCanvasElement | null = null;
  let stop: (() => void) | null = null;
  let started = false;
  let texture: HTMLImageElement | null = null;
  let textureReady: Promise<void> = Promise.resolve();
  if (opts.textureUrl) {
    const img = new Image();
    img.src = opts.textureUrl;
    textureReady = Promise.race([
      img.decode().then(() => void (texture = img)).catch(() => void (texture = null)),
      new Promise<void>((r) => setTimeout(r, 1500)),
    ]);
  }
  const ready = (): Promise<unknown> => Promise.all([document.fonts.ready, textureReady]);

  onceInView(
    host,
    () => {
      if (started) return;
      started = true;
      ready().then(run);
    },
    0.4,
  );
  // a resize changes the line boxes: give the words back to the browser
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - lastW) < 2) return;
    lastW = window.innerWidth;
    if (cv) teardown(true);
  });

  function teardown(showText: boolean): void {
    stop?.();
    stop = null;
    cv?.remove();
    cv = null;
    if (showText) host.classList.remove('is-live');
  }

  function run(): void {
    teardown(false);
    const cs = getComputedStyle(text);
    const rect = host.getBoundingClientRect();
    const W = Math.ceil(rect.width);
    const H = Math.ceil(rect.height);
    if (W < 10 || H < 10) return;
    cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    const dpr = DPR();
    cv.width = W * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const material = opts.exposed ?? cs.color;

    /* ---------- the letter mask, built from the DOM's own line boxes ---------- */
    const mask = document.createElement('canvas');
    mask.width = W;
    mask.height = H;
    const mc = mask.getContext('2d')!;
    mc.fillStyle = '#000';
    mc.fillRect(0, 0, W, H);
    mc.fillStyle = '#fff';
    mc.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    mc.textBaseline = 'alphabetic';
    const ink = document.createElement('canvas'); // the same letters at device resolution, for the finished part
    ink.width = W * dpr;
    ink.height = H * dpr;
    const ic = ink.getContext('2d')!;
    ic.setTransform(dpr, 0, 0, dpr, 0, 0);
    ic.fillStyle = '#fff';
    ic.font = mc.font;
    ic.textBaseline = 'alphabetic';
    const ls = parseFloat(cs.letterSpacing) || 0;
    const fontSize = parseFloat(cs.fontSize);
    const lineH = parseFloat(cs.lineHeight) || fontSize * 1.1; // the line box; text-node rects are taller
    const bars: Bar[] = [];
    const pad = fontSize * 0.08;
    const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const raw = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (!raw) continue;
      const str = cs.textTransform === 'uppercase' ? raw.toUpperCase() : raw;
      const range = document.createRange();
      range.selectNodeContents(node);
      const lines = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2);
      const words = str.split(' ');
      let wi = 0;
      for (const lb of lines) {
        const x0 = lb.left - rect.left;
        const baseline = lb.top - rect.top + (lb.height + fontSize * 0.7) / 2 - 1;
        let line = '';
        while (wi < words.length) {
          const trial = line ? line + ' ' + words[wi] : words[wi];
          if (measure(mc, trial, ls) > lb.width + 2 && line) break;
          line = trial;
          wi++;
        }
        drawTracked(mc, line, x0, baseline, ls);
        drawTracked(ic, line, x0, baseline, ls);
        const tw = measure(mc, line, ls);
        bars.push({ x: x0 - pad, y: lb.top - rect.top + (lb.height - lineH) / 2, w: tw + pad * 2, h: lineH });
      }
    }
    const md = mc.getImageData(0, 0, W, H).data;
    const isLetter = (x: number, y: number): boolean => {
      x |= 0;
      y |= 0;
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      return md[(y * W + x) * 4] > 127;
    };
    const nearLetter = (x: number, y: number, r: number): boolean => {
      if (isLetter(x, y)) return true;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        if (isLetter(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true;
      }
      return isLetter(x + r * 0.5, y) || isLetter(x - r * 0.5, y);
    };

    /* ---------- the bar of material, and the cutter sizes ---------- */
    const cut = document.createElement('canvas');
    cut.width = W * dpr;
    cut.height = H * dpr;
    const cc = cut.getContext('2d')!;
    cc.setTransform(dpr, 0, 0, dpr, 0, 0);
    let fill: string | CanvasPattern = material;
    if (texture) {
      const pat = cc.createPattern(texture, 'repeat');
      if (pat) {
        pat.setTransform(new DOMMatrix().scale(opts.textureScale ?? 0.6, opts.textureScale ?? 0.6));
        fill = pat;
      }
    }
    cc.fillStyle = fill;
    for (const b of bars) {
      cc.beginPath();
      cc.roundRect(b.x, b.y, b.w, b.h, fontSize * 0.06);
      cc.fill();
    }
    const part = document.createElement('canvas');
    part.width = W * dpr;
    part.height = H * dpr;
    const pc = part.getContext('2d')!;
    pc.setTransform(dpr, 0, 0, dpr, 0, 0);
    pc.fillStyle = fill;
    pc.fillRect(0, 0, W, H);
    pc.globalCompositeOperation = 'destination-in';
    pc.drawImage(ink, 0, 0, W, H);
    const scale = Math.max(0.5, Math.min(3.2, fontSize / 80));
    const passes: Pass[] = [
      { r: 4.5 * scale, step: 5 * scale, feed: 2600, rapid: 15000, name: 'rough' },
      { r: 1.3 * scale, step: 2 * scale, feed: 3400, rapid: 17000, name: 'finish' },
    ];
    const band = passes[0].r + passes[0].step + 2; // what the roughing pass leaves around the letters
    // the rows of a pass over a bar: evenly spaced, no wider than the step, and the first and last rows
    // put the cutter past the bar's rim so no sliver is left at either edge
    const rowsFor = (b: Bar, p: Pass): number[] => {
      const top = b.y + p.r * 0.6;
      const bot = b.y + b.h - p.r * 0.6;
      const n = Math.max(1, Math.ceil((bot - top) / p.step));
      const out: number[] = [];
      for (let i = 0; i <= n; i++) out.push(top + ((bot - top) * i) / n);
      return out;
    };
    const cutsHere = (p: Pass, x: number, y: number): boolean =>
      p.name === 'rough' ? !nearLetter(x, y, p.r + 1) : !isLetter(x, y) && nearLetter(x, y, band);
    const travelsHere = (p: Pass, x: number, y: number): boolean => (p.name === 'rough' ? true : nearLetter(x, y, band + p.step * 2));

    // calibrate: walk each pass once so the roughing takes ~62% of opts.seconds and the finish the rest
    const budget = opts.seconds ?? Math.min(4, 1.2 + (W * H) / 220000);
    const shares = [0.62, 0.38];
    passes.forEach((p, i) => {
      let est = 0;
      for (const b of bars) {
        let d = 1;
        for (const ry of rowsFor(b, p)) {
          let rx = d > 0 ? b.x : b.x + b.w;
          while (d > 0 ? rx < b.x + b.w : rx > b.x) {
            const eng = cutsHere(p, rx, ry);
            const sl = eng ? 2 : 6;
            est += sl / (eng ? p.feed : travelsHere(p, rx, ry) ? p.feed * 2.5 : p.rapid);
            rx += d * sl;
          }
          d = -d;
        }
      }
      const k = est > 0 ? est / (budget * shares[i]) : 1;
      p.feed *= k;
      p.rapid *= k;
    });

    /* ---------- the cut itself ---------- */
    let pi = 0;
    let bi = 0;
    let rows = bars[0] ? rowsFor(bars[0], passes[0]) : [0];
    let ri = 0;
    let rowY = rows[0];
    let dir = 1;
    let x = bars[0] ? bars[0].x : 0;
    let lifted = true;
    let done = bars.length === 0;
    let dwell = opts.dwell ?? 0.6;
    // the polishing pass: a buffing pad sweeps each bar left to right; behind it the scalloped cut is
    // the crisp letter in the same material
    const polishSeconds = opts.polish ?? Math.min(2.6, 0.5 + budget * 0.4);
    const padR = (b: Bar): number => b.h * 0.62;
    const sweep = bars.reduce((acc, b) => acc + b.w + 2 * padR(b), 0);
    const polishSpeed = sweep / Math.max(0.3, polishSeconds);
    let polishBar = 0;
    let polishX = bars[0] ? bars[0].x - padR(bars[0]) : 0;
    let polishFrom = polishX; // where the wheel touched down on this bar: it rolls from here without slipping
    let polished = bars.length === 0;
    sprite('buff');
    const sparks: Chip[] = [];
    const bandOf = (i: number): [number, number] => {
      const top = i === 0 ? 0 : (bars[i - 1].y + bars[i - 1].h + bars[i].y) / 2;
      const bot = i === bars.length - 1 ? H : (bars[i].y + bars[i].h + bars[i + 1].y) / 2;
      return [top, bot];
    };
    const clipped = (img: HTMLCanvasElement, x0: number, x1: number, top: number, bot: number): void => {
      if (x1 <= x0) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, top, x1 - x0, bot - top);
      ctx.clip();
      ctx.drawImage(img, 0, 0, W, H);
      ctx.restore();
    };
    const chips: Chip[] = [];
    let spin = 0;
    host.classList.add('is-live');

    // debug probe: per-host state of the running cut
    const dbg = ((window as unknown as { __cnc?: Record<string, () => unknown> }).__cnc ??= {});
    dbg[host.id || 'cnc'] = () => ({ dwell, pi, bi, ri, rows: rows.length, done, polishBar, polishX, polished, bars: bars.length });

    stop = addTicker((dt) => {
      spin += dt * 70;
      if (dwell > 0) {
        dwell -= dt; // the bar sits there whole; the spindle spins up above it
      } else if (!done) {
        let t = dt;
        while (t > 0 && !done) {
          const p = passes[pi];
          const b = bars[bi];
          const engaged = cutsHere(p, x, rowY);
          const speed = engaged ? p.feed : travelsHere(p, x, rowY) ? p.feed * 2.5 : p.rapid;
          const stepLen = engaged ? 2 : 6;
          const cost = stepLen / speed;
          const frac = cost > t ? t / cost : 1;
          x += dir * stepLen * frac;
          t -= cost * frac;
          lifted = !engaged;
          if (engaged) {
            cc.save();
            cc.globalCompositeOperation = 'destination-out';
            cc.fillStyle = '#000';
            cc.beginPath();
            cc.arc(x, rowY, p.r, 0, Math.PI * 2);
            cc.fill();
            cc.restore();
            if (chips.length < 160 && Math.random() < 0.3)
              chips.push({ x: x - dir * p.r, y: rowY, vx: -dir * (120 + Math.random() * 360) + (Math.random() - 0.5) * 160, vy: -(80 + Math.random() * 260), life: 0.35 + Math.random() * 0.35, r: 1 + Math.random() * 1.6 });
          }
          if ((dir > 0 && x >= b.x + b.w) || (dir < 0 && x <= b.x)) {
            dir = -dir;
            ri++;
            x = dir > 0 ? b.x : b.x + b.w;
            if (ri >= rows.length) {
              bi++;
              if (bi >= bars.length) {
                bi = 0;
                pi++;
                if (pi >= passes.length) {
                  done = true;
                  break;
                }
              }
              dir = 1;
              rows = rowsFor(bars[bi], passes[pi]);
              ri = 0;
              x = bars[bi].x;
            }
            rowY = rows[ri];
          }
        }
      }
      for (let i = chips.length - 1; i >= 0; i--) {
        const c = chips[i];
        c.vy += 1400 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.life -= dt;
        if (c.life <= 0) chips.splice(i, 1);
      }
      if (done && !polished) {
        const b = bars[polishBar];
        polishX += polishSpeed * dt;
        if (sparks.length < 90 && Math.random() < 0.55)
          sparks.push({ x: polishX - padR(b) * 0.5, y: b.y + b.h * (0.15 + Math.random() * 0.7), vx: -(80 + Math.random() * 220), vy: (Math.random() - 0.5) * 90, life: 0.2 + Math.random() * 0.3, r: 1 + Math.random() });
        if (polishX > b.x + b.w + padR(b)) {
          polishBar++;
          if (polishBar >= bars.length) polished = true;
          else polishX = polishFrom = bars[polishBar].x - padR(bars[polishBar]);
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }
      ctx.clearRect(0, 0, W, H);
      if (!done) ctx.drawImage(cut, 0, 0, W, H);
      else if (polished) ctx.drawImage(part, 0, 0, W, H);
      else
        bars.forEach((b, i) => {
          const [top, bot] = bandOf(i);
          if (i !== polishBar) {
            clipped(i < polishBar ? part : cut, 0, W, top, bot);
            return;
          }
          clipped(part, 0, polishX, top, bot);
          clipped(cut, polishX, W, top, bot);
          // the sheen the pad leaves, on the material only
          const r = padR(b);
          const g = ctx.createLinearGradient(polishX - r * 3.4, 0, polishX, 0);
          g.addColorStop(0, 'rgba(255,255,255,0)');
          g.addColorStop(0.72, 'rgba(255,255,255,0.45)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.save();
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = g;
          ctx.fillRect(polishX - r * 3.4, top, r * 3.4, bot - top);
          ctx.restore();
        });
      for (const s of sparks) {
        ctx.globalAlpha = Math.min(1, s.life * 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
      for (const c of chips) {
        ctx.globalAlpha = Math.min(1, c.life * 3);
        ctx.fillStyle = texture ? P.steel : material;
        ctx.fillRect(c.x, c.y, c.r, c.r);
      }
      ctx.globalAlpha = 1;
      if (!done) {
        const p = passes[pi];
        ctx.beginPath();
        ctx.arc(x, rowY, lifted ? p.r * 0.7 + 1.5 : p.r + 1, 0, Math.PI * 2);
        ctx.fillStyle = lifted ? P.steel : P.steelDark;
        ctx.fill();
        if (!lifted) {
          ctx.strokeStyle = P.ball;
          ctx.lineWidth = Math.max(1.2, p.r * 0.35);
          ctx.beginPath();
          ctx.moveTo(x - Math.cos(spin) * p.r, rowY - Math.sin(spin) * p.r);
          ctx.lineTo(x + Math.cos(spin) * p.r, rowY + Math.sin(spin) * p.r);
          ctx.stroke();
        }
      } else if (!polished) {
        // the buffing wheel: a cotton mop on an arbor from above, rolling along the bar without slipping,
        // the seam between cut and polished metal under it
        const b = bars[polishBar];
        const r = padR(b);
        const cy = b.y + b.h / 2;
        const roll = (polishX - polishFrom) / r;
        const wheel = sprite('buff');
        // the arbor: a steel shaft down from above the title to the hub
        ctx.fillStyle = P.steelDark;
        ctx.fillRect(polishX - r * 0.07, 0, r * 0.14, cy);
        if (wheel) {
          drawSprite(ctx, wheel, polishX, cy, r * 2, 0.5, 0.5, roll);
        } else {
          ctx.save();
          ctx.translate(polishX, cy);
          ctx.rotate(roll);
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
          ctx.fillStyle = P.steel;
          ctx.fill();
          ctx.strokeStyle = P.steelDark;
          ctx.lineWidth = Math.max(1, r * 0.04);
          for (let k = 1; k <= 4; k++) {
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.2 * k, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
          ctx.fillStyle = P.recess;
          ctx.fill();
          ctx.restore();
        }
        // the hub nut, fixed to the arbor, does not turn with the wheel
        ctx.beginPath();
        ctx.arc(polishX, cy, Math.max(2, r * 0.09), 0, Math.PI * 2);
        ctx.fillStyle = P.steelDark;
        ctx.fill();
      } else if (chips.length === 0 && sparks.length === 0) {
        // finished and polished: the part stays as the title; just stop spending frames on it
        stop?.();
        stop = null;
      }
    });
  }

  return {
    run() {
      started = true;
      ready().then(run);
    },
  };
}

function measure(mc: CanvasRenderingContext2D, s: string, ls: number): number {
  return mc.measureText(s).width + ls * s.length;
}

function drawTracked(mc: CanvasRenderingContext2D, s: string, x: number, y: number, ls: number): void {
  if (!ls) {
    mc.fillText(s, x, y);
    return;
  }
  let cx = x;
  for (const ch of s) {
    mc.fillText(ch, cx, y);
    cx += mc.measureText(ch).width + ls;
  }
}
