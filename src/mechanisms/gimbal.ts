/** Mechanism B: the gimbal-stabilised player. The ring (outer axis) takes every disturbance: scroll
 *  acceleration, a fast cursor nearby, a drag, device tilt where no permission prompt is needed or
 *  where the visitor opts in. The frame inside is driven level by a servo with visible lag. */
import { stepSpring } from '../lib/spring';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion, finePointer } from '../lib/visible';
import { clamp } from '../lib/motor';
import { capture } from '../lib/pointer';

export function mountGimbal(root: HTMLElement, videoId: string, title: string): { play(): void } {
  const ring = root.querySelector<HTMLElement>('.gimbal__ring')!;
  const frame = root.querySelector<HTMLElement>('.gimbal__frame')!;
  const playBtn = root.querySelector<HTMLButtonElement>('.gimbal__play')!;
  const tiltBtn = root.querySelector<HTMLButtonElement>('.gimbal__tilt')!;
  const still = reducedMotion();

  // disturbance on the ring: an angle (deg) and a small vertical bob (px), both springs with a
  // little bounce since they are driven by momentum
  const ringA = { x: 0, v: 0 };
  const ringY = { x: 0, v: 0 };
  // the stabilised frame chases "level" with lag: a slower, critically damped servo on the error
  const frameA = { x: 0, v: 0 };
  let visible = false;
  let lastScroll = window.scrollY;
  let lastScrollV = 0;
  let tilt = 0;
  let tiltOn = false;

  onVisible(root, (v) => (visible = v), 0.1);

  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      const dv = y - lastScroll;
      lastScroll = y;
      if (!visible || still) return;
      const accel = dv - lastScrollV;
      lastScrollV = dv;
      ringA.v += clamp(accel, -60, 60) * 0.9;
      ringY.v += clamp(dv, -80, 80) * 1.2;
    },
    { passive: true },
  );

  if (finePointer() && !still) {
    let px = 0;
    let py = 0;
    let pt = 0;
    window.addEventListener(
      'pointermove',
      (e) => {
        if (!visible) return;
        const now = performance.now();
        const dt = (now - pt) / 1000;
        if (pt && dt > 0 && dt < 0.1) {
          const r = root.getBoundingClientRect();
          const inside = e.clientX > r.left - 80 && e.clientX < r.right + 80 && e.clientY > r.top - 80 && e.clientY < r.bottom + 80;
          if (inside) {
            const vx = (e.clientX - px) / dt;
            const side = (e.clientY - r.top) / r.height - 0.5; // above centre pushes one way
            ringA.v += clamp((vx / 1000) * side * 40, -25, 25);
          }
        }
        px = e.clientX;
        py = e.clientY;
        pt = now;
        void py;
      },
      { passive: true },
    );
  }

  // drag the ring to shove it
  let drag: { x: number; y: number } | null = null;
  ring.style.pointerEvents = 'auto';
  ring.style.touchAction = 'none';
  ring.style.cursor = 'grab';
  ring.addEventListener('pointerdown', (e) => {
    capture(ring, e);
    drag = { x: e.clientX, y: e.clientY };
  });
  ring.addEventListener('pointermove', (e) => {
    if (!drag) return;
    ringA.v += (e.clientX - drag.x) * 0.9;
    ringY.v += (e.clientY - drag.y) * 2;
    drag = { x: e.clientX, y: e.clientY };
  });
  const endDrag = (): void => {
    drag = null;
  };
  ring.addEventListener('pointerup', endDrag);
  ring.addEventListener('pointercancel', endDrag);

  // device tilt: Android and desktops fire without a prompt; iOS needs an opt-in tap
  const needsPrompt = typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === 'function';
  const onTilt = (e: DeviceOrientationEvent): void => {
    if (e.gamma == null) return;
    tilt = clamp(e.gamma, -35, 35);
    tiltOn = true;
  };
  if (!still && 'DeviceOrientationEvent' in window) {
    if (!needsPrompt) window.addEventListener('deviceorientation', onTilt, { passive: true });
    else if (window.matchMedia('(hover: none)').matches) {
      root.classList.add('has-tilt-option');
      tiltBtn.addEventListener('click', async () => {
        try {
          const res = await (DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
          if (res === 'granted') {
            window.addEventListener('deviceorientation', onTilt, { passive: true });
            tiltBtn.textContent = 'Tilt on';
          }
        } catch {
          tiltBtn.textContent = 'Tilt unavailable';
        }
      });
    }
  }

  addTicker((dt) => {
    if (!visible || still) return;
    // ring: springs back to rest (or to the device tilt) with a little bounce
    stepSpring(ringA, tiltOn ? tilt * 0.6 : 0, dt, 0.55, 0.75);
    stepSpring(ringY, 0, dt, 0.45, 0.8);
    ringA.x = clamp(ringA.x, -28, 28);
    // frame: a slower servo that keeps the picture level in the world; its visible lag is the point
    stepSpring(frameA, 0, dt, 0.42, 1);
    frameA.x += (ringA.v * dt) * 0.35; // the ring's motion drags the frame before the servo catches up
    ring.style.transform = `translate3d(0, ${ringY.x.toFixed(2)}px, 0) rotate(${ringA.x.toFixed(2)}deg)`;
    frame.style.transform = `translate3d(0, ${(ringY.x * 0.25).toFixed(2)}px, 0) rotate(${(frameA.x * 0.5).toFixed(2)}deg)`;
  });

  function play(): void {
    if (frame.querySelector('iframe')) return;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&rel=0&playsinline=1`;
    iframe.title = title;
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.setAttribute('allowfullscreen', '');
    frame.appendChild(iframe);
    playBtn.remove();
  }
  playBtn.addEventListener('click', play);
  return { play };
}
