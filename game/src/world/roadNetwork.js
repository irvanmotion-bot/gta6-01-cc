// The road graph traffic and police drive on: intersections, right-hand lanes, traffic-light phases and spawn points.
import { CITY } from '../core/config.js';

export function nodePosition(i, j) {
  return { x: i * P, z: j * P };
}

export function isNode(i, j) {
  return i >= 0 && j >= 0 && i < CITY.roadsX && j < CITY.roadsZ;
}

export function nearestNode(x, z) {
  return {
    i: Math.min(Math.max(Math.round(x / P), 0), CITY.roadsX - 1),
    j: Math.min(Math.max(Math.round(z / P), 0), CITY.roadsZ - 1),
  };
}

/** The intersections one road segment away from (i, j). */
export function neighborNodes(i, j) {
  const list = [];
  for (const [di, dj] of DIRECTIONS) if (isNode(i + di, j + dj)) list.push({ i: i + di, j: j + dj });
  return list;
}

/** The next intersection for ambient traffic: any way on but back, unless it is a dead end. */
export function chooseNextNode(from, to, rng) {
  const options = neighborNodes(to.i, to.j).filter((n) => !(n.i === from.i && n.j === from.j));
  if (options.length === 0) return from;
  const straight = options.find((n) => n.i - to.i === to.i - from.i && n.j - to.j === to.j - from.j);
  if (straight && rng.chance(0.55)) return straight;
  return rng.pick(options);
}

/** The neighbour of `node` that brings a pursuer closest to (x, z). */
export function stepToward(node, x, z) {
  let best = node;
  let bestDistance = Math.hypot(node.i * P - x, node.j * P - z);
  for (const n of neighborNodes(node.i, node.j)) {
    const d = Math.hypot(n.i * P - x, n.j * P - z);
    if (d < bestDistance) { bestDistance = d; best = n; }
  }
  return best;
}

/** A point `along` metres from node `from` toward node `to`, in the right-hand lane. */
export function lanePoint(from, to, along, offset = LANE_OFFSET) {
  const dx = Math.sign(to.i - from.i);
  const dz = Math.sign(to.j - from.j);
  return { x: from.i * P + dx * along - dz * offset, z: from.j * P + dz * along + dx * offset };
}

export function segmentHeading(from, to) {
  return Math.atan2(to.i - from.i, to.j - from.j);
}

/** 'go', 'slow' or 'stop' for traffic travelling along the given axis ('ns' or 'ew') at this time. */
export function lightState(axis, time) {
  const t = time % LIGHT_CYCLE;
  const half = LIGHT_CYCLE / 2;
  const local = axis === 'ns' ? t : (t + half) % LIGHT_CYCLE;
  if (local < half - 3) return 'go';
  if (local < half - 1) return 'slow';
  return 'stop';
}

/**
 * A random lane position between `minDistance` and `maxDistance` from (x, z): the segment's two nodes, the
 * point and the heading. Null when none was found in a few tries.
 */
export function randomLaneSpawn(x, z, minDistance, maxDistance, rng, offset = LANE_OFFSET) {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const radius = rng.range(minDistance, maxDistance);
    const from = nearestNode(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius);
    const options = neighborNodes(from.i, from.j);
    const to = rng.pick(options);
    const along = rng.range(16, P - 16);
    const point = lanePoint(from, to, along, offset);
    const distance = Math.hypot(point.x - x, point.z - z);
    if (distance < minDistance || distance > maxDistance) continue;
    return { from, to, x: point.x, z: point.z, heading: segmentHeading(from, to) };
  }
  return null;
}

const P = CITY.pitch;
export const LANE_OFFSET = 2.6;
export const LIGHT_CYCLE = 22;
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
