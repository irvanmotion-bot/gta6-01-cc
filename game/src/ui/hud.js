// The heads-up display: wanted stars, cash, health and armor, weapon, clock, objective, subtitles, banners and hints.
import { districtNameAt, streetNameAt } from '../world/cityLayout.js';

const byId = (id) => document.getElementById(id);

export class Hud {
  constructor(game) {
    this.game = game;
    this.root = byId('hud');
    this.el = {};
    for (const id of ['wanted-stars', 'cash', 'weapon-name', 'weapon-ammo', 'health-bar', 'armor-bar', 'clock', 'mission-panel', 'mission-title',
      'mission-objective', 'mission-timer', 'district-name', 'street-name', 'speedometer', 'speed-value', 'vehicle-name', 'radio-station', 'crosshair',
      'subtitles', 'notifications', 'hint', 'banner', 'banner-title', 'banner-sub', 'damage-flash', 'down-screen', 'down-title', 'down-sub']) {
      this.el[id] = byId(id);
    }
    this.el['wanted-stars'].innerHTML = '<i>★</i><i>★</i><i>★</i><i>★</i><i>★</i>';
    this.cache = {};
    this.speech = [];
    this.speechClock = 0;
    this.bannerClock = 0;
    this.hintText = '';
    this.hintClock = 0;
    this.hitClock = 0;
    this.vehicleClock = 0;
    this.shownCash = 0;
  }

  /** Write text into an element only when it changed, so the DOM is left alone on most frames. */
  text(id, value) {
    if (this.cache[id] === value) return;
    this.cache[id] = value;
    this.el[id].textContent = value;
  }

  toggle(id, name, on) {
    const key = `${id}.${name}`;
    if (this.cache[key] === on) return;
    this.cache[key] = on;
    this.el[id].classList.toggle(name, on);
  }

  setVisible(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  /** A short line that slides in under the cash and fades: pickups, purchases, small news. */
  notify(message) {
    const line = document.createElement('div');
    line.className = 'note';
    line.textContent = message;
    this.el.notifications.prepend(line);
    while (this.el.notifications.children.length > 4) this.el.notifications.lastChild.remove();
    setTimeout(() => line.classList.add('gone'), 3600);
    setTimeout(() => line.remove(), 4300);
  }

  /** The big centred title of a mission start, pass or fail. */
  banner(title, subtitle, color) {
    this.el['banner-title'].textContent = title;
    this.el['banner-title'].style.color = color;
    this.el['banner-sub'].textContent = subtitle;
    this.el.banner.classList.add('visible');
    this.bannerClock = 4.2;
  }

  /** Queue a line of dialogue; lines play one after another at the bottom of the screen. */
  say(speaker, line, color) {
    this.speech.push({ speaker, line, color });
  }

  clearSpeech() {
    this.speech.length = 0;
    this.speechClock = 0;
    this.el.subtitles.classList.remove('visible');
  }

  /** A prompt that shows for as long as a system keeps asking for it each frame. */
  hint(message) {
    this.hintText = message;
    this.hintClock = 0.15;
  }

  hitMarker() {
    this.hitClock = 0.12;
  }

  showVehicleName(name, kind) {
    this.text('vehicle-name', `${name} · ${kind}`);
    this.vehicleClock = 4;
  }

  showRadio(station) {
    this.text('radio-station', station.host ? `♪ ${station.name} — ${station.host}` : `♪ ${station.name}`);
    this.radioClock = 4;
  }

  /** The full-screen card when Nova is taken down or arrested. */
  showDown(title, subtitle) {
    this.el['down-title'].textContent = title;
    this.el['down-sub'].textContent = subtitle;
    this.el['down-screen'].classList.add('visible');
  }

  hideDown() {
    this.el['down-screen'].classList.remove('visible');
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    const wanted = game.wanted;
    const stars = this.el['wanted-stars'].children;
    const blink = wanted.evading && Math.floor(game.time * 4) % 2 === 0;
    for (let index = 0; index < 5; index += 1) {
      const on = index < wanted.stars && !blink;
      if (stars[index].classList.contains('on') !== on) stars[index].classList.toggle('on', on);
    }
    this.toggle('wanted-stars', 'active', wanted.stars > 0);

    this.shownCash += (player.cash - this.shownCash) * Math.min(1, dt * 8);
    if (Math.abs(player.cash - this.shownCash) < 1) this.shownCash = player.cash;
    this.text('cash', `$${Math.round(this.shownCash).toLocaleString('en-US')}`);
    const weapon = game.weapons.status();
    this.text('weapon-name', weapon.name);
    this.text('weapon-ammo', weapon.ammo);
    const health = `${Math.max(0, Math.round(player.health))}%`;
    if (this.cache.health !== health) { this.cache.health = health; this.el['health-bar'].firstElementChild.style.width = health; }
    const armor = `${Math.round(player.armor)}%`;
    if (this.cache.armor !== armor) { this.cache.armor = armor; this.el['armor-bar'].firstElementChild.style.width = armor; }
    this.toggle('health-bar', 'low', player.health < 30);
    this.text('clock', game.sky.clockText());
    this.text('district-name', districtNameAt(player.position.x, player.position.z));
    this.text('street-name', streetNameAt(player.position.x, player.position.z));

    const mission = game.missions.active;
    const objective = mission ? game.missions.objectiveText() : game.activities.objectiveText();
    const timer = mission ? mission.timer : game.activities.timer();
    this.toggle('mission-panel', 'visible', Boolean(objective));
    this.text('mission-title', mission ? mission.mission.title.toUpperCase() : 'SOL CAB');
    this.text('mission-objective', objective);
    this.text('mission-timer', timer === null ? '' : `${Math.floor(timer / 60)}:${String(Math.floor(timer % 60)).padStart(2, '0')}`);
    this.toggle('mission-timer', 'urgent', timer !== null && timer < 20);

    const vehicle = player.vehicle;
    this.toggle('speedometer', 'visible', Boolean(vehicle));
    if (vehicle) this.text('speed-value', String(Math.round(Math.abs(vehicle.speed) * 3.6)));
    this.vehicleClock -= dt;
    this.radioClock -= dt;
    this.toggle('vehicle-name', 'visible', this.vehicleClock > 0);
    this.toggle('radio-station', 'visible', this.radioClock > 0);
    this.toggle('crosshair', 'visible', !vehicle && (player.aiming || game.weapons.current !== 'fists'));
    this.hitClock -= dt;
    this.toggle('crosshair', 'hit', this.hitClock > 0);
    this.toggle('damage-flash', 'visible', player.hurtFlash > 0);

    this.hintClock -= dt;
    this.toggle('hint', 'visible', this.hintClock > 0);
    if (this.hintClock > 0) this.text('hint', this.hintText);
    if (this.bannerClock > 0) {
      this.bannerClock -= dt;
      if (this.bannerClock <= 0) this.el.banner.classList.remove('visible');
    }
    this.speechClock -= dt;
    if (this.speechClock <= 0) {
      const next = this.speech.shift();
      if (next) {
        this.el.subtitles.innerHTML = '';
        const who = document.createElement('b');
        who.textContent = `${next.speaker}: `;
        who.style.color = next.color;
        this.el.subtitles.append(who, next.line);
        this.el.subtitles.classList.add('visible');
        this.speechClock = 2.2 + next.line.length * 0.045;
      } else {
        this.el.subtitles.classList.remove('visible');
      }
    }
  }
}
