// The scripted playthrough behind `captureScreenshots.mjs --smoke`. It runs inside the page: plays every story job
// by teleporting between objectives and sleeping through the days of eclipse week into totality, then shops, tunes a car, races, claims a bounty, calls the crew, drives a
// fare, survives a five-star response, is arrested and wiped out, and saves and loads across slots.

/** Runs in the browser (page.evaluate): returns a report of what each system did. */
export function playWholeGame() {
  const game = window.totality;
  const player = game.player;
  const calendar = game.calendar;
  const saveKey = (slot) => `totality-saros-save-v1-slot-${slot}`;
  for (let slot = 1; slot <= 3; slot += 1) window.localStorage.removeItem(saveKey(slot));
  game.newGame(2);
  const started = performance.now();
  /** Every check that did not hold; an empty list is a pass. */
  const failures = [];
  let steps = 0;
  const run = (count) => { for (let k = 0; k < count; k += 1) { game.update(1 / 60); steps += 1; } };
  const teleport = (x, z) => {
    if (player.vehicle) { player.vehicle.position.x = x; player.vehicle.position.z = z; player.vehicle.velX = 0; player.vehicle.velZ = 0; }
    player.position.x = x; player.position.z = z;
  };
  const press = (code) => { game.input.pressed.add(code); run(1); };
  const boardCar = (car) => {
    if (player.vehicle && player.vehicle !== car) press('KeyF');
    if (!player.vehicle) { teleport(car.position.x + 2.4, car.position.z); press('KeyF'); }
  };

  // The story: ten jobs across the five days of eclipse week, each stage counted as it goes by. When the next job
  // is waiting for its day, Nova rests at Casa Reyes; the last job runs through first contact into totality.
  const missions = [];
  const eclipse = { startedOn: `${calendar.dayName()} ${calendar.clockText()}`, daysSeen: [calendar.dayName()], phasesSeen: [], heldOnEve: false, hiddenInDark: false, litByHeadlights: false, sunlightAtTotality: null, watchers: 0 };
  // Eclipse eve must not turn into eclipse day while setup jobs are left: midnight on Thursday holds the week there.
  calendar.reset(4, 23.9);
  run(600);
  eclipse.heldOnEve = calendar.day === 4;
  calendar.reset();
  let stagesSeen = 0;
  for (let round = 0; round < 24; round += 1) {
    run(360);
    game.wanted.reset();
    eclipse.watchers = Math.max(eclipse.watchers, game.watchParties.watcherCount());
    const offer = game.missions.offers()[0];
    if (!offer) {
      if (!game.missions.waitingForDay()) break;
      if (player.vehicle) press('KeyF');
      game.shops.rest();
      if (!eclipse.daysSeen.includes(calendar.dayName())) eclipse.daysSeen.push(calendar.dayName());
      continue;
    }
    if (player.vehicle) press('KeyF');
    teleport(offer.at.x, offer.at.z);
    run(3);
    let lastStage = 0;
    for (let safety = 0; game.missions.active && safety < 4000; safety += 1) {
      const active = game.missions.active;
      const step = active.step;
      const info = game.missions.stageInfo();
      if (info && info.stage !== lastStage) { lastStage = info.stage; stagesSeen += 1; }
      player.health = 100;
      const phase = calendar.phase();
      if (!eclipse.phasesSeen.includes(phase)) eclipse.phasesSeen.push(phase);
      if (phase === 'totality') {
        eclipse.sunlightAtTotality = calendar.sunlight();
        // The rules of the dark: unseen on foot away from the lamps, lit as soon as a car's headlights are on.
        if (game.darkness.isHidden()) eclipse.hiddenInDark = true;
        if (game.darkness.litBy === 'HEADLIGHTS') eclipse.litByHeadlights = true;
      }
      if (step.kind === 'steal') boardCar(active.vehicle);
      else if (step.kind === 'goto' || step.kind === 'deliver' || step.kind === 'wait' || step.kind === 'awaitTotality') {
        if ((step.kind === 'deliver' || step.vehicle) && player.vehicle !== active.vehicle) boardCar(active.vehicle);
        else teleport(step.at[0], step.at[1]);
      } else if (step.kind === 'collect' || step.kind === 'race') teleport(active.remaining[0].x, active.remaining[0].z);
      else if (step.kind === 'eliminate') { for (const g of game.gunmen.list) if (g.alive && g.missionTag === active.tag) g.takeDamage(999, true); }
      else if (step.kind === 'destroy') { for (const target of active.targets) if (!target.dead) target.explode(); }
      else if (step.kind === 'loseCops') game.wanted.clear();
      run(2);
    }
    const passed = game.missions.completed.has(offer.id);
    missions.push(passed ? `${offer.id}:passed` : `${offer.id}:NOT PASSED (${document.querySelector('.banner-sub').textContent}; ${game.down ? game.down.kind : 'standing'})`);
  }
  eclipse.endedOn = `${calendar.dayName()} ${calendar.clockText()}`;
  eclipse.storyComplete = game.missions.isStoryComplete();
  // After the story the observatory replays the eclipse: totality must fall again and police sight must shrink in it.
  calendar.relive();
  for (let safety = 0; !calendar.isTotality() && safety < 3000; safety += 1) calendar.update(1);
  if (player.vehicle) press('KeyF');
  teleport(40, 40);
  run(20);
  eclipse.relivedTotality = calendar.isTotality();
  eclipse.sightInDark = game.darkness.sightRange(80);
  eclipse.darkReadout = game.darkness.readout();
  eclipse.hudCountdown = document.querySelector('.eclipse-big').textContent;
  // A car's headlights give Nova away in the dark; L switches them off and the dark hides her again.
  const darkCar = game.vehicles.spawn('avocet', player.position.x + 2.4, player.position.z, 0);
  darkCar.parked = true;
  press('KeyF');
  run(20);
  eclipse.litInCar = game.darkness.litBy;
  press('KeyL');
  run(20);
  eclipse.hiddenRunningDark = game.darkness.isHidden();
  press('KeyL');
  press('KeyF');
  for (let safety = 0; calendar.phase() !== 'after' && safety < 3000; safety += 1) calendar.update(1);
  run(5);
  eclipse.sightInDaylight = game.darkness.sightRange(80);
  const afterStory = { cash: player.cash, cred: game.cred.points, rank: game.cred.rank, title: game.cred.title(), stagesSeen };
  game.wanted.reset();
  run(30);
  if (player.vehicle) press('KeyF');

  // Shops: a gun at Ammo Amigo, then upgrades and a repair in Bravo's workshop.
  game.shops.openGunShop();
  game.shops.buy('shotgun');
  game.shops.close();
  const ride = game.vehicles.spawn('coyote', player.position.x + 2.4, player.position.z, 0);
  ride.parked = true;
  press('KeyF');
  const bay = game.workshop;
  ride.health = 40;
  ride.tiresShredded = true;
  game.counter.open({ title: 'TEST', tagline: '', accent: '#fff', stock: () => bay.stock(), purchase: (row) => bay.purchase(row) });
  for (const id of ['repair', 'engine', 'plating', 'tires', 'nitro', 'engine']) game.counter.buy(id);
  game.counter.close();
  const workshop = { levels: { ...bay.levels }, tuning: { ...bay.tuning }, condition: ride.conditionPercent(), tyresFixed: !ride.tiresShredded, maxHealth: ride.maxHealth };
  game.input.held.add('KeyW'); game.input.held.add('ShiftLeft');
  run(90);
  workshop.boosted = ride.boosting || bay.nitroCharge < 1;
  game.input.held.clear();

  // A street race against three rivals, driven by teleporting through the checkpoints.
  teleport(2.7, 100);
  run(5);
  press('KeyE');
  const raceStarted = Boolean(game.races.active);
  let raceRows = 0;
  for (let safety = 0; game.races.active && safety < 3000; safety += 1) {
    const race = game.races.active;
    if (race.countdown <= 0 && race.points[race.index]) teleport(race.points[race.index].x, race.points[race.index].z);
    raceRows = Math.max(raceRows, game.races.standings().length);
    run(3);
  }
  const race = { started: raceStarted, best: game.races.best, raceRows, wins: game.races.winsCount() };

  // A bounty: walk up to a capo's corner and take him down.
  if (player.vehicle) press('KeyF');
  const capo = game.bounties.blips()[0];
  teleport(capo.x + 30, capo.z);
  run(10);
  const capoSpawned = game.gunmen.list.some((g) => g.kind === 'capo');
  for (const g of game.gunmen.list) if (g.kind === 'capo') g.takeDamage(9999, true);
  run(10);
  const bounty = { capoSpawned, tally: game.bounties.tally() };
  game.gunmen.clear();

  // On foot beside a parked car: the game rings it and offers F to steal it; then a shot fired in a full street
  // sends the citizens running with their hands up, or to the ground.
  game.wanted.reset();
  run(2);
  const kerbCar = game.vehicles.spawn('estela', player.position.x + 2.6, player.position.z, 0);
  kerbCar.parked = true;
  run(3);
  const hintBox = document.querySelector('.hint');
  const street = {
    prompt: `[${document.querySelector('.hint-key').textContent}] ${document.querySelector('.hint-line').textContent}`,
    promptShown: hintBox.classList.contains('visible') && hintBox.classList.contains('keyed'), ringsOnCar: game.markers.used,
  };
  if (!street.promptShown || !street.prompt.startsWith('[F] STEAL THE')) failures.push(`no steal prompt beside a parked car: "${street.prompt}"`);
  if (street.ringsOnCar < 1) failures.push('no ring marks the car in reach');
  game.vehicles.remove(kerbCar);
  game.pedestrians.populate();
  street.calmBefore = game.pedestrians.moodCount();
  game.weapons.give('pistol', 48);
  const shotsBefore = game.stats.shotsFired;
  game.input.locked = true;
  game.input.buttons[0] = true;
  game.input.buttonPressed[0] = true;
  run(1);
  game.input.buttons[0] = false;
  game.input.locked = false;
  street.shots = game.stats.shotsFired - shotsBefore;
  street.afterShot = game.pedestrians.moodCount();
  street.handsUp = game.pedestrians.list.filter((ped) => ped.alive && ped.panicking).length;
  run(30);
  if (street.shots < 1) failures.push('the pistol did not fire');
  if (street.afterShot.fleeing + street.afterShot.cowering < 1 || street.handsUp < 1) failures.push(`citizens did not react to gunfire: ${JSON.stringify(street.afterShot)}`);
  street.weaponIcons = [...document.querySelectorAll('.weapon-icon')].filter((icon) => icon.getContext('2d').getImageData(0, 0, icon.width, icon.height).data.some((value, index) => index % 4 === 3 && value > 0)).length;
  if (street.weaponIcons !== 5) failures.push(`weapon bar drew ${street.weaponIcons} of 5 icons`);
  game.wanted.reset();
  game.gunmen.clear();

  // Taxi fares in a Saros Cab.
  const cab = game.vehicles.spawn('sarosCab', player.position.x + 2.4, player.position.z, 0);
  cab.parked = true;
  press('KeyF');
  game.activities.toggleTaxi();
  teleport(game.activities.fare.pickup.x, game.activities.fare.pickup.z);
  run(5);
  teleport(game.activities.fare.drop.x, game.activities.fare.drop.z);
  run(5);
  const fares = game.activities.faresDone;
  game.activities.toggleTaxi();
  game.saveGame(false);

  // Five stars: units with callsigns and tactics, a roadblock with a spike strip, the helicopter, then the crew's favors.
  teleport(0, 200);
  cab.heading = 0;
  game.wanted.setStars(5, 60);
  const tactics = new Set();
  const kinds = new Set();
  let roadblocks = 0;
  /** Shots each pursuit car has fired from its window, by car. */
  const windowShots = new Map();
  // The dispatch panel's big number must be the units really after Nova: counted three ways at every sample (the
  // world itself, the roster's rows, and what the panel wrote on screen), with the listed rows plus "+N MORE"
  // adding up to it.
  const panel = { samples: 0, recounts: 0, mismatches: [], most: 0, mostRows: 0, sawOverflow: false, sawBlockade: false, sawFootSquad: false };
  const checkPanel = (when) => {
    run(1);
    const visible = document.querySelector('.dispatch-panel').classList.contains('visible');
    if (game.wanted.stars === 0) {
      // Escaped: the panel must be gone, and must count afresh the moment Nova is wanted again.
      if (visible) panel.mismatches.push(`${when}: panel still showing with no stars`);
      game.wanted.setStars(1, 60);
      run(1);
      panel.recounts += 1;
    } else {
      game.hud.dispatchPanel.clock = 0;
      run(1);
    }
    const roster = game.police.roster();
    const world = game.police.unitsOnPlayer();
    const rosterUnits = roster.reduce((sum, row) => sum + row.units, 0);
    const shown = Number(document.querySelector('.dispatch-count').textContent);
    const rows = [...document.querySelectorAll('.dispatch-panel .unit')];
    const more = rows.filter((row) => row.classList.contains('unit-more')).reduce((sum, row) => sum + parseInt(row.querySelector('b').textContent, 10), 0);
    const listed = roster.slice(0, rows.length - (more > 0 ? 1 : 0)).reduce((sum, row) => sum + row.units, 0);
    panel.samples += 1;
    panel.most = Math.max(panel.most, shown);
    panel.mostRows = Math.max(panel.mostRows, rows.length);
    if (more > 0) panel.sawOverflow = true;
    if (roster.some((row) => row.role === 'roadblock' && row.units > 1)) panel.sawBlockade = true;
    if (roster.some((row) => row.role === 'foot' && row.units > 1)) panel.sawFootSquad = true;
    if (shown !== world || rosterUnits !== world || listed + more !== world) panel.mismatches.push(`${when}: panel ${shown}, world ${world}, roster ${rosterUnits}, listed ${listed} + more ${more}`);
  };
  for (let k = 0; k < 150; k += 1) {
    game.input.held.add('KeyW');
    player.health = 100;
    cab.health = cab.maxHealth;
    run(8);
    for (const unit of game.police.roster()) { tactics.add(unit.tactic); kinds.add(unit.kind); }
    for (const cruiser of game.police.pursuitUnits()) windowShots.set(cruiser, cruiser.controller.shotsFired);
    roadblocks = Math.max(roadblocks, game.police.roadblocks.list.length);
    if (k % 5 === 0) checkPanel(`5 stars, sample ${k}`);
  }
  game.input.held.clear();
  const chase = { stars: game.wanted.stars, tier: game.wanted.responseTier(), units: game.police.pursuitUnits().length, chopper: game.police.helicopter.active, roster: game.police.roster().length, tactics: [...tactics], kinds: [...kinds], roadblocks };
  chase.shotsFromCarWindows = [...windowShots.values()].reduce((sum, shots) => sum + shots, 0);
  if (chase.shotsFromCarWindows < 1) failures.push('no pursuit car fired from its window at five stars');
  // The same count at every lower wanted level, as units stand down or are lost behind.
  for (const stars of [4, 3, 2, 1]) {
    game.wanted.setStars(stars, 60);
    for (let k = 0; k < 6; k += 1) { player.health = 100; cab.health = cab.maxHealth; run(40); checkPanel(`${stars} stars, sample ${k}`); }
  }
  // Lose the stars with a full panel on screen, then be wanted again one frame later: no stale count may show.
  game.wanted.setStars(5, 60);
  run(240);
  checkPanel('5 stars again');
  game.wanted.reset();
  checkPanel('wanted again straight after an escape');
  game.wanted.setStars(5, 60);
  run(30);
  chase.panel = panel;
  if (panel.mismatches.length) failures.push(`dispatch panel count is wrong: ${panel.mismatches.slice(0, 3).join(' | ')}`);
  if (!panel.sawOverflow) failures.push('dispatch panel never showed more units than it lists, so the overflow line went untested');
  const block = game.police.roadblocks.deploy({ x: 0, z: 440, alongX: false, direction: 1 }, true);
  teleport(block.strip.position.x, block.strip.position.z);
  run(2);
  chase.spikesShredTyres = cab.tiresShredded;
  press('KeyX');
  chase.jamDroppedTo = game.wanted.stars;
  chase.jamming = game.crew.isJamming();
  player.health = 30;
  press('KeyC');
  chase.patchedHealth = player.health;
  press('KeyZ');
  chase.favorsUsed = game.stats.favorsUsed;

  // Arrest, death, then load the save from its slot.
  player.health = 100;
  game.onPlayerDown('busted');
  run(400);
  const afterArrest = { alive: player.alive, stars: game.wanted.stars, guns: Object.keys(game.weapons.owned).length };
  player.invulnerable = 0;
  player.takeDamage(999, 'bullet');
  run(400);
  const afterWipe = { alive: player.alive, health: player.health };
  game.continueGame(2);
  run(120);
  game.setState('pause');
  game.menus.open('stats');
  game.setState('map');
  const atlasJobs = document.querySelectorAll('.atlas-job').length;
  game.setState('play');
  run(30);
  const hud = {
    job: document.querySelector('.job-header').textContent, wanted: document.querySelector('.wanted-state').textContent, rank: document.querySelector('.rank-meter .meter-label').textContent,
    slots: document.querySelectorAll('.weapon-slot.owned').length, favors: document.querySelectorAll('.favor').length, atlasJobs,
  };
  const slotCards = JSON.parse(window.localStorage.getItem(saveKey(2))).summary;
  // The script stands in the open through every firefight, so a job may take it more than one try; the story must
  // still end with every job passed.
  if (!eclipse.storyComplete) failures.push(`the story did not complete: ${missions.filter((result) => !result.endsWith(':passed')).join(', ')}`);
  return {
    failures, missions, eclipse, afterStory, workshop, race, bounty, street, fares, chase, afterArrest, afterWipe, state: game.state, loaded: { guns: Object.keys(game.weapons.owned), jobs: game.missions.completed.size, cred: game.cred.points, workshop: game.workshop.levels, slot: game.saveSlot, summary: slotCards },
    hud, msPerStep: (performance.now() - started) / steps, vehicles: game.vehicles.list.length, pedestrians: game.pedestrians.list.length, drawCalls: game.renderer.info.render.calls,
  };
}
