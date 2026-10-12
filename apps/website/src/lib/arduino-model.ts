// Procedural wireframe Arduino Uno R3, drawn only with line work like a
// technical drawing. All geometry is authored in millimetres in "board space":
// x = along the long edge, y = along the short edge, z = height above the PCB
// bottom, origin at the board's lower-left corner (USB end on the left).

import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  Object3D,
  Path,
  Shape,
  ShaderMaterial,
  Uint32BufferAttribute,
  Vector2,
  Vector3,
} from "three";

export type LineKind = "board" | "part" | "accent" | "trace" | "dim";

export interface ModelLabel {
  id: string;
  text: string;
  accent?: boolean;
  /** hide below this viewport width (px) to keep small screens calm */
  minWidth?: number;
  anchor: Object3D;
}

export interface ArduinoModel {
  root: Group;
  labels: ModelLabel[];
  materials: Record<LineKind, ShaderMaterial>;
  /** Draw-in schedule: [start, end] seconds per line kind */
  schedule: Record<LineKind, [number, number]>;
}

const BOARD_W = 68.6;
const BOARD_H = 53.4;
const PCB_T = 1.6;
const HEADER_H = 8.5;
const PIN = 2.54;

/* ------------------------------------------------------------------ */
/* Thick-line batch: every segment becomes a screen-space quad so lines */
/* keep a constant on-screen width on any pixel density.                */
/* ------------------------------------------------------------------ */

class Batch {
  private segs: number[] = [];

  addEdges(geometry: BufferGeometry, matrix: Matrix4, threshold = 20) {
    const edges = new EdgesGeometry(geometry, threshold);
    const pos = edges.attributes.position;
    const a = new Vector3();
    const b = new Vector3();
    for (let i = 0; i < pos.count; i += 2) {
      a.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      b.fromBufferAttribute(pos, i + 1).applyMatrix4(matrix);
      this.segs.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    edges.dispose();
    geometry.dispose();
  }

  line(a: [number, number, number], b: [number, number, number]) {
    this.segs.push(...a, ...b);
  }

  polyline(points: [number, number, number][], closed = false) {
    for (let i = 0; i < points.length - 1; i++) {
      this.line(points[i], points[i + 1]);
    }
    if (closed) this.line(points[points.length - 1], points[0]);
  }

  ring(cx: number, cy: number, z: number, r: number, steps = 18) {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r, z]);
    }
    this.polyline(pts, true);
  }

  get count() {
    return this.segs.length / 6;
  }

  build(material: ShaderMaterial): Mesh {
    const n = this.count;
    const aA = new Float32Array(n * 4 * 3);
    const aB = new Float32Array(n * 4 * 3);
    const aCorner = new Float32Array(n * 4 * 2);
    const aT = new Float32Array(n * 4);
    const index = new Uint32Array(n * 6);
    const corners = [
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 1],
    ];
    for (let s = 0; s < n; s++) {
      const o = s * 6;
      for (let c = 0; c < 4; c++) {
        const v = s * 4 + c;
        aA.set(this.segs.slice(o, o + 3), v * 3);
        aB.set(this.segs.slice(o + 3, o + 6), v * 3);
        aCorner.set(corners[c], v * 2);
        aT[v] = s / n;
      }
      const base = s * 4;
      index.set(
        [base, base + 1, base + 2, base + 1, base + 3, base + 2],
        s * 6,
      );
    }
    const geo = new BufferGeometry();
    // `position` is required by three; the shader reads aA/aB instead.
    geo.setAttribute("position", new Float32BufferAttribute(aA, 3));
    geo.setAttribute("aA", new Float32BufferAttribute(aA, 3));
    geo.setAttribute("aB", new Float32BufferAttribute(aB, 3));
    geo.setAttribute("aCorner", new Float32BufferAttribute(aCorner, 2));
    geo.setAttribute("aT", new Float32BufferAttribute(aT, 1));
    geo.setIndex(new Uint32BufferAttribute(index, 1));
    const mesh = new Mesh(geo, material);
    mesh.frustumCulled = false;
    return mesh;
  }
}

