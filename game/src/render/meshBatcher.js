// Merges many coloured boxes, cylinders and other shapes into one mesh, so a whole district draws in one call.
import * as THREE from 'three';

const scratchColor = new THREE.Color();
const scratchMatrix = new THREE.Matrix4();
const scratchNormalMatrix = new THREE.Matrix3();
const scratchVector = new THREE.Vector3();
const unitBox = new THREE.BoxGeometry(1, 1, 1);

export class MeshBatcher {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.uvs = [];
    this.indices = [];
    this.vertexCount = 0;
  }

  /** Append any geometry, moved by `matrix` and tinted `color`; `uvOf(index, u, v)` may rewrite a vertex's UV. */
  addGeometry(geometry, matrix, color, uvOf = null) {
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    scratchColor.set(color);
    scratchNormalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < position.count; i += 1) {
      scratchVector.fromBufferAttribute(position, i).applyMatrix4(matrix);
      this.positions.push(scratchVector.x, scratchVector.y, scratchVector.z);
      scratchVector.fromBufferAttribute(normal, i).applyMatrix3(scratchNormalMatrix).normalize();
      this.normals.push(scratchVector.x, scratchVector.y, scratchVector.z);
      this.colors.push(scratchColor.r, scratchColor.g, scratchColor.b);
      const u = uv ? uv.getX(i) : 0;
      const v = uv ? uv.getY(i) : 0;
      const mapped = uvOf ? uvOf(i, u, v) : null;
      if (mapped) this.uvs.push(mapped[0], mapped[1]);
      else this.uvs.push(u, v);
    }
    const index = geometry.index;
    if (index) {
      for (let i = 0; i < index.count; i += 1) this.indices.push(this.vertexCount + index.getX(i));
    } else {
      for (let i = 0; i < position.count; i += 1) this.indices.push(this.vertexCount + i);
    }
    this.vertexCount += position.count;
  }

  /**
   * A box standing on height `y0`, centred on (cx, cz). With `tile` [metres wide, metres tall] its walls repeat
   * a facade texture and its roof samples the texture's plain corner.
   */
  addBox(cx, y0, cz, width, height, depth, color, options = {}) {
    const { rotY = 0, tile = null, uvOffset = 0 } = options;
    scratchMatrix.makeRotationY(rotY);
    scratchMatrix.scale(scratchVector.set(width, height, depth));
    scratchMatrix.setPosition(cx, y0 + height / 2, cz);
    let uvOf = null;
    if (tile) {
      // BoxGeometry lists its faces +x, -x, +y, -y, +z, -z, four vertices each.
      uvOf = (i, u, v) => {
        const face = i >> 2;
        if (face === 2 || face === 3) return [0.004, 0.004];
        const span = face < 2 ? depth : width;
        return [uvOffset + (u * span) / tile[0], (v * height) / tile[1]];
      };
    }
    this.addGeometry(unitBox, scratchMatrix, color, uvOf);
  }

  /** Narrow the top face of the box just added, and slide it along z: slopes a windscreen or a bonnet. */
  taperLastBox(scaleX, scaleZ, shiftZ = 0) {
    const p = this.positions;
    const start = p.length - 72;
    let top = -Infinity;
    let cx = 0;
    let cz = 0;
    for (let k = start; k < p.length; k += 3) {
      top = Math.max(top, p[k + 1]);
      cx += p[k] / 24;
      cz += p[k + 2] / 24;
    }
    for (let k = start; k < p.length; k += 3) {
      if (p[k + 1] < top - 0.0001) continue;
      p[k] = cx + (p[k] - cx) * scaleX;
      p[k + 2] = cz + (p[k + 2] - cz) * scaleZ + shiftZ;
    }
  }

  /** A flat rectangle lying on the ground at height `y` (road paint, lawns, sand). */
  addFlat(cx, y, cz, width, depth, color, rotY = 0) {
    this.addBox(cx, y - 0.02, cz, width, 0.02, depth, color, { rotY });
  }

  isEmpty() {
    return this.vertexCount === 0;
  }

  build(material, { castShadow = true, receiveShadow = true } = {}) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setIndex(this.indices);
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

/** A matrix that places, turns and scales a shape; shared by the prop builders. */
export function placement(x, y, z, rotY = 0, sx = 1, sy = 1, sz = 1, rotX = 0, rotZ = 0) {
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ')),
    new THREE.Vector3(sx, sy, sz),
  );
  return matrix;
}
