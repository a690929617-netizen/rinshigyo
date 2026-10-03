// EP36 test plate `deep` (chorus 3, the quiet one): 「百万本の／動画の 奥の／わたし ひとりを／次へ 行っても／ループ してるよ」.
// An endless engraved lattice of phones (steel frames, dead glass) sinking into fog, red rims from behind;
// the camera sinks with it. Only one screen in a million is lit. On 「わたしひとりを」 the camera pushes in to
// it; on 「次へ行っても」 it slides to the next phone — which is lit too, the same card (the loop); on
// 「ループしてるよ」 the playhead leaves the progress bar and draws ↻ around it. Solemn voice: thin Mincho.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { clamp, ease, keys, lerp, prog } from '../engine/util';
import { EngraveCam, engraveFrag, engraveUniforms } from './_engrave';
import { EZ, annotate, drawPlayhead, jlayout, scramble, slamChar } from './_ep36';

const CELL = [2.3, 3.9, 4.2] as const; // phone lattice spacing (x, y, z)
const LIT_A = [0, -3, 0] as const;     // the lit phone's cell (front layer)
const LIT_B = [1, -3, 0] as const;     // "the next one" (also lit: the loop)
const cellPos = (c: readonly number[]) => new THREE.Vector3(c[0]! * CELL[0], c[1]! * CELL[1], c[2]! * CELL[2]);

const PHONE_GLSL = /* glsl */ `
const vec3 CELL = vec3(${CELL.map((x) => x.toFixed(2)).join(',')});
uniform vec3 litA, litB; uniform float litK, litBK, playP;
float sdRoundBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
// info = (local x, local y, local z, cell id)
float map(vec3 p, out vec4 info) {
  // the lattice is a wall: endless in x and y, receding in depth (z <= 0 layers only); the camera stays in front
  info = vec4(0.0, 0.0, 0.0, -1.0);
  float front = p.z - (0.5 * CELL.z + 0.45);
  if (front > 0.25) return front;
  vec3 id = floor(p / CELL + 0.5);
  float best = max(front, 0.0) + 0.3;
  // the jitter keeps phones inside their cell, so checking this cell and the next one toward the ray is enough
  for (int j = 0; j < 2; j++) {
    vec3 cid = id;
    if (j == 1) { vec3 f = p / CELL - id; vec3 a = abs(f); cid += a.x > a.y && a.x > a.z ? vec3(sign(f.x), 0.0, 0.0) : a.y > a.z ? vec3(0.0, sign(f.y), 0.0) : vec3(0.0, 0.0, sign(f.z)); }
    if (cid.z > 0.5) continue;
    vec3 h = hash33(cid + 17.0);
    vec3 q = p - cid * CELL - (h - 0.5) * vec3(0.35, 0.5, 0.6);
    float a = (h.z - 0.5) * 0.25;
    q.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * q.xz;
    float d = sdRoundBox(q, vec3(0.68, 1.42, 0.075), 0.16);
    if (d < best) { best = d; info = vec4(q, dot(cid, vec3(1.0, 57.0, 113.0))); }
  }
  return best;
}`;

const PHONE_SURFACE = /* glsl */ `
float cardLines(vec2 s) {
  // a generic video card: a few text bars and a thumbnail block (no real app UI)
  float bars = 0.0;
  for (int i = 0; i < 3; i++) { float y = 0.62 - float(i) * 0.12; float w = 0.55 - float(i) * 0.12; bars = max(bars, step(abs(s.y - y), 0.018) * step(abs(s.x + 0.05 - (w - 0.55) * 0.5), w * 0.5)); }
  float thumb = step(abs(s.x), 0.5) * step(abs(s.y + 0.05), 0.38);
  return max(bars, thumb * 0.35);
}
EngraveSurf surface(vec3 P, vec3 N, vec4 info) {
  EngraveSurf s = defaultSurf(P, N);
  vec3 q = info.xyz;
  // steel: lines around the frame (constant height), finer on the glass
  s.u = q.y * 9.0 + 0.15 * q.x;
  s.uWorld = 1.0 / 9.0;
  s.spec = 0.8;
  bool front = q.z > 0.03 && abs(q.x) < 0.6 && abs(q.y) < 1.32;
  float cid = info.w;
  float isA = step(abs(cid - dot(litA, vec3(1.0, 57.0, 113.0))), 0.5);
  float isB = step(abs(cid - dot(litB, vec3(1.0, 57.0, 113.0))), 0.5);
  if (front) {
    s.toneBias = -0.8;            // dead glass: black, a faint sheen only
    s.lineMask = 0.12;
    s.cross = 0.0;
    s.spec = 0.35;
    float lit = isA * litK + isB * litBK;
    if (lit > 0.0) {
      vec2 sc = vec2(q.x / 0.6, q.y / 1.32);
      vec3 glow = C_BONE * (0.035 + 0.95 * cardLines(sc)) + C_INK2 * 0.6;
      // the progress bar and the playhead on the lit card
      float bar = step(abs(sc.y + 0.86), 0.012) * step(abs(sc.x), 0.86);
      float red = bar * step(sc.x, -0.86 + 1.72 * playP);
      float ph = exp(-dot(sc - vec2(-0.86 + 1.72 * playP, -0.86), sc - vec2(-0.86 + 1.72 * playP, -0.86)) * 900.0);
      glow = mix(glow, C_ASH * 0.5, bar) + C_SIGNAL * (red * 1.5 + ph * 4.0);
      s.emit = glow * lit;
      s.lineMask = mix(s.lineMask, 0.0, lit);
    }
  }
  return s;
}`;

