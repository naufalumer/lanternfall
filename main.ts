// Lanternfall — the entrypoint (Node 22, standard library only).
// It hands the game in: copies game/ and screenshots/ from beside this
// file into the output directory and writes dossier.json there with the
// vendored make.fun library. Two runs write identical bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(src, dest) {
  // cpSync follows the starter's contract: plain recursive copy, no
  // symlinks, deterministic order from the filesystem walk.
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

mkdirSync(out, { recursive: true });
copyTree(join(here, 'game'), join(out, 'game'));
if (existsSync(join(here, 'screenshots'))) {
  copyTree(join(here, 'screenshots'), join(out, 'screenshots'));
} else {
  mkdirSync(join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps for this competition: text is capped at 160 KiB,
// at most 4 screenshots of at most 256 KiB, game/ at most 993 files and
// 48 MiB with paths of at most 1000 bytes.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
