// Takes the entry's screenshots: serves game/ on a local port, opens each scene of shots.json in Chromium through
// Playwright and saves what the browser rendered, untouched, into screenshots/.
//
//   PLAYWRIGHT_DIR=<folder with node_modules/playwright> node tools/captureScreenshots.mjs [--only <name>] [--smoke]
//
// --smoke plays a new game for a few seconds instead and reports any console error.
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gameDir = join(root, 'game');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json' };
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const smoke = args.includes('--smoke');
const VIEWPORT = { width: 1280, height: 800 };
const MAX_BYTES = 250 * 1024;

function serveGame() {
  const server = createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(join(gameDir, normalize(pathname)));
    if (!file.startsWith(gameDir + sep) || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end('not found'); return; }
    response.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    response.end(readFileSync(file));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

async function launchBrowser() {
  const require = createRequire(join(process.env.PLAYWRIGHT_DIR ?? root, 'package.json'));
  const { chromium } = require('playwright');
  const flags = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
  try {
    return await chromium.launch({ channel: 'chrome', args: flags });
  } catch (error) {
    return chromium.launch({ args: flags });
  }
}

const server = await serveGame();
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
page.on('pageerror', (error) => problems.push(String(error.stack || error)));
page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
page.on('request', (request) => { if (!request.url().startsWith(base) && !request.url().startsWith('data:')) problems.push(`network request: ${request.url()}`); });

if (smoke) {
  await page.goto(base);
  await page.waitForFunction(() => window.solmara && window.solmara.state === 'title', null, { timeout: 60000 });
  // Plays the whole story by teleporting between objectives, then dies, gets arrested, shops, drives a fare and reloads.
  const report = await page.evaluate(() => {
    const game = window.solmara;
    const player = game.player;
    game.newGame();
    const started = performance.now();
    let steps = 0;
    const run = (count) => { for (let k = 0; k < count; k += 1) { game.update(1 / 60); steps += 1; } };
    const teleport = (x, z) => {
      if (player.vehicle) { player.vehicle.position.x = x; player.vehicle.position.z = z; player.vehicle.velX = 0; player.vehicle.velZ = 0; }
      player.position.x = x; player.position.z = z;
    };
    const pressF = () => { game.input.pressed.add('KeyF'); run(1); };
    const boardCar = (car) => {
      if (player.vehicle && player.vehicle !== car) pressF();
      if (!player.vehicle) { teleport(car.position.x + 2.4, car.position.z); pressF(); }
    };
    const missions = [];
    for (let round = 0; round < 8; round += 1) {
      run(360);
      game.wanted.reset();
      const offer = game.missions.offers()[0];
      if (!offer) break;
      if (player.vehicle) pressF();
      teleport(offer.at.x, offer.at.z);
      run(3);
      for (let safety = 0; game.missions.active && safety < 3000; safety += 1) {
        const active = game.missions.active;
        const step = active.step;
        player.health = 100;
        if (step.kind === 'steal') boardCar(active.vehicle);
        else if (step.kind === 'goto' || step.kind === 'deliver' || step.kind === 'wait') {
          if ((step.kind === 'deliver' || step.vehicle) && player.vehicle !== active.vehicle) boardCar(active.vehicle);
          else teleport(step.at[0], step.at[1]);
        } else if (step.kind === 'collect' || step.kind === 'race') teleport(active.remaining[0].x, active.remaining[0].z);
        else if (step.kind === 'eliminate') { for (const g of game.gunmen.list) if (g.alive && g.missionTag === active.tag) g.takeDamage(999, true); }
        else if (step.kind === 'loseCops') game.wanted.clear();
        run(2);
      }
      missions.push(`${offer.id}:${game.missions.completed.has(offer.id) ? 'passed' : 'NOT PASSED'}`);
    }
    const cashAfterStory = player.cash;
    game.wanted.reset();
    run(30);
    if (player.vehicle) pressF();
    game.shops.openGunShop();
    game.shops.buy('shotgun');
    game.shops.close();
    const cab = game.vehicles.spawn('solCab', player.position.x + 2.4, player.position.z, 0);
    cab.parked = true;
    pressF();
    game.activities.toggleTaxi();
    teleport(game.activities.fare.pickup.x, game.activities.fare.pickup.z);
    run(5);
    teleport(game.activities.fare.drop.x, game.activities.fare.drop.z);
    run(5);
    const fares = game.activities.faresDone;
    game.saveGame(false);
    game.wanted.setStars(5, 30);
    run(900);
    const chase = { stars: game.wanted.stars, units: game.police.pursuitUnits().length, chopper: game.police.helicopter.active, officers: game.gunmen.list.length };
    player.health = 100;
    game.onPlayerDown('busted');
    run(400);
    const afterArrest = { alive: player.alive, stars: game.wanted.stars, guns: Object.keys(game.weapons.owned).length };
    player.invulnerable = 0;
    player.takeDamage(999, 'bullet');
    run(400);
    const afterWipe = { alive: player.alive, health: player.health };
    game.continueGame();
    run(120);
    game.setState('pause');
    game.menus.open('stats');
    game.setState('map');
    game.setState('play');
    return {
      missions, cashAfterStory, fares, chase, afterArrest, afterWipe, state: game.state, loadedGuns: Object.keys(game.weapons.owned), loadedMissions: game.missions.completed.size,
      msPerStep: (performance.now() - started) / steps, vehicles: game.vehicles.list.length, pedestrians: game.pedestrians.list.length, drawCalls: game.renderer.info.render.calls,
    };
  });
  console.log(JSON.stringify(report, null, 1));
} else {
  const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
  for (const shot of shots) {
    if (only && !shot.name.includes(only)) continue;
    await page.goto(base + shot.query);
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
    await page.waitForTimeout(1500);
    let quality = 90;
    let image = await page.screenshot({ type: 'jpeg', quality });
    while (image.length > MAX_BYTES && quality > 50) {
      quality -= 4;
      image = await page.screenshot({ type: 'jpeg', quality });
    }
    await page.screenshot({ type: 'jpeg', quality, path: join(root, 'screenshots', shot.name) });
    console.log(`${shot.name}: ${image.length} bytes at quality ${quality}`);
  }
}
if (problems.length) console.log(`PROBLEMS:\n${[...new Set(problems)].join('\n')}`);
await browser.close();
server.close();
