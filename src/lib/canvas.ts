/** Canvas helpers: device-pixel fitting and the page palette read from CSS tokens. */
export interface Palette {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  steel: string;
  steelDark: string;
  recess: string;
  ball: string;
  paper: string;
}

let cached: Palette | null = null;

export function palette(): Palette {
  if (cached) return cached;
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  cached = {
    bg: v('--bg'),
    surface: v('--surface'),
    ink: v('--ink'),
    muted: v('--muted'),
    accent: v('--accent'),
    accentInk: v('--accent-ink'),
    steel: v('--steel'),
    steelDark: v('--steel-dark'),
    recess: v('--recess'),
    ball: v('--ball') || '#ff5a1f',
    paper: v('--paper') || v('--bg'),
  };
  return cached;
}

export const DPR = (): number => Math.min(2, window.devicePixelRatio || 1);

/** Size a canvas to its CSS box (or an explicit logical size) at device resolution. Returns logical w/h. */
export function fit(cv: HTMLCanvasElement, w?: number, h?: number): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = DPR();
  const W = w ?? cv.clientWidth;
  const H = h ?? cv.clientHeight;
  const pw = Math.max(1, Math.round(W * dpr));
  const ph = Math.max(1, Math.round(H * dpr));
  if (cv.width !== pw || cv.height !== ph) {
    cv.width = pw;
    cv.height = ph;
  }
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: W, h: H };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function fontFor(size: number, weight = 900): string {
  return `${weight} ${size}px Chivo, "Helvetica Neue", Arial, sans-serif`;
}

/* ---------- drawn-metal helpers: three flat tones per part, no gradients ---------- */
export interface Metal {
  face: string;
  light: string;
  dark: string;
}

/** Bright machined aluminium and black anodised parts, from the palette. */
export function metals(): { alu: Metal; anod: Metal; steel: Metal } {
  const P = palette();
  return {
    alu: { face: P.steel, light: '#f1f1ec', dark: '#9d9d97' },
    anod: { face: P.surface, light: '#31343b', dark: P.recess },
    steel: { face: P.steelDark, light: '#b3b3ad', dark: '#5e5e59' },
  };
}

/** A shaded bar: main face with a light band on top and a dark band below. */
export function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, m: Metal, r = 2): void {
  const band = Math.max(1.5, Math.min(4, h * 0.16));
  ctx.fillStyle = m.face;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.fillStyle = m.light;
  ctx.beginPath();
  ctx.roundRect(x, y, w, band, [r, r, 0, 0]);
  ctx.fill();
  ctx.fillStyle = m.dark;
  ctx.beginPath();
  ctx.roundRect(x, y + h - band, w, band, [0, 0, r, r]);
  ctx.fill();
}

/** A shaded disc with a highlight crescent, a hub and an optional bore. */
export function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, m: Metal, bore = 0): void {
  ctx.fillStyle = m.dark;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = m.face;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.06, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = m.light;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.18, r * 0.66, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(x, y - r * 0.18);
  ctx.closePath();
  ctx.fill();
  if (bore > 0) {
    ctx.fillStyle = m.dark;
    ctx.beginPath();
    ctx.arc(x, y, bore, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A socket-head bolt: dark ring, lighter head, hex recess. */
export function bolt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, m: Metal): void {
  ctx.fillStyle = m.dark;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = m.light;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = m.dark;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = x + Math.cos(a) * r * 0.38;
    const py = y + Math.sin(a) * r * 0.38;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/** A T-slot extrusion rail drawn horizontally: shaded body with two slot grooves. */
export function tslot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, m: Metal): void {
  bar(ctx, x, y, w, h, m, 1.5);
  ctx.fillStyle = m.dark;
  const g = Math.max(1.5, h * 0.14);
  ctx.fillRect(x, y + h * 0.5 - g / 2, w, g);
}
