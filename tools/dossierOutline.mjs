// Prints what the judge is shown of the source: first the order in which the dossier lists the game's files
// (index.html, the module walk from main.js, then the rest by path) with each file's size and where the 160 KiB text
// cap falls, then the outline of the judge's view as the rules describe it. That view is held to 1,536 tokens an
// entry, the sheet of screenshots takes 1,120 of them, and three bytes of text go to a token: 1,248 bytes of outline.
// With eighty source files that is the first line, the Game block's two lines and about a dozen file headings, so
// the files the page loads first are the ones the judge reads the names of.
//
//   node tools/dossierOutline.mjs
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, htmlFacts, importOrder, readGameTree } from '../vendor/makefun-game.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gameDir = join(root, 'game');
const TEXT_CAP = 163840;
const VIEW_TOKENS = 1536;
const SHEET_TOKENS = 1120;
const BYTES_PER_TOKEN = 3;

/** The first few declarations of a source file, roughly as an outline of it would name them. */
function firstDeclarations(text, limit = 4) {
  const names = [];
  for (const line of text.split('\n')) {
    const match = /^(?:export\s+)?(?:async\s+)?(?:class|function)\s+([A-Za-z0-9_$]+)/.exec(line) || /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)/.exec(line) || /^ {2}(?:static\s+|async\s+)?([A-Za-z0-9_$]+)\(.*\)\s*\{$/.exec(line) || /^([.#][A-Za-z0-9_#. :>-]+)\s*\{/.exec(line);
    if (match && !['if', 'for', 'while', 'switch', 'constructor'].includes(match[1])) names.push(match[1]);
    if (names.length >= limit) break;
  }
  return names.join(', ');
}

/** What a line costs in the view's budget: its bytes as JSON text, the line break included. */
function lineCost(line) {
  return Buffer.byteLength(JSON.stringify(`${line}\n`), 'utf8') - 2;
}

/**
 * The outline of the judge's view for a dossier text: its opening line, the Game block's kept lines, then as many
 * file headings as the budget holds, and the line that says what was cut. (When every heading fits, the view goes
 * on to declarations; with this many files it never gets there, so this stops at the headings.)
 */
function judgeOutline(text, screenshots) {
  const budget = (VIEW_TOKENS - SHEET_TOKENS) * BYTES_PER_TOKEN;
  const lines = text.split('\n');
  const firstHeading = lines.findIndex((line) => line.startsWith('### '));
  const kept = [];
  for (const line of lines.slice(0, firstHeading)) {
    if (line.trim() === '') { if (kept.length > 0 && kept.at(-1) !== '') kept.push(''); } else if (/^(#{1,6}\s|(Source files|Files|Scripts|Instances|Totals):\s)/.test(line)) kept.push(line.trimEnd());
  }
  while (kept.at(-1) === '') kept.pop();
  const headings = lines.filter((line) => line.startsWith('### ')).map((line) => line.trimEnd());
  const opening = `[An outline of the entry's source: each file's heading and its declarations, bodies and comments left out. The image: its ${screenshots} screenshots on one sheet, the cover on top, the rest below in order.]`;
  const cut = (left) => `[Cut at ${budget} bytes: ${left} file headings, 1500 declaration lines and 555000 bytes of source left out.]`;
  const all = [opening, ...kept, '', ...headings];
  const room = budget - lineCost(cut(headings.length));
  const shown = [];
  let used = 0;
  for (const line of all) {
    if (used + lineCost(line) > room) break;
    used += lineCost(line);
    shown.push(line);
  }
  const headingsShown = shown.filter((line) => line.startsWith('### ')).length;
  return { budget, used, lines: [...shown, cut(headings.length - headingsShown)], headingsShown, headings: headings.length };
}

const tree = readGameTree(gameDir, {});
const sources = tree.files.filter((file) => file.cls === 'source').map((file) => ({ path: file.path, bytes: readFileSync(join(gameDir, file.path)) }));
const html = htmlFacts(sources.find((source) => source.path === 'index.html').bytes.toString('utf8'));
const walked = importOrder(sources, html).filter((path) => path !== 'index.html');
const seen = new Set(['index.html', ...walked]);
const rest = sources.map((source) => source.path).filter((path) => !seen.has(path)).sort();
const byPath = new Map(sources.map((source) => [source.path, source]));

let total = 0;
let position = 0;
for (const path of ['index.html', ...walked, ...rest]) {
  const source = byPath.get(path);
  const size = source.bytes.length;
  total += size + 80;
  position += 1;
  const mark = total <= TEXT_CAP ? ' ' : total - size - 80 < TEXT_CAP ? '~' : 'x';
  console.log(`${mark} ${String(position).padStart(2)} ${String(size).padStart(6)} ${String(total).padStart(7)}  ${path}  [${firstDeclarations(source.bytes.toString('utf8'))}]`);
}
console.log(`\n${sources.length} source files; ' ' fits whole, '~' is cut partway, 'x' is left out of the ${TEXT_CAP}-byte text.`);

const dossier = JSON.parse(Buffer.from(buildDossier(root, { text_max_bytes: TEXT_CAP, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648, game_path_max_bytes: 1000 })).toString('utf8'));
const outline = judgeOutline(dossier.text, dossier.images.length);
console.log(`\nThe judge's outline (${outline.used} of ${outline.budget} bytes, ${outline.headingsShown} of ${outline.headings} headings in the dossier's text):\n`);
console.log(outline.lines.join('\n'));
