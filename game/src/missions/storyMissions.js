// The story of Solmara Heat as data: ten jobs in stages, their dialogue and the steps the mission director runs.
import { CITY } from '../core/config.js';
import { blockRect, kerbSpot, LANDMARKS } from '../world/cityLayout.js';

/** The cast: the colour of each speaker's name and portrait, and the line under their name on the map screen. */
export const CHARACTERS = {
  nova: { name: 'NOVA', color: '#ff7b6b', role: 'Nova Reyes · back in town' },
  bravo: { name: 'TÍO BRAVO', color: '#f6b042', role: 'Bravo Motors · chop shop' },
  jazz: { name: 'JAZZ', color: '#f062b0', role: 'Tidewave FM · the city\'s ear' },
  ines: { name: 'DOC INÉS', color: '#7be0c3', role: 'Santa Brisa Medical · night clinic' },
  marlin: { name: 'SILAS MARLIN', color: '#d8c06a', role: 'Marlin Syndicate · owns the debt' },
};

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

const node = (i, j) => [i * CITY.pitch, j * CITY.pitch];
const L = LANDMARKS;

/**
 * Each job: who gives it and where, what it needs done first, its cash and cred, and its steps.
 * A step with `stage` opens a new stage of the job, which the HUD counts ("STAGE 2/3").
 * Step kinds are run by missionDirector.js: say, give, steal, deliver, goto, collect, race, eliminate, destroy, loseCops, wait.
 */
