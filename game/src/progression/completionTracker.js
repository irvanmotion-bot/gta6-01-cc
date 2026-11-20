// Completion: how much of Solmara Heat a save has done, as one percentage and the rows behind it
// (story jobs, street races, bounties, Sun Tokens, taxi fares, workshop tiers) for the map screen and save cards.
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { STREET_RACES } from '../activities/streetRaces.js';
import { MARLIN_CAPOS } from '../activities/marlinBounties.js';

/** Each part of the game with how much of it is done and how much it weighs in the total. */
export function completionRows(game) {
  return [
    { label: 'Story jobs', done: game.missions.completed.size, total: STORY_MISSIONS.length, weight: 50 },
    { label: 'Street races won', done: game.races.winsCount(), total: STREET_RACES.length, weight: 12 },
    { label: 'Marlin bounties', done: game.bounties.claimed.size, total: MARLIN_CAPOS.length, weight: 12 },
    { label: 'Sun Tokens', done: game.activities.tokens.size, total: TOKEN_TOTAL, weight: 10 },
    { label: 'Taxi fares', done: Math.min(game.activities.faresDone, FARE_GOAL), total: FARE_GOAL, weight: 8 },
    { label: 'Workshop tiers', done: game.workshop.totalLevels(), total: 12, weight: 8 },
  ];
}

/** The whole game as a percentage, 0 to 100. */
export function completionPercent(game) {
  let earned = 0;
  for (const row of completionRows(game)) earned += (row.done / row.total) * row.weight;
  return Math.round(earned);
}

const TOKEN_TOTAL = 12;
const FARE_GOAL = 10;
