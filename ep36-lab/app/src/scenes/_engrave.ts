// EP36 shared module: raymarched "engraved" 3D worlds (TREATMENT upgrade #1).
//
// The look follows pdoom's ray-marched plates (paperclips, shoggoth, rooms): bone hairlines on ink whose
// width follows the light, a crisp specular line, a thin signal-red rim from a back light, fog into ink,
// 4-tap rotated-grid supersampling. What is new here is that it is one reusable piece: a scene supplies
// only its distance field and how its surface wants to be engraved; camera, marching, normals, shadow,
// AO, line footprint and fog are shared, so every 3D plate in the MV reads as the same printing process.
//
// Usage (see thumb.ts / deep.ts):
//   const pass = new FSPass(engraveFrag({ map: MY_MAP_GLSL, surface: MY_SURFACE_GLSL }), engraveUniforms());
//   cam.set(pos, target, roll, fovDeg); cam.apply(pass.u);   // every frame
//   pass.render(renderer, out);
//
// The scene's GLSL must define
//   float map(vec3 p, out vec4 info)           signed distance (may be a bound: set MARCH_K < 1) + info for shading
//   EngraveSurf surface(vec3 P, vec3 N, vec4 info)   (optional) how to engrave the hit point (see struct below)
// and may define `vec3 background(vec3 rd)` (default: ink fog) and `vec3 extraLight(vec3 ro, vec3 rd, float tHit)`.
import * as THREE from 'three';
import { SS_TAP, SS_TAP_GLSL, W, H } from '../engine/gl';
import { LIN } from '../engine/palette';

