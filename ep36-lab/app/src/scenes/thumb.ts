// EP36 test plate `thumb` (part of `judge`, verse 1 lines 7–8): 「指紋が 近づく／そこまで ストップ」.
// We are the phone, looking up through the glass. The opponent's thumb comes down out of the dark: an
// engraved 3D fingerprint (raymarched pad, ridge displacement, every engraved line IS a ridge), lit cold
// from below by the screen, a red rim from behind. Annotations measure it like a specimen (FIG., core,
// ridge pitch, gap, speed). The characters grow as it nears. On 「ストップ」 everything freezes: the thumb,
// the camera, the readouts — and a red STOP stamp slams onto the glass.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, keys, lerp, prog, pulse } from '../engine/util';
import { EngraveCam, engraveFrag, engraveUniforms } from './_engrave';
import { EZ, annotate, drawPlayhead, drawProgress, jlayout, scramble, slamChar, timecode } from './_ep36';

const FP_GLSL = /* glsl */ `
uniform vec3 padC; uniform vec3 padR; uniform float ridgeAmp, ridgeFreq, gapGlow;
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
// fingerprint phase: a whorl whose loops open toward the tip (+z), warped like skin; ridges at integer phase
float fpPhase(vec2 q) {
  vec2 w = q + 0.12 * vec2(snoise(q * 0.38 + 3.1), snoise(q * 0.38 + 9.7));
  vec2 e = vec2(w.x, w.y * 0.80 + 0.10 * w.x * w.x);
  float r = length(e);
  float a = atan(e.y, e.x);
  return r * ridgeFreq + 0.55 * sin(a - 0.5) * smoothstep(0.0, 1.4, r) + 0.10 * snoise(q * 0.8);
}
float ridgeH(vec2 q, out float ph) {
  ph = fpPhase(q);
  return pow(0.5 + 0.5 * cos(TAU * ph), 1.6);
}
/** minutiae: where a low-frequency field peaks, the ridge line breaks (an ending or a short island) */
float minutiae(vec2 q) { return smoothstep(0.84, 0.9, 0.5 + 0.5 * snoise(q * 5.5 + 4.0)); }
float map(vec3 p, out vec4 info) {
  vec3 q = p - padC;
  // the pad, and the rest of the thumb rising behind it out of frame
  float d = sdEllipsoid(q, padR);
  d = smin(d, sdCapsule(q, vec3(0.4, 0.55, -0.4), vec3(6.5, 6.0, -3.5), padR.x * 0.82), 1.6);
  float ph = 0.0;
  if (d < 0.35) {
    float face = smoothstep(0.35, -0.55, q.y / padR.y); // ridges on the underside (facing the glass)
    d -= ridgeAmp * ridgeH(q.xz, ph) * face;
  }
  info = vec4(ph, q.y, 0.0, 0.0);
  return d;
}`;

const FP_SURFACE = /* glsl */ `
EngraveSurf surface(vec3 P, vec3 N, vec4 info) {
  EngraveSurf s = defaultSurf(P, N);
  vec3 q = P - padC;
  float face = smoothstep(0.35, -0.55, q.y / padR.y);
  // the underside is engraved along the ridges themselves; the upper skin with plain contour lines
  s.u = mix((q.y + 0.07 * q.x) * 4.5, info.x, face);
  s.uWorld = mix(1.0 / 4.5, 1.0 / ridgeFreq, face);
  s.toneBias = 0.05 * face;
  s.lineMask = 1.0 - 0.9 * minutiae(q.xz) * face;
  s.spec = 0.45;
  s.heat = gapGlow * face * exp(-dot(q.xz, q.xz) * 0.35) * 0.35; // the screen's red reflection, close to contact
  return s;
}`;

const FP_EXTRA = /* glsl */ `
uniform float glassY, glassA;
// the glass we look through: a faint pixel grid, a smudge, and the capacitive "touch" ring under the pad
vec3 extraLight(vec3 ro, vec3 rd, float tHit) {
  if (rd.y <= 0.0 || ro.y >= glassY) return vec3(0.0);
  float tp = (glassY - ro.y) / rd.y;
  if (tp > tHit) return vec3(0.0);
  vec3 P = ro + rd * tp;
  vec2 g = P.xz * 3.0;
  float fwp = max(fwidth(g.x), fwidth(g.y));
  vec2 gd = abs(fract(g) - 0.5) / max(fwp, 1e-4);
  float grid = (1.0 - smoothstep(0.5, 1.5, min(gd.x, gd.y))) * exp(-tp * 0.12);
  vec3 col = C_GRAPHITE * grid * 0.09 * glassA * exp(-length(P.xz - padC.xz) * 0.12);
  float smudge = smoothstep(0.55, 0.9, 0.5 + 0.5 * snoise(P.xz * 1.3 + 2.0)) * exp(-length(P.xz - vec2(2.6, -1.2)) * 0.6);
  col += C_ASH * smudge * 0.05 * glassA;
  vec2 c = P.xz - padC.xz;
  float r = length(c * vec2(1.0, 0.75));
  float ringR = 0.6 + 2.2 * (1.0 - gapGlow);
  col += C_SIGNAL * exp(-abs(r - ringR) * 9.0) * gapGlow * 0.55 * glassA;
  return col;
}`;

