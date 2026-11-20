// Prints the order in which the dossier lists the game's sources (index.html, the module walk from main.js, then
// the rest by path), each file's size, its first declarations and where the 160 KiB text cap falls.
//
//   node tools/dossierOutline.mjs
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlFacts, importOrder, readGameTree } from '../vendor/makefun-game.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const gameDir = join(root, 'game');
const TEXT_CAP = 163840;

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