const PHONE_EXTRA = /* glsl */ `
// the lit screen's light spilling into the fog toward the camera
vec3 extraLight(vec3 ro, vec3 rd, float tHit) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec3 c = (i == 0 ? litA : litB) * CELL;
    float k = i == 0 ? litK : litBK;
    if (k <= 0.0) continue;
    vec3 lp = c - ro; float tl = dot(lp, rd);
    if (tl <= 0.0) continue;
    float apx = length(lp - rd * tl) / tl * focal;
    col += C_BONE * 0.05 / (1.0 + apx * apx / 60000.0) * k;
  }
  return col;
}`;

export default class DeepScene extends Scene {
  pass = new FSPass(engraveFrag({ map: PHONE_GLSL, surface: PHONE_SURFACE, extra: PHONE_EXTRA, defines: { MARCH_K: 0.8, MARCH_STEPS: 150 } }), engraveUniforms({
    litA: { value: new THREE.Vector3(...LIT_A) }, litB: { value: new THREE.Vector3(...LIT_B) },
    litK: { value: 0 }, litBK: { value: 0 }, playP: { value: 0 },
  }));
  cam = new EngraveCam();
  ui = new Layer2D();
  lines: Line[] = [];
  tWatashi = 0; tTsugi = 0; tLoop = 0;

