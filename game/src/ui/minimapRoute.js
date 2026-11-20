// The radar's route line: the way from the player to an objective along the street grid of Saros, as a list of
// corners. The city is a grid, so the way is at most three legs: down the road she is on, across, and in.
import { CITY } from '../core/config.js';

const P = CITY.pitch;

function nearestRoad(value, last) {
  return Math.min(Math.max(Math.round(value / P), 0), last) * P;
}

/** The corners of the drive from `from` to `to` (both { x, z }), each leg along an avenue or a street. */
export function routeAlongStreets(from, to) {
  const fromX = nearestRoad(from.x, CITY.roadsX - 1);
  const fromZ = nearestRoad(from.z, CITY.roadsZ - 1);
  const toX = nearestRoad(to.x, CITY.roadsX - 1);
  const toZ = nearestRoad(to.z, CITY.roadsZ - 1);
  // An avenue runs north to south at a fixed x; a street runs across at a fixed z.
  const startsOnAvenue = Math.abs(from.x - fromX) <= Math.abs(from.z - fromZ);
  const endsOnAvenue = Math.abs(to.x - toX) <= Math.abs(to.z - toZ);
  const corners = [{ x: from.x, z: from.z }];
  if (startsOnAvenue) {
    corners.push({ x: fromX, z: from.z });
    if (endsOnAvenue && fromX === toX) corners.push({ x: toX, z: to.z });
    else if (endsOnAvenue) corners.push({ x: fromX, z: toZ }, { x: toX, z: toZ }, { x: toX, z: to.z });
    else corners.push({ x: fromX, z: toZ }, { x: to.x, z: toZ });
  } else {
    corners.push({ x: from.x, z: fromZ });
    if (!endsOnAvenue && fromZ === toZ) corners.push({ x: to.x, z: toZ });
    else if (!endsOnAvenue) corners.push({ x: toX, z: fromZ }, { x: toX, z: toZ }, { x: to.x, z: toZ });
    else corners.push({ x: toX, z: fromZ }, { x: toX, z: to.z });
  }
  corners.push({ x: to.x, z: to.z });
  return corners;
}
