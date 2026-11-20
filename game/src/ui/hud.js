// The heads-up display: builds every panel (job, crew, eclipse countdown, status, dispatch, weapon, vehicle, radio,
// radar) and the health bars over the gunmen, sizes them by the HUD SIZE setting, and runs the pieces that belong
// to no panel: the dialogue box with the speaker's portrait and part, banners, the feed of notifications, key
// prompts and the crosshair.
import { districtNameAt, streetNameAt } from '../world/cityLayout.js';
import { partOfSpeaker } from '../missions/storyMissions.js';
import { DomCache, createElement } from './domBuilder.js';
import { HudEclipsePanel } from './hudEclipsePanel.js';
import { HudJobPanel } from './hudJobPanel.js';
import { HudStatusPanel } from './hudStatusPanel.js';
import { HudDispatchPanel } from './hudDispatchPanel.js';
import { HudCrewPanel } from './hudCrewPanel.js';
import { HudVehiclePanel } from './hudVehiclePanel.js';
import { HudRadioPanel } from './hudRadioPanel.js';
import { HudWeaponBar } from './hudWeaponBar.js';
import { HudCombatTags } from './hudCombatTags.js';
import { drawSpeakerPortrait } from './speakerPortraits.js';

/**
 * The HUD SIZE setting. STANDARD and LARGE show every panel, smaller or larger. HUGE keeps the essentials (the job
 * and its objective, the eclipse clock, stars and cash, the radar with health and armor, the weapon, the speed)
 * and sets them more than twice as big, for a small window, a far screen or tired eyes.
 */
export const HUD_SIZES = {
  standard: { label: 'STANDARD', zoom: 0.8, essentials: false },
  large: { label: 'LARGE', zoom: 1, essentials: false },
  huge: { label: 'HUGE', zoom: 1, essentials: true },
};

export class Hud {
  constructor(game) {
    this.game = game;
    this.cache = new DomCache();
    const root = createElement('div', 'hidden', document.body);
    root.id = 'hud';
    this.root = root;
    this.size = HUD_SIZES.large;
    // The tags over the gunmen are part of the street: they go under every panel.
    this.combatTags = new HudCombatTags(game, root, this.cache);
    const left = createElement('div', 'hud-column left-column', root);
    const right = createElement('div', 'hud-column right-column', root);
    const radar = this.buildRadar(root);
    this.jobPanel = new HudJobPanel(game, left, this.cache);
    this.buildDialogue(left);
    this.eclipsePanel = new HudEclipsePanel(game, right, this.cache);
    this.statusPanel = new HudStatusPanel(game, right, this.cache, radar);
    this.dispatchPanel = new HudDispatchPanel(game, right, this.cache);
    // Bottom right: the weapon bar, with the car's dial and the radio under it at the wheel or the GPS list over
    // it on a quiet walk. The crew's bar runs along the foot of the screen between the radar and this corner.
    const corner = createElement('div', 'corner-stack', root);
    this.weaponBar = new HudWeaponBar(game, corner, this.cache);
    this.vehiclePanel = new HudVehiclePanel(game, corner, this.cache);
    this.radioPanel = new HudRadioPanel(game, corner, this.cache);
    this.crewPanel = new HudCrewPanel(game, root, this.cache);
    this.buildOverlays(root);
    this.speech = [];
    this.speechClock = 0;
    this.bannerClock = 0;
    this.hintText = '';
    this.hintClock = 0;
    this.hitClock = 0;
    this.notes = [];
    this.fitToWindow();
  }

  /** Apply the HUD SIZE setting: 'standard', 'large' or 'huge'. */
  setSize(name) {
    this.size = HUD_SIZES[name] || HUD_SIZES.large;
    this.root.classList.toggle('huge', this.size.essentials);
    this.fitToWindow();
  }

  /**
   * The panels are sized in window heights and laid out for a 16:10 frame. In a narrower window the whole HUD
   * shrinks in step, so the columns, the radar and the dialogue box never run into each other; the HUD SIZE
   * setting scales it on top of that.
   */
  fitToWindow() {
    const scale = Math.min(1, window.innerWidth / window.innerHeight / 1.6) * this.size.zoom;
    const style = this.root.style;
    style.zoom = String(scale);
    style.right = 'auto';
    style.bottom = 'auto';
    style.width = `${100 / scale}vw`;
    style.height = `${100 / scale}vh`;
  }

