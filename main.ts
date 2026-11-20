// Solmara Heat's hand-in program (Node 22, standard library only). The game itself is game/: static files a desktop
// browser plays offline. This copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json with the kit's own buildDossier, so the gate can rebuild the same bytes.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The scorer's caps for this bounty: only text_max_bytes shapes the dossier, the rest refuse an oversized entry. */
const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const repository = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** Copy one of the entry's folders into the output, replacing whatever an earlier run left there. */
function handIn(folder: string): void {
  const target = join(output, folder);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  const source = join(repository, folder);
  if (existsSync(source)) cpSync(source, target, { recursive: true });
}

mkdirSync(output, { recursive: true });
handIn('game');
handIn('screenshots');
writeFileSync(join(output, 'dossier.json'), buildDossier(output, GATE_CAPS));
