// The story of Totality as data: ten jobs across the five days of eclipse week, their dialogue and the steps the
// mission director runs. Nine jobs set the crew up; the tenth is the vault of the Orrery Trust, which only opens in
// the dark, robbed in the two and a half minutes on Friday afternoon when the moon covers the sun.
import { CITY } from '../core/config.js';
import { CONTACTS } from '../eclipse/eclipseCalendar.js';
import { blockRect, kerbSpot, LANDMARKS } from '../world/cityLayout.js';

/** The cast: the colour of each speaker's name and portrait, and the line under their name in the atlas. */
export const CHARACTERS = {
  nova: { name: 'NOVA', color: '#ff9e7a', role: 'Nova Reyes · back in town' },
  bravo: { name: 'TÍO BRAVO', color: '#ffb547', role: 'Bravo Motors · workshop' },
  jazz: { name: 'JAZZ', color: '#f4ecd8', role: 'Penumbra FM · the city\'s ear' },
  ines: { name: 'DOC INÉS', color: '#cfe8d8', role: 'Avocet Medical · night clinic' },
  vane: { name: 'CASSIUS VANE', color: '#e3c06a', role: 'Orrery Trust · owns the debt' },
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
/** The coat Fresh Coat gives Vane's golden Rayo on Wednesday; the crew drives it to the heist on Friday. */
export const GETAWAY_PAINT = '#ec2f0a';

/**
 * Each job: who gives it and where, the day of eclipse week it opens on, what it needs done first, its cash and
 * cred, and its steps. A step with `stage` opens a new stage of the job, which the HUD counts ("STAGE 2/3").
 * Step kinds are run by missionDirector.js: say, give, steal, deliver, goto, collect, race, eliminate, destroy,
 * loseCops, wait and awaitTotality (hold a place until the sun goes out). `onFoot` lets the job's car go.
 */
export const STORY_MISSIONS = [
  {
    id: 'homecoming', title: 'Homecoming', day: 1, giver: 'bravo', at: L.garage, requires: [], reward: 600, cred: 150,
    brief: 'Monday. Three years gone, and Nova comes home the week the sun goes out. Tío Bravo has a welcome-back job.',
    steps: [
      { kind: 'say', lines: [['bravo', 'Nova Reyes. Three years, and you come back the week the sun goes out.'], ['nova', 'I need work, Tío. Mateo owes Cassius Vane forty grand.'], ['bravo', 'Vane keeps every debt in Saros in one vault. Friday it opens. First, a gold Estela at Strand Parking.']] },
      { kind: 'steal', stage: 'Take the gold Estela', model: 'estela', paint: '#d4a72c', at: kerb(0, 3), heading: -Math.PI / 2, text: 'Steal the gold ESTELA at Strand Parking', textIn: 'You have the Estela' },
      { kind: 'deliver', stage: 'Bring it to Bravo', at: [L.garage.kerb.x, L.garage.kerb.z], text: 'Deliver the Estela to BRAVO MOTORS in one piece' },
      { kind: 'give', weapon: 'pistol', ammo: 60 },
      { kind: 'say', lines: [['bravo', 'Clean. Take this Viper 9. The Trust\'s vault has a daylight lock: it only opens in the dark.'], ['nova', 'And Friday at 17:12 it is dark for two and a half minutes.']] },
    ],
  },
  {
    id: 'shadeRun', title: 'Shade Run', day: 1, giver: 'jazz', at: L.radio, requires: ['homecoming'], reward: 900, cred: 200,
    brief: 'Monday. Jazz runs Penumbra FM and the eclipse-shades racket. Vane\'s boys keep robbing her couriers.',
    steps: [
      { kind: 'say', lines: [['jazz', 'You are Bravo\'s driver? Five boxes of eclipse shades, all over Azimuth Market. Vane\'s boys are sniffing.'], ['nova', 'How long do I have?'], ['jazz', 'Until the record ends, baby. Two and a half minutes. Same as the eclipse.']] },
      { kind: 'collect', stage: 'Five boxes, one record', time: 150, text: 'Collect the 5 boxes of shades before the timer runs out', points: [kerb(4, 2), kerb(7, 1), kerb(9, 3), kerb(8, 6, 0.3), kerb(5, 6)] },
      { kind: 'goto', stage: 'Back to the booth', at: [L.radio.kerb.x, L.radio.kerb.z], radius: 5, text: 'Bring the boxes back to PENUMBRA FM' },
      { kind: 'say', lines: [['jazz', 'Every one of them. You just timed the heist, Reyes: that is how long the dark lasts.']] },
    ],
  },
  {
    id: 'houseCall', title: 'House Call', day: 2, giver: 'ines', at: L.hospital, requires: ['homecoming'], reward: 1200, cred: 250,
    brief: 'Tuesday. Doc Inés patches up half the Strand for free. Vane\'s supplier just cut her off.',
    steps: [
      { kind: 'say', lines: [['ines', 'You are Mateo\'s sister. He still owes me for eleven stitches.'], ['nova', 'Put it with the rest. What do you need?'], ['ines', 'Three crates of supplies Vane is sitting on. Take a van, and drive it like it carries glass.']] },
      { kind: 'steal', stage: 'Borrow a Caravana', model: 'caravana', paint: '#ecf0f1', at: kerb(9, 2), heading: -Math.PI / 2, text: 'Take the white CARAVANA on First Contact Street', textIn: 'The van is yours' },
      { kind: 'collect', stage: 'Load the crates', time: 150, text: 'Load the 3 supply crates', points: [kerb(9, 5), kerb(6, 7), kerb(4, 5, 0.3)] },
      { kind: 'deliver', stage: 'Deliver to the clinic', at: [L.hospital.kerb.x, L.hospital.kerb.z], text: 'Deliver the van to AVOCET MEDICAL in one piece' },
      { kind: 'say', lines: [['ines', 'Not a scratch on the crates. Friday I will be waiting with the lights off.']] },
    ],
  },
  {
    id: 'pierNine', title: 'Pier Nine', day: 2, giver: 'bravo', at: L.garage, requires: ['homecoming'], reward: 1800, cred: 300,
    brief: 'Tuesday. The drill that opens a vault in two minutes sits in a Vane Freight container. Six men guard it.',
    steps: [
      { kind: 'say', lines: [['bravo', 'Vane Freight, Pier 9. The drill we need for Friday is in a container there, with six enforcers.'], ['bravo', 'Send them a loud message.']] },
      { kind: 'give', weapon: 'pistol', ammo: 72 },
      { kind: 'goto', stage: 'Reach Pier 9', at: [L.docks.x, L.docks.z], radius: 14, text: 'Go to VANE FREIGHT in Cormorant Yards' },
      { kind: 'eliminate', stage: 'Clear the pier', enemy: 'enforcer', text: 'Take out the Vane enforcers', spots: [sidewalk(4, 8, 's', 0.2), sidewalk(4, 8, 's', 0.8), [L.docks.x - 14, CITY.depth + 22], [L.docks.x + 16, CITY.depth + 26], [L.docks.x + 2, CITY.depth + 36], sidewalk(4, 8, 'e', 0.7)] },
      { kind: 'give', weapon: 'smg', ammo: 96 },
      { kind: 'say', lines: [['nova', 'Pier is quiet, Tío. The drill is ours.'], ['bravo', 'Keep one of their Hornets. You earned it.']] },
    ],
  },
  {
    id: 'paintItGone', title: 'Paint It Gone', day: 3, giver: 'jazz', at: L.radio, requires: ['shadeRun'], reward: 3000, cred: 400,
    brief: 'Wednesday. Cassius Vane parks his golden Rayo outside his own bank, with the vault pass in the glovebox.',
    steps: [
      { kind: 'say', lines: [['jazz', 'Vane leaves his Rayo outside the Orrery Trust like nobody would dare. The vault pass is in the glovebox.'], ['nova', 'Somebody dares.'], ['jazz', 'The whole precinct is on his payroll. Get it resprayed, then to Bravo.']] },
      { kind: 'steal', stage: 'Take Vane\'s Rayo', model: 'rayo', paint: '#f5c518', at: kerb(5, 4), heading: -Math.PI / 2, text: 'Steal CASSIUS VANE\'S RAYO outside the Orrery Trust', textIn: 'The alarm is tripped!', stars: 3 },
      { kind: 'say', lines: [['jazz', 'That is every badge on Vane\'s payroll behind you. Fresh Coat, now!']] },
      { kind: 'goto', stage: 'Lose the pursuit', at: [L.respray.kerb.x, L.respray.kerb.z], radius: 5, vehicle: true, respray: GETAWAY_PAINT, text: 'Drive the Rayo into FRESH COAT CUSTOMS' },
      { kind: 'deliver', stage: 'Deliver to Bravo', at: [L.garage.kerb.x, L.garage.kerb.z], text: 'Deliver the resprayed Rayo to BRAVO MOTORS' },
      { kind: 'say', lines: [['vane', 'Whoever you are, enjoy the sunshine. You have two days of it left.'], ['nova', 'Funny. So do you.']] },
    ],
  },
  {
    id: 'borrowedSirens', title: 'Borrowed Sirens', day: 3, giver: 'bravo', at: L.garage, requires: ['pierNine'], reward: 3500, cred: 450,
    brief: 'Wednesday. Nobody stops a police car in the dark. Saros P.D. keeps its interceptors outside headquarters.',
    steps: [
      { kind: 'say', lines: [['bravo', 'Friday, in the dark, nobody stops a police car. I want a Lince interceptor.'], ['nova', 'You want me to steal it from the station.'], ['bravo', 'From the front door. Lose them before you bring it here, I do not need visitors.']] },
      { kind: 'steal', stage: 'Steal the Lince', model: 'lince', paint: '#16213e', at: [L.police.kerb.x, L.police.kerb.z], heading: -Math.PI / 2, text: 'Steal the LINCE outside SAROS P.D.', textIn: 'Every unit heard that door', stars: 3 },
      { kind: 'loseCops', stage: 'Shake the pursuit', vehicle: true, text: 'Lose the police in the Lince' },
      { kind: 'deliver', stage: 'Deliver to Bravo', at: [L.garage.kerb.x, L.garage.kerb.z], text: 'Deliver the Lince to BRAVO MOTORS' },
      { kind: 'say', lines: [['bravo', 'Still warm. Friday it wears our plates.']] },
    ],
  },
  {
    id: 'lightsOut', title: 'Lights Out', day: 4, giver: 'jazz', at: L.radio, requires: ['paintItGone'], reward: 3200, cred: 500,
    brief: 'Thursday. Vane has hired two floodlight trucks to keep his bank lit through totality. They must not arrive.',
    steps: [
      { kind: 'say', lines: [['jazz', 'Vane got nervous. Two black Caravanas full of floodlights, to light the Trust through totality.'], ['nova', 'And if the lights never arrive?'], ['jazz', 'Then Orrery Square goes as dark as the rest of us. Wreck both vans, baby.']] },
      { kind: 'give', weapon: 'smg', ammo: 128 },
      { kind: 'destroy', stage: 'Wreck the floodlight vans', model: 'caravana', paint: '#14171c', text: 'Destroy the two FLOODLIGHT VANS', spots: [[...node(6, 4), 0], [...node(8, 3), Math.PI / 2]] },
      { kind: 'goto', stage: 'Report to Jazz', at: [L.radio.kerb.x, L.radio.kerb.z], radius: 6, text: 'Return to PENUMBRA FM' },
      { kind: 'say', lines: [['jazz', 'No floodlights in Saros till Monday. Tomorrow the square is yours and the moon\'s.']] },
    ],
  },
  {
    id: 'raceTheShadow', title: 'Race the Shadow', day: 4, giver: 'jazz', at: L.radio, requires: ['paintItGone'], reward: 3500, cred: 550,
    brief: 'Thursday. The moon\'s shadow crosses Saros faster than any car. Drive the getaway route against the clock.',
    steps: [
      { kind: 'say', lines: [['jazz', 'Tomorrow the shadow comes up the coast at two thousand kilometres an hour. Show me you can keep up.'], ['nova', 'The getaway route? Now?'], ['jazz', 'Corona Drive, the docks, and back up the boulevard. I am timing you.']] },
      { kind: 'steal', stage: 'Take the wheel', model: 'coronaGT', paint: '#ff3b30', at: [L.radio.kerb.x, L.radio.kerb.z], heading: -Math.PI / 2, text: 'Get in the CORONA GT', textIn: 'Hit every checkpoint!' },
      { kind: 'race', stage: 'Beat the clock', time: 125, text: 'Race the getaway route: hit every checkpoint', points: [node(1, 3), node(0, 3), node(0, 5), node(0, 7), node(0, 9), node(2, 9), node(4, 9), node(6, 9), node(6, 7), node(6, 5), node(6, 3), node(4, 3), [L.radio.kerb.x, L.radio.kerb.z]] },
      { kind: 'say', lines: [['jazz', 'Inside the window, with seconds to spare. The shadow can eat your dust.']] },
    ],
  },
  {
    id: 'nightClinic', title: 'Night Clinic', day: 4, giver: 'ines', at: L.hospital, requires: ['houseCall', 'pierNine'], reward: 4500, cred: 600, hour: 21.4,
    brief: 'Eclipse eve. The man who built the vault\'s daylight lock is hiding in Inés\'s clinic. Vane knows.',
    steps: [
      { kind: 'say', lines: [['ines', 'The man upstairs built the daylight lock on Vane\'s vault. They are coming for him tonight.'], ['nova', 'How many?'], ['ines', 'Enough. Stay out of the street lamps, Nova. In the dark they cannot see you.']] },
      { kind: 'give', weapon: 'smg', ammo: 160 },
      { kind: 'give', armor: 100 },
      { kind: 'eliminate', stage: 'Hold the first wave', enemy: 'enforcer', text: 'Defend the clinic: first wave', spots: [sidewalk(8, 2, 's', 0.1), sidewalk(8, 2, 's', 0.9), sidewalk(8, 3, 'n', 0.3), sidewalk(8, 3, 'n', 0.7), sidewalk(7, 2, 'e', 0.8)] },
      { kind: 'say', lines: [['ines', 'More headlights on Shadow Band Street. Do not let them reach the door!']] },
      { kind: 'eliminate', stage: 'Break the second wave', enemy: 'guard', text: 'Defend the clinic: second wave', spots: [sidewalk(9, 2, 'w', 0.8), sidewalk(9, 3, 'n', 0.2), sidewalk(7, 3, 'n', 0.8), sidewalk(8, 3, 'n', 0.5), sidewalk(7, 2, 's', 0.7), sidewalk(8, 2, 'e', 0.9)] },
      { kind: 'goto', stage: 'Check on the witness', at: [L.hospital.x, L.hospital.z], radius: 3, text: 'Go to the door of AVOCET MEDICAL' },
      { kind: 'say', lines: [['ines', 'He will live, and he talked. The lock reads the sky: no sun, no lock. Tomorrow, 17:12.']] },
    ],
  },
  {
    id: 'totality', title: 'Totality', day: 5, giver: 'bravo', at: L.garage, requires: ['borrowedSirens', 'lightsOut', 'raceTheShadow', 'nightClinic'], reward: 40000, cred: 1200, hour: CONTACTS.first - 0.02,
    brief: 'Friday. First contact is at 16:12. When the sun goes out, the vault of the Orrery Trust opens, and so does the city.',
    steps: [
      { kind: 'say', lines: [['bravo', 'First contact. The moon has started on the sun, and Vane has every guard he owns on the square.'], ['nova', 'Then I clear the door before the dark, and take the vault in it.'], ['bravo', 'The Rayo you stole him is at Strand Parking, in a new coat. His lookouts are on the boardwalk beside it.']] },
      { kind: 'give', weapon: 'rifle', ammo: 150 },
      { kind: 'give', armor: 100 },
      { kind: 'goto', stage: 'Reach the Strand', at: [3, 334], radius: 30, text: 'Go to the boardwalk by STRAND PARKING' },
      { kind: 'say', lines: [['nova', 'Half of Saros is on the boardwalk looking up. Five of them are looking for me.']] },
      { kind: 'eliminate', stage: 'Clear the lookouts', enemy: 'enforcer', text: 'Take out Vane\'s lookouts among the eclipse watchers', spots: [[-9.4, 322], [4.6, 326], [-2.5, 315], [6.9, 309], [-9.6, 304]] },
      { kind: 'steal', stage: 'Take the getaway Rayo', model: 'rayo', paint: GETAWAY_PAINT, at: kerb(0, 3), heading: -Math.PI / 2, text: 'Get in the RAYO at Strand Parking', textIn: 'Every badge on Vane\'s payroll knows this car', stars: 3 },
      { kind: 'say', lines: [['jazz', 'They made the car, baby. Get to the square before the sun goes, the dark will do the rest!']] },
      { kind: 'goto', stage: 'Break through', onFoot: true, at: [L.bank.x, L.bank.z], radius: 34, text: 'Reach the ORRERY TRUST before the sun goes' },
      { kind: 'say', lines: [['nova', 'Guards on every corner, and a crowd looking at the sky. Nobody is looking at me.']] },
      { kind: 'eliminate', stage: 'Clear the guards', enemy: 'guard', text: 'Clear the Trust\'s guards before the dark', spots: [sidewalk(5, 4, 's', 0.25), sidewalk(5, 4, 's', 0.75), sidewalk(5, 4, 'e', 0.8), sidewalk(5, 4, 'w', 0.8), sidewalk(5, 5, 'n', 0.5), sidewalk(4, 4, 'e', 0.6), sidewalk(6, 4, 'w', 0.6)] },
      { kind: 'awaitTotality', stage: 'Wait for the dark', at: [L.bank.x, L.bank.z], radius: 9, text: 'Hold the door of the Trust until TOTALITY' },
      { kind: 'say', lines: [['jazz', 'There it goes. Saros is dark, and the daylight lock just let go!']] },
      { kind: 'wait', stage: 'Crack the vault', at: [L.bank.x, L.bank.z], radius: 7, seconds: 28, stars: 4, text: 'Hold the door while the drill cuts the vault' },
      { kind: 'say', lines: [['jazz', 'Vault is open! Kill your lights and keep off the lamps: they cannot chase what they cannot see.']] },
      { kind: 'goto', stage: 'Escape to Casa Reyes', at: [L.safehouse.x, L.safehouse.z], radius: 6, text: 'Escape to CASA REYES with the ledger' },
      { kind: 'loseCops', stage: 'Vanish in the dark', text: 'Lose the police: stay out of the light' },
      { kind: 'say', lines: [['bravo', 'The ledger is ash. Mateo is free, and so is half this town.'], ['nova', 'Two and a half minutes of night. It was enough.']] },
    ],
  },
];

/** The jobs that set the heist up: everything but the last. */
export const SETUP_JOB_COUNT = STORY_MISSIONS.length - 1;
