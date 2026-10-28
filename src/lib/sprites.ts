/** Rendered part images (WebP with alpha) used by the mechanisms. Each loads once; a mechanism draws
 *  its fallback shapes until the sprite is ready, and forever if the file is missing. A mechanism asks
 *  for its parts with near() so they download when its section is about to arrive, not at page load. */
const cache = new Map<string, HTMLImageElement | null>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();
// a part downloads only once its section has asked for it through near() or preload(); a draw that
// runs earlier (a first frame at mount) gets null and draws the fallback
const released = new Set<string>();
const releasedTextures = new Set<string>();

export function sprite(name: string): HTMLImageElement | null {
  if (cache.has(name)) return cache.get(name)!;
  if (!released.has(name)) return null;
  if (!pending.has(name)) {
    const p = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        cache.set(name, img);
        resolve(img);
      };
      img.onerror = () => {
        cache.set(name, null);
        resolve(null);
      };
      img.src = `/parts/${name}.webp`;
    });
    pending.set(name, p);
  }
  return null;
}

export function preload(names: string[]): void {
  for (const n of names) {
    released.add(n);
    sprite(n);
  }
}

/** Start loading a section's renders (and textures) once it is within about a screen and a half of
 *  the viewport, so they are ready when it arrives and cost nothing while it is far away. */
export function near(el: Element, names: string[], textureNames: string[] = []): void {
  const go = (): void => {
    preload(names);
    for (const t of textureNames) {
      releasedTextures.add(t);
      texture(t);
    }
  };
  if (!('IntersectionObserver' in window)) {
    go();
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      go();
      io.disconnect();
    },
    { rootMargin: '150% 0px 150% 0px', threshold: 0 },
  );
  io.observe(el);
}

/** Draw a sprite scaled to a target height, anchored at (ax, ay) in its own 0..1 box, rotated. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  height: number,
  anchorX = 0.5,
  anchorY = 0.5,
  rotation = 0,
  flipX = false,
): void {
  const w = (img.naturalWidth / img.naturalHeight) * height;
  ctx.save();
  ctx.translate(x, y);
  if (rotation) ctx.rotate(rotation);
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -w * anchorX, -height * anchorY, w, height);
  ctx.restore();
}

/** A rendered arm link between two points: the bearing ends keep their shape, only the bar stretches.
 *  Falls back to nothing (the caller draws its own bar) when the render is not loaded. */
export function drawLink(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x0: number, y0: number, x1: number, y1: number, thick: number): void {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const ang = Math.atan2(y1 - y0, x1 - x0);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const k = thick / ih;
  const capW = iw * 0.17 * k;
  const bearing = iw * 0.085 * k;
  const left = -bearing;
  const total = L + 2 * bearing;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(ang);
  ctx.drawImage(img, 0, 0, iw * 0.17, ih, left, -thick / 2, capW, thick);
  ctx.drawImage(img, iw * 0.17, 0, iw * 0.66, ih, left + capW, -thick / 2, Math.max(1, total - 2 * capW), thick);
  ctx.drawImage(img, iw * 0.83, 0, iw * 0.17, ih, left + total - capW, -thick / 2, capW, thick);
  ctx.restore();
}

const textures = new Map<string, HTMLImageElement>();
/** A photographed material (a jpg in /parts) for fills; null until it has loaded. */
export function texture(name: string): HTMLImageElement | null {
  let img = textures.get(name);
  if (!img && !releasedTextures.has(name)) return null;
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = `/parts/${name}.jpg`;
    textures.set(name, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

