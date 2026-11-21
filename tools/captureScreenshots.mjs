// Takes the entry's screenshots: serves game/ on a local port, opens each scene of shots.json in Chromium through
// Playwright and saves what the browser rendered, untouched, into screenshots/.
//
//   PLAYWRIGHT_DIR=<folder with node_modules/playwright> node tools/captureScreenshots.mjs [--only <name>] [--out <dir>]
//   ... --smoke          plays the whole game by script instead and reports what happened and any console error
//   ... --sheet <dir>    renders a preview of the judge's contact sheet from screenshots/ into <dir> (never into the entry)
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { playWholeGame } from './smokeTest.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gameDir = join(root, 'game');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const only = option('--only');
const outDir = option('--out') ? resolve(option('--out')) : join(root, 'screenshots');
const sheetDir = option('--sheet') ? resolve(option('--sheet')) : null;
const smoke = args.includes('--smoke');
// The judge's sheet fits the cover inside 768x480, so the shots are taken at exactly that size; the game draws its
// 3D view at twice the pixels in a staged shot, so the frame is supersampled rather than scaled down afterwards.
const VIEWPORT = { width: 768, height: 480 };
const MAX_BYTES = 250 * 1024;

/** Serve game/ at the root and the entry's screenshots under /__shots/ (for the contact-sheet preview only). */
function serveGame() {
  const server = createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const base = pathname.startsWith('/__shots/') ? join(root, 'screenshots') : gameDir;
    const file = resolve(join(base, normalize(pathname.replace('/__shots/', '/'))));
    if (!file.startsWith(base + sep) || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404).end('not found'); return; }
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

/** The judge's view of the screenshots, rebuilt for the eye: the cover inside 768x480, the others in a row beneath. */
async function previewContactSheet(page, base) {
  const names = readdirSync(join(root, 'screenshots')).filter((name) => !name.startsWith('.')).sort();
  const cells = names.slice(1).map((name) => `<img src="${base}__shots/${name}" style="width:256px;height:160px;object-fit:contain">`).join('');
  await page.setViewportSize({ width: 768, height: 640 });
  await page.setContent(`<body style="margin:0;background:#000"><img src="${base}__shots/${names[0]}" style="width:768px;height:480px;object-fit:contain;display:block"><div style="display:flex">${cells}</div></body>`);
  await page.waitForLoadState('networkidle');
  mkdirSync(sheetDir, { recursive: true });
  await page.screenshot({ path: join(sheetDir, 'contact-sheet.png') });
  await page.screenshot({ path: join(sheetDir, 'cover-768.png'), clip: { x: 0, y: 0, width: 768, height: 480 } });
  console.log(`contact sheet preview written to ${sheetDir}`);
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
  await page.waitForFunction(() => window.totality && window.totality.state === 'title', null, { timeout: 60000 });
  const report = await page.evaluate(playWholeGame);
  console.log(JSON.stringify(report, null, 1));
  for (const failure of report.failures) problems.push(`smoke check failed: ${failure}`);
} else if (sheetDir) {
  await previewContactSheet(page, base);
} else {
  const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
  mkdirSync(outDir, { recursive: true });
  for (const shot of shots) {
    if (only && !shot.name.includes(only)) continue;
    await page.goto(base + shot.query);
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
    // The frame is frozen; a longer wait only lets the notification toasts time out of a crowded shot.
    await page.waitForTimeout(shot.wait ?? 1500);
    let quality = 92;
    let image = await page.screenshot({ type: 'jpeg', quality });
    while (image.length > MAX_BYTES && quality > 50) {
      quality -= 3;
      image = await page.screenshot({ type: 'jpeg', quality });
    }
    await page.screenshot({ type: 'jpeg', quality, path: join(outDir, shot.name) });
    console.log(`${shot.name}: ${image.length} bytes at quality ${quality}`);
  }
}
if (problems.length) console.log(`PROBLEMS:\n${[...new Set(problems)].join('\n')}`);
await browser.close();
server.close();
if (problems.length) process.exitCode = 1;
