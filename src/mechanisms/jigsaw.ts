/** Mechanism 15: the all-white jigsaw. Twenty-four blank pieces lie in a tray; a gantry head picks one,
 *  reads its four edges (tab or blank, how big, how far along), compares them with every open slot's
 *  known neighbours, and places it when exactly one slot fits. A piece with nothing to compare against
 *  goes back to the tray. When the board is full it flips over and the picture is on the other side,
 *  which is how his machine worked: it never saw the picture either. From "Worlds hardest jigsaw vs.
 *  puzzle machine (all white)" (2022). */
import { cue } from '../lib/sound';
import { axis, stepAxis, clamp } from '../lib/motor';
import { fit, palette, metals, bar, fontFor } from '../lib/canvas';
import { sprite, drawSprite, near } from '../lib/sprites';
import { addTicker } from '../lib/loop';
import { onVisible, reducedMotion } from '../lib/visible';

export interface JigsawHandle {
  reset(): void;
}

const COLS = 6;
const ROWS = 4;

/** one edge, seen from the piece that owns it: +1 a tab out, -1 a blank, 0 the puzzle's border */
interface Edge {
  sign: -1 | 0 | 1;
  size: number; // 0.8..1.2 of the standard tab
  at: number; // -0.15..0.15 along the edge
}
interface Piece {
  r: number;
  c: number;
  edges: [Edge, Edge, Edge, Edge]; // top, right, bottom, left
  // where it lies now (tray or board), in canvas px, centre
  x: number;
  y: number;
  placed: boolean;
  tray: number; // its tray slot
}

type Phase = 'wait' | 'pick' | 'scan' | 'carry' | 'place' | 'back' | 'flip' | 'done';

