// The radar in the corner and the full city map: a painted map of Saros with blips for missions, shops and police,
// and, on the atlas, the path the moon's shadow takes across the city.
import { CITY } from '../core/config.js';
import { blockRect, districtOfBlock, DISTRICTS, LANDMARKS, AVENUES, STREETS } from '../world/cityLayout.js';
import { routeAlongStreets } from './minimapRoute.js';

const MAP_MIN_X = -130;
const MAP_MIN_Z = -60;
const MAP_WIDTH = CITY.width + 190;
const MAP_DEPTH = CITY.depth + 180;

/** Paint the whole city once, one pixel per metre: ocean, sand, roads, blocks tinted by district, piers. */
function paintCityMap() {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_DEPTH;
  const c = canvas.getContext('2d');
  c.translate(-MAP_MIN_X, -MAP_MIN_Z);
  c.fillStyle = '#2f9fcb';
  c.fillRect(MAP_MIN_X, MAP_MIN_Z, MAP_WIDTH, MAP_DEPTH);
  c.fillStyle = '#86b866';
  c.fillRect(-6, MAP_MIN_Z, MAP_WIDTH, -MAP_MIN_Z);
  c.fillRect(CITY.width + 6, MAP_MIN_Z, 200, CITY.depth + 86);
  c.fillStyle = '#f0deb0';
  c.fillRect(-78, -46, 72, CITY.depth + 52);
  c.fillStyle = '#8f9094';
  c.fillRect(-60, CITY.depth + 6, CITY.width + 200, 40);
  for (let k = 0; k < 4; k += 1) c.fillRect(142 + k * 190, CITY.depth + 46, 16, 42);
  c.fillStyle = '#b98b5e';
  c.fillRect(-128, 297.5, 60, 5);
  c.fillStyle = '#3f3a55';
  c.fillRect(-6, -6, CITY.width + 12, CITY.depth + 12);
  for (let i = 0; i < CITY.roadsX - 1; i += 1) {
    for (let j = 0; j < CITY.roadsZ - 1; j += 1) {
      const rect = blockRect(i, j);
      c.fillStyle = DISTRICTS[districtOfBlock(i, j)].map;
      c.fillRect(rect.minX, rect.minZ, rect.maxX - rect.minX, rect.maxZ - rect.minZ);
      c.fillStyle = 'rgba(0,0,0,0.13)';
      c.fillRect(rect.minX + 6, rect.minZ + 6, rect.maxX - rect.minX - 12, rect.maxZ - rect.minZ - 12);
    }
  }
  return canvas;
}

export class Minimap {
  constructor(game) {
    this.game = game;
    this.cityMap = paintCityMap();
    this.canvas = document.getElementById('minimap');
    this.context = this.canvas.getContext('2d');
    this.fullCanvas = document.getElementById('city-map');
    this.zoom = 0.85;
  }

  /** Every blip to draw this frame: story, taxi, shops, then the police on top. */
  collectBlips() {
    const game = this.game;
    const blips = [...game.shops.blips(), ...game.races.blips(), ...game.bounties.blips(), ...game.missions.blips(), ...game.activities.blips()];
    const flash = Math.floor(game.time * 5) % 2 === 0;
    // The helicopter goes under the cars it flies over, so a cruiser beside Nova is never hidden by it.
    const chopper = game.police.helicopter;
    if (chopper.active) blips.push({ x: chopper.mesh.position.x, z: chopper.mesh.position.z, color: '#ffffff', label: '✕', size: 1.05 });
    for (const vehicle of game.vehicles.list) {
      if (vehicle.spec.police && !vehicle.dead && vehicle.siren) blips.push({ x: vehicle.position.x, z: vehicle.position.z, color: flash ? '#ff3b30' : '#3a7bff', label: '', size: 1.25 });
    }
    for (const gunman of game.gunmen.list) {
      if (gunman.alive && gunman.faction === 'police') blips.push({ x: gunman.position.x, z: gunman.position.z, color: flash ? '#3a7bff' : '#ff3b30', label: '', size: 0.8 });
    }
    return blips;
  }

