// Every texture in the game is painted here on a canvas at load: facades, their night windows, signs and billboards.
import * as THREE from 'three';
import { SeededRandom } from '../core/random.js';

const BAYS = 4;
const FLOORS = 4;
const SIZE = 256;

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function textureOf(canvas, repeat = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** Window rectangles, as fractions of one bay, for each facade style. */
const FACADE_STYLES = {
  hotel: { wall: '#ffffff', window: [0.14, 0.2, 0.72, 0.56], balcony: true, glass: ['#4f7fa0', '#b4dcee'] },
  office: { wall: '#f2f6f8', window: [0.05, 0.08, 0.9, 0.84], balcony: false, glass: ['#3f86ad', '#d2f3fa'] },
  shop: { wall: '#ffffff', window: [0.2, 0.22, 0.6, 0.5], balcony: false, glass: ['#46678a', '#9cc3dc'] },
  house: { wall: '#ffffff', window: [0.3, 0.3, 0.4, 0.42], balcony: false, glass: ['#34495e', '#86a8bd'] },
  warehouse: { wall: '#ffffff', window: null, balcony: false, glass: null },
};

/** The day texture (white walls a building's tint colours) and the matching night-window glow of one style. */
export function createFacadeTextures(style, seed) {
  const spec = FACADE_STYLES[style];
  const rng = new SeededRandom(seed);
  const day = canvasOf(SIZE, SIZE);
  const night = canvasOf(SIZE, SIZE);
  const d = day.getContext('2d');
  const n = night.getContext('2d');
  d.fillStyle = spec.wall;
  d.fillRect(0, 0, SIZE, SIZE);
  n.fillStyle = '#000';
  n.fillRect(0, 0, SIZE, SIZE);
  const bay = SIZE / BAYS;
  const floor = SIZE / FLOORS;
  if (!spec.window) {
    d.strokeStyle = 'rgba(0,0,0,0.13)';
    d.lineWidth = 2;
    for (let x = 4; x < SIZE; x += 8) { d.beginPath(); d.moveTo(x, 0); d.lineTo(x, SIZE); d.stroke(); }
    d.fillStyle = 'rgba(0,0,0,0.18)';
    d.fillRect(0, SIZE - 10, SIZE, 10);
    return { day: textureOf(day), night: textureOf(night) };
  }
  for (let fy = 0; fy < FLOORS; fy += 1) {
    d.fillStyle = 'rgba(0,0,0,0.10)';
    d.fillRect(0, fy * floor, SIZE, 3);
    for (let bx = 0; bx < BAYS; bx += 1) {
      const [wx, wy, ww, wh] = spec.window;
      const x = bx * bay + wx * bay;
      const y = fy * floor + wy * floor;
      const gradient = d.createLinearGradient(x, y, x + ww * bay, y + wh * floor);
      gradient.addColorStop(0, spec.glass[1]);
      gradient.addColorStop(0.55, spec.glass[0]);
      gradient.addColorStop(1, spec.glass[0]);
      d.fillStyle = gradient;
      d.fillRect(x, y, ww * bay, wh * floor);
      d.fillStyle = 'rgba(255,255,255,0.22)';
      d.fillRect(x + ww * bay * 0.12, y, ww * bay * 0.14, wh * floor);
      d.strokeStyle = 'rgba(20,30,40,0.55)';
      d.lineWidth = 2;
      d.strokeRect(x, y, ww * bay, wh * floor);
      if (spec.balcony) {
        d.fillStyle = 'rgba(0,0,0,0.22)';
        d.fillRect(bx * bay + 4, y + wh * floor + 2, bay - 8, 5);
      }
      if (rng.chance(0.42)) {
        n.fillStyle = rng.pick(['#ffd98a', '#ffe9b8', '#ffc56b', '#bfe6ff']);
        n.fillRect(x, y, ww * bay, wh * floor);
      }
    }
  }
  return { day: textureOf(day), night: textureOf(night) };
}

/** A shop or landmark sign: bold lettering on a coloured board. */
export function createSignTexture(text, background, foreground = '#ffffff', subtitle = '') {
  const canvas = canvasOf(512, 128);
  const c = canvas.getContext('2d');
  c.fillStyle = background;
  c.fillRect(0, 0, 512, 128);
  c.strokeStyle = foreground;
  c.lineWidth = 6;
  c.strokeRect(7, 7, 498, 114);
  c.fillStyle = foreground;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  let size = 70;
  c.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  while (c.measureText(text).width > 460 && size > 20) {
    size -= 4;
    c.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  }
  c.fillText(text, 256, subtitle ? 52 : 66);
  if (subtitle) {
    c.font = '700 24px Arial, sans-serif';
    c.fillText(subtitle, 256, 100);
  }
  return textureOf(canvas, false);
}

/** A rooftop billboard for one of Solmara's own brands. */
export function createBillboardTexture(brand) {
  const canvas = canvasOf(512, 256);
  const c = canvas.getContext('2d');
  const gradient = c.createLinearGradient(0, 0, 512, 256);
  gradient.addColorStop(0, brand.colors[0]);
  gradient.addColorStop(1, brand.colors[1]);
  c.fillStyle = gradient;
  c.fillRect(0, 0, 512, 256);
  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.beginPath();
  c.arc(410, 70, 120, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = brand.ink;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.font = '900 84px Impact, "Arial Black", sans-serif';
  c.fillText(brand.name, 28, 104);
  c.font = 'italic 700 32px Georgia, serif';
  c.fillText(brand.slogan, 30, 196);
  return textureOf(canvas, false);
}

/** A soft round dot for particles and glows. */
export function createGlowTexture() {
  const canvas = canvasOf(64, 64);
  const c = canvas.getContext('2d');
  const gradient = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gradient;
  c.fillRect(0, 0, 64, 64);
  return textureOf(canvas, false);
}

/** The metres one repeat of a facade texture covers: four bays wide, four floors tall. */
export const FACADE_TILE = { hotel: [16, 13.2], office: [14, 14.4], shop: [18, 14], house: [14, 11], warehouse: [10, 10] };
