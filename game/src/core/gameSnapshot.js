// What a save holds: gathers every system's progress into one snapshot with a summary card for its slot,
// and puts a loaded snapshot back into the systems.
import { districtNameAt } from '../world/cityLayout.js';
import { completionPercent } from '../progression/completionTracker.js';
import { freshStats } from './saveGame.js';

/** The card a save slot shows on the start screen and in the city atlas. */
export function summarizeGame(game) {
  const p = game.player.position;
  return {
    percent: completionPercent(game), rank: game.cred.rank, title: game.cred.title(), cash: game.player.cash,
    jobs: game.missions.completed.size, district: districtNameAt(p.x, p.z), playSeconds: Math.round(game.stats.playSeconds),
  };
}

/** Everything the systems need to come back as they were: story, cred, workshop, weapons, activities and statistics. */
export function captureGame(game) {
  return {
    cash: game.player.cash, armor: game.player.armor, hour: game.sky.hour, missions: [...game.missions.completed], cred: game.cred.points,
    workshop: { ...game.workshop.levels }, weapons: game.weapons.serialize(), tokens: [...game.activities.tokens], faresDone: game.activities.faresDone,
    races: { ...game.races.best }, bounties: [...game.bounties.claimed], stats: { ...game.stats },
  };
}

/** Put a loaded save back into a world that resetWorld has just emptied. */
export function restoreGame(game, save) {
  game.missions.reset(save.missions);
  game.cred.reset(save.cred || 0);
  game.workshop.reset(save.workshop);
  game.weapons.restore(save.weapons);
  game.activities.reset(save.tokens, save.faresDone);
  game.races.reset(save.races);
  game.bounties.reset(save.bounties);
  game.stats = { ...freshStats(), ...save.stats };
  game.player.cash = save.cash;
  game.player.armor = save.armor || 0;
  game.sky.hour = save.hour;
}