  /**
   * The radar block in the bottom-left corner, one frame: the minimap with the district's name across its foot,
   * the street and the clock under it, and room at the bottom for the health and armor bars. Returns the block.
   */
  buildRadar(root) {
    const radar = createElement('div', 'radar', root);
    const frame = createElement('div', 'radar-frame', radar);
    const canvas = createElement('canvas', '', frame);
    canvas.id = 'minimap';
    this.district = createElement('div', 'place-district', frame);
    const place = createElement('div', 'place-line', radar);
    this.street = createElement('span', 'place-street', place);
    this.clock = createElement('b', 'place-clock', place);
    return radar;
  }

  /** The dialogue box under the job panel: whoever is talking, their portrait, their part and their line. */
  buildDialogue(column) {
    this.dialogue = createElement('div', 'dialogue', column);
    this.portrait = createElement('canvas', 'dialogue-portrait', this.dialogue);
    this.portrait.width = 96;
    this.portrait.height = 96;
    const text = createElement('div', 'dialogue-text', this.dialogue);
    const who = createElement('div', 'dialogue-who', text);
    this.speaker = createElement('b', 'dialogue-speaker', who);
    this.part = createElement('span', 'dialogue-part', who);
    this.line = createElement('div', 'dialogue-line', text);
  }

  buildOverlays(root) {
    this.notifications = createElement('div', 'notifications', root);
    // The pop-up of a driving stunt, under the feed: its name and combo, what it paid, the combo's clock as a bar.
    this.stuntBox = createElement('div', 'stunt-popup', root);
    this.stuntTitle = createElement('b', 'stunt-title', this.stuntBox);
    this.stuntLine = createElement('span', 'stunt-line', this.stuntBox);
    this.stuntClock = createElement('u', '', createElement('i', 'stunt-clock', this.stuntBox));
    this.crosshair = createElement('div', 'crosshair', root);
    this.hintBox = createElement('div', 'hint', root);
    this.hintKey = createElement('b', 'hint-key', this.hintBox);
    this.hintLine = createElement('span', 'hint-line', this.hintBox);
    this.damageFlash = createElement('div', 'damage-flash', root);
    this.bannerBox = createElement('div', 'banner', root);
    this.bannerTitle = createElement('div', 'banner-title', this.bannerBox);
    this.bannerSub = createElement('div', 'banner-sub', this.bannerBox);
    this.downScreen = createElement('div', 'down-screen', document.body);
    this.downTitle = createElement('div', 'down-title', this.downScreen);
    this.downSub = createElement('div', 'down-sub', this.downScreen);
  }

  setVisible(visible) {
    this.root.classList.toggle('hidden', !visible);
  }

  /**
   * A short line in the feed at the top of the screen: pickups, purchases, cred, police radio. A line lives a few
   * seconds of the game's own time, so a paused game holds the feed still.
   */
  notify(message) {
    const line = createElement('div', 'note', null, message);
    this.notifications.prepend(line);
    this.notes.unshift({ line, age: 0 });
    while (this.notes.length > NOTE_LIMIT) this.notes.pop().line.remove();
  }

  /** Empty the feed at once: a new game, a load. */
  clearFeed() {
    for (const note of this.notes) note.line.remove();
    this.notes.length = 0;
  }

  /** Age the feed: a line fades after a few seconds and is gone a moment later. */
  ageNotes(dt) {
    for (let index = this.notes.length - 1; index >= 0; index -= 1) {
      const note = this.notes[index];
      note.age += dt;
      if (note.age > NOTE_SECONDS) note.line.classList.add('gone');
      if (note.age > NOTE_SECONDS + 0.7) { note.line.remove(); this.notes.splice(index, 1); }
    }
  }

  /** The big centred title of a job start, pass or fail. */
  banner(title, subtitle, color) {
    this.bannerTitle.textContent = title;
    this.bannerTitle.style.color = color;
    this.bannerSub.textContent = subtitle;
    this.bannerBox.classList.add('visible');
    this.bannerClock = 4.2;
  }

