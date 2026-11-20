// The radar in the corner and the full city map: a painted map of Solmara with blips for missions, shops and police.
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
  c.fillStyle = '#545861';
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
    c.strokeStyle = game.wanted.stars > 0 && Math.floor(game.time * 4) % 2 === 0 ? '#ff3b30' : 'rgba(10,14,22,0.9)';
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
    c.font = `900 ${Math.max(12, 20 * scale)}px Impact, "Arial Black", sans-serif`;
    c.fillStyle = '#ffffff';
    c.strokeStyle = 'rgba(10,14,22,0.85)';
    c.lineWidth = 4;
    c.lineJoin = 'round';
    for (const [text, x, z] of [['PLAYA DORADA', 80, 250], ['CENTRO ALTO', 480, 370], ['LAS COLINAS', 520, 80], ['EL MERCADO', 760, 440], ['PUERTO VIEJO', 440, 640], ['BAHÍA DEL SOL', -100, 520]]) {
      c.strokeText(text, toX(x), toY(z));
      c.fillText(text, toX(x), toY(z));
    }
    const unit = Math.max(1.2, scale * 2.4);
    const places = Object.values(LANDMARKS).map((p) => ({ x: p.x, z: p.z, color: p.color, label: p.icon }));
    for (const blip of [...places, ...this.collectBlips()]) this.drawBlip(c, toX(blip.x), toY(blip.z), blip, unit);
    const player = game.player.position;
    this.drawArrow(c, toX(player.x), toY(player.z), game.player.heading, 9 * unit);
    c.textAlign = 'left';
    c.font = `700 ${Math.max(11, 13 * scale)}px Arial, sans-serif`;
    Object.values(LANDMARKS).forEach((place, index) => {
      const y = offsetY + 18 + index * 20;
      this.drawBlip(c, 22, y, { color: place.color, label: place.icon }, 1.2);
      c.textAlign = 'left';
      c.font = '700 13px Arial, sans-serif';
      c.fillStyle = '#ffffff';
      c.fillText(place.name, 40, y + 4);
    });
  }
}
