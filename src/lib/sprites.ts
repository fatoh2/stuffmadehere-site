/** Rendered part images (PNG with alpha) used by the mechanisms. Each loads once; a mechanism draws
 *  its fallback shapes until the sprite is ready, and forever if the file is missing. */
const cache = new Map<string, HTMLImageElement | null>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

export function sprite(name: string): HTMLImageElement | null {
  if (cache.has(name)) return cache.get(name)!;
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
      img.src = `/parts/${name}.png`;
    });
    pending.set(name, p);
  }
  return null;
}

export function preload(names: string[]): void {
  names.forEach(sprite);
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