  /** Where the route line leads: the objective of the job, race or fare in hand, else the next job on offer. */
  routeTarget() {
    const game = this.game;
    const pinned = [...game.missions.blips(), ...game.races.blips(), ...game.activities.blips()].filter((blip) => blip.pinned);
    return pinned[0] || null;
  }

  /**
   * The radar: the map turns with the camera so that ahead is always up. On it, the route to the objective along
   * the streets, every blip, the objective with a ring round it and how far it is, and north on the rim.
   */
  draw() {
    const game = this.game;
    const canvas = this.canvas;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width < 8 || height < 8) return;
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const c = this.context;
    const halfX = width / 2;
    // The player stands a little below the middle, so more of the road ahead is on the map than of the road behind.
    const halfY = height * 0.56;
    const player = game.player;
    const vehicle = player.vehicle;
    const targetZoom = vehicle ? 1.05 - Math.min(Math.abs(vehicle.speed) / 60, 1) * 0.3 : 1.2;
    this.zoom += (targetZoom - this.zoom) * 0.05;
    const unit = height / 220;
    const scale = this.zoom * unit;
    const angle = game.camera.yaw - Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const toMap = (x, z) => {
      const dx = (x - player.position.x) * scale;
      const dz = (z - player.position.z) * scale;
      return { x: dx * cos - dz * sin, y: dx * sin + dz * cos };
    };

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2f9fcb';
    c.fillRect(0, 0, width, height);
    c.save();
    c.translate(halfX, halfY);
    c.rotate(angle);
    c.scale(scale, scale);
    c.drawImage(this.cityMap, MAP_MIN_X - player.position.x, MAP_MIN_Z - player.position.z);
    c.restore();

    const target = this.routeTarget();
    if (target) this.drawRoute(c, routeAlongStreets(player.position, target), toMap, halfX, halfY, unit, target.color);
    this.drawSearchZone(c, toMap, halfX, halfY, scale, unit);