const VERT = /* glsl */ `
  attribute vec3 aA;
  attribute vec3 aB;
  attribute vec2 aCorner;
  attribute float aT;
  uniform vec2 uRes;
  uniform float uWidth;
  varying float vDepth;
  varying float vT;
  void main() {
    vec4 va = modelViewMatrix * vec4(aA, 1.0);
    vec4 vb = modelViewMatrix * vec4(aB, 1.0);
    vec4 ca = projectionMatrix * va;
    vec4 cb = projectionMatrix * vb;
    vec2 sa = ca.xy / ca.w * uRes * 0.5;
    vec2 sb = cb.xy / cb.w * uRes * 0.5;
    vec2 d = sb - sa;
    float len = length(d);
    vec2 dir = len > 0.0001 ? d / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    float e = aCorner.x;
    vec4 c = mix(ca, cb, e);
    vec2 s = mix(sa, sb, e);
    s += nrm * aCorner.y * uWidth * 0.5;
    s += dir * (e * 2.0 - 1.0) * uWidth * 0.5;
    gl_Position = vec4(s / (uRes * 0.5) * c.w, c.z, c.w);
    vDepth = -mix(va.z, vb.z, e);
    vT = aT;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uProgress;
  uniform float uNear;
  uniform float uFar;
  varying float vDepth;
  varying float vT;
  void main() {
    if (vT > uProgress) discard;
    float t = clamp((vDepth - uNear) / (uFar - uNear), 0.0, 1.0);
    // freshly drawn lines glow brighter, then settle
    float fresh = smoothstep(0.0, 0.06, uProgress - vT);
    float a = uOpacity * mix(1.0, 0.22, t) * mix(1.6, 1.0, fresh);
    gl_FragColor = vec4(uColor, min(a, 1.0));
  }
`;

function lineMaterial(
  rgb: [number, number, number],
  opacity: number,
  width: number,
) {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uColor: { value: new Vector3(...rgb) },
      uOpacity: { value: opacity },
      uProgress: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
      uWidth: { value: width },
      uNear: { value: 80 },
      uFar: { value: 200 },
    },
  });
}

const BLUE: [number, number, number] = [0x88 / 255, 0xbf / 255, 0xec / 255];
const ICE: [number, number, number] = [0xd6 / 255, 0xea / 255, 0xf8 / 255];
const YELLOW: [number, number, number] = [0xf3 / 255, 0xc1 / 255, 0x35 / 255];

/** Base line widths (CSS px); the viewer multiplies by devicePixelRatio. */
export const LINE_WIDTHS: Record<LineKind, number> = {
  board: 1.5,
  part: 1.15,
  accent: 1.6,
  trace: 0.9,
  dim: 0.9,
};

/** Vertical FOV used by the hero viewer. */
export const ARDUINO_FOV = 24;

/**
 * Half-extents the camera fits, in board millimetres. Width sets on-screen
 * scale; height is a floor so a very wide, short canvas cannot blow the model
 * up. Extra canvas height (when width is the tighter fit) becomes margin
 * around the board instead of zooming out — so a taller hero frame does not
 * shrink the model.
 */
export const ARDUINO_FIT_HALF_WIDTH = 64;
export const ARDUINO_FIT_HALF_HEIGHT = 35;

/** Nudge the drafting so left-hand dimension lines and the DC jack clear the frame. */
export const ARDUINO_FRAME_SHIFT = { x: 9, y: 3.5 };

/** Camera distance that preserves board scale for a canvas of `width`×`height`. */
export function arduinoCameraDistance(
  width: number,
  height: number,
  fovDeg = ARDUINO_FOV,
): number {
  const tanH = Math.tan((fovDeg * Math.PI) / 360);
  const aspect = Math.max(width, 1) / Math.max(height, 1);
  return Math.max(
    ARDUINO_FIT_HALF_WIDTH / (tanH * aspect),
    ARDUINO_FIT_HALF_HEIGHT / tanH,
  );
}

/** On-screen pixels per board millimetre at the look-at plane. */
export function arduinoPixelsPerWorldUnit(
  width: number,
  height: number,
  fovDeg = ARDUINO_FOV,
): number {
  const distance = arduinoCameraDistance(width, height, fovDeg);
  const tanH = Math.tan((fovDeg * Math.PI) / 360);
  return Math.max(height, 1) / (2 * distance * tanH);
}

/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOLES: [number, number][] = [
  [14.0, 2.5],
  [15.3, 50.7],
  [64.0, 7.6],
  [64.0, 35.6],
];

