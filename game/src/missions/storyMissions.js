// The story of Solmara Heat as data: six missions, their dialogue and the steps the mission director runs.
import { CITY } from '../core/config.js';
import { blockRect, kerbSpot, LANDMARKS } from '../world/cityLayout.js';

const P = CITY.pitch;

/** A spot on one sidewalk of block (i, j): side 'n', 's', 'e' or 'w', `t` of the way along it. */
function sidewalk(i, j, side, t) {
  const r = blockRect(i, j);
  if (side === 'n') return [r.minX + (r.maxX - r.minX) * t, r.minZ + 1.6];
  if (side === 's') return [r.minX + (r.maxX - r.minX) * t, r.maxZ - 1.6];
  if (side === 'w') return [r.minX + 1.6, r.minZ + (r.maxZ - r.minZ) * t];
  return [r.maxX - 1.6, r.minZ + (r.maxZ - r.minZ) * t];
}

function kerb(i, j, t = 0.5) {
  const spot = kerbSpot(i, j, t);
  return [spot.x, spot.z];
}

const node = (i, j) => [i * P, j * P];
const L = LANDMARKS;

export const CHARACTERS = {
  nova: { name: 'NOVA', color: '#ff7b6b' },
  bravo: { name: 'TÍO BRAVO', color: '#f6b042' },
  jazz: { name: 'JAZZ', color: '#f062b0' },
  marlin: { name: 'SILAS MARLIN', color: '#d8c06a' },
};

/**
 * Each mission: who gives it and where, what it needs done first, its reward and its steps.
 * Step kinds are run by missionDirector.js: say, give, steal, deliver, goto, collect, race, eliminate, loseCops, wait.
 */