    const edgeX = halfX - 11 * unit;
    const edgeTop = halfY - 11 * unit;
    const edgeBottom = height - halfY - 26 * unit;
    for (const blip of this.collectBlips()) {
      const spot = toMap(blip.x, blip.z);
      const reach = Math.min(1, edgeX / Math.abs(spot.x || 1e-6), (spot.y < 0 ? edgeTop : edgeBottom) / Math.abs(spot.y || 1e-6));
      if (reach < 1 && !blip.pinned) continue;
      const x = halfX + spot.x * reach;
      const y = halfY + spot.y * reach;
      if (blip === target || (target && blip.pinned && blip.x === target.x && blip.z === target.z)) this.drawObjective(c, x, y, blip, unit, Math.hypot(blip.x - player.position.x, blip.z - player.position.z));
      else this.drawBlip(c, x, y, blip, unit);
    }
    // North marker on the rim, and the player's arrow.
    const north = Math.min(edgeX / Math.abs(sin || 1e-6), edgeTop / Math.abs(cos || 1e-6));
    const northY = halfY - cos * north;
    if (northY < halfY + edgeBottom) {
      c.fillStyle = 'rgba(18,14,36,0.85)';
      c.beginPath();
      c.arc(halfX + sin * north, northY, 8 * unit, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = `900 ${11 * unit}px Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('N', halfX + sin * north, northY + unit * 0.5);
    }
    this.drawArrow(c, halfX, halfY, player.heading - angle, 10 * unit);
    // The frame flashes coral while the police are on her.
    if (game.wanted.stars > 0 && Math.floor(game.time * 4) % 2 === 0) {
      c.lineWidth = 5 * unit;
      c.strokeStyle = '#ff6a4d';
      c.strokeRect(0, 0, width, height);
    }
  }

  /**
   * While the police have lost her: the zone they are searching, a pulsing ring round the place she was last seen
   * that widens the longer she stays out of sight. Leaving it unseen is how the stars fall.
   */
  drawSearchZone(c, toMap, halfX, halfY, scale, unit) {
    const wanted = this.game.wanted;
    if (wanted.stars === 0 || wanted.seen) return;
    const centre = toMap(wanted.lastKnown.x, wanted.lastKnown.z);
    const radius = wanted.searchRadius() * scale;
    c.save();
    c.beginPath();
    c.arc(halfX + centre.x, halfY + centre.y, radius, 0, Math.PI * 2);
    c.fillStyle = `rgba(58, 123, 255, ${0.2 + Math.sin(this.game.time * 4) * 0.06})`;
    c.fill();
    c.setLineDash([7 * unit, 5 * unit]);
    c.lineWidth = 2.6 * unit;
    c.strokeStyle = '#cfe0ff';
    c.stroke();
    c.restore();
  }

  /** The route as a bright line with a dark edge, from the player's arrow to the objective. */
  drawRoute(c, corners, toMap, halfX, halfY, unit, color) {
    c.save();
    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const [lineWidth, style] of [[9 * unit, 'rgba(18,14,36,0.92)'], [5.4 * unit, color === '#ffb547' || !color ? '#ffd23f' : color]]) {
      c.beginPath();
      corners.forEach((corner, index) => {
        const spot = toMap(corner.x, corner.z);
        if (index === 0) c.moveTo(halfX + spot.x, halfY + spot.y); else c.lineTo(halfX + spot.x, halfY + spot.y);
      });
      c.lineWidth = lineWidth;
      c.strokeStyle = style;
      c.stroke();
    }
    c.restore();
  }

  /** The objective: a ringed marker that pulses, with the metres to it written beside it. */
  drawObjective(c, x, y, blip, unit, metres) {
    const pulse = 1 + Math.sin(this.game.time * 5) * 0.12;
    c.beginPath();
    c.arc(x, y, 11 * unit * pulse, 0, Math.PI * 2);
    c.lineWidth = 2.4 * unit;
    c.strokeStyle = blip.color;
    c.stroke();
    this.drawBlip(c, x, y, { ...blip, size: 1.25 }, unit);
    const label = `${Math.round(metres)} m`;
    c.font = `900 ${11.5 * unit}px Arial, sans-serif`;
    c.textAlign = x > c.canvas.width * 0.6 ? 'right' : 'left';
    c.textBaseline = 'middle';
    const labelX = x + (c.textAlign === 'right' ? -14 : 14) * unit;
    c.lineWidth = 3.4 * unit;
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(18,14,36,0.92)';
    c.strokeText(label, labelX, y);
    c.fillStyle = '#ffffff';
    c.fillText(label, labelX, y);
  }

  drawBlip(c, x, y, blip, unit) {
    const radius = (blip.label ? 8.5 : 5.5) * unit * (blip.size || 1);
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.fillStyle = blip.color;
    c.fill();
    c.lineWidth = 1.6 * unit;
    c.strokeStyle = '#0a0e16';
    c.stroke();
    if (blip.label) {
      c.fillStyle = '#ffffff';
      c.font = `900 ${11 * unit}px Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(blip.label, x, y + unit * 0.5);
    }
  }

  /** The player's arrow; `turn` is the heading already rotated into map space. */
  drawArrow(c, x, y, turn, size) {
    c.save();
    c.translate(x, y);
    c.rotate(-turn + Math.PI);
    c.beginPath();
    c.moveTo(0, -size);
    c.lineTo(size * 0.72, size * 0.8);
    c.lineTo(0, size * 0.38);
    c.lineTo(-size * 0.72, size * 0.8);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = size * 0.22;
    c.strokeStyle = '#0a0e16';
    c.stroke();
    c.restore();
  }