export const STORY_MISSIONS = [
  {
    id: 'homecoming', title: 'Homecoming', giver: 'bravo', at: L.garage, requires: [], reward: 600, cred: 150,
    brief: 'Three years gone and Solmara still owes you. Tío Bravo has a welcome-back job.',
    steps: [
      { kind: 'say', lines: [['bravo', 'Nova Reyes. Three years and you still walk like you own the street.'], ['nova', 'I need work, Tío. Mateo owes Marlin forty grand.'], ['bravo', 'Then start small. A gold Estela sits at Playa Parking. Bring it to me.']] },
      { kind: 'steal', stage: 'Take the gold Estela', model: 'estela', paint: '#d4a72c', at: kerb(0, 3), heading: -Math.PI / 2, text: 'Steal the gold ESTELA at Playa Parking', textIn: 'You have the Estela' },
      { kind: 'deliver', stage: 'Bring it to Bravo', at: [L.garage.kerb.x, L.garage.kerb.z], text: 'Deliver the Estela to BRAVO MOTORS in one piece' },
      { kind: 'give', weapon: 'pistol', ammo: 60 },
      { kind: 'say', lines: [['bravo', 'Clean. Take this Viper 9. Marlin\'s people do not ask twice.']] },
    ],
  },
  {
    id: 'hotPlates', title: 'Hot Plates', giver: 'jazz', at: L.radio, requires: ['homecoming'], reward: 900, cred: 200,
    brief: 'Jazz runs Tidewave FM and half the gossip in town. Her couriers keep getting robbed.',
    steps: [
      { kind: 'say', lines: [['jazz', 'You are Bravo\'s driver? Five packages, all over El Mercado. Marlin\'s boys are sniffing.'], ['nova', 'How long do I have?'], ['jazz', 'Until the record ends, baby. Two and a half minutes.']] },
      { kind: 'collect', stage: 'Five drops, one record', time: 150, text: 'Collect the 5 packages before the timer runs out', points: [kerb(4, 2), kerb(7, 1), kerb(9, 3), kerb(8, 6, 0.3), kerb(5, 6)] },
      { kind: 'goto', stage: 'Back to the booth', at: [L.radio.kerb.x, L.radio.kerb.z], radius: 5, text: 'Bring the packages back to TIDEWAVE FM' },
      { kind: 'say', lines: [['jazz', 'Every one of them. I am putting you on the air, Reyes.']] },
    ],
  },
  {
    id: 'houseCall', title: 'House Call', giver: 'ines', at: L.hospital, requires: ['homecoming'], reward: 1200, cred: 250,
    brief: 'Doc Inés patched up half of Playa Dorada for free. Marlin\'s supplier just cut her off.',
    steps: [
      { kind: 'say', lines: [['ines', 'You are Mateo\'s sister. He still owes me for eleven stitches.'], ['nova', 'Put it with the rest. What do you need?'], ['ines', 'Three crates of supplies Marlin is sitting on. Take a van, and drive it like it carries glass.']] },
      { kind: 'steal', stage: 'Borrow a Caravana', model: 'caravana', paint: '#ecf0f1', at: kerb(9, 2), heading: -Math.PI / 2, text: 'Take the white CARAVANA on Hibiscus Street', textIn: 'The van is yours' },
      { kind: 'collect', stage: 'Load the crates', time: 150, text: 'Load the 3 supply crates', points: [kerb(9, 5), kerb(6, 7), kerb(4, 5, 0.3)] },
      { kind: 'deliver', stage: 'Deliver to Santa Brisa', at: [L.hospital.kerb.x, L.hospital.kerb.z], text: 'Deliver the van to SANTA BRISA MEDICAL in one piece' },
      { kind: 'say', lines: [['ines', 'Not a scratch on the crates. Call me when somebody puts a hole in you.']] },
    ],
  },
  {
    id: 'pierPressure', title: 'Pier Pressure', giver: 'bravo', at: L.garage, requires: ['homecoming'], reward: 1800, cred: 300,
    brief: 'Marlin Freight moves more than fish. Bravo wants their pier crew gone.',
    steps: [
      { kind: 'say', lines: [['bravo', 'Marlin Freight, Pier 9. Six enforcers guard a shipment that was mine.'], ['bravo', 'Send them a loud message.']] },
      { kind: 'give', weapon: 'pistol', ammo: 72 },
      { kind: 'goto', stage: 'Reach Pier 9', at: [L.docks.x, L.docks.z], radius: 14, text: 'Go to MARLIN FREIGHT in Puerto Viejo' },
      { kind: 'eliminate', stage: 'Clear the pier', enemy: 'enforcer', text: 'Take out the Marlin enforcers', spots: [sidewalk(4, 8, 's', 0.2), sidewalk(4, 8, 's', 0.8), [L.docks.x - 14, CITY.depth + 22], [L.docks.x + 16, CITY.depth + 26], [L.docks.x + 2, CITY.depth + 36], sidewalk(4, 8, 'e', 0.7)] },
      { kind: 'give', weapon: 'smg', ammo: 96 },
      { kind: 'say', lines: [['nova', 'Pier is quiet, Tío.'], ['bravo', 'Keep one of their Hornets. You earned it.']] },
    ],
  },
  {
    id: 'paintItGone', title: 'Paint It Gone', giver: 'jazz', at: L.radio, requires: ['hotPlates'], reward: 3000, cred: 400,
    brief: 'Silas Marlin parks his golden Rayo outside his own bank. Jazz thinks it would look better in pieces.',
    steps: [
      { kind: 'say', lines: [['jazz', 'Marlin leaves his Rayo outside Banco Marlin like nobody would dare.'], ['nova', 'Somebody dares.'], ['jazz', 'The whole precinct is on his payroll. Get it resprayed, then to Bravo.']] },
      { kind: 'steal', stage: 'Take Marlin\'s Rayo', model: 'rayo', paint: '#f5c518', at: kerb(5, 4), heading: -Math.PI / 2, text: 'Steal SILAS MARLIN\'S RAYO outside Banco Marlin', textIn: 'The alarm is tripped!', stars: 3 },
      { kind: 'say', lines: [['jazz', 'That is every badge on Marlin\'s payroll behind you. Fresh Coat, now!']] },
      { kind: 'goto', stage: 'Lose the heat', at: [L.respray.kerb.x, L.respray.kerb.z], radius: 5, vehicle: true, respray: '#1fb5a6', text: 'Drive the Rayo into FRESH COAT CUSTOMS' },
      { kind: 'deliver', stage: 'Deliver to Bravo', at: [L.garage.kerb.x, L.garage.kerb.z], text: 'Deliver the resprayed Rayo to BRAVO MOTORS' },
      { kind: 'say', lines: [['marlin', 'Whoever you are, you just bought yourself a funeral.'], ['nova', 'Put it on Mateo\'s tab.']] },
    ],
  },
  {
    id: 'blueTide', title: 'Blue Tide', giver: 'bravo', at: L.garage, requires: ['pierPressure'], reward: 3500, cred: 450,
    brief: 'A client wants a police interceptor. Solmara P.D. keeps them parked outside headquarters.',
    steps: [
      { kind: 'say', lines: [['bravo', 'A Lince interceptor. Fastest thing with a siren in this city.'], ['nova', 'You want me to steal it from the station.'], ['bravo', 'From the front door. Lose them before you bring it here, I do not need visitors.']] },
      { kind: 'steal', stage: 'Steal the Lince', model: 'lince', paint: '#16213e', at: [L.police.kerb.x, L.police.kerb.z], heading: -Math.PI / 2, text: 'Steal the LINCE outside SOLMARA P.D.', textIn: 'Every unit heard that door', stars: 3 },
      { kind: 'loseCops', stage: 'Shake the pursuit', vehicle: true, text: 'Lose the police in the Lince' },
      { kind: 'deliver', stage: 'Deliver to Bravo', at: [L.garage.kerb.x, L.garage.kerb.z], text: 'Deliver the Lince to BRAVO MOTORS' },
      { kind: 'say', lines: [['bravo', 'Still warm. The client pays double for the light bar.']] },
    ],
  },
  {
    id: 'loudAndClear', title: 'Loud and Clear', giver: 'jazz', at: L.radio, requires: ['paintItGone'], reward: 3200, cred: 500,
    brief: 'Two black vans carry the payroll that keeps the precinct quiet. Jazz wants them off the road.',
    steps: [
      { kind: 'say', lines: [['jazz', 'Marlin pays his badges every Friday, out of two black Caravanas.'], ['nova', 'And if the payroll never arrives?'], ['jazz', 'Then the badges get honest. Wreck both vans, baby.']] },
      { kind: 'give', weapon: 'smg', ammo: 128 },
      { kind: 'destroy', stage: 'Wreck the payroll vans', model: 'caravana', paint: '#14171c', text: 'Destroy the two PAYROLL VANS', spots: [[...node(6, 4), 0], [...node(8, 3), Math.PI / 2]] },
      { kind: 'goto', stage: 'Report to Jazz', at: [L.radio.kerb.x, L.radio.kerb.z], radius: 6, text: 'Return to TIDEWAVE FM' },
      { kind: 'say', lines: [['jazz', 'Unpaid cops on every frequency. This is the best radio I ever made.']] },
    ],
  },
  {
    id: 'coastlineClassic', title: 'Coastline Classic', giver: 'jazz', at: L.radio, requires: ['paintItGone'], reward: 3500, cred: 550,
    brief: 'Jazz bet the station on a race down Ocean Drive. You are the driver.',
    steps: [
      { kind: 'say', lines: [['jazz', 'I bet Tidewave FM on you. Ocean Drive, the docks, and back up the boulevard.'], ['nova', 'You bet the station?'], ['jazz', 'So do not lose.']] },
      { kind: 'steal', stage: 'Take the wheel', model: 'marlinGT', paint: '#ff3b30', at: [L.radio.kerb.x, L.radio.kerb.z], heading: -Math.PI / 2, text: 'Get in the MARLIN GT', textIn: 'Hit every checkpoint!' },
      { kind: 'race', stage: 'Beat the clock', time: 125, text: 'Race the Coastline Classic: hit every checkpoint', points: [node(1, 3), node(0, 3), node(0, 5), node(0, 7), node(0, 9), node(2, 9), node(4, 9), node(6, 9), node(6, 7), node(6, 5), node(6, 3), node(4, 3), [L.radio.kerb.x, L.radio.kerb.z]] },
      { kind: 'say', lines: [['jazz', 'New lap record on the coast! The station stays mine.']] },
    ],
  },
  {
    id: 'nightClinic', title: 'Night Clinic', giver: 'ines', at: L.hospital, requires: ['houseCall', 'pierPressure'], reward: 4500, cred: 600, hour: 21.4,
    brief: 'A Marlin bookkeeper is hiding in Inés\'s clinic with the ledger in his head. The Syndicate knows.',
    steps: [
      { kind: 'say', lines: [['ines', 'I have a man upstairs who kept Marlin\'s books. They are coming for him tonight.'], ['nova', 'How many?'], ['ines', 'Enough that I called you instead of the police.']] },
      { kind: 'give', weapon: 'smg', ammo: 160 },
      { kind: 'give', armor: 100 },
      { kind: 'eliminate', stage: 'Hold the first wave', enemy: 'enforcer', text: 'Defend the clinic: first wave', spots: [sidewalk(8, 2, 's', 0.1), sidewalk(8, 2, 's', 0.9), sidewalk(8, 3, 'n', 0.3), sidewalk(8, 3, 'n', 0.7), sidewalk(7, 2, 'e', 0.8)] },
      { kind: 'say', lines: [['ines', 'More headlights on Sunset Street. Do not let them reach the door!']] },
      { kind: 'eliminate', stage: 'Break the second wave', enemy: 'guard', text: 'Defend the clinic: second wave', spots: [sidewalk(9, 2, 'w', 0.8), sidewalk(9, 3, 'n', 0.2), sidewalk(7, 3, 'n', 0.8), sidewalk(8, 3, 'n', 0.5), sidewalk(7, 2, 's', 0.7), sidewalk(8, 2, 'e', 0.9)] },
      { kind: 'goto', stage: 'Check on the witness', at: [L.hospital.x, L.hospital.z], radius: 3, text: 'Go to the door of SANTA BRISA MEDICAL' },
      { kind: 'say', lines: [['ines', 'He will live, and he will talk. The vault code is in that ledger, Nova.']] },
    ],
  },
  {
    id: 'sundownHeist', title: 'Sundown Heist', giver: 'bravo', at: L.garage, requires: ['blueTide', 'loudAndClear', 'coastlineClassic', 'nightClinic'], reward: 40000, cred: 1200, hour: 16.4,
    brief: 'Banco Marlin holds Mateo\'s debt and everybody else\'s. Tonight the vault opens.',
    steps: [
      { kind: 'say', lines: [['bravo', 'Banco Marlin. The vault holds every debt in Solmara, your brother\'s too.'], ['nova', 'Then we burn the ledger and take the rest.'], ['bravo', 'Jazz jams the alarm for half a minute. After that, the whole city comes.']] },
      { kind: 'give', weapon: 'rifle', ammo: 150 },
      { kind: 'give', armor: 100 },
      { kind: 'goto', stage: 'Reach Banco Marlin', at: [L.bank.x, L.bank.z], radius: 34, text: 'Go to BANCO MARLIN in Centro Alto' },
      { kind: 'say', lines: [['nova', 'Guards on every corner. Marlin was expecting company.']] },
      { kind: 'eliminate', stage: 'Clear the guards', enemy: 'guard', text: 'Clear the bank guards', spots: [sidewalk(5, 4, 's', 0.25), sidewalk(5, 4, 's', 0.75), sidewalk(5, 4, 'e', 0.8), sidewalk(5, 4, 'w', 0.8), sidewalk(5, 5, 'n', 0.5), sidewalk(4, 4, 'e', 0.6), sidewalk(6, 4, 'w', 0.6)] },
      { kind: 'wait', stage: 'Crack the vault', at: [L.bank.x, L.bank.z], radius: 7, seconds: 28, stars: 4, text: 'Hold the door while the vault cracks' },
      { kind: 'say', lines: [['jazz', 'Vault is open! Every cop in Solmara is on your frequency, go, go!']] },
      { kind: 'goto', stage: 'Escape to Casa Reyes', at: [L.safehouse.x, L.safehouse.z], radius: 6, text: 'Escape to CASA REYES with the money' },
      { kind: 'loseCops', stage: 'Lose the heat', text: 'Lose the police' },
      { kind: 'say', lines: [['bravo', 'The ledger is ash. Mateo is free, and so is half this town.'], ['nova', 'Solmara owes me nothing now. I own it.']] },
    ],
  },
];
