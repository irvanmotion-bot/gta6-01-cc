// The scripted playthrough behind `captureScreenshots.mjs --smoke`. It runs inside the page: plays every story job
// by teleporting between objectives, then shops, tunes a car, races, claims a bounty, calls the crew, drives a
// fare, survives a five-star response, is arrested and wiped out, and saves and loads across slots.

/** Runs in the browser (page.evaluate): returns a report of what each system did. */
export function playWholeGame() {
  const game = window.solmara;
  const player = game.player;
  for (let slot = 1; slot <= 3; slot += 1) window.localStorage.removeItem(`solmara-heat-save-v1-slot-${slot}`);
  game.newGame(2);
  const started = performance.now();
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

  // The story: ten jobs, each stage counted as it goes by.
  const missions = [];
  let stagesSeen = 0;
  for (let round = 0; round < 14; round += 1) {
    run(360);
    game.wanted.reset();
    const offer = game.missions.offers()[0];
    if (!offer) break;
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
      if (step.kind === 'steal') boardCar(active.vehicle);
      else if (step.kind === 'goto' || step.kind === 'deliver' || step.kind === 'wait') {
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

  // Taxi fares in a Sol Cab.
  const cab = game.vehicles.spawn('solCab', player.position.x + 2.4, player.position.z, 0);
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
  for (let k = 0; k < 150; k += 1) {
    game.input.held.add('KeyW');
    player.health = 100;
    cab.health = cab.maxHealth;
    run(8);
    for (const unit of game.police.roster()) { tactics.add(unit.tactic); kinds.add(unit.kind); }
    roadblocks = Math.max(roadblocks, game.police.roadblocks.list.length);
  }
  game.input.held.clear();
  const chase = { stars: game.wanted.stars, tier: game.wanted.responseTier(), units: game.police.pursuitUnits().length, chopper: game.police.helicopter.active, roster: game.police.roster().length, tactics: [...tactics], kinds: [...kinds], roadblocks };
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
    job: document.querySelector('.job-header').textContent, tier: document.querySelector('.wanted-tier').textContent, rank: document.querySelector('.rank-meter .meter-label').textContent,
    slots: document.querySelectorAll('.weapon-slot.owned').length, favors: document.querySelectorAll('.favor').length, atlasJobs,
  };
  const slotCards = JSON.parse(window.localStorage.getItem('solmara-heat-save-v1-slot-2')).summary;
  return {
    missions, afterStory, workshop, race, bounty, fares, chase, afterArrest, afterWipe, state: game.state, loaded: { guns: Object.keys(game.weapons.owned), jobs: game.missions.completed.size, cred: game.cred.points, workshop: game.workshop.levels, slot: game.saveSlot, summary: slotCards },
    hud, msPerStep: (performance.now() - started) / steps, vehicles: game.vehicles.list.length, pedestrians: game.pedestrians.list.length, drawCalls: game.renderer.info.render.calls,
  };
}