export default class ThumbScene extends Scene {
  pass = new FSPass(engraveFrag({ map: FP_GLSL, surface: FP_SURFACE, extra: FP_EXTRA, defines: { MARCH_K: 0.6, MARCH_STEPS: 140 } }), engraveUniforms({
    padC: { value: new THREE.Vector3(0, 6, 0) }, padR: { value: new THREE.Vector3(2.8, 0.95, 3.8) },
    ridgeAmp: { value: 0.022 }, ridgeFreq: { value: 4.4 }, gapGlow: { value: 0 },
    glassY: { value: 0 }, glassA: { value: 1 },
  }));
  cam = new EngraveCam();
  ui = new Layer2D();
  L7!: Line; L8!: Line;
  tStop = 0; tSoko = 0;

  override init() {
    const ly = this.ctx.lyrics;
    this.L7 = ly.get('指紋が');
    this.L8 = ly.get('ストップ');
    this.tSoko = this.L8.words[0]!.start;
    this.tStop = this.L8.words[1]!.start;
    const u = this.pass.u;
    u.keyDir!.value.set(-0.25, -1.0, 0.35).normalize(); // the screen lights the thumb from below
    u.rimDir!.value.set(0.15, 0.55, -0.82).normalize();
    u.fogK!.value = 0.035; u.fogFar!.value = 40;
  }

