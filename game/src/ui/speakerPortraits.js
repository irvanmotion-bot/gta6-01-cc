// Paints the dialogue box's portraits on a canvas: each speaker of the story as a blocky bust in the game's own
// low-poly style, so a line of dialogue shows who is talking.

/** Draw the bust of `speaker` (a name as hud.say receives it) into a square canvas. */
export function drawSpeakerPortrait(canvas, speaker, accent) {
  const look = PORTRAIT_LOOKS[speaker] || { ...PORTRAIT_LOOKS.DEFAULT, shirt: accent };
  const size = canvas.width;
  const c = canvas.getContext('2d');
  const u = size / 16;
  const box = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(Math.round(x * u), Math.round(y * u), Math.round(w * u), Math.round(h * u)); };
  const gradient = c.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, look.sky);
  gradient.addColorStop(1, '#101623');
  c.fillStyle = gradient;
  c.fillRect(0, 0, size, size);
  box(2, 11.5, 12, 4.5, look.shirt);
  if (look.jacket) { box(2, 11.5, 3.4, 4.5, look.jacket); box(10.6, 11.5, 3.4, 4.5, look.jacket); }
  box(6.6, 9.8, 2.8, 2.2, shadeOf(look.skin, 0.82));
  box(4.6, 3.6, 6.8, 6.8, look.skin);
  box(4.2, 2.2, 7.6, 2.6, look.hair);
  box(4.2, 2.2, 1.3, look.longHair ? 8 : 4.2, look.hair);
  box(10.5, 2.2, 1.3, look.longHair ? 8 : 4.2, look.hair);
  if (look.hat) { box(3.6, 1.4, 8.8, 1.9, look.hat); box(3, 3.1, 10, 0.8, look.hat); }
  box(5.8, 6.2, 1.5, 1, '#10131a');
  box(8.7, 6.2, 1.5, 1, '#10131a');
  if (look.shades) box(5.2, 5.8, 5.6, 1.6, '#0b0d12');
  box(6.6, 8.6, 2.8, 0.6, look.mouth || '#7a2e2e');
  if (look.moustache) box(6, 7.8, 4, 0.8, look.hair);
  if (look.headset) { box(3.4, 5, 1.2, 3, '#22262e'); box(11.4, 5, 1.2, 3, '#22262e'); box(3.4, 1.6, 9.2, 0.8, '#22262e'); }
  c.strokeStyle = accent;
  c.lineWidth = Math.max(2, u * 0.7);
  c.strokeRect(c.lineWidth / 2, c.lineWidth / 2, size - c.lineWidth, size - c.lineWidth);
}

function shadeOf(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const part = (shift) => Math.round(((value >> shift) & 255) * amount).toString(16).padStart(2, '0');
  return `#${part(16)}${part(8)}${part(0)}`;
}

/** How each speaker looks: the same colours their 3D model wears, plus what tells them apart at a glance. */
const PORTRAIT_LOOKS = {
  NOVA: { skin: '#c68642', hair: '#2a1a12', shirt: '#ff5e5b', jacket: '#1fb5a6', sky: '#ff8a5b', longHair: true },
  'TÍO BRAVO': { skin: '#b97a45', hair: '#d9d9d9', shirt: '#f39c12', jacket: '#3b2a1a', sky: '#c9862c', moustache: true, hat: '#3b2a1a' },
  JAZZ: { skin: '#8d5524', hair: '#ff7eb6', shirt: '#7a2bbf', sky: '#e84393', longHair: true, headset: true, mouth: '#d1335b' },
  'DOC INÉS': { skin: '#e0ac69', hair: '#e8e8e8', shirt: '#eafff8', jacket: '#7be0c3', sky: '#2bb673' },
  'SILAS MARLIN': { skin: '#f1c9a5', hair: '#1b1b1b', shirt: '#f2e9dc', jacket: '#d8c06a', sky: '#5b4a16', shades: true },
  FARE: { skin: '#e0ac69', hair: '#3b2314', shirt: '#ffcc00', sky: '#b98b00' },
  DISPATCH: { skin: '#e0ac69', hair: '#16203a', shirt: '#2e4a7d', sky: '#2e6fd8', hat: '#16203a', headset: true },
  DEFAULT: { skin: '#e0ac69', hair: '#1b1b1b', shirt: '#888888', sky: '#3a4660' },
};
