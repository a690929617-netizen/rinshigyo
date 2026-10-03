// EP36《六秒》shared motifs and helpers (Canvas2D side). Every plate uses these so the recurring things
// look identical everywhere: the playhead (red dot + hot core + short tail), the progress bar, timecodes,
// the "digits scramble 3–5 frames then settle" readout, the per-character slam, and the easing curves
// borrowed from mg-styles-15 (see the code-lyric-mv skill, references/mg-styles-15.md).
import { rgba } from '../engine/palette';
import { font } from '../engine/type';
import { clamp, frameIdx, hash, lerp } from '../engine/util';

// ------------------------------------------------------------------ easing (cubic-bezier, CSS semantics)
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s: number) => ((ax * s + bx) * s + cx) * s;
  const Y = (s: number) => ((ay * s + by) * s + cy) * s;
  const dX = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let s = x;
    for (let i = 0; i < 6; i++) { const e = X(s) - x; const d = dX(s); if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break; s -= e / d; }
    return Y(clamp(s));
  };
}
/** Easing by emotion (mg-styles-15): slam = overshoot, write = pen, liquid = long tail, morph = A→circle→B. */
export const EZ = {
  slam: cubicBezier(0.34, 1.56, 0.64, 1),
  write: cubicBezier(0.65, 0, 0.35, 1),
  liquid: cubicBezier(0.22, 1, 0.36, 1),
  morph: cubicBezier(0.7, 0, 0.3, 1),
  /** 3D camera: 80 % of the distance in the first 20 % of the time. */
  cam: (x: number) => 1 - Math.pow(1 - clamp(x), 7.2),
};

// ------------------------------------------------------------------ timecodes and readouts
/** 7.3 -> "00:07", with hundredths: "00:07.30". */
export function timecode(sec: number, hundredths = false) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60), r = s - m * 60;
  const ss = Math.floor(r).toString().padStart(2, '0');
  const base = `${m.toString().padStart(2, '0')}:${ss}`;
  return hundredths ? `${base}.${Math.floor((r % 1) * 100).toString().padStart(2, '0')}` : base;
}
/**
 * HUD digits: for `frames` video frames after `t0` every digit is a random one (deterministic per frame),
 * then the true value lands (mg-styles-15 #08). Non-digits stay.
 */
export function scramble(s: string, t: number, t0: number, frames = 4, seed = 1) {
  const k = frameIdx(t) - frameIdx(t0);
  if (k < 0 || k >= frames) return s;
  return s.replace(/[0-9]/g, (_, i: number) => String(Math.floor(hash(frameIdx(t), i, seed) * 10)));
}

// ------------------------------------------------------------------ the playhead
/**
 * The playhead: a red dot with a hot ember core, a soft glow and a short tail pointing back along `dir`
 * (unit vector, the direction it travels). `I` scales the glow (0..1+).
 */
export function drawPlayhead(c: CanvasRenderingContext2D, x: number, y: number, t: number, o: { r?: number; I?: number; dir?: [number, number]; tail?: number } = {}) {
  const r = o.r ?? 9, I = o.I ?? 1, [dx, dy] = o.dir ?? [1, 0], tail = o.tail ?? 46;
  c.save();
  c.globalCompositeOperation = 'lighter';
  // tail
  const g = c.createLinearGradient(x, y, x - dx * tail, y - dy * tail);
  g.addColorStop(0, rgba('signal', 0.85 * I)); g.addColorStop(1, rgba('signal', 0));
  c.strokeStyle = g; c.lineWidth = r * 0.9; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x - dx * tail, y - dy * tail); c.stroke();
  // glow
  const breathe = 1 + 0.06 * Math.sin(t * 9.0);
  const gl = c.createRadialGradient(x, y, 0, x, y, r * 6 * breathe);
  gl.addColorStop(0, rgba('signal', 0.55 * I)); gl.addColorStop(0.35, rgba('signal', 0.16 * I)); gl.addColorStop(1, rgba('signal', 0));
  c.fillStyle = gl; c.beginPath(); c.arc(x, y, r * 6 * breathe, 0, Math.PI * 2); c.fill();
  c.restore();
  // body + core
  c.fillStyle = rgba('signal', 1); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.fillStyle = rgba('ember', 1); c.beginPath(); c.arc(x - r * 0.18, y - r * 0.18, r * 0.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,240,230,0.95)'; c.beginPath(); c.arc(x - r * 0.25, y - r * 0.25, r * 0.2, 0, Math.PI * 2); c.fill();
}

/**
 * The progress bar the playhead rides: a hairline from x0 to x1 at y, red up to `frac`, seconds ticks
 * every `tickEvery` of `total`, an optional labelled wall (e.g. the 6-second wall). Returns the playhead x.
 */
