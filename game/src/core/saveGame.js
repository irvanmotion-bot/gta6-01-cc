// Saving and loading through localStorage: the game's progress under one key, the player's settings under another.
import { SAVE_KEY, SETTINGS_KEY } from './config.js';

function read(key) {
  try {
    const text = window.localStorage.getItem(key);
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

export function hasSavedGame() {
  const save = read(SAVE_KEY);
  return Boolean(save && save.version === 1);
}

export function loadSavedGame() {
  const save = read(SAVE_KEY);
  return save && save.version === 1 ? save : null;
}

export function writeSavedGame(data) {
  return write(SAVE_KEY, { version: 1, savedAt: Date.now(), ...data });
}

export function deleteSavedGame() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (error) { /* nothing to delete */ }
}

export const DEFAULT_SETTINGS = { volume: 0.8, sensitivity: 1, shadows: true, radio: true };

export function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(read(SETTINGS_KEY) || {}) };
}

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

/** The counters the pause menu's statistics page shows. */
export function freshStats() {
  return { missionsPassed: 0, missionsFailed: 0, carsStolen: 0, peopleHurt: 0, copsDowned: 0, enforcersDowned: 0, choppersDowned: 0, shotsFired: 0, maxStars: 0, earned: 0, faresDone: 0, timesBusted: 0, timesWiped: 0, playSeconds: 0 };
}