  override init() {
    const ly = this.ctx.lyrics;
    // lines inside this scene's own window only (「わたし」 alone would match 「お次はわたしだ」 in verse 1)
    const own = ly.lines.filter((l) => l.start >= this.ctx.start - 0.1 && l.start < this.ctx.end);
    this.lines = ['百万本', '動画の', 'わたし', '次へ', 'ループ'].map((q) => {
      const l = own.find((x) => x.text.includes(q));
      if (!l) throw new Error(`deep: lyric not in window: ${q}`);
      return l;
    });
    this.tWatashi = this.lines[2]!.start;
    this.tTsugi = this.lines[3]!.start;
    this.tLoop = this.lines[4]!.start;
    const u = this.pass.u;
    u.keyDir!.value.set(-0.55, 0.65, 0.5).normalize();
    u.keyI!.value = 0.55; // a quiet chorus: low key light, the rims and the one screen carry it
    u.rimDir!.value.set(0.2, 0.35, -0.9).normalize();
    u.fogK!.value = 0.085; u.fogFar!.value = 34;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const t = f.t, u = this.pass.u;
    const A = cellPos(LIT_A), B = cellPos(LIT_B);
    // camera: sinks through the lattice, pushes in to the lit phone, slides to the next one
    const sink = prog(t, this.ctx.start, this.tWatashi);
    const push = prog(t, this.tWatashi, this.tTsugi, EZ.cam);
    const slide = prog(t, this.tTsugi, this.tTsugi + 0.9, EZ.morph);
    const look = new THREE.Vector3().lerpVectors(A, B, slide);
    const far = new THREE.Vector3(look.x + 2.6, lerp(A.y + 8.5, A.y + 2.2, ease.inOutQuad(sink)), A.z + 10.5);
    const near = new THREE.Vector3(look.x + 0.6, look.y + 0.35, look.z + 8.2);
    const pos = far.clone().lerp(near, push);
    const tgt = new THREE.Vector3(look.x, lerp(A.y - 1.5, look.y, Math.max(push, sink * 0.7)), look.z);
    this.cam.set(pos, tgt, lerp(-0.05, 0.0, push) + 0.01 * Math.sin(t * 0.4), lerp(42, 32, push));
    this.cam.apply(u);
    u.litK!.value = keys(t, [[this.ctx.start, 0], [this.lines[1]!.start, 0.0], [this.tWatashi, 1.0, ease.outQuad]]);
    u.litBK!.value = prog(t, this.tTsugi + 0.35, this.tTsugi + 0.6);
    u.playP!.value = keys(t, [[this.tWatashi, 0.18], [this.tTsugi, 0.62], [this.tTsugi + 0.5, 0.05, ease.outExpo], [this.tLoop, 0.7]]);
    u.time!.value = t;
    this.pass.render(renderer, out);

    // ------------------------------------------------------------------ 2D
    const c = this.ui.ctx;
    this.ui.clear();
    c.textAlign = 'left';
    c.fillStyle = rgba('bone', 0.9); c.font = font('Plex-500', 15); c.fillText('FIG. 11', 84, 96);
    c.fillStyle = rgba('ash', 0.85); c.font = font('UD-400', 15); c.fillText('動画の奥 — 百万本のうちの一本', 160, 96);
    c.font = font('Plex-400', 12); c.fillStyle = rgba('ash', 0.6);
    const count = Math.floor(lerp(12480, 1000000, prog(t, this.ctx.start, this.tWatashi, ease.inQuad)));
    c.fillText(`FEED DEPTH  ${scramble(count.toLocaleString('en-US'), t, this.lines[0]!.start, 5, 11)} items · lit 1`, 84, 118);

    // the one lit phone, annotated like a specimen
    const pa = this.cam.project(A.clone().add(new THREE.Vector3(0.68, 1.0, 0.1)));
    if (u.litK!.value > 0.05 && pa.z > 0 && t < this.tTsugi) annotate(c, pa.x, pa.y, pa.x + 120, pa.y - 90, ['No. 0,000,001', 'わたし · 再生中'], { alpha: u.litK!.value as number, red: 1 });

    // the lyric: thin Mincho, small, lots of black; the mora being sung is red
    const L = this.lines.find((l) => t >= l.start - 0.05 && t < l.end + 0.15) ?? null;
    if (L) {
      const fam = F.mincho(400), size = 54;
      const lay = jlayout(c, L.text, fam, size, 6);
      const x0 = W * 0.5 - lay.width / 2, y0 = H * 0.86;
      const syl = L.words.flatMap((w) => w.syl ?? [[w.start, w.end]]);
      lay.glyphs.forEach((g, i) => {
        const s = syl[i] ?? syl[syl.length - 1]!;
        const singing = t >= s[0] - 1 / 60 && t < s[1];
        slamChar(c, g.ch, x0 + g.x, y0, size, fam, t, s[0] - 1 / 60, { from: 1.12, cool: 0.6, hold: singing, alpha: 0.95 });
      });
    }

    // 「ループしてるよ」: the playhead leaves the card and draws ↻ around the phone, then keeps circling
    if (t >= this.tLoop) {
      const cB = this.cam.project(B);
      const top = this.cam.project(B.clone().add(new THREE.Vector3(0, 1.42, 0)));
      const R = Math.abs(cB.y - top.y) * 1.02;
      const k = prog(t, this.tLoop, this.tLoop + 1.1, EZ.write);
      const a0 = Math.PI * 0.62, a1 = a0 + Math.PI * 1.72 * k;
      c.strokeStyle = rgba('signal', 0.95); c.lineWidth = 2.6; c.lineCap = 'round';
      c.beginPath(); c.arc(cB.x, cB.y, R, a0, a1); c.stroke();
      const hx = cB.x + Math.cos(a1) * R, hy = cB.y + Math.sin(a1) * R;
      if (k >= 1) {
        // arrowhead of ↻
        const ta = a1 + Math.PI / 2;
        c.beginPath(); c.moveTo(hx, hy);
        c.lineTo(hx - Math.cos(ta - 0.5) * 22, hy - Math.sin(ta - 0.5) * 22);
        c.moveTo(hx, hy); c.lineTo(hx - Math.cos(ta + 0.5) * 22, hy - Math.sin(ta + 0.5) * 22); c.stroke();
      }
      drawPlayhead(c, hx, hy, t, { r: 8, dir: [Math.cos(a1 + Math.PI / 2), Math.sin(a1 + Math.PI / 2)] });
    }

    comp.draw(renderer, this.ui.upload(), out);
    return { bloom: 0.6, halation: 0.3, grain: 0.07, vignette: 0.5 };
  }
}
