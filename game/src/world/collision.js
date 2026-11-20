// Static collision: buildings and props as boxes in a spatial grid, with circle push-out and ray tests.

const CELL = 20;

export class CollisionWorld {
  constructor() {
    this.cells = new Map();
    this.boxes = [];
  }

  key(cx, cz) {
    return cx * 4096 + cz;
  }

  /** Add an axis-aligned solid from the ground up to `height`. */
  addBox(minX, minZ, maxX, maxZ, height = 100) {
    const box = { minX, minZ, maxX, maxZ, height };
    this.boxes.push(box);
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx += 1) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz += 1) {
        const key = this.key(cx, cz);
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(box);
      }
    }
    return box;
  }

  boxesNear(x, z) {
    return this.cells.get(this.key(Math.floor(x / CELL), Math.floor(z / CELL)));
  }

  /**
   * Push a circle out of every box it overlaps. Returns null when it touches nothing, else the total push
   * {x, z} and the unit normal {nx, nz} of the deepest contact.
   */
  resolveCircle(x, z, radius, y = 0) {
    let pushX = 0;
    let pushZ = 0;
    let normalX = 0;
    let normalZ = 0;
    let deepest = 0;
    const minCX = Math.floor((x - radius) / CELL);
    const maxCX = Math.floor((x + radius) / CELL);
    const minCZ = Math.floor((z - radius) / CELL);
    const maxCZ = Math.floor((z + radius) / CELL);
    for (let cx = minCX; cx <= maxCX; cx += 1) {
      for (let cz = minCZ; cz <= maxCZ; cz += 1) {
        const list = this.cells.get(this.key(cx, cz));
        if (!list) continue;
        for (let index = 0; index < list.length; index += 1) {
          const box = list[index];
          if (y > box.height) continue;
          const px = x + pushX;
          const pz = z + pushZ;
          const nearX = px < box.minX ? box.minX : px > box.maxX ? box.maxX : px;
          const nearZ = pz < box.minZ ? box.minZ : pz > box.maxZ ? box.maxZ : pz;
          let dx = px - nearX;
          let dz = pz - nearZ;
          let dist = Math.hypot(dx, dz);
          let depth;
          if (dist > 0.0001) {
            if (dist >= radius) continue;
            depth = radius - dist;
            dx /= dist;
            dz /= dist;
          } else {
            // The centre is inside the box: leave by the nearest face.
            const left = px - box.minX;
            const right = box.maxX - px;
            const top = pz - box.minZ;
            const bottom = box.maxZ - pz;
            const least = Math.min(left, right, top, bottom);
            dx = 0; dz = 0;
            if (least === left) dx = -1; else if (least === right) dx = 1; else if (least === top) dz = -1; else dz = 1;
            depth = least + radius;
          }
          pushX += dx * depth;
          pushZ += dz * depth;
          if (depth > deepest) { deepest = depth; normalX = dx; normalZ = dz; }
        }
      }
    }
    if (deepest === 0) return null;
    return { x: pushX, z: pushZ, nx: normalX, nz: normalZ };
  }

  /** True when the point is inside a solid. */
  isSolid(x, y, z) {
    const list = this.boxesNear(x, z);
    if (!list) return false;
    for (let index = 0; index < list.length; index += 1) {
      const box = list[index];
      if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ && y < box.height) return true;
    }
    return false;
  }

  /** March a ray through the solids; the distance to the first hit, or `maxDistance` when it is clear. */
  raycast(ox, oy, oz, dx, dy, dz, maxDistance, step = 0.6) {
    for (let t = step; t < maxDistance; t += step) {
      const y = oy + dy * t;
      if (y < 0) return t;
      if (this.isSolid(ox + dx * t, y, oz + dz * t)) return t - step * 0.5;
    }
    return maxDistance;
  }

  /** True when nothing solid stands between two points at about chest height. */
  hasLineOfSight(ax, az, bx, bz, y = 1.4) {
    const dist = Math.hypot(bx - ax, bz - az);
    if (dist < 0.5) return true;
    return this.raycast(ax, y, az, (bx - ax) / dist, 0, (bz - az) / dist, dist, 1.5) >= dist;
  }
}