export function drawProgress(c: CanvasRenderingContext2D, x0: number, x1: number, y: number, frac: number, o: { total?: number; tickEvery?: number; wall?: number; wallLabel?: string; alpha?: number } = {}) {
  const a = o.alpha ?? 1, total = o.total ?? 6, x = lerp(x0, x1, clamp(frac));
  c.save();
  c.lineWidth = 1.2;
  c.strokeStyle = rgba('graphite', 0.9 * a); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke();
  c.strokeStyle = rgba('signal', 0.95 * a); c.lineWidth = 2.4; c.beginPath(); c.moveTo(x0, y); c.lineTo(x, y); c.stroke();
  if (o.tickEvery) {
    c.fillStyle = rgba('ash', 0.75 * a); c.font = font('Plex-400', 11); c.textAlign = 'center';
    for (let s = 0; s <= total + 1e-6; s += o.tickEvery) {
      const tx = lerp(x0, x1, s / total);
      c.fillRect(tx - 0.5, y - 5, 1, 10);
      c.fillText(String(Math.round(s)), tx, y + 20);
    }
  }
  if (o.wall !== undefined) {
    const wx = lerp(x0, x1, o.wall / total);
    c.strokeStyle = rgba('bone', 0.8 * a); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(wx, y - 22); c.lineTo(wx, y + 8); c.stroke();
    if (o.wallLabel) { c.fillStyle = rgba('bone', 0.85 * a); c.font = font('UD-400', 13); c.textAlign = 'center'; c.fillText(o.wallLabel, wx, y - 28); }
  }
  c.restore();
  return x;
}

// ------------------------------------------------------------------ Japanese lyric type
export interface JGlyph { ch: string; x: number; w: number }
/** Per-character layout (Japanese needs no kerning tables; widths from the font). `sx` = horizontal scale (the width axis). */
export function jlayout(c: CanvasRenderingContext2D, text: string, fam: string, size: number, tracking = 0, sx = 1): { glyphs: JGlyph[]; width: number } {
  c.font = font(fam, size);
  const glyphs: JGlyph[] = [];
  let x = 0;
  for (const ch of Array.from(text)) {
    if (ch === ' ') { x += size * 0.32 * sx; continue; }
    const w = c.measureText(ch).width * sx;
    glyphs.push({ ch, x, w });
    x += w + tracking;
  }
  return { glyphs, width: x - tracking };
}

/**
 * One character slammed in at t0 (the frame its mora is sung, minus one frame of lead):
 * 75 ms from `from`× to 1× on the overshoot curve, one smear frame stretched along the fall at the
 * fastest moment, white-hot → signal red → cools to bone over `cool` s (or stays red with `hold`).
 * (x, y) is the glyph's baseline-left; `sx` horizontal scale.
 */
export function slamChar(c: CanvasRenderingContext2D, ch: string, x: number, y: number, size: number, fam: string, t: number, t0: number,
  o: { from?: number; cool?: number; hold?: boolean; sx?: number; alpha?: number; dir?: [number, number] } = {}) {
  const lt = t - t0;
  if (lt < 0) return;
  const from = o.from ?? 1.7, dur = 0.075, a = o.alpha ?? 1, sx = o.sx ?? 1;
  const k = EZ.slam(clamp(lt / dur));
  const s = lerp(from, 1, k);
  c.save();
  c.font = font(fam, size);
  const w = c.measureText(ch).width;
  const cx = x + (w * sx) / 2, cy = y - size * 0.38;
  c.translate(cx, cy);
  // the smear: the frame where the glyph moves fastest is stretched 200 % along the fall, once
  const smear = frameIdx(t) === frameIdx(t0 + dur * 0.35) ? 2.0 : 1;
  const [dx, dy] = o.dir ?? [0, 1];
  c.scale(s * sx * (dx ? smear : 1), s * (dy ? smear : 1));
  // colour: white-hot at impact → red → bone (unless held red: the word being sung)
  const cool = o.cool ?? 0.45;
  const h = o.hold ? 0 : clamp((lt - dur) / cool);
  const hot = clamp(1 - lt / 0.06);
  let col: string;
  if (hot > 0) col = `rgba(255,${Math.round(lerp(120, 236, hot))},${Math.round(lerp(100, 220, hot))},${a})`;
  else col = h < 1 ? mixRGB([255, 59, 47], [238, 233, 223], h, a) : rgba('bone', a);
  c.fillStyle = col;
  c.textBaseline = 'alphabetic';
  c.fillText(ch, -w / 2, size * 0.38);
  c.restore();
}
function mixRGB(a: [number, number, number], b: [number, number, number], k: number, alpha: number) {
  return `rgba(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))},${alpha})`;
}

/** A small mono annotation with a hairline leader from (ax, ay) to the label at (x, y). */
export function annotate(c: CanvasRenderingContext2D, ax: number, ay: number, x: number, y: number, lines: string[], o: { alpha?: number; align?: CanvasTextAlign; red?: number } = {}) {
  const a = o.alpha ?? 1;
  c.save();
  c.strokeStyle = rgba('ash', 0.7 * a); c.lineWidth = 1;
  c.beginPath(); c.moveTo(ax, ay); c.lineTo(x, y); c.lineTo(x + (o.align === 'right' ? -24 : 24), y); c.stroke();
  c.fillStyle = rgba('bone', 0.9 * a); c.beginPath(); c.arc(ax, ay, 2.2, 0, Math.PI * 2); c.fill();
  c.textAlign = o.align ?? 'left';
  const tx = x + (o.align === 'right' ? -30 : 30);
  lines.forEach((s, i) => {
    c.font = font(i === 0 ? 'Plex-500' : 'Plex-400', i === 0 ? 13 : 12);
    c.fillStyle = i === o.red ? rgba('signal', a) : rgba(i === 0 ? 'bone' : 'ash', (i === 0 ? 0.95 : 0.8) * a);
    c.fillText(s, tx, y + 4 + i * 17);
  });
  c.restore();
}