export function buildArduino(): ArduinoModel {
  const board = new Batch();
  const part = new Batch();
  const accent = new Batch();
  const trace = new Batch();
  const dim = new Batch();

  const m = new Matrix4();
  const zTop = PCB_T;

  const box = (
    batch: Batch,
    cx: number,
    cy: number,
    w: number,
    d: number,
    h: number,
    z0: number,
  ) => {
    batch.addEdges(
      new BoxGeometry(w, d, h),
      m.clone().makeTranslation(cx, cy, z0 + h / 2),
    );
  };

  const cylinder = (
    batch: Batch,
    cx: number,
    cy: number,
    r: number,
    h: number,
    z0: number,
    seg = 22,
  ) => {
    const g = new CylinderGeometry(r, r, h, seg);
    g.rotateX(Math.PI / 2);
    batch.addEdges(g, m.clone().makeTranslation(cx, cy, z0 + h / 2), 30);
  };

  /* ---- PCB ---- */
  const outline = new Shape();
  const pts: [number, number][] = [
    [0, 0],
    [64.5, 0],
    [66, 1.5],
    [66, 7.6],
    [BOARD_W, 10.2],
    [BOARD_W, 33],
    [66, 35.6],
    [66, 50.8],
    [64.5, BOARD_H],
    [0, BOARD_H],
  ];
  outline.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) outline.lineTo(x, y);
  outline.closePath();
  for (const [hx, hy] of HOLES) {
    const hole = new Path();
    hole.absarc(hx, hy, 1.6, 0, Math.PI * 2, true);
    outline.holes.push(hole);
  }
  board.addEdges(
    new ExtrudeGeometry(outline, {
      depth: PCB_T,
      bevelEnabled: false,
      curveSegments: 24,
    }),
    new Matrix4(),
    20,
  );

  /* ---- Mounting holes: copper annulus around each ---- */
  for (const [hx, hy] of HOLES) {
    trace.ring(hx, hy, zTop + 0.02, 3.0, 28);
    trace.ring(hx, hy, zTop + 0.02, 2.2, 24);
  }

  /* ---- Connectors (both overhang the left edge by 6 mm) ---- */
  const LEFT = -6.0;

  // USB-B: metal shell with a rectangular receptacle on its end face
  box(part, LEFT + 8.2, 38.5, 16.4, 12, 10.9, zTop);
  {
    const y0 = 38.5 - 4.8;
    const y1 = 38.5 + 4.8;
    const z0 = zTop + 1.4;
    const z1 = zTop + 9.5;
    part.polyline(
      [
        [LEFT, y0, z0],
        [LEFT, y1, z0],
        [LEFT, y1, z1],
        [LEFT, y0, z1],
      ],
      true,
    );
    // tongue inside the receptacle
    part.line([LEFT, y0 + 1.2, zTop + 5.4], [LEFT, y1 - 1.2, zTop + 5.4]);
    part.line([LEFT + 2.5, y0, z0], [LEFT + 2.5, y0, z1]);
    part.line([LEFT + 2.5, y1, z0], [LEFT + 2.5, y1, z1]);
  }

  // DC barrel jack: housing with a round bore (outer + centre pin)
  const jackY = 7.5;
  box(part, LEFT + 7.3, jackY, 14.6, 9.0, 10.8, zTop);
  {
    const cz = zTop + 5.6;
    const tube = (r: number, depth: number) => {
      const steps = 20;
      const pts: [number, number, number][] = [];
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        pts.push([LEFT, jackY + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
      part.polyline(pts, true);
      const back = pts.map(
        ([, y, z]) => [LEFT + depth, y, z] as [number, number, number],
      );
      part.polyline(back, true);
      for (let i = 0; i < steps; i += 5) part.line(pts[i], back[i]);
    };
    tube(3.2, 6.5); // bore
    tube(1.0, 6.5); // centre pin
  }

  /* ---- Headers: 10 + 8 on top edge, 8 + 6 along bottom ---- */
  const header = (x0: number, y: number, n: number) => {
    box(part, x0 + ((n - 1) * PIN) / 2, y, n * PIN, PIN, HEADER_H, zTop);
    for (let i = 0; i < n; i++) {
      box(part, x0 + i * PIN, y, 1.0, 1.0, 0.05, zTop + HEADER_H);
    }
  };
  const TOP_Y = 50.8;
  const BOT_Y = 2.54;
  const top10 = 19.7;
  const top8 = 46.7;
  const power8 = 26.6;
  const analog6 = 49.5;
  header(top10, TOP_Y, 10);
  header(top8, TOP_Y, 8);
  header(power8, BOT_Y, 8);
  header(analog6, BOT_Y, 6);

  // ICSP 2x3 (328P) on the right-hand side, above the chip
  {
    const ix = 63.0;
    const iy = 28.0;
    box(part, ix, iy, 5.1, 7.62, 2.5, zTop);
    for (const dx of [-1.27, 1.27]) {
      for (const dy of [-2.54, 0, 2.54]) {
        box(part, ix + dx, iy + dy, 1.0, 1.0, 0.05, zTop + 2.5);
      }
    }
  }

  /* ---- ATmega328P (DIP-28), highlighted ---- */
  const chipX = 48.0;
  const chipY = 17.8;
  box(accent, chipX, chipY, 35.2, 7.5, 3.6, zTop);
  {
    // pin-1 notch (half circle on the left end) + dimple
    const notch: [number, number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const t = -Math.PI / 2 + (i / 10) * Math.PI;
      notch.push([
        chipX - 17.6 + Math.cos(t) * 1.3,
        chipY + Math.sin(t) * 1.3,
        zTop + 3.6,
      ]);
    }
    accent.polyline(notch);
    accent.ring(chipX - 15.2, chipY - 2.2, zTop + 3.6, 0.55, 10);
    // legs, 14 per side
    for (let k = 0; k < 14; k++) {
      const px = chipX - 16.5 + k * PIN;
      box(accent, px, chipY + 4.4, 0.6, 1.3, 0.35, zTop);
      box(accent, px, chipY - 4.4, 0.6, 1.3, 0.35, zTop);
    }
  }

  /* ---- ATmega16U2 (QFN/TQFP) with leads on all four sides ---- */
  {
    const ux = 21.5;
    const uy = 31.0;
    const s = 7.2;
    box(part, ux, uy, s, s, 1.2, zTop);
    const lz = zTop + 0.15;
    for (let k = 0; k < 8; k++) {
      const o = -2.8 + k * 0.8;
      part.line([ux + o, uy + s / 2, lz], [ux + o, uy + s / 2 + 1.0, lz]);
      part.line([ux + o, uy - s / 2, lz], [ux + o, uy - s / 2 - 1.0, lz]);
      part.line([ux + s / 2, uy + o, lz], [ux + s / 2 + 1.0, uy + o, lz]);
      part.line([ux - s / 2, uy + o, lz], [ux - s / 2 - 1.0, uy + o, lz]);
    }
    part.ring(ux - 2.4, uy + 2.4, zTop + 1.2, 0.45, 8); // pin-1 dot
  }

  /* ---- 16 MHz crystal: rounded can ---- */
  {
    const cx = 27.5;
    const cy = 24.2;
    const len = 11.4;
    const w = 4.6;
    const h = 3.6;
    const r = w / 2;
    for (const z of [zTop, zTop + h]) {
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI;
        pts.push([cx + len / 2 - r + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
      }
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI / 2 + (i / 10) * Math.PI;
        pts.push([cx - len / 2 + r + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
      }
      part.polyline(pts, true);
    }
    for (const [vx, vy] of [
      [cx + len / 2 - r, cy + r],
      [cx + len / 2 - r, cy - r],
      [cx - len / 2 + r, cy + r],
      [cx - len / 2 + r, cy - r],
    ]) {
      part.line([vx, vy, zTop], [vx, vy, zTop + h]);
    }
  }

  /* ---- Reset switch ---- */
  box(part, 4.7, 47.6, 6.0, 6.0, 3.4, zTop);
  cylinder(part, 4.7, 47.6, 1.8, 1.6, zTop + 3.4, 16);

  /* ---- Power section: 2 electrolytic caps + regulator ---- */
  for (const cy of [8.8, 16.6]) {
    const cx = 19.8;
    const ch = 5.6;
    cylinder(part, cx, cy, 3.1, ch, zTop, 24);
    // vent cross + polarity bar on top
    part.line([cx - 1.9, cy, zTop + ch], [cx + 1.9, cy, zTop + ch]);
    part.line([cx, cy - 1.9, zTop + ch], [cx, cy + 1.9, zTop + ch]);
    part.line([cx - 3.1, cy + 2.1, zTop + ch], [cx + 3.1, cy + 2.1, zTop + ch]);
  }
  {
    // SOT-223 regulator: body, three legs, wide tab
    const rx = 27.0;
    const ry = 10.5;
    box(part, rx, ry, 3.6, 6.6, 1.8, zTop + 0.2);
    for (const dy of [-2.3, 0, 2.3]) {
      box(part, rx - 3.1, ry + dy, 1.6, 0.8, 0.3, zTop);
    }
    box(part, rx + 3.0, ry, 2.4, 3.0, 0.3, zTop);
  }

  /* ---- SMD passives (0805-ish), placed in clear board areas ---- */
  const passive = (x: number, y: number, vertical = false) =>
    box(part, x, y, vertical ? 1.25 : 2.0, vertical ? 2.0 : 1.25, 0.55, zTop);
  for (const [x, y, v] of [
    [14.5, 24.0, false],
    [14.5, 26.4, false],
    [29.5, 29.5, false],
    [32.2, 29.5, false],
    [29.5, 33.0, true],
    [26.0, 38.0, false],
    [28.8, 38.0, false],
    [42.0, 28.5, false],
    [44.8, 28.5, false],
    [47.6, 28.5, false],
    [56.5, 24.5, true],
    [58.5, 24.5, true],
    [13.0, 17.5, true],
    [13.0, 12.5, true],
  ] as [number, number, boolean][]) {
    passive(x, y, v);
  }

  /* ---- LEDs: L, TX, RX near pin 13, plus the ON led ---- */
  for (const lx of [30.0, 32.6, 35.2]) box(part, lx, 43.4, 2.2, 1.3, 0.8, zTop);
  box(part, 55.0, 27.0, 2.2, 1.3, 0.8, zTop);

  /* ---- Arduino infinity mark, drawn on the board surface ---- */
  {
    const cx = 36.0;
    const cy = 33.5;
    const logo: [number, number, number][] = [];
    const steps = 64;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      logo.push([
        cx + Math.cos(t) * 8.5,
        cy + Math.sin(t) * Math.cos(t) * 9,
        zTop + 0.02,
      ]);
    }
    trace.polyline(logo, true);
    trace.line([cx - 6.2, cy, zTop + 0.02], [cx - 2.6, cy, zTop + 0.02]);
    trace.line([cx + 2.6, cy, zTop + 0.02], [cx + 6.2, cy, zTop + 0.02]);
    trace.line(
      [cx + 4.4, cy - 1.8, zTop + 0.02],
      [cx + 4.4, cy + 1.8, zTop + 0.02],
    );
  }

  /* ---- Traces ---- */
  const rand = mulberry32(7);
  const zT = zTop + 0.02;
  const topPins: number[] = [
    ...Array.from({ length: 10 }, (_, i) => top10 + i * PIN),
    ...Array.from({ length: 8 }, (_, i) => top8 + i * PIN),
  ];
  const dipTopY = chipY + 5.2;
  const dipBotY = chipY - 5.2;
  const dipX = (k: number) => chipX - 16.5 + k * PIN;

  topPins.forEach((px, i) => {
    const k = Math.round((i * 13) / 17);
    const tx = dipX(k);
    const dx = Math.abs(tx - px);
    const yEnd = dipTopY + 1.2;
    const yMid = yEnd + dx + 0.6 + rand() * 0.5;
    trace.polyline([
      [px, TOP_Y - 2.4, zT],
      [px, yMid, zT],
      [tx, yEnd, zT],
      [tx, dipTopY, zT],
    ]);
    trace.ring(px, TOP_Y - 3.2, zT, 0.55, 8);
  });
  for (let i = 0; i < 8; i++) {
    const px = power8 + i * PIN;
    const k = i;
    const tx = dipX(k);
    const dx = Math.abs(tx - px);
    const yEnd = dipBotY - 1.2;
    const yMid = Math.max(yEnd - dx - 0.6, 5.2);
    trace.polyline([
      [px, BOT_Y + 2.4, zT],
      [px, Math.min(yMid, 6.4), zT],
      [tx, Math.min(yMid, 6.4) + 0, zT],
      [tx, dipBotY, zT],
    ]);
  }
  for (let i = 0; i < 6; i++) {
    const px = analog6 + i * PIN;
    const tx = dipX(8 + i);
    trace.polyline([
      [px, BOT_Y + 2.4, zT],
      [px, dipBotY - 3.4 - i * 0.0, zT],
      [tx, dipBotY - 1.2, zT],
      [tx, dipBotY, zT],
    ]);
  }
  // USB to 16U2, 16U2 to crystal, 16U2 to the main chip
  for (let i = 0; i < 4; i++) {
    const y = 36 + i * 1.6;
    trace.polyline([
      [10.6, 33 + i * 2.2, zT],
      [14.6 + i, y, zT],
      [17.9, 30 + (i - 1.5) * 1.2, zT],
    ]);
  }
  trace.polyline([
    [25.1, 31.5, zT],
    [34.0, 31.5, zT],
    [36.5, 29.0, zT],
    [36.5, chipY + 5.2, zT],
  ]);
  trace.polyline([
    [27.5, 26.8, zT],
    [27.5, 29.0, zT],
    [25.1, 30.6, zT],
  ]);

  /* ---- Dimension lines (68.6 x 53.4 mm), drafting-style ---- */
  const tick = (x: number, y: number) =>
    dim.line([x - 1.4, y - 1.4, 0], [x + 1.4, y + 1.4, 0]);
  // bottom: overall length
  dim.line([0, -3, 0], [0, -11, 0]);
  dim.line([BOARD_W, -3, 0], [BOARD_W, -11, 0]);
  dim.line([0, -9, 0], [BOARD_W, -9, 0]);
  tick(0, -9);
  tick(BOARD_W, -9);
  // left: overall width, clear of the USB overhang
  dim.line([-3, 0, 0], [-26, 0, 0]);
  dim.line([-3, BOARD_H, 0], [-26, BOARD_H, 0]);
  dim.line([-24, 0, 0], [-24, BOARD_H, 0]);
  tick(-24, 0);
  tick(-24, BOARD_H);

  /* ---- Leader lines + label anchors ---- */
  const leaders: ModelLabel[] = [];
  const leader = (
    id: string,
    text: string,
    x: number,
    y: number,
    zFrom: number,
    zTo: number,
    opts: { accent?: boolean; minWidth?: number } = {},
  ) => {
    (opts.accent ? accent : dim).line([x, y, zFrom], [x, y, zTo]);
    const anchor = new Object3D();
    anchor.position.set(x, y, zTo);
    leaders.push({ id, text, anchor, ...opts });
  };

  leader("chip", "ATmega328P", chipX + 9, chipY, zTop + 3.6, 24, {
    accent: true,
  });
  leader("usb", "USB-B", 2.2, 38.5, zTop + 10.9, 26);
  leader("digital", "Digital I/O ×14", 30.5, TOP_Y, zTop + HEADER_H, 26, {
    minWidth: 720,
  });
  leader("analog", "Analog in ×6", 55.6, BOT_Y, zTop + HEADER_H, 26, {
    minWidth: 720,
  });
  leader("dc", "DC jack", 1.3, 7.5, zTop + 10.8, 22, { minWidth: 720 });

  // Dimension label anchors (no leader)
  const dimAnchor = (id: string, text: string, x: number, y: number) => {
    const anchor = new Object3D();
    anchor.position.set(x, y, 0);
    leaders.push({ id, text, anchor, minWidth: 560 });
  };
  dimAnchor("dim-w", "68.6 mm", BOARD_W / 2, -9);
  dimAnchor("dim-h", "53.4 mm", -24, BOARD_H / 2);

  /* ---- Assemble ---- */
  const materials: Record<LineKind, ShaderMaterial> = {
    board: lineMaterial(BLUE, 0.95, LINE_WIDTHS.board),
    part: lineMaterial(ICE, 0.8, LINE_WIDTHS.part),
    accent: lineMaterial(YELLOW, 0.95, LINE_WIDTHS.accent),
    trace: lineMaterial(BLUE, 0.4, LINE_WIDTHS.trace),
    dim: lineMaterial(ICE, 0.5, LINE_WIDTHS.dim),
  };

  const centerer = new Group();
  centerer.position.set(-BOARD_W / 2, -BOARD_H / 2, -PCB_T / 2);
  centerer.add(
    board.build(materials.board),
    trace.build(materials.trace),
    part.build(materials.part),
    accent.build(materials.accent),
    dim.build(materials.dim),
  );
  for (const l of leaders) centerer.add(l.anchor);

  // Board space (z up) -> world space (y up)
  const model = new Group();
  model.rotation.x = -Math.PI / 2;
  model.add(centerer);

  const root = new Group();
  root.add(model);

  return {
    root,
    labels: leaders,
    materials,
    schedule: {
      board: [0.0, 1.5],
      trace: [0.5, 2.4],
      part: [0.9, 2.8],
      accent: [1.9, 2.9],
      dim: [2.4, 3.2],
    },
  };
}