  /** Height of the pad above the glass (world units; 1 unit = 4 mm on the readout). Frozen after 「ストップ」. */
  padY(t: number) {
    const a = this.ctx.start, L7 = this.L7;
    return keys(Math.min(t, this.tStop), [
      [a, 9.5],
      [L7.start, 8.2, ease.inOutQuad],
      [L7.end, 2.9, ease.inCubic],         // it accelerates as it comes
      [this.tSoko + 0.25, 1.55, EZ.liquid],  // 「そこまで」: it brakes hard
      [this.tStop, 1.42, ease.outQuad],
    ]);
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, tf = Math.min(t, this.tStop); // tf: time frozen at the stop
    const u = this.pass.u;
    const py = this.padY(t);
    const R = u.padR!.value as THREE.Vector3;
    (u.padC!.value as THREE.Vector3).set(0.15 * Math.sin(tf * 0.7), py + R.y, 0.2 * Math.sin(tf * 0.5 + 1));
    const gap = py; // underside height above the glass
    u.gapGlow!.value = clamp(1 - gap / 3.2);
    u.time!.value = tf;

    // camera: below the glass looking up at the descending pad; slow push in, frozen on the stop
    const k = prog(tf, this.ctx.start, this.tStop);
    const camPos: [number, number, number] = [lerp(1.4, 0.5, k), lerp(-2.2, -1.6, k), lerp(9.0, 7.0, EZ.cam(k))];
    const tgt: [number, number, number] = [0, lerp(4.2, 1.8, k), 0];
    this.cam.set(camPos, tgt, 0.035 * Math.sin(tf * 0.6), 38);
    this.cam.apply(u);
    this.pass.render(renderer, out);

    // ------------------------------------------------------------------ 2D: annotations + lyric
    const c = this.ui.ctx;
    this.ui.clear();
    const frozen = t >= this.tStop;
    const mm = gap * 4; // readout scale
    const vel = frozen ? 0 : (this.padY(t - 1 / 60) - this.padY(t)) * 60 * 4;

    // specimen header
    c.fillStyle = rgba('bone', 0.92); c.font = font('Plex-500', 15); c.textAlign = 'left';
    c.fillText('FIG. 04', 84, 96);
    c.fillStyle = rgba('ash', 0.85); c.font = font('UD-400', 15);
    c.fillText('指紋 — 対手（右母指）', 160, 96);
    c.font = font('Plex-400', 12); c.fillStyle = rgba('ash', 0.6);
    c.fillText('VIEW  from the glass, looking up · SCALE 12:1 · capacitive layer', 84, 118);

    // the core of the whorl, tracked in 3D
    const pc = u.padC!.value as THREE.Vector3;
    const core = this.cam.project([pc.x, pc.y - R.y, pc.z]);
    if (core.z > 0) {
      const cr = 14;
      c.strokeStyle = rgba('bone', 0.75); c.lineWidth = 1;
      c.beginPath(); c.arc(core.x, core.y, cr, 0, Math.PI * 2);
      c.moveTo(core.x - cr - 10, core.y); c.lineTo(core.x - cr + 4, core.y); c.moveTo(core.x + cr - 4, core.y); c.lineTo(core.x + cr + 10, core.y);
      c.moveTo(core.x, core.y - cr - 10); c.lineTo(core.x, core.y - cr + 4); c.moveTo(core.x, core.y + cr - 4); c.lineTo(core.x, core.y + cr + 10);
      c.stroke();
      annotate(c, core.x + cr * 0.7, core.y - cr * 0.7, core.x + 150, core.y - 120, ['CORE · 渦状紋', 'ridge pitch 0.47 mm', 'minutiae 37'], { alpha: 0.95 });
    }

    // left column under the header: the approach readout (digits scramble when each line lands)
    const rx = 84;
    c.textAlign = 'left';
    const row = (label: string, val: string, y: number, red = false) => {
      c.font = font('Plex-400', 12); c.fillStyle = rgba('ash', 0.75); c.fillText(label, rx, y);
      c.font = font('Plex-500', 26); c.fillStyle = red ? rgba('signal', 1) : rgba('bone', 0.95); c.fillText(val, rx, y + 30);
    };
    row('GAP', scramble(`${mm.toFixed(2)} mm`, t, this.L7.start, 5, 3), 168, gap < 1.8);
    row('V', scramble(`${vel.toFixed(1)} mm/s`, t, this.tSoko, 4, 5), 242, false);
    row('T+', scramble(timecode(Math.min(t, this.tStop) - (this.ctx.start - 1.6), true), t, this.tStop, 4, 7), 316, frozen);

    // the clip's own progress bar with the playhead (the 6-second wall ahead)
    const frac = (Math.min(t, this.tStop) - (this.ctx.start - 1.6)) / 6;
    const px = drawProgress(c, 84, W - 84, H - 70, frac, { total: 6, tickEvery: 1, wall: 6, wallLabel: '六秒の壁', alpha: 0.9 });
    drawPlayhead(c, px, H - 70, tf, { r: 8, I: 1 });

    // the lyric: 「指紋が 近づく」 grows with the approach; 「そこまで」 small and quick; 「ストップ」 is the stamp
    const L7 = this.L7;
    const fam = F.jp(900);
    if (t < this.L8.start) {
      const words = L7.words;
      const chars: { ch: string; t0: number }[] = [];
      for (const w of words) { const syl = w.syl ?? [[w.start, w.end]]; Array.from(w.w).forEach((ch, i) => chars.push({ ch, t0: (syl[i] ?? syl[syl.length - 1]!)[0] - 1 / 60 })); }
      let x = 150;
      const base = H * 0.80;
      chars.forEach((g, i) => {
        const size = lerp(118, 232, i / (chars.length - 1)); // closer = bigger
        c.font = font(fam, size);
        const w = c.measureText(g.ch).width;
        slamChar(c, g.ch, x, base, size, fam, t, g.t0, { from: 1.55, cool: 0.5 });
        x += w + (i === 2 ? size * 0.35 : 4); // a breath between 指紋が / 近づく
      });
    } else {
      // 「そこまで」: compact, set on the readout's baseline grid, words sung in red
      const w0 = this.L8.words[0]!;
      const lay = jlayout(c, w0.w, F.jp(700), 74, 2);
      const syl = w0.syl ?? [[w0.start, w0.end]];
      lay.glyphs.forEach((g, i) => slamChar(c, g.ch, 150 + g.x, H * 0.80, 74, F.jp(700), t, syl[i]![0] - 1 / 60, { from: 1.4, cool: 0.35 }));
      if (frozen) {
        // the STOP stamp: slams in 75 ms on the overshoot curve, rotated, red ink with a double frame
        const lt = t - this.tStop;
        const s = lerp(1.9, 1, EZ.slam(clamp(lt / 0.075)));
        c.save();
        c.translate(W * 0.56, H * 0.62);
        c.rotate(-0.11);
        c.scale(s, s);
        c.globalAlpha = clamp(lt / 0.03);
        c.strokeStyle = rgba('signal', 1); c.lineWidth = 7;
        const bw = 760, bh = 236;
        c.strokeRect(-bw / 2, -bh / 2, bw, bh);
        c.lineWidth = 2; c.strokeRect(-bw / 2 + 14, -bh / 2 + 14, bw - 28, bh - 28);
        c.fillStyle = rgba('signal', 1); c.font = font(F.jp(900), 168); c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('ストップ', 0, 6);
        c.font = font('Plex-600', 14); c.fillText(`STOPPED AT ${(mm).toFixed(2)} mm · ${timecode(this.tStop - (this.ctx.start - 1.6), true)}`, 0, bh / 2 + 30);
        c.restore();
      }
    }

    comp.draw(renderer, this.ui.upload(), out);
    const hit = pulse(t, this.tStop, 0.09);
    return { bloom: 0.55, halation: 0.25, grain: 0.06, shake: [hit * 6, -hit * 4], flash: 0 };
  }
}