/** Camera for raymarched plates: position, target, roll (rad), vertical field of view (deg). y is up. */
export class EngraveCam {
  pos = new THREE.Vector3(0, 0, 10);
  tgt = new THREE.Vector3();
  roll = 0;
  fov = 35;
  r = new THREE.Vector3(); u = new THREE.Vector3(); f = new THREE.Vector3();
  set(pos: THREE.Vector3 | [number, number, number], tgt: THREE.Vector3 | [number, number, number], roll = 0, fov = 35) {
    Array.isArray(pos) ? this.pos.set(...pos) : this.pos.copy(pos);
    Array.isArray(tgt) ? this.tgt.set(...tgt) : this.tgt.copy(tgt);
    this.roll = roll; this.fov = fov;
    this.f.subVectors(this.tgt, this.pos).normalize();
    const up = Math.abs(this.f.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    this.r.crossVectors(this.f, up).normalize();
    this.u.crossVectors(this.r, this.f).normalize();
    if (roll) { this.r.applyAxisAngle(this.f, roll); this.u.applyAxisAngle(this.f, roll); }
    return this;
  }
  /** Focal length in logical px for the vertical fov. */
  get focal() { return (0.5 * H) / Math.tan((this.fov * Math.PI) / 360); }
  apply(u: Record<string, THREE.IUniform>) {
    u.camPos!.value.copy(this.pos); u.camR!.value.copy(this.r); u.camU!.value.copy(this.u); u.camF!.value.copy(this.f);
    u.focal!.value = this.focal;
  }
  /** Project a world point to logical screen px (y down) — for 2D annotations that stick to 3D things. */
  project(p: THREE.Vector3 | [number, number, number]): { x: number; y: number; z: number } {
    const v = Array.isArray(p) ? new THREE.Vector3(...p) : p.clone();
    v.sub(this.pos);
    const z = v.dot(this.f);
    return { x: W / 2 + (v.dot(this.r) / z) * this.focal, y: H / 2 - (v.dot(this.u) / z) * this.focal, z };
  }
}

/** Uniforms shared by every engraved plate (light defaults: key from upper left, red rim from behind). */
export function engraveUniforms(extra: Record<string, THREE.IUniform> = {}): Record<string, THREE.IUniform> {
  return {
    ssTap: SS_TAP,
    camPos: { value: new THREE.Vector3() }, camR: { value: new THREE.Vector3() },
    camU: { value: new THREE.Vector3() }, camF: { value: new THREE.Vector3() },
    focal: { value: 1000 }, res: { value: new THREE.Vector2(W, H) }, time: { value: 0 },
    keyDir: { value: new THREE.Vector3(-0.5, 0.75, 0.45).normalize() }, keyI: { value: 1.0 },
    rimDir: { value: new THREE.Vector3(0.3, 0.2, -1).normalize() }, rimI: { value: 1.0 },
    fogK: { value: 0.04 }, fogFar: { value: 60 }, lineFreq: { value: 6.0 }, exposure: { value: 1.0 },
    signal: { value: new THREE.Vector3(...LIN.signal) },
    ...extra,
  };
}

/** What a surface wants: engraving coordinate, local line density, tone bias, base ink, red heat. */
const GLSL_ENGRAVE_HEAD = /* glsl */ `
${SS_TAP_GLSL}
uniform vec3 camPos, camR, camU, camF; uniform float focal; uniform vec2 res; uniform float time;
uniform vec3 keyDir; uniform float keyI; uniform vec3 rimDir; uniform float rimI;
uniform float fogK, fogFar, lineFreq, exposure;
struct EngraveSurf {
  float u;       // engraving coordinate: lines run along u = const (integer values), e.g. a surface parameter
  float uWorld;  // world units per 1.0 of u along the surface (for the line footprint / anti-aliasing)
  float toneBias;// added to the light tone (-1..1)
  float cross;   // 0..1 how much crosshatch the deep shadows get
  vec3 ink;      // line colour (bone by default)
  float heat;    // 0..1 signal-red glow mixed into the lines (the playhead light, a hot spot)
  float spec;    // specular line strength
  float lineMask;// 0..1 multiplies the line coverage (breaks in the lines: ridge endings, worn spots)
  vec3 emit;     // light the surface gives off itself (a lit screen), added before the fog
};
EngraveSurf defaultSurf(vec3 P, vec3 N) {
  // planar engraving along world height, tilted slightly so flat floors don't alias
  EngraveSurf s; s.u = (P.y + 0.13 * P.x) * lineFreq; s.uWorld = 1.0 / lineFreq; s.toneBias = 0.0; s.cross = 0.6;
  s.ink = C_BONE; s.heat = 0.0; s.spec = 1.0; s.lineMask = 1.0; s.emit = vec3(0.0); return s;
}
/** Engraving line with an explicit footprint fw (line periods per pixel): coverage of lines at integer u.
    Fades to the mean tone where lines get denser than the pixel grid (no moire). */
float hatchW(float u, float darkness, float fw) {
  float f = abs(fract(u) - 0.5);
  float hw = 0.5 * clamp(darkness, 0.0, 1.0);
  float aa = max(fw, 1e-3);
  float l = 1.0 - smoothstep(hw - aa, hw + aa, 0.5 - f);
  return mix(l, clamp(darkness, 0.0, 1.0), smoothstep(0.3, 0.75, fw));
}
`;

const GLSL_ENGRAVE_MARCH = /* glsl */ `
#ifndef MARCH_K
#define MARCH_K 0.9
#endif
#ifndef MARCH_STEPS
#define MARCH_STEPS 160
#endif
float mapD(vec3 p) { vec4 i; return map(p, i); }
vec3 calcN(vec3 p, float e) {
  vec2 k = vec2(1.0, -1.0);
  return normalize(k.xyy * mapD(p + k.xyy * e) + k.yyx * mapD(p + k.yyx * e) + k.yxy * mapD(p + k.yxy * e) + k.xxx * mapD(p + k.xxx * e));
}
float softShadow(vec3 ro, vec3 rd, float eps) {
  float res = 1.0, t = 0.05 + 4.0 * eps;
  for (int i = 0; i < 32; i++) {
    float h = mapD(ro + rd * t);
    res = min(res, 8.0 * h / t);
    t += clamp(h * MARCH_K, 0.03, 0.8);
    if (res < 0.02 || t > 18.0) break;
  }
  return smoothstep(0.0, 1.0, clamp(res, 0.0, 1.0));
}
float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = 0; i < 5; i++) { float h = 0.03 + 0.2 * float(i); occ += (h - mapD(p + n * h)) * sca; sca *= 0.75; }
  return clamp(1.0 - 1.5 * occ, 0.0, 1.0);
}
#ifndef HAS_BACKGROUND
vec3 background(vec3 rd) { return C_INK * 0.85 + C_INK2 * 0.3 * exp(-abs(rd.y) * 6.0); }
#endif
#ifndef HAS_SURFACE
EngraveSurf surface(vec3 P, vec3 N, vec4 info) { return defaultSurf(P, N); }
#endif
#ifndef HAS_EXTRA_LIGHT
vec3 extraLight(vec3 ro, vec3 rd, float tHit) { return vec3(0.0); }
#endif
/** Engraved shading of a hit at distance t. */
vec3 shadeHit(vec3 ro, vec3 rd, float t, vec4 info) {
  vec3 P = ro + rd * t;
  float eps = 0.5 * t / focal;
  vec3 N = calcN(P, max(eps, 0.0015));
  vec3 V = -rd;
  EngraveSurf s = surface(P, N, info);
  float pxW = t / focal;                                // world units per logical px at the hit
  float nv = max(dot(N, V), 0.05);
  float fw = pxW / max(s.uWorld, 1e-5) / nv * 0.7;     // line periods per px (foreshortened)
  float sh = softShadow(P + N * (0.01 + 2.0 * eps), keyDir, eps);
  float ao = calcAO(P + N * eps, N);
  float dif = max(dot(N, keyDir), 0.0) * sh;
  float tone = sat(keyI * (0.03 + 0.97 * pow(dif, 1.4)) * mix(0.35, 1.0, ao) + s.toneBias);
  // bone lines on ink: a hairline that is always there, swelling with the light but never merging into
  // a solid fill (large surfaces must stay mostly ink, like pdoom's wires and rooms)
  float cov = hatchW(s.u, 0.05 + 0.34 * pow(tone, 1.3), fw) * s.lineMask;
  // deep shadows aren't flat black: a faint second direction of hairlines (graphite) keeps the form
  float shadowK = sat(1.0 - tone * 2.2) * s.cross;
  vec3 xAxis = normalize(cross(N, vec3(0.3, 1.0, 0.2)) + 1e-4);
  float xh = hatchW(dot(P, xAxis) / max(s.uWorld, 1e-5) * 0.8, 0.14, fw * 0.8) * shadowK;
  vec3 col = s.ink * 0.78 * cov + C_GRAPHITE * 0.55 * xh;
  vec3 Hh = normalize(keyDir + V);
  float spec = pow(max(dot(N, Hh), 0.0), 90.0) * keyI * sh * s.spec;
  col += C_BONE * 0.85 * smoothstep(0.35, 0.65, spec) * (0.25 + 0.75 * cov); // the highlight is engraved too
  // signal-red rim from the back light
  float rim = pow(sat(1.0 - nv), 4.0) * smoothstep(-0.1, 0.6, dot(N, rimDir)) * rimI;
  col += C_SIGNAL * rim * 1.2;
  col = mix(col, col + C_SIGNAL * (0.4 + 2.2 * cov), s.heat);
  col += s.emit;
  float fogA = 1.0 - exp(-t * fogK);
  return mix(col, background(rd), fogA);
}
vec3 trace(vec3 ro, vec3 rd, out float tHit) {
  float pa = 1.0 / focal, t = 0.02;
  vec4 info; bool hit = false;
  for (int i = 0; i < MARCH_STEPS; i++) {
    if (t > fogFar) break;
    float d = map(ro + rd * t, info);
    float pr = t * pa;
    if (d < 0.25 * pr) { hit = true; break; }
    t += max(d * MARCH_K, pr * 0.3);
  }
  tHit = hit ? t : 1e5;
  vec3 col = hit ? shadeHit(ro, rd, t, info) : background(rd);
  return col + extraLight(ro, rd, tHit);
}
void main() {
  vec2 px0 = vUv * res - 0.5 * res;
  vec3 col = vec3(0.0);
  float tH;
  for (int k = ssK0(); k < ssK1(); k++) {
    vec2 px = px0 + rgss(k) / PX_SCALE;
    vec3 rd = normalize(camF * focal + camR * px.x + camU * px.y);
    col += trace(camPos, rd, tH);
  }
  fragColor = vec4(col * ssWeight() * exposure, 1.0);
}
`;

/**
 * Assemble a full fragment shader for FSPass. `map` must define `float map(vec3 p, out vec4 info)`.
 * `surface` (optional) defines `EngraveSurf surface(vec3 P, vec3 N, vec4 info)`; `background` and `extra`
 * optionally define `vec3 background(vec3 rd)` and `vec3 extraLight(vec3 ro, vec3 rd, float tHit)`.
 */
export function engraveFrag(o: { map: string; surface?: string; background?: string; extra?: string; defines?: Record<string, string | number>; head?: string }): string {
  const defs = Object.entries(o.defines ?? {}).map(([k, v]) => `#define ${k} ${v}`).join('\n');
  return [
    defs,
    o.surface ? '#define HAS_SURFACE' : '',
    o.background ? '#define HAS_BACKGROUND' : '',
    o.extra ? '#define HAS_EXTRA_LIGHT' : '',
    GLSL_ENGRAVE_HEAD,
    o.head ?? '',
    o.map,
    o.surface ?? '',
    o.background ?? '',
    o.extra ?? '',
    GLSL_ENGRAVE_MARCH,
  ].join('\n');
}
