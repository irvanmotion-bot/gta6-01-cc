// The radar in the corner and the full city map: a painted map of Saros with blips for missions, shops and police,
// and, on the atlas, the path the moon's shadow takes across the city.
import { CITY } from '../core/config.js';
import { blockRect, districtOfBlock, DISTRICTS, LANDMARKS, AVENUES, STREETS } from '../world/cityLayout.js';

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
    for (const vehicle of game.vehicles.list) {
      if (vehicle.spec.police && !vehicle.dead && vehicle.siren) blips.push({ x: vehicle.position.x, z: vehicle.position.z, color: flash ? '#ff3b30' : '#3a7bff', label: '', size: 1.25 });
    }
    for (const gunman of game.gunmen.list) {
      if (gunman.alive && gunman.faction === 'police') blips.push({ x: gunman.position.x, z: gunman.position.z, color: flash ? '#3a7bff' : '#ff3b30', label: '', size: 0.8 });
    }
    const chopper = game.police.helicopter;
    if (chopper.active) blips.push({ x: chopper.mesh.position.x, z: chopper.mesh.position.z, color: '#ffffff', label: '✕', size: 1.3 });
    return blips;
  }

  /** The round radar: the map turns with the camera so that ahead is always up. */
  draw() {
    const game = this.game;
    const canvas = this.canvas;
    const size = canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2);
    if (size < 8) return;
    if (canvas.width !== Math.round(size)) { canvas.width = Math.round(size); canvas.height = Math.round(size); }
    const c = this.context;
    const half = canvas.width / 2;
    const player = game.player;
    const vehicle = player.vehicle;
    const targetZoom = vehicle ? 0.85 - Math.min(Math.abs(vehicle.speed) / 60, 1) * 0.3 : 1.05;
    this.zoom += (targetZoom - this.zoom) * 0.05;
    const scale = (this.zoom * canvas.width) / 220;
    const angle = game.camera.yaw - Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.beginPath();
    c.arc(half, half, half - 2, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#2f9fcb';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.translate(half, half);
    c.rotate(angle);
    c.scale(scale, scale);
    c.drawImage(this.cityMap, MAP_MIN_X - player.position.x, MAP_MIN_Z - player.position.z);
    c.restore();

    const unit = canvas.width / 220;
    const edge = half - 12 * unit;
    for (const blip of this.collectBlips()) {
      const dx = (blip.x - player.position.x) * scale;
      const dz = (blip.z - player.position.z) * scale;
      let x = dx * cos - dz * sin;
      let y = dx * sin + dz * cos;
      const distance = Math.hypot(x, y);
      if (distance > edge) {
        if (!blip.pinned) continue;
        x *= edge / distance;
        y *= edge / distance;
      }
      this.drawBlip(c, half + x, half + y, blip, unit);
    }
    // North marker on the rim, and the player's arrow in the middle.
    c.fillStyle = '#ffffff';
    c.font = `900 ${13 * unit}px Arial, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('N', half + sin * (half - 11 * unit), half - cos * (half - 11 * unit));
    this.drawArrow(c, half, half, player.heading - angle, 9 * unit);
    c.lineWidth = 4 * unit;
    c.strokeStyle = game.wanted.stars > 0 && Math.floor(game.time * 4) % 2 === 0 ? '#ff6a4d' : 'rgba(23,18,43,0.9)';
    c.beginPath();
    c.arc(half, half, half - 2 * unit, 0, Math.PI * 2);
    c.stroke();
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
