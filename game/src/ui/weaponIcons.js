// Silhouettes of the five weapons, drawn on a canvas for the HUD's weapon bar and the gun counter: a fist, the
// Viper 9 pistol, the Hornet SMG, the Boomstick 12 shotgun and the Longshot AR rifle.

/** Each silhouette is a list of filled polygons on a 96 by 48 grid, muzzle to the right. */
const SILHOUETTES = {
  fists: [
    [[30, 14], [62, 12], [68, 18], [68, 34], [60, 40], [34, 40], [28, 32]],
    [[20, 22], [30, 20], [30, 34], [22, 34]],
    [[34, 8], [42, 8], [42, 14], [34, 14]], [[44, 7], [52, 7], [52, 13], [44, 13]], [[54, 8], [62, 8], [62, 13], [54, 13]],
  ],
  pistol: [
    [[22, 14], [76, 14], [76, 24], [22, 24]],
    [[24, 24], [42, 24], [36, 44], [22, 44]],
    [[42, 24], [54, 24], [52, 30], [44, 32]],
    [[76, 16], [82, 16], [82, 21], [76, 21]],
  ],
  smg: [
    [[18, 14], [70, 14], [70, 26], [18, 26]],
    [[70, 17], [90, 17], [90, 22], [70, 22]],
    [[24, 26], [36, 26], [30, 42], [20, 42]],
    [[46, 26], [56, 26], [56, 46], [46, 46]],
    [[4, 12], [18, 14], [18, 19], [4, 18]],
  ],
  shotgun: [
    [[30, 15], [94, 15], [94, 21], [30, 21]],
    [[44, 22], [78, 22], [78, 28], [44, 28]],
    [[2, 22], [22, 15], [32, 15], [32, 25], [16, 30], [4, 34]],
    [[28, 24], [38, 24], [34, 36], [26, 36]],
  ],
  rifle: [
    [[22, 15], [70, 15], [70, 25], [22, 25]],
    [[70, 18], [94, 18], [94, 22], [70, 22]],
    [[2, 16], [22, 17], [22, 25], [2, 30]],
    [[28, 25], [38, 25], [32, 40], [24, 40]],
    [[46, 25], [58, 25], [62, 44], [52, 44]],
    [[36, 8], [58, 8], [58, 13], [36, 13]],
  ],
};

export const WEAPON_ICON_SIZE = { width: 96, height: 48 };

/** Fill a canvas with one weapon's silhouette in a colour. */
export function drawWeaponIcon(canvas, weaponId, color) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.scale(canvas.width / WEAPON_ICON_SIZE.width, canvas.height / WEAPON_ICON_SIZE.height);
  context.fillStyle = color;
  for (const polygon of SILHOUETTES[weaponId] || SILHOUETTES.fists) {
    context.beginPath();
    polygon.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
    context.closePath();
    context.fill();
  }
  context.restore();
}
