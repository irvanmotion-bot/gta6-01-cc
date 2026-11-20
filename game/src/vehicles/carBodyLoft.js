// The sculpted body of a car: a smooth skin stretched over cross-sections set along its length, so a bonnet falls
// away in a curve, the flanks bulge, the glasshouse leans in to a crowned roof and the paint catches the sky. The
// skin is two surfaces that meet in a crease at the shoulder: the lower body, and the bonnet, glass, roof and boot
// over it. Each face takes one flat colour (paint, glass, livery), each corner the smooth normal of its surface.
import * as THREE from 'three';

const GLASS = '#16242f';
const UNDERSIDE = '#1d2024';
const BOTTOM = 0.27;

function mix(a, b, t) {
  return a + (b - a) * t;
}

function ease(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Where the body's lines stand along the car, tail (0) to nose (1): the glasshouse from `rear` to `front`, its roof
 * from `roofRear` to `roofFront`, and the door pillar in the middle of the roof.
 */
function layoutOf(shape) {
  const [rear, front] = shape.cabin;
  const [, roofShare, roofShift] = shape.rake;
  const cabin = front - rear;
  const roofMid = (rear + front) / 2 + roofShift * cabin;
  const roofRear = Math.max(rear + 0.012, roofMid - (roofShare * cabin) / 2);
  const roofFront = Math.min(front - 0.012, roofMid + (roofShare * cabin) / 2);
  return { rear, front, roofRear, roofFront, pillar: (roofRear + roofFront) / 2 };
}

/** The stations the skin is stretched over: the ends, the foot and head of each glass, the pillar, and points between. */
function stationsOf(layout) {
  const { rear, front, roofRear, roofFront, pillar } = layout;
  const wanted = [
    0, 0.02, 0.06, rear * 0.55, rear, (rear + roofRear) / 2, roofRear, (roofRear + pillar) / 2, pillar - 0.016, pillar + 0.016,
    (pillar + roofFront) / 2, roofFront, (roofFront + front) / 2, front, mix(front, 1, 0.35), mix(front, 1, 0.7), 0.94, 0.98, 1,
  ].sort((a, b) => a - b);
  const stations = [];
  for (const t of wanted) if (!stations.length || t - stations[stations.length - 1] > 0.011) stations.push(t);
  stations[stations.length - 1] = 1;
  return stations;
}

/** The cross-section at station `t`: half-widths and heights in metres. */
function sectionAt(t, spec, shape, layout, frame) {
  const { rear, front, roofRear, roofFront } = layout;
  const { shellHeight, clearance } = frame;
  const half = spec.width / 2;
  // The shoulder line: level under the glass, falling toward the nose and the tail.
  let fall = 0;
  let narrow = 1;
  if (t > front) {
    const along = (t - front) / (1 - front);
    fall = shape.nose[0] * Math.pow(along, 1.35);
    narrow = 1 - (1 - shape.nose[1]) * Math.pow(along, 1.7);
  } else if (t < rear) {
    const along = (rear - t) / Math.max(rear, 0.0001);
    fall = shape.tail[0] * Math.pow(along, 1.35);
    narrow = 1 - (1 - shape.tail[1]) * Math.pow(along, 1.7);
  }
  // The corners of the car are rounded off in plan, and its chin and tail are tucked up.
  const end = Math.max(0, (Math.abs(t - 0.5) - 0.44) / 0.06);
  narrow *= 1 - 0.13 * end * end;
  const belt = clearance + shellHeight * (1 - fall);
  // The glasshouse: up the rear glass, along the roof, down the windscreen. Elsewhere the top is the bonnet or boot.
  let rise = 0;
  if (t > rear && t < front) rise = t < roofRear ? ease((t - rear) / (roofRear - rear)) : t > roofFront ? ease((front - t) / (front - roofFront)) : 1;
  const top = mix(belt + 0.025, spec.height - 0.03, rise);
  const beltHalf = half * narrow;
  const topHalf = beltHalf * mix(0.86, shape.rake[0] * 0.9, rise);
  return { belt, top, beltHalf, topHalf, low: BOTTOM + 0.12 * end * end, crown: 0.03 + 0.02 * rise, rise };
}

/** The nine points of the lower body's section, left shoulder round under the floor to the right shoulder. */
function lowerPoints(section, z) {
  const { belt, beltHalf, low } = section;
  const sill = beltHalf * 0.93;
  const side = [[beltHalf * 0.985, belt], [beltHalf, low + (belt - low) * 0.56], [sill, low + 0.08], [sill * 0.88, low]];
  const points = side.map(([x, y]) => new THREE.Vector3(-x, y, z));
  points.push(new THREE.Vector3(0, low, z));
  for (let k = side.length - 1; k >= 0; k -= 1) points.push(new THREE.Vector3(side[k][0], side[k][1], z));
  return points;
}

/** The nine points of the upper section, right shoulder over the roof (or the bonnet) to the left shoulder. */
function upperPoints(section, z) {
  const { belt, top, beltHalf, topHalf, crown } = section;
  const shoulder = beltHalf * 0.985;
  const side = [[shoulder, belt], [mix(shoulder, topHalf, 0.42), mix(belt, top, 0.5)], [topHalf, top - (top - belt) * 0.07], [topHalf * 0.52, top + crown * 0.75]];
  const points = side.map(([x, y]) => new THREE.Vector3(x, y, z));
  points.push(new THREE.Vector3(0, top + crown, z));
  for (let k = side.length - 1; k >= 0; k -= 1) points.push(new THREE.Vector3(-side[k][0], side[k][1], z));
  return points;
}

/** The smooth normal at every point of a grid of rings: the mean of the faces round it, turned to face outward. */
function smoothNormals(rings, axisHeight) {
  const normals = rings.map((ring) => ring.map(() => new THREE.Vector3()));
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const face = new THREE.Vector3();
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let k = 0; k < rings[i].length - 1; k += 1) {
      a.subVectors(rings[i + 1][k + 1], rings[i][k]);
      b.subVectors(rings[i][k + 1], rings[i + 1][k]);
      face.crossVectors(a, b);
      // Outward is away from the car's long axis.
      const centre = rings[i][k];
      if (face.x * centre.x + face.y * (centre.y - axisHeight) < 0) face.negate();
      for (const corner of [normals[i][k], normals[i][k + 1], normals[i + 1][k], normals[i + 1][k + 1]]) corner.add(face);
    }
  }
  for (const ring of normals) for (const normal of ring) normal.normalize();
  return normals;
}

