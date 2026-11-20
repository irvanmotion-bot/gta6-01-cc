// Saving and loading through localStorage: three save slots with a summary card each, and the player's settings.
import { RETIRED_KEYS, SAVE_KEY, SETTINGS_KEY } from './config.js';

export const SAVE_SLOT_COUNT = 3;

/** Move saves and settings an earlier build left under its own keys to today's keys, once, and drop the old ones. */
export function migrateRetiredSaves() {
  try {
    const store = window.localStorage;
    const moves = [[RETIRED_KEYS.settings, SETTINGS_KEY]];
    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) moves.push([`${RETIRED_KEYS.save}-slot-${slot}`, slotKey(slot)]);
    for (const [from, to] of moves) {
      const old = store.getItem(from);
      if (old === null) continue;
      if (store.getItem(to) === null) store.setItem(to, old);
      store.removeItem(from);
    }
  } catch (error) { /* storage is blocked: there is nothing to move */ }
}

/** The summary of every slot, for the start screen's cards and the map screen: null where nothing is saved. */
export function listSaveSlots() {
  const slots = [];
  for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) {
    const save = loadSaveSlot(slot);
    slots.push(save ? { slot, savedAt: save.savedAt, ...save.summary } : null);
  }
  return slots;
}

/** The slot saved most recently, or 0 when every slot is empty: what CONTINUE loads. */
export function latestSaveSlot() {
  let latest = 0;
  let newest = 0;
  listSaveSlots().forEach((card) => {
    if (card && card.savedAt > newest) { newest = card.savedAt; latest = card.slot; }
  });
  return latest;
}

/** The first empty slot, or the oldest one when all three are taken: where NEW GAME goes by default. */
export function freeSaveSlot() {
  const cards = listSaveSlots();
  const empty = cards.findIndex((card) => card === null);
  if (empty !== -1) return empty + 1;
  return cards.reduce((oldest, card) => (card.savedAt < oldest.savedAt ? card : oldest)).slot;
}

export function loadSaveSlot(slot) {
  const save = readStored(slotKey(slot));
  return save && save.version === SAVE_VERSION ? save : null;
}

/** Write a slot: `summary` is the card (rank, cash, completion, time played), `data` is everything the systems restore. */
export function writeSaveSlot(slot, summary, data) {
  return writeStored(slotKey(slot), { version: SAVE_VERSION, savedAt: Date.now(), summary, ...data });
}

export function deleteSaveSlot(slot) {
  try { window.localStorage.removeItem(slotKey(slot)); } catch (error) { /* nothing to delete */ }
}

/**
 * The player's settings: sound, mouse and shadows; `bloom` spreads the brightest light of the frame into a glow and
 * `sunShafts` lays rays of the low sun over it; `hudSize` is the HUD SIZE (standard, large, or huge with only the
 * essentials); `renderScale` draws the city at more pixels than the window has and scales it down, for smoother edges.
 */
export const DEFAULT_SETTINGS = { volume: 0.8, sensitivity: 1, shadows: true, bloom: true, sunShafts: true, radio: true, hudSize: 'standard', renderScale: 1 };

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(readStored(SETTINGS_KEY) || {}) };
}

export function saveSettings(settings) {
  writeStored(SETTINGS_KEY, settings);
}

/** The counters the statistics pages show. */
export function freshStats() {
  return {
    missionsPassed: 0, missionsFailed: 0, carsStolen: 0, peopleHurt: 0, copsDowned: 0, enforcersDowned: 0, choppersDowned: 0, shotsFired: 0,
    maxStars: 0, escapes: 0, earned: 0, spent: 0, faresDone: 0, racesRun: 0, racesWon: 0, bountiesClaimed: 0, favorsUsed: 0, metresDriven: 0,
    timesBusted: 0, timesWiped: 0, playSeconds: 0,
  };
}

const SAVE_VERSION = 2;

function slotKey(slot) {
  return `${SAVE_KEY}-slot-${slot}`;
}

function readStored(key) {
  try {
    const text = window.localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}
