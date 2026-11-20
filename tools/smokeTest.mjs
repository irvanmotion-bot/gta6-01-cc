// The scripted playthrough behind `captureScreenshots.mjs --smoke`. It runs inside the page: plays every story job
// by teleporting between objectives and sleeping through the days of eclipse week into totality (letting the sun go
// out early once, to see the heist fail for it), is spotted and then lost behind a building until the stars come
// off, resizes the HUD, then shops, turns the radio, tunes a car, races, claims a bounty under its health bars,
// calls the crew, drives a fare, survives a five-star response, is arrested and wiped out, pauses, and saves and
// loads across slots.

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
    // The heist is held to the eclipse. Once, let the sun go out before the vault door is hers: the job must
    // carry the deadline on its panel and fail for it; the next round takes the job again from first contact.
    if (offer.id === 'totality' && !eclipse.deadline) {
      const limit = game.missions.timeLimit();
      eclipse.deadline = { armed: game.missions.underEclipseDeadline(), clock: limit ? `${Math.round(limit.seconds)} s to ${limit.until}` : 'none', failIf: game.missions.failConditions().join(' · '), panel: document.querySelector('.job-panel').textContent };
      calendar.setHour(17.3);
      run(2);
      eclipse.deadline.failedJob = !game.missions.active;
      eclipse.deadline.reason = document.querySelector('.banner-sub').textContent;
      if (!eclipse.deadline.armed || !limit || limit.until !== 'TOTALITY' || !eclipse.deadline.failedJob) failures.push(`the heist is not held to the eclipse: ${JSON.stringify(eclipse.deadline)}`);
      if (!eclipse.deadline.panel.includes('TIME LIMIT') || !eclipse.deadline.panel.includes('FAIL IF')) failures.push('the job panel does not print TIME LIMIT and FAIL IF during the heist');
      delete eclipse.deadline.panel;
      continue;
    }
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

  // Line of sight. A cruiser with a clear street to Nova keeps her SPOTTED; the same cruiser with a building in
  // the way has no eyes on her. With no unit in sight the force is SEARCHING: the radar gets a zone round the place
  // she was last seen, the status panel says so, and the stars come off one at a time.
  const standDown = () => {
    for (const vehicle of [...game.vehicles.list]) if (vehicle.spec.police) game.vehicles.remove(vehicle);
    game.gunmen.clear();
    game.police.clear();
  };
  standDown();
  teleport(320, 360);
  run(2);
  let open = null;
  let walled = null;
  for (let k = 0; k < 48 && !(open && walled); k += 1) {
    const angle = (k / 48) * Math.PI * 2;
    const point = { x: player.position.x + Math.sin(angle) * 45, z: player.position.z + Math.cos(angle) * 45 };
    if (game.collision.hasLineOfSight(point.x, point.z, player.position.x, player.position.z, 1.2)) open = open || point; else walled = walled || point;
  }
  const sight = { foundSpots: Boolean(open && walled), starsSeen: [] };
  if (sight.foundSpots) {
    game.wanted.setStars(2, 0);
    let cruiser = game.police.enlist(game.vehicles.spawn('centinela', open.x, open.z, 0), 'patrol');
    run(1);
    sight.eyesInTheOpen = game.wanted.eyes;
    sight.stateInTheOpen = game.wanted.status().state;
    sight.lineInTheOpen = document.querySelector('.wanted-detail').textContent;
    game.vehicles.remove(cruiser);
    cruiser = game.police.enlist(game.vehicles.spawn('centinela', walled.x, walled.z, 0), 'patrol');
    sight.eyesBehindWall = game.police.unitsSeeing(80);
    game.vehicles.remove(cruiser);
    game.wanted.setStars(3, 0);
    sight.starsSeen.push(game.wanted.stars);
    for (let k = 0; k < 3600 && game.wanted.stars > 0; k += 1) {
      standDown();
      run(1);
      const zone = game.wanted.searchZone();
      if (zone) { sight.zoneFirst = sight.zoneFirst || Math.round(zone.radius); sight.zoneWidest = Math.max(sight.zoneWidest || 0, Math.round(zone.radius)); }
      if (game.wanted.status().state === 'SEARCHING' && !sight.panelSearching) { sight.panelSearching = document.querySelector('.wanted-state').textContent; sight.lineSearching = document.querySelector('.wanted-detail').textContent; }
      if (game.wanted.stars !== sight.starsSeen[sight.starsSeen.length - 1]) sight.starsSeen.push(game.wanted.stars);
    }
  }
  if (!sight.foundSpots) failures.push('no open and no walled spot found round the test corner');
  else {
    if (sight.eyesInTheOpen < 1 || sight.stateInTheOpen !== 'SPOTTED') failures.push(`a cruiser with a clear street did not spot her: ${JSON.stringify(sight)}`);
    if (sight.eyesBehindWall !== 0) failures.push(`a cruiser behind a building still has eyes on her: ${sight.eyesBehindWall}`);
    if (sight.starsSeen.join('') !== '3210') failures.push(`unseen, the stars did not come off one at a time: ${sight.starsSeen.join(' ')}`);
    if (!sight.zoneFirst || sight.zoneWidest <= sight.zoneFirst) failures.push(`the search zone did not open and grow: ${sight.zoneFirst} to ${sight.zoneWidest}`);
    if (!sight.panelSearching || !sight.panelSearching.includes('SEARCHING')) failures.push('the status panel never said SEARCHING');
  }
  game.wanted.reset();
  run(5);

  // HUD SIZE: the setting changes the HUD at once, and the biggest size keeps the essentials only.
  const hudRoot = document.getElementById('hud');
  const sizes = {};
  for (const size of ['standard', 'huge', 'large']) {
    game.settings.hudSize = size;
    game.applySettings();
    run(1);
    sizes[size] = { zoom: hudRoot.style.zoom, essentialsOnly: hudRoot.classList.contains('huge'), crewBarShown: getComputedStyle(document.querySelector('.crew-bar')).display !== 'none' };
  }
  if (!sizes.huge.essentialsOnly || sizes.huge.crewBarShown || sizes.large.essentialsOnly || !sizes.large.crewBarShown || sizes.standard.zoom === sizes.large.zoom) failures.push(`HUD SIZE does not change the HUD: ${JSON.stringify(sizes)}`);

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
  // The radio: at the wheel the HUD names the station, its frequency, its DJ and the track on air; R moves to the
  // next station, and a track gives way to the next one on the station's list.
  run(2);
  const radioPlayer = game.audio.radio;
  const onAir = radioPlayer.nowPlaying();
  const radio = { station: onAir && onAir.station, dj: onAir && onAir.dj, track: onAir && `${onAir.title} · ${onAir.artist}`, panel: `${document.querySelector('.radio-station').textContent} / ${document.querySelector('.radio-track').textContent}` };
  radioPlayer.tick(81, true);
  radio.nextTrack = radioPlayer.nowPlaying().title;
  press('KeyR');
  radio.nextStation = radioPlayer.nowPlaying() ? radioPlayer.nowPlaying().station : 'off';
  if (!onAir || !radio.panel.includes(onAir.station.toUpperCase()) || !radio.panel.includes(onAir.title.toUpperCase())) failures.push(`the radio panel does not name the station and the track: ${JSON.stringify(radio)}`);
  if (radio.nextTrack === (onAir && onAir.title) || radio.nextStation === (onAir && onAir.station)) failures.push(`the radio does not move on: ${JSON.stringify(radio)}`);
  // The workshop's own counter, beside the car on the turntable: five rows, each upgrade with the tier it sells.
  bay.openBay(ride);
  const counterRows = [...document.querySelectorAll('#shop-menu .shop-row')].map((row) => `${row.querySelector('.shop-label b').textContent} | ${row.querySelector('.shop-label em').textContent} | ${row.querySelector('.shop-price').textContent}`);
  const showroomOpen = game.showroom.active && document.querySelector('#shop-menu').classList.contains('showroom');
  game.counter.close();
  if (counterRows.length !== 5 || !counterRows[1].includes('TIER 1 OF 3') || !showroomOpen) failures.push(`the workshop counter is not five rows with tiers beside the turntable: ${JSON.stringify(counterRows)}`);
  game.counter.open({ title: 'TEST', tagline: '', accent: '#fff', stock: () => bay.stock(), purchase: (row) => bay.purchase(row) });
  for (const id of ['repair', 'engine', 'plating', 'tires', 'nitro', 'engine']) game.counter.buy(id);
  game.counter.close();
  const workshop = { levels: { ...bay.levels }, tuning: { ...bay.tuning }, condition: ride.conditionPercent(), tyresFixed: !ride.tiresShredded, maxHealth: ride.maxHealth, counterRows };
  game.input.held.add('KeyW'); game.input.held.add('ShiftLeft');
  run(90);
  workshop.boosted = ride.boosting || bay.nitroCharge < 1;
  game.input.held.clear();

  // Driving stunts: two parked cars passed at speed with less than a metre between the doors are two NEAR MISSES,
  // the second inside the combo's clock and so at double pay; the HUD pops each one up.
  teleport(2.7, 200);
  ride.heading = 0;
  for (const other of [...game.vehicles.list]) if (other !== ride && Math.abs(other.position.x) < 9 && other.position.z > 170 && other.position.z < 340) game.vehicles.remove(other);
  for (const z of [232, 266]) game.vehicles.spawn('estela', -0.05, z, 0).parked = true;
  const stunts = { cashBefore: player.cash, nearBefore: game.stats.nearMisses, popups: [] };
  for (let k = 0; k < 160; k += 1) {
    ride.heading = 0;
    ride.velX = 0;
    ride.velZ = Math.max(ride.velZ, 30);
    run(1);
    const title = document.querySelector('.stunt-popup.visible .stunt-title');
    if (title && !stunts.popups.includes(title.textContent)) stunts.popups.push(title.textContent);
  }
  stunts.nearMisses = game.stats.nearMisses - stunts.nearBefore;
  stunts.paid = player.cash - stunts.cashBefore;
  stunts.bestCombo = game.stats.bestCombo;
  stunts.line = document.querySelector('.stunt-line').textContent;
  if (stunts.nearMisses !== 2 || stunts.bestCombo < 2 || !stunts.popups.includes('NEAR MISS ×2') || stunts.paid < 75) failures.push(`two near misses did not pay as a combo: ${JSON.stringify(stunts)}`);

  // A street race against three rivals, driven by teleporting through the checkpoints. The runs above may have
  // clipped somebody: the grid only takes a car the police are not after, so any heat is dropped first.
  const heatFromNitroRun = game.wanted.stars;
  game.wanted.reset();
  standDown();
  teleport(2.7, 100);
  run(5);
  press('KeyE');
  const raceStarted = Boolean(game.races.active);
  if (!raceStarted) failures.push(`the street race did not start (stars ${game.wanted.stars}, speed ${player.vehicle ? player.vehicle.speed.toFixed(1) : 'on foot'}, heat before ${heatFromNitroRun})`);
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
  // Facing his corner with his guns turned on her: every one of them in view carries a health bar, the capo his name.
  for (const g of game.gunmen.list) g.hostile = true;
  game.camera.yaw = Math.atan2(capo.x - player.position.x, capo.z - player.position.z);
  game.camera.pitch = 0.05;
  run(4);
  const tags = [...document.querySelectorAll('.combat-tag.visible')];
  const combatTags = { shown: tags.length, named: tags.filter((tag) => tag.classList.contains('named')).map((tag) => tag.querySelector('.combat-name').textContent), panel: document.querySelector('.job-header').textContent };
  if (combatTags.shown < 2 || combatTags.named.length !== 1) failures.push(`no health bars over the capo's crew: ${JSON.stringify(combatTags)}`);
  for (const g of game.gunmen.list) if (g.kind === 'capo') g.takeDamage(9999, true);
  run(10);
  const bounty = { capoSpawned, tally: game.bounties.tally(), combatTags };
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
  // (The script stands in the open under the gunship, so it keeps Nova and the cab patched up while it counts.)
  const runUnderFire = (count) => { for (let k = 0; k < count; k += 1) { player.health = 100; cab.health = cab.maxHealth; run(1); } };
  game.wanted.setStars(5, 60);
  runUnderFire(240);
  checkPanel('5 stars again');
  game.wanted.reset();
  checkPanel('wanted again straight after an escape');
  game.wanted.setStars(5, 60);
  runUnderFire(30);
  chase.panel = panel;
  if (panel.mismatches.length) failures.push(`dispatch panel count is wrong: ${panel.mismatches.slice(0, 3).join(' | ')}`);
  if (!panel.sawOverflow) failures.push('dispatch panel never showed more units than it lists, so the overflow line went untested');
  const block = game.police.roadblocks.deploy({ x: 0, z: 440, alongX: false, direction: 1 }, true);
  teleport(block.strip.position.x, block.strip.position.z);
  runUnderFire(2);
  chase.spikesShredTyres = cab.tiresShredded;
  // The crew's three favors, called in the middle of it: Jazz takes a star off and jams the police band, Inés
  // patches Nova up, Bravo leaves a car at a kerb; the crew bar counts the favors still ready.
  chase.standingForFavors = player.alive && !game.down;
  const favorsBefore = game.stats.favorsUsed;
  press('KeyX');
  chase.jamDroppedTo = game.wanted.stars;
  chase.jamming = game.crew.isJamming();
  chase.statusJammed = game.wanted.status().state;
  player.health = 30;
  press('KeyC');
  chase.patchedHealth = player.health;
  press('KeyZ');
  chase.favorsUsed = game.stats.favorsUsed - favorsBefore;
  chase.crewBar = document.querySelector('.crew-head').textContent;
  if (!chase.standingForFavors) failures.push('Nova was down when the script came to call the crew');
  else if (chase.jamDroppedTo !== 4 || !chase.jamming || chase.patchedHealth !== 100 || chase.favorsUsed < 2) failures.push(`the crew's favors did not work: ${JSON.stringify({ jam: chase.jamDroppedTo, jamming: chase.jamming, health: chase.patchedHealth, used: chase.favorsUsed })}`);

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
  const pauseMenu = { items: [...document.querySelectorAll('#pause-menu .menu-item span')].map((node) => node.textContent), hint: document.querySelector('#pause-menu .menu-hint').textContent, slots: document.querySelectorAll('#pause-menu .save-card').length, where: document.querySelector('.pause-where').textContent };
  for (const label of ['RESUME', 'SAVE GAME', 'LOAD GAME', 'CITY MAP', 'STATS', 'CONTROLS', 'SETTINGS', 'QUIT TO TITLE']) if (!pauseMenu.items.includes(label)) failures.push(`the pause menu has no ${label}`);
  if (pauseMenu.slots !== 3 || !pauseMenu.hint) failures.push(`the pause menu shows ${pauseMenu.slots} save slots and the hint "${pauseMenu.hint}"`);
  game.menus.open('stats');
  pauseMenu.statRows = document.querySelectorAll('#pause-menu .menu-table div').length;
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
    failures, missions, eclipse, afterStory, sight, sizes, radio, workshop, stunts, race, bounty, street, fares, chase, afterArrest, afterWipe, state: game.state, loaded: { guns: Object.keys(game.weapons.owned), jobs: game.missions.completed.size, cred: game.cred.points, workshop: game.workshop.levels, slot: game.saveSlot, summary: slotCards },
    hud, pauseMenu, msPerStep: (performance.now() - started) / steps, vehicles: game.vehicles.list.length, pedestrians: game.pedestrians.list.length, drawCalls: game.renderer.info.render.calls,
  };
}