export function mountJigsaw(cv: HTMLCanvasElement, stat: HTMLElement | null, pictureSrc: string): JigsawHandle {
  const P = palette();
  const M = metals();
  let ctx = cv.getContext('2d')!;
  let W = 10;
  let H = 10;
  let s = 40; // piece size
  let board = { x: 0, y: 0 };
  let tray = { x: 0, y: 0, cols: 3 };
  let pieces: Piece[] = [];
  const head = { x: axis(0, 3600, 24000), y: axis(0, 3600, 24000), down: 0, holding: null as Piece | null };
  let picks = 0;
  let phase: Phase = 'wait';
  let t = 0;
  let order: Piece[] = [];
  let scan: { piece: Piece; fits: Piece[]; compared: number; known: number } | null = null;
  let target: Piece | null = null;
  let placedN = 0;
  let compares = 0;
  let returned = 0;
  let flip = 0; // 0 face down .. 1 picture up
  let visible = false;
  const still = reducedMotion();
  const picture = new Image();
  picture.decoding = 'async';
  picture.src = pictureSrc;
  near(cv, ['head']);

  /* ---------- the puzzle: cut once, then solved ---------- */
  function cut(): void {
    const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
    // horizontal seams h[r][c] belong to the piece above (sign) ; vertical seams v[r][c] to the piece on the left
    const hs: Edge[][] = [];
    const vs: Edge[][] = [];
    for (let r = 0; r < ROWS - 1; r++) {
      hs.push([]);
      for (let c = 0; c < COLS; c++) hs[r].push({ sign: Math.random() < 0.5 ? 1 : -1, size: rnd(0.8, 1.2), at: rnd(-0.15, 0.15) });
    }
    for (let r = 0; r < ROWS; r++) {
      vs.push([]);
      for (let c = 0; c < COLS - 1; c++) vs[r].push({ sign: Math.random() < 0.5 ? 1 : -1, size: rnd(0.8, 1.2), at: rnd(-0.15, 0.15) });
    }
    const flat: Edge = { sign: 0, size: 1, at: 0 };
    const mirror = (e: Edge): Edge => ({ sign: -e.sign as -1 | 0 | 1, size: e.size, at: -e.at });
    pieces = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const top = r === 0 ? flat : mirror(hs[r - 1][c]);
        const bottom = r === ROWS - 1 ? flat : hs[r][c];
        const left = c === 0 ? flat : mirror(vs[r][c - 1]);
        const right = c === COLS - 1 ? flat : vs[r][c];
        pieces.push({ r, c, edges: [top, right, bottom, left], x: 0, y: 0, placed: false, tray: 0 });
      }
    }
    // scrambled into the tray
    const shuffled = [...pieces].sort(() => Math.random() - 0.5);
    shuffled.forEach((p, i) => (p.tray = i));
    order = shuffled;
  }

  function layout(): void {
    const f = fit(cv);
    ctx = f.ctx;
    W = f.w;
    H = f.h;
    const m = 16;
    // the board takes the right side, the tray the left; the head needs headroom above both
    const top = 70;
    // the board on the right, a four-column tray of smaller pieces on the left, the head's beam above both
    s = Math.floor(Math.min((W - 2 * m - 48) / (COLS + 2.4), (H - top - m) / ROWS));
    board = { x: W - m - s * COLS, y: Math.max(top, (H + top - s * ROWS) / 2) };
    const ts = s * 0.6;
    const trayRows = Math.ceil((COLS * ROWS) / 4);
    tray = { x: m + 8, y: Math.max(top, (H + top - trayRows * (ts + 6)) / 2), cols: 4 };
    for (const p of pieces) {
      if (p.placed) {
        p.x = board.x + p.c * s + s / 2;
        p.y = board.y + p.r * s + s / 2;
      } else {
        p.x = tray.x + (p.tray % 4) * (ts + 6) + ts / 2;
        p.y = tray.y + Math.floor(p.tray / 4) * (ts + 6) + ts / 2;
      }
    }
    if (phase === 'wait') {
      head.x.p = board.x + (s * COLS) / 2;
      head.y.p = top - 30;
    }
  }
  cut();
  layout();
  new ResizeObserver(layout).observe(cv);
  (window as unknown as { __jigsaw: () => unknown }).__jigsaw = () => ({ phase, placedN, returned, compares, head: { x: Math.round(head.x.p), y: Math.round(head.y.p), down: head.down, holding: !!head.holding }, scan: scan ? { fits: scan.fits.length, known: scan.known, compared: scan.compared } : null, visible, s, board, tray });
  onVisible(cv, (v) => (visible = v), 0.3);

  const tell = (text: string): void => {
    if (stat) stat.textContent = text;
  };

  /* ---------- the matching: what a scanned piece can be compared with ---------- */
  function candidates(p: Piece): { fits: Piece[]; compared: number; known: number } {
    let compared = 0;
    let known = 0;
    const fits: Piece[] = [];
    const same = (a: Edge, b: Edge): boolean => a.sign === b.sign && Math.abs(a.size - b.size) < 0.02 && Math.abs(a.at - b.at) < 0.02;
    for (const slot of pieces) {
      if (slot.placed) continue;
      // what the slot demands: the border where it is on the edge, and the facing edge of each placed neighbour
      const demands: (Edge | null)[] = [
        slot.r === 0 ? { sign: 0, size: 1, at: 0 } : neighbour(slot.r - 1, slot.c, 2),
        slot.c === COLS - 1 ? { sign: 0, size: 1, at: 0 } : neighbour(slot.r, slot.c + 1, 3),
        slot.r === ROWS - 1 ? { sign: 0, size: 1, at: 0 } : neighbour(slot.r + 1, slot.c, 0),
        slot.c === 0 ? { sign: 0, size: 1, at: 0 } : neighbour(slot.r, slot.c - 1, 1),
      ];
      const k = demands.filter((d) => d !== null).length;
      if (k === 0) continue;
      known = Math.max(known, k);
      let ok = true;
      // a flat edge means the border, and only the border: that alone rules most slots out
      const border = [slot.r === 0, slot.c === COLS - 1, slot.r === ROWS - 1, slot.c === 0];
      for (let i = 0; i < 4 && ok; i++) {
        compared++;
        if ((p.edges[i].sign === 0) !== border[i]) ok = false;
      }
      for (let i = 0; i < 4 && ok; i++) {
        const d = demands[i];
        if (!d) continue;
        compared++;
        // the neighbour's facing edge must be the mirror of this piece's edge
        const need: Edge = { sign: -d.sign as -1 | 0 | 1, size: d.size, at: -d.at };
        if (!same(p.edges[i], need)) {
          ok = false;
          break;
        }
      }
      if (ok) fits.push(slot);
    }
    return { fits, compared, known };
  }
  function neighbour(r: number, c: number, side: number): Edge | null {
    const n = pieces.find((q) => q.r === r && q.c === c);
    return n && n.placed ? n.edges[side] : null;
  }

  function start(): void {
    cut();
    placedN = 0;
    picks = 0;
    compares = 0;
    returned = 0;
    flip = 0;
    head.holding = null;
    head.down = 0;
    phase = 'pick';
    t = 0;
    layout();
    tell('0 of 24 placed');
  }

  /* ---------- the loop ---------- */
  addTicker(function jigsaw(dt) {
    if (!visible && phase !== 'wait') return;
    if (still) {
      // no motion: the solved board, picture up
      if (!pieces.every((p) => p.placed)) {
        pieces.forEach((p) => (p.placed = true));
        flip = 1;
        layout();
      }
      draw();
      return;
    }
    if (phase === 'wait') {
      if (visible) {
        t += dt;
        if (t > 0.6) start();
      }
      return;
    }
    t += dt;
    const next = order.find((p) => !p.placed);
    switch (phase) {
      case 'pick': {
        if (!next) {
          phase = 'flip';
          t = 0;
          break;
        }
        // the first piece is whatever is nearest, which is how a first attempt goes; after that the head
        // takes the piece whose edges fit exactly one slot of what has been placed so far
        const pick = picks === 0 ? next : (order.find((p) => !p.placed && candidates(p).fits.length === 1) ?? next);
        stepAxis(head.x, pick.x, dt);
        stepAxis(head.y, pick.y - s * 0.9, dt);
        if (head.x.p === pick.x && head.y.p === pick.y - s * 0.9) {
          head.down = Math.min(1, head.down + dt * 24);
          if (head.down >= 1) {
            picks++;
            head.holding = pick;
            const c = candidates(pick);
            compares += c.compared;
            scan = { piece: pick, fits: c.fits, compared: c.compared, known: c.known };
            phase = 'scan';
            t = 0;
            cue.index();
          }
        }
        break;
      }
      case 'scan': {
        head.down = Math.max(0.4, head.down - dt * 20);
        if (t > 0.16 && scan) {
          if (scan.fits.length === 1) {
            target = scan.fits[0];
            phase = 'carry';
          } else {
            // nothing to compare against yet (or more than one fit): back to the tray, next piece
            returned++;
            const p = scan.piece;
            order = [...order.filter((q) => q !== p), p];
            phase = 'back';
          }
          t = 0;
        }
        break;
      }
      case 'carry': {
        if (!target || !head.holding) break;
        const tx = board.x + target.c * s + s / 2;
        const ty = board.y + target.r * s + s / 2;
        head.holding.x = head.x.p;
        head.holding.y = head.y.p + s * 0.9 * head.down;
        stepAxis(head.x, tx, dt);
        stepAxis(head.y, ty - s * 0.9, dt);
        if (head.x.p === tx && head.y.p === ty - s * 0.9) {
          phase = 'place';
          t = 0;
        }
        break;
      }
      case 'place': {
        head.down = Math.min(1, head.down + dt * 24);
        if (head.holding) {
          head.holding.x = head.x.p;
          head.holding.y = head.y.p + s * 0.9 * head.down;
        }
        if (head.down >= 1 && head.holding && target) {
          const p = head.holding;
          p.r = target.r;
          p.c = target.c;
          p.placed = true;
          p.x = board.x + p.c * s + s / 2;
          p.y = board.y + p.r * s + s / 2;
          placedN++;
          cue.pawl();
          tell(`${placedN} of ${COLS * ROWS} placed · ${compares} edges compared · ${returned} put back`);
          head.holding = null;
          target = null;
          scan = null;
          phase = 'pick';
          t = 0;
        }
        break;
      }
      case 'back': {
        head.down = Math.min(1, head.down + dt * 24);
        if (head.down >= 1 && head.holding) {
          head.holding = null;
          scan = null;
          phase = 'pick';
          t = 0;
        }
        break;
      }
      case 'flip': {
        // the board turns over about its vertical axis; the head parks above it
        stepAxis(head.x, board.x + (s * COLS) / 2, dt);
        stepAxis(head.y, board.y - s * 1.3, dt);
        head.down = Math.max(0, head.down - dt * 4);
        flip = clamp((t - 0.5) / 1.1, 0, 1);
        if (flip >= 1) {
          phase = 'done';
          tell(`24 of 24 placed · ${compares} edges compared · ${returned} put back · face down the whole time`);
        }
        break;
      }
    }
    draw();
  });

  /* ---------- drawing ---------- */
  function piecePath(cx: number, cy: number, size: number, e: [Edge, Edge, Edge, Edge]): void {
    const h = size / 2;
    const tab = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - h, cy - h);
    // each side: straight, then a tab or blank bump in the middle, then straight; sides run clockwise
    const side = (x0: number, y0: number, x1: number, y1: number, ed: Edge): void => {
      if (ed.sign === 0) {
        ctx.lineTo(x1, y1);
        return;
      }
      const dx = x1 - x0;
      const dy = y1 - y0;
      const nx = dy / size; // outward normal (clockwise winding)
      const ny = -dx / size;
      const mx = x0 + dx * (0.5 + ed.at);
      const my = y0 + dy * (0.5 + ed.at);
      const k = ed.sign * tab * ed.size;
      const w = size * 0.11;
      ctx.lineTo(mx - (dx / size) * w, my - (dy / size) * w);
      ctx.bezierCurveTo(mx - (dx / size) * w * 1.6 + nx * k, my - (dy / size) * w * 1.6 + ny * k, mx + (dx / size) * w * 1.6 + nx * k, my + (dy / size) * w * 1.6 + ny * k, mx + (dx / size) * w, my + (dy / size) * w);
      ctx.lineTo(x1, y1);
    };
    side(cx - h, cy - h, cx + h, cy - h, e[0]);
    side(cx + h, cy - h, cx + h, cy + h, e[1]);
    side(cx + h, cy + h, cx - h, cy + h, e[2]);
    side(cx - h, cy + h, cx - h, cy - h, e[3]);
    ctx.closePath();
  }

  function draw(): void {
    ctx.clearRect(0, 0, W, H);
    // the tray and the board
    const ts = s * 0.6;
    const trayRows = Math.ceil((COLS * ROWS) / tray.cols);
    // the tray empties as the board fills, and fades with it
    ctx.globalAlpha = 0.25 + 0.75 * (1 - placedN / (COLS * ROWS));
    ctx.fillStyle = P.recess;
    ctx.fillRect(tray.x - 8, tray.y - 8, tray.cols * (ts + 6) + 10, trayRows * (ts + 6) + 10);
    ctx.globalAlpha = 1;
    const bw = s * COLS;
    const bh = s * ROWS;
    const cx = board.x + bw / 2;
    // the flip: the board narrows about its centre line and comes back with the picture on it
    const k = Math.cos(flip * Math.PI);
    ctx.save();
    ctx.translate(cx, 0);
    ctx.scale(Math.max(0.02, Math.abs(k)), 1);
    ctx.translate(-cx, 0);
    ctx.fillStyle = k >= 0 ? P.steelDark : '#2a2b2f';
    ctx.fillRect(board.x - 6, board.y - 6, bw + 12, bh + 12);
    if (k >= 0) {
      // face down: the blank pieces that have been placed, in their slots
      ctx.fillStyle = P.surface;
      ctx.fillRect(board.x, board.y, bw, bh);
      for (const p of pieces) {
        if (!p.placed) continue;
        drawPiece(p.x, p.y, s, p.edges, '#f4f3ee', 1);
      }
    } else {
      // the picture, with the piece seams over it
      if (picture.complete && picture.naturalWidth) {
        const ir = picture.naturalWidth / picture.naturalHeight;
        const br = bw / bh;
        const sw = ir > br ? picture.naturalHeight * br : picture.naturalWidth;
        const sh = ir > br ? picture.naturalHeight : picture.naturalWidth / br;
        ctx.save();
        ctx.beginPath();
        ctx.rect(board.x, board.y, bw, bh);
        ctx.clip();
        ctx.drawImage(picture, (picture.naturalWidth - sw) / 2, (picture.naturalHeight - sh) / 2, sw, sh, board.x, board.y, bw, bh);
        ctx.restore();
      } else {
        ctx.fillStyle = P.accent;
        ctx.fillRect(board.x, board.y, bw, bh);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1;
      for (const p of pieces) {
        // the picture is mirrored by the flip, so the seams are drawn mirrored too
        const mx = 2 * cx - (board.x + p.c * s + s / 2);
        piecePath(mx, board.y + p.r * s + s / 2, s, [p.edges[0], { ...p.edges[3], at: -p.edges[3].at }, { ...p.edges[2], at: -p.edges[2].at }, { ...p.edges[1], at: -p.edges[1].at }]);
        ctx.stroke();
      }
    }
    ctx.restore();
    // tray pieces, and the one in the head
    for (const p of pieces) {
      if (p.placed) continue;
      const held = head.holding === p;
      drawPiece(p.x, p.y, held ? s : ts, p.edges, held ? '#ffffff' : '#f0efe9', held ? 1 : 0.9);
    }
    // the scan: the held piece's four edges as read, and what they were compared with
    if (scan && phase === 'scan') {
      const p = scan.piece;
      ctx.font = fontFor(12, 700);
      ctx.fillStyle = P.ink;
      ctx.textBaseline = 'top';
      const code = p.edges.map((e) => (e.sign === 0 ? 'flat' : `${e.sign > 0 ? 'tab' : 'blank'} ${e.size.toFixed(2)} @${(e.at >= 0 ? '+' : '') + e.at.toFixed(2)}`));
      const lx = Math.min(W - 230, p.x + s);
      const ly = Math.max(6, p.y - s * 1.6);
      ['top', 'right', 'bottom', 'left'].forEach((name, i) => ctx.fillText(`${name}  ${code[i]}`, lx, ly + i * 15));
      ctx.fillStyle = scan.fits.length === 1 ? P.accent : P.muted;
      ctx.fillText(scan.known ? `${scan.compared} edges compared, ${scan.fits.length} slot${scan.fits.length === 1 ? '' : 's'} fit` : 'nothing placed beside it yet: back to the tray', lx, ly + 64);
    }
    // the head: a gantry beam across the top, the pick head on it, the arm down to the piece
    const hx = head.x.p;
    const hy = head.y.p;
    bar(ctx, 8, 14, W - 16, 10, M.anod, 2);
    const img = sprite('head');
    const drop = s * 0.9 * head.down;
    ctx.strokeStyle = M.steel.light;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(hx, 24);
    ctx.lineTo(hx, hy + drop - 10);
    ctx.stroke();
    if (img) drawSprite(ctx, img, hx, hy + drop, s * 1.5, 0.5, 1);
    else {
      bar(ctx, hx - 14, hy + drop - 46, 28, 40, M.anod, 3);
      ctx.fillStyle = P.ball;
      ctx.beginPath();
      ctx.ellipse(hx, hy + drop - 2, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPiece(x: number, y: number, size: number, e: [Edge, Edge, Edge, Edge], fill: string, alpha: number): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    piecePath(x, y, size, e);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  return {
    reset() {
      if (still) return;
      start();
    },
  };
}