  /** The pause screen's full map, north up, with street names and every landmark. */
  /**
   * The districts of Saros on a menu's small map: the painted city, the path of totality, the district names set
   * large and a dot for each landmark. No street names, no blips and no player: the atlas (M) has those.
   */
  drawDistrictMap(canvas) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const c = canvas.getContext('2d');
    const scale = Math.min(canvas.width / MAP_WIDTH, canvas.height / MAP_DEPTH);
    const offsetX = (canvas.width - MAP_WIDTH * scale) / 2;
    const offsetY = (canvas.height - MAP_DEPTH * scale) / 2;
    const toX = (x) => offsetX + (x - MAP_MIN_X) * scale;
    const toY = (z) => offsetY + (z - MAP_MIN_Z) * scale;
    c.fillStyle = '#2f9fcb';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.drawImage(this.cityMap, offsetX, offsetY, MAP_WIDTH * scale, MAP_DEPTH * scale);
    this.drawPathOfTotality(c, toX, toY, scale);
    for (const place of Object.values(LANDMARKS)) {
      c.beginPath();
      c.arc(toX(place.x), toY(place.z), Math.max(3, 15 * scale), 0, Math.PI * 2);
      c.fillStyle = place.color;
      c.fill();
      c.lineWidth = Math.max(1.5, 4 * scale);
      c.strokeStyle = '#17122b';
      c.stroke();
    }
    // Each district's name in two short lines of bold capitals over its blocks, the Strand's up its coast.
    const size = Math.max(11, 58 * scale);
    c.font = `700 ${size}px Verdana, "DejaVu Sans", sans-serif`;
    c.textAlign = 'center';
    c.lineWidth = Math.max(3, size * 0.3);
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(18,14,36,0.85)';
    c.fillStyle = '#ffffff';
    for (const [id, x, z] of [['orrery', 480, 322], ['hill', 520, 62], ['azimuth', 800, 200], ['yards', 440, 622]]) {
      DISTRICTS[id].name.toUpperCase().split(' ').forEach((word, line) => {
        c.strokeText(word, toX(x), toY(z) + line * size * 1.05);
        c.fillText(word, toX(x), toY(z) + line * size * 1.05);
      });
    }
    c.save();
    c.translate(toX(96), toY(360));
    c.rotate(-Math.PI / 2);
    c.strokeText(DISTRICTS.strand.name.toUpperCase(), 0, 0);
    c.fillText(DISTRICTS.strand.name.toUpperCase(), 0, 0);
    c.restore();
  }

  drawFullMap() {
    const game = this.game;
    const canvas = this.fullCanvas;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    const c = canvas.getContext('2d');
    const scale = Math.min(canvas.width / MAP_WIDTH, canvas.height / MAP_DEPTH);
    const offsetX = (canvas.width - MAP_WIDTH * scale) / 2;
    const offsetY = (canvas.height - MAP_DEPTH * scale) / 2;
    const toX = (x) => offsetX + (x - MAP_MIN_X) * scale;
    const toY = (z) => offsetY + (z - MAP_MIN_Z) * scale;
    c.fillStyle = '#2f9fcb';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.drawImage(this.cityMap, offsetX, offsetY, MAP_WIDTH * scale, MAP_DEPTH * scale);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.font = `700 ${Math.max(9, 11 * scale)}px Arial, sans-serif`;
    c.textAlign = 'center';
    AVENUES.forEach((name, i) => {
      c.save();
      c.translate(toX(i * CITY.pitch), toY(CITY.depth / 2 + (i % 2 ? 130 : -130)));
      c.rotate(-Math.PI / 2);
      c.fillText(name, 0, 3);
      c.restore();
    });
    STREETS.forEach((name, j) => c.fillText(name, toX(CITY.width / 2 + (j % 2 ? 200 : -200)), toY(j * CITY.pitch) + 3));
    this.drawPathOfTotality(c, toX, toY, scale);
    // District names sit large over their blocks; the water's name runs up the coast.
    c.font = `900 ${Math.max(14, 34 * scale)}px Impact, "Arial Black", sans-serif`;
    c.lineWidth = 4;
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(23,18,43,0.55)';
    c.fillStyle = 'rgba(255,255,255,0.92)';
    for (const [id, x, z] of [['orrery', 480, 352], ['hill', 520, 84], ['azimuth', 770, 250], ['yards', 420, 664]]) {
      const text = DISTRICTS[id].name.toUpperCase();
      c.strokeText(text, toX(x), toY(z));
      c.fillText(text, toX(x), toY(z));
    }
    for (const [text, x, z] of [[DISTRICTS.strand.name.toUpperCase(), 80, 360], ['AVOCET SOUND', -104, 430]]) {
      c.save();
      c.translate(toX(x), toY(z));
      c.rotate(-Math.PI / 2);
      c.strokeText(text, 0, 0);
      c.fillText(text, 0, 0);
      c.restore();
    }
    c.font = `900 ${Math.max(10, 17 * scale)}px Impact, "Arial Black", sans-serif`;
    c.strokeText(DISTRICTS.jacaranda.name.toUpperCase(), toX(280), toY(330));
    c.fillText(DISTRICTS.jacaranda.name.toUpperCase(), toX(280), toY(330));
    const unit = Math.max(1.2, scale * 2.4);
    const places = Object.values(LANDMARKS).map((p) => ({ x: p.x, z: p.z, color: p.color, label: p.icon }));
    for (const blip of [...places, ...this.collectBlips()]) this.drawBlip(c, toX(blip.x), toY(blip.z), blip, unit);
    // Every landmark carries its name under its icon.
    c.font = `800 ${Math.max(9, 11.5 * scale)}px Arial, sans-serif`;
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(10,14,22,0.9)';
    c.fillStyle = '#ffffff';
    for (const place of Object.values(LANDMARKS)) {
      const y = toY(place.z) + 9 * unit + 9;
      c.strokeText(place.name, toX(place.x), y);
      c.fillText(place.name, toX(place.x), y);
    }
    const player = game.player.position;
    this.drawArrow(c, toX(player.x), toY(player.z), game.player.heading, 9 * unit);
    this.drawMapKey(c, offsetX + 10, offsetY + 12);
  }

  /**
   * The path of totality across the atlas: the band the moon's shadow sweeps on Friday, drawn from the sea to the
   * hills, with its centre line and the hour it arrives.
   */
  drawPathOfTotality(c, toX, toY, scale) {
    const from = { x: toX(-130), y: toY(CITY.depth + 40) };
    const to = { x: toX(CITY.width + 60), y: toY(40) };
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    c.save();
    c.translate(from.x, from.y);
    c.rotate(angle);
    c.fillStyle = 'rgba(23,18,43,0.2)';
    c.fillRect(0, -150 * scale, length, 300 * scale);
    c.strokeStyle = 'rgba(244,236,216,0.85)';
    c.lineWidth = Math.max(1.5, 2.4 * scale);
    c.setLineDash([14 * scale, 10 * scale]);
    for (const offset of [-150, 0, 150]) {
      c.beginPath();
      c.moveTo(0, offset * scale);
      c.lineTo(length, offset * scale);
      c.stroke();
    }
    c.setLineDash([]);
    c.fillStyle = 'rgba(244,236,216,0.95)';
    c.font = `900 ${Math.max(10, 15 * scale)}px Arial, sans-serif`;
    c.textAlign = 'center';
    c.fillText('PATH OF TOTALITY · FRIDAY 17:12', length * 0.8, -160 * scale);
    c.restore();
  }

  /** The key in the map's corner: what each kind of marker means. */
  drawMapKey(c, x, y) {
    const rows = [['#35d0ff', 'R', 'Street race'], ['#ff3b30', '☠', 'Vane bounty'], ['#ffb547', '', 'Job objective'], ['#3a7bff', '', 'Police unit']];
    c.fillStyle = 'rgba(23,18,43,0.8)';
    c.fillRect(x, y, 132, rows.length * 20 + 10);
    rows.forEach(([color, label, text], index) => {
      const rowY = y + 15 + index * 20;
      this.drawBlip(c, x + 14, rowY, { color, label }, 1.15);
      c.textAlign = 'left';
      c.font = '700 12px Arial, sans-serif';
      c.fillStyle = '#ffffff';
      c.fillText(text, x + 30, rowY + 4);
    });
    c.textAlign = 'center';
  }
}
