/** Calls back with true/false as an element enters or leaves the viewport. */
export function onVisible(el: Element, cb: (visible: boolean) => void, threshold = 0.2, rootMargin = '0px'): () => void {
  if (!('IntersectionObserver' in window)) {
    cb(true);
    return () => {};
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) cb(e.isIntersecting);
    },
    { threshold, rootMargin },
  );
  io.observe(el);
  return () => io.disconnect();
}

/** Runs once, the first time the element is reasonably in view. */
export function onceInView(el: Element, cb: () => void, threshold = 0.3): void {
  let done = false;
  const stop = onVisible(
    el,
    (v) => {
      if (v && !done) {
        done = true;
        stop();
        cb();
      }
    },
    threshold,
  );
}

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const finePointer = (): boolean => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
export const narrow = (): boolean => window.matchMedia('(max-width: 47.99em)').matches;