/** Collects triangles with a colour a face and a normal a corner. */
class Skin {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.tint = new THREE.Color();
  }

  corner(point, normal) {
    this.positions.push(point.x, point.y, point.z);
    this.normals.push(normal.x, normal.y, normal.z);
    this.colors.push(this.tint.r, this.tint.g, this.tint.b);
  }

  /** A four-cornered face, its corners given round its edge; `outward` settles which side shows. */
  quad(points, normals, color, outward) {
    this.tint.set(color);
    const a = new THREE.Vector3().subVectors(points[1], points[0]);
    const b = new THREE.Vector3().subVectors(points[2], points[0]);
    const order = a.cross(b).dot(outward) >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const index of order) this.corner(points[index], normals[index]);
  }

  geometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((this.positions.length / 3) * 2), 2));
    return geometry;
  }
}

/** Lay one surface's grid of rings into the skin; `colorOf(i, k)` names the colour of the face past ring i, point k. */
function layGrid(skin, rings, normals, colorOf, axisHeight) {
  const outward = new THREE.Vector3();
  for (let i = 0; i < rings.length - 1; i += 1) {
    for (let k = 0; k < rings[i].length - 1; k += 1) {
      const points = [rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]];
      outward.set(points[0].x + points[1].x, points[0].y + points[1].y - axisHeight * 2, 0);
      skin.quad(points, [normals[i][k], normals[i][k + 1], normals[i + 1][k + 1], normals[i + 1][k]], colorOf(i, k), outward);
    }
  }
}

/** Close one end of the body with a flat face: the fascia the lamps, the grille and the plate sit on. */
function capEnd(skin, lower, upper, color, facing) {
  const loop = [...lower, ...upper.slice(1, -1)];
  const centre = new THREE.Vector3();
  for (const point of loop) centre.add(point);
  centre.divideScalar(loop.length);
  const normal = new THREE.Vector3(0, 0, facing);
  skin.tint.set(color);
  for (let k = 0; k < loop.length; k += 1) {
    const a = loop[k];
    const b = loop[(k + 1) % loop.length];
    const turn = new THREE.Vector3().subVectors(a, centre).cross(new THREE.Vector3().subVectors(b, centre)).z * facing;
    for (const point of turn >= 0 ? [centre, a, b] : [centre, b, a]) skin.corner(point, normal);
  }
}

/**
 * The body of one car as a geometry, its nose toward +z. `shape` is the body shape's proportions (vehicleModel.js),
 * `frame` its `clearance` and `shellHeight`, `paint` its colour and `livery` what is painted over it:
 * { roof, band } colours for a police car's roof and door band or a cab's band, or nothing.
 */
export function buildCarBody(spec, shape, frame, paint, livery = {}) {
  const layout = layoutOf(shape);
  const stations = stationsOf(layout);
  const sections = stations.map((t) => sectionAt(t, spec, shape, layout, frame));
  const zOf = (t) => (t - 0.5) * spec.length;
  const lower = stations.map((t, index) => lowerPoints(sections[index], zOf(t)));
  const upper = stations.map((t, index) => upperPoints(sections[index], zOf(t)));
  const axisHeight = frame.clearance + frame.shellHeight * 0.5;
  const skin = new Skin();
  const sill = new THREE.Color(paint).multiplyScalar(0.62).getStyle();
  const { rear, front, roofRear, roofFront, pillar } = layout;
  const middle = (i) => (stations[i] + stations[i + 1]) / 2;

  // The lower body: paint on the flanks, a darker sill, a dark floor; a livery band runs along the doors.
  layGrid(skin, lower, smoothNormals(lower, axisHeight), (i, k) => {
    if (k >= 3 && k <= 4) return UNDERSIDE;
    if (k === 2 || k === 5) return sill;
    const t = middle(i);
    const upperFlank = k === 0 || k === 7;
    if (livery.band && upperFlank && t > rear + 0.02 && t < front + 0.04) return livery.band;
    return paint;
  }, axisHeight);

  // Over the shoulder: bonnet and boot in paint; inside the glasshouse the screens, the side windows between the
  // pillars, and the roof panel.
  layGrid(skin, upper, smoothNormals(upper, axisHeight), (i, k) => {
    const t = middle(i);
    if (t <= rear || t >= front) return paint;
    const onRoof = t > roofRear && t < roofFront;
    const side = k <= 1 || k >= 6;
    if (side) {
      // Side glass runs under the roof and half-way down each screen's slope; the rest of the slope is the pillar.
      const glazed = t > mix(rear, roofRear, 0.45) && t < mix(front, roofFront, 0.45) && Math.abs(t - pillar) > 0.017;
      return glazed ? GLASS : paint;
    }
    return onRoof ? livery.roof || paint : GLASS;
  }, axisHeight);

  capEnd(skin, lower[0], upper[0], paint, -1);
  capEnd(skin, lower[lower.length - 1], upper[upper.length - 1], paint, 1);
  return skin.geometry();
}