  /** Queue a line of dialogue; lines play one after another in the dialogue box, each with its speaker's portrait. */
  say(speaker, line, color) {
    this.speech.push({ speaker, line, color });
  }

  clearSpeech() {
    this.speech.length = 0;
    this.speechClock = 0;
    this.dialogue.classList.remove('visible');
  }

  /** A prompt that shows for as long as a system keeps asking for it each frame. */
  hint(message) {
    this.hintText = message;
    this.hintClock = 0.15;
  }

  /** Write a prompt into its box; "Press F to steal the Duna" becomes a key cap F beside STEAL THE DUNA. */
  showHint(message) {
    const cache = this.cache;
    const press = /^Press (\w) (?:to |for )?(.*)$/.exec(message);
    cache.toggle(this.hintBox, 'keyed', Boolean(press));
    cache.text(this.hintKey, press ? press[1] : '');
    cache.text(this.hintLine, press ? press[2].toUpperCase() : message);
  }

  hitMarker() {
    this.hitClock = 0.12;
  }

  showVehicleName(name, kind) {
    this.notify(`${name} · ${kind}`);
  }

  showRadio(station) {
    this.notify(station.bpm > 0 ? `♪ ${station.name} ${station.band} · ${station.dj} · ${station.host}` : '♪ Radio off');
  }

  /** The full-screen card when Nova is taken down or arrested. */
  showDown(title, subtitle) {
    this.downTitle.textContent = title;
    this.downSub.textContent = subtitle;
    this.downScreen.classList.add('visible');
  }

  hideDown() {
    this.downScreen.classList.remove('visible');
  }

  /** Show the next queued line of dialogue when the current one has had its time. */
  advanceDialogue(dt) {
    this.speechClock -= dt;
    if (this.speechClock > 0) return;
    const next = this.speech.shift();
    if (!next) { this.dialogue.classList.remove('visible'); return; }
    drawSpeakerPortrait(this.portrait, next.speaker, next.color);
    this.speaker.textContent = next.speaker;
    this.speaker.style.color = next.color;
    this.part.textContent = partOfSpeaker(next.speaker);
    this.line.textContent = next.line;
    this.dialogue.style.borderColor = next.color;
    this.dialogue.classList.add('visible');
    this.speechClock = 2.2 + next.line.length * 0.045;
  }

  update(dt) {
    const game = this.game;
    const cache = this.cache;
    const player = game.player;
    this.jobPanel.update(dt);
    this.eclipsePanel.update(dt);
    this.statusPanel.update(dt);
    this.dispatchPanel.update(dt);
    this.crewPanel.update(dt);
    this.weaponBar.update(dt);
    this.vehiclePanel.update(dt);
    this.radioPanel.update(dt);
    this.combatTags.update(dt);
    cache.text(this.clock, `${game.calendar.dayName()} ${game.calendar.clockText()}`);
    cache.text(this.district, districtNameAt(player.position.x, player.position.z).toUpperCase());
    cache.text(this.street, streetNameAt(player.position.x, player.position.z).toUpperCase());
    cache.toggle(this.root, 'driving', Boolean(player.vehicle));
    const stunt = game.stunts.popup();
    cache.toggle(this.stuntBox, 'visible', stunt !== null);
    if (stunt) {
      cache.text(this.stuntTitle, stunt.title);
      cache.text(this.stuntLine, stunt.line);
      cache.width(this.stuntClock, stunt.share);
    }

    cache.toggle(this.crosshair, 'visible', !player.vehicle && (player.aiming || game.weapons.current !== 'fists'));
    this.hitClock -= dt;
    cache.toggle(this.crosshair, 'hit', this.hitClock > 0);
    cache.toggle(this.damageFlash, 'visible', player.hurtFlash > 0);
    this.hintClock -= dt;
    cache.toggle(this.hintBox, 'visible', this.hintClock > 0);
    if (this.hintClock > 0) this.showHint(this.hintText);
    if (this.bannerClock > 0) {
      this.bannerClock -= dt;
      if (this.bannerClock <= 0) this.bannerBox.classList.remove('visible');
    }
    this.ageNotes(dt);
    this.advanceDialogue(dt);
  }
}

/** How many lines the feed holds, and how many seconds of play each stays. */
const NOTE_LIMIT = 3;
const NOTE_SECONDS = 4;