export const STORY_MISSIONS = [
  {
    id: 'homecoming', title: 'Homecoming', giver: 'bravo', at: L.garage, requires: [], reward: 600,
    brief: 'Three years gone and Solmara still owes you. Tío Bravo has a welcome-back job.',
    steps: [
      { kind: 'say', lines: [['bravo', 'Nova Reyes. Three years and you still walk like you own the street.'], ['nova', 'I need work, Tío. Mateo owes Marlin forty grand.'], ['bravo', 'Then start small. A gold Estela sits at Playa Parking. Bring it to me.']] },
      { kind: 'steal', model: 'estela', paint: '#d4a72c', at: kerb(0, 3), heading: -Math.PI / 2, text: 'Steal the gold ESTELA at Playa Parking', textIn: 'You have the Estela' },
      { kind: 'deliver', at: [L.garage.kerb.x, L.garage.kerb.z], text: 'Deliver the Estela to BRAVO MOTORS in one piece' },
      { kind: 'give', weapon: 'pistol', ammo: 60 },
      { kind: 'say', lines: [['bravo', 'Clean. Take this Viper 9. Marlin\'s people do not ask twice.']] },
    ],
  },
  {
    id: 'hotPlates', title: 'Hot Plates', giver: 'jazz', at: L.radio, requires: ['homecoming'], reward: 900,
    brief: 'Jazz runs Tidewave FM and half the gossip in town. Her couriers keep getting robbed.',
    steps: [
      { kind: 'say', lines: [['jazz', 'You are Bravo\'s driver? Five packages, all over El Mercado. Marlin\'s boys are sniffing.'], ['nova', 'How long do I have?'], ['jazz', 'Until the record ends, baby. Two and a half minutes.']] },
      { kind: 'collect', time: 150, text: 'Collect the 5 packages before the timer runs out', points: [kerb(4, 2), kerb(7, 1), kerb(9, 3), kerb(8, 6, 0.3), kerb(5, 6)] },
      { kind: 'goto', at: [L.radio.kerb.x, L.radio.kerb.z], radius: 5, text: 'Bring the packages back to TIDEWAVE FM' },
      { kind: 'say', lines: [['jazz', 'Every one of them. I am putting you on the air, Reyes.']] },
    ],
  },
  {
    id: 'pierPressure', title: 'Pier Pressure', giver: 'bravo', at: L.garage, requires: ['homecoming'], reward: 1800,
    brief: 'Marlin Freight moves more than fish. Bravo wants their pier crew gone.',
    steps: [
      { kind: 'say', lines: [['bravo', 'Marlin Freight, Pier 9. Six enforcers guard a shipment that was mine.'], ['bravo', 'Send them a loud message.']] },
      { kind: 'give', weapon: 'pistol', ammo: 72 },
      { kind: 'goto', at: [L.docks.x, L.docks.z], radius: 14, text: 'Go to MARLIN FREIGHT in Puerto Viejo' },
      { kind: 'eliminate', enemy: 'enforcer', text: 'Take out the Marlin enforcers', spots: [sidewalk(4, 8, 's', 0.2), sidewalk(4, 8, 's', 0.8), [L.docks.x - 14, CITY.depth + 22], [L.docks.x + 16, CITY.depth + 26], [L.docks.x + 2, CITY.depth + 36], sidewalk(4, 8, 'e', 0.7)] },
      { kind: 'give', weapon: 'smg', ammo: 96 },
      { kind: 'say', lines: [['nova', 'Pier is quiet, Tío.'], ['bravo', 'Keep one of their Hornets. You earned it.']] },
    ],
  },
  {
    id: 'paintItGone', title: 'Paint It Gone', giver: 'jazz', at: L.radio, requires: ['hotPlates'], reward: 3000,
    brief: 'Silas Marlin parks his golden Rayo outside his own bank. Jazz thinks it would look better in pieces.',
    steps: [
      { kind: 'say', lines: [['jazz', 'Marlin leaves his Rayo outside Banco Marlin like nobody would dare.'], ['nova', 'Somebody dares.'], ['jazz', 'The whole precinct is on his payroll. Get it resprayed, then to Bravo.']] },
      { kind: 'steal', model: 'rayo', paint: '#f5c518', at: kerb(5, 4), heading: -Math.PI / 2, text: 'Steal SILAS MARLIN\'S RAYO outside Banco Marlin', textIn: 'The alarm is tripped!', stars: 3 },
      { kind: 'say', lines: [['jazz', 'That is every badge on Marlin\'s payroll behind you. Fresh Coat, now!']] },
      { kind: 'goto', at: [L.respray.kerb.x, L.respray.kerb.z], radius: 5, vehicle: true, respray: '#1fb5a6', text: 'Lose the heat: drive the Rayo into FRESH COAT CUSTOMS' },
      { kind: 'deliver', at: [L.garage.kerb.x, L.garage.kerb.z], text: 'Deliver the resprayed Rayo to BRAVO MOTORS' },
      { kind: 'say', lines: [['marlin', 'Whoever you are, you just bought yourself a funeral.'], ['nova', 'Put it on Mateo\'s tab.']] },
    ],
  },
  {
    id: 'coastlineClassic', title: 'Coastline Classic', giver: 'jazz', at: L.radio, requires: ['paintItGone'], reward: 3500,
    brief: 'Jazz bet the station on a race down Ocean Drive. You are the driver.',
    steps: [
      { kind: 'say', lines: [['jazz', 'I bet Tidewave FM on you. Ocean Drive, the docks, and back up the boulevard.'], ['nova', 'You bet the station?'], ['jazz', 'So do not lose.']] },
      { kind: 'steal', model: 'marlinGT', paint: '#ff3b30', at: [L.radio.kerb.x, L.radio.kerb.z], heading: -Math.PI / 2, text: 'Get in the MARLIN GT', textIn: 'Hit every checkpoint!' },
      { kind: 'race', time: 125, text: 'Race the Coastline Classic: hit every checkpoint', points: [node(1, 3), node(0, 3), node(0, 5), node(0, 7), node(0, 9), node(2, 9), node(4, 9), node(6, 9), node(6, 7), node(6, 5), node(6, 3), node(4, 3), [L.radio.kerb.x, L.radio.kerb.z]] },
      { kind: 'say', lines: [['jazz', 'New lap record on the coast! The station stays mine.']] },
    ],
  },
  {
    id: 'sundownHeist', title: 'Sundown Heist', giver: 'bravo', at: L.garage, requires: ['pierPressure', 'coastlineClassic'], reward: 40000,
    brief: 'Banco Marlin holds Mateo\'s debt and everybody else\'s. Tonight the vault opens.',
    steps: [
      { kind: 'say', lines: [['bravo', 'Banco Marlin. The vault holds every debt in Solmara, your brother\'s too.'], ['nova', 'Then we burn the ledger and take the rest.'], ['bravo', 'Jazz jams the alarm for half a minute. After that, the whole city comes.']] },
      { kind: 'give', weapon: 'rifle', ammo: 150 },
      { kind: 'give', armor: 100 },
      { kind: 'goto', at: [L.bank.x, L.bank.z], radius: 34, text: 'Go to BANCO MARLIN in Centro Alto' },
      { kind: 'say', lines: [['nova', 'Guards on every corner. Marlin was expecting company.']] },
      { kind: 'eliminate', enemy: 'guard', text: 'Clear the bank guards', spots: [sidewalk(5, 4, 's', 0.25), sidewalk(5, 4, 's', 0.75), sidewalk(5, 4, 'e', 0.8), sidewalk(5, 4, 'w', 0.8), sidewalk(5, 5, 'n', 0.5), sidewalk(4, 4, 'e', 0.6), sidewalk(6, 4, 'w', 0.6)] },
      { kind: 'wait', at: [L.bank.x, L.bank.z], radius: 7, seconds: 28, stars: 4, text: 'Hold the door while the vault cracks' },
      { kind: 'say', lines: [['jazz', 'Vault is open! Every cop in Solmara is on your frequency, go, go!']] },
      { kind: 'goto', at: [L.safehouse.x, L.safehouse.z], radius: 6, text: 'Escape to CASA REYES with the money' },
      { kind: 'loseCops', text: 'Lose the police' },
      { kind: 'say', lines: [['bravo', 'The ledger is ash. Mateo is free, and so is half this town.'], ['nova', 'Solmara owes me nothing now. I own it.']] },
    ],
  },
];
