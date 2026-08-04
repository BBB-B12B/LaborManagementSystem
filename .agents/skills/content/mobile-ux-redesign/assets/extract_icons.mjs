#!/usr/bin/env node
/**
 * extract_icons.mjs — add real lucide icons to icons_sprite.svg by name.
 *
 * Why: the mockup must use the app's REAL icons, not emoji. This turns lucide icon
 * names into <symbol> entries you can <use href="#i-name"> in the mockup template.
 *
 * Usage:
 *   node extract_icons.mjs building-2 map-pin chevron-down        # add these
 *   node extract_icons.mjs --sprite ./icons_sprite.svg wrench     # custom sprite path
 *
 * Source of truth for the SVGs: the `lucide-static` npm package (icons as .svg files).
 *   npm i -D lucide-static        # if not already installed somewhere reachable
 * The script searches common locations; override with --lucide <dir-of-svgs>.
 *
 * Deprecated aliases re-export in lucide (bar-chart-3 -> chart-column). This script
 * follows one hop via ALIASES below so an old name still resolves. Add to ALIASES if
 * you hit a name that isn't found but you know its replacement.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// one-hop alias map for deprecated/renamed lucide icons
const ALIASES = {
  'bar-chart-3': 'chart-column',
  'bar-chart': 'chart-column',
  'x-circle': 'circle-x',
  'check-circle-2': 'circle-check-big',
  'check-circle': 'circle-check',
  'alert-triangle': 'triangle-alert',
  'alert-circle': 'circle-alert',
  'loader-2': 'loader-circle',
  'edit-2': 'pencil',
  'edit-3': 'pencil-line',
  'trending-up': 'trending-up',
};

// ---- args ----
const args = process.argv.slice(2);
let spritePath = join(HERE, 'icons_sprite.svg');
let lucideDir = null;
const names = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--sprite') spritePath = args[++i];
  else if (args[i] === '--lucide') lucideDir = args[++i];
  else names.push(args[i].replace(/^i-/, '').toLowerCase());
}
if (names.length === 0) {
  console.error('Give at least one lucide icon name, e.g.: node extract_icons.mjs building-2 map-pin');
  process.exit(1);
}

// ---- locate lucide-static icons dir ----
function findLucideDir() {
  if (lucideDir) return lucideDir;
  const candidates = [
    join(process.cwd(), 'node_modules/lucide-static/icons'),
    join(HERE, 'node_modules/lucide-static/icons'),
    join(HERE, '../../../node_modules/lucide-static/icons'),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return null;
}
const dir = findLucideDir();
if (!dir) {
  console.error('Could not find lucide-static icons. Install it (npm i -D lucide-static) or pass --lucide <dir>.');
  process.exit(1);
}

// ---- read the raw <svg> for a name, extract its inner markup ----
function iconInner(name) {
  const tryNames = [name, ALIASES[name]].filter(Boolean);
  for (const n of tryNames) {
    const p = join(dir, `${n}.svg`);
    if (existsSync(p)) {
      const svg = readFileSync(p, 'utf-8');
      // strip the outer <svg ...> and </svg>, keep the inner paths/shapes
      const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '').trim();
      return { resolved: n, inner };
    }
  }
  return null;
}

// ---- load existing sprite, append missing symbols before </svg> ----
let sprite = existsSync(spritePath) ? readFileSync(spritePath, 'utf-8') : '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">\n</svg>\n';
const have = new Set([...sprite.matchAll(/<symbol id="i-([a-z0-9-]+)"/g)].map(m => m[1]));

const added = [];
const missing = [];
let block = '';
for (const name of names) {
  if (have.has(name)) continue;
  const got = iconInner(name);
  if (!got) { missing.push(name); continue; }
  block += `<symbol id="i-${name}" viewBox="0 0 24 24">${got.inner}</symbol>\n`;
  added.push(name === got.resolved ? name : `${name}→${got.resolved}`);
}

if (block) {
  sprite = sprite.replace(/<\/svg>\s*$/i, block + '</svg>\n');
  writeFileSync(spritePath, sprite);
}
console.log(`sprite: ${spritePath}`);
console.log(`added (${added.length}): ${added.join(', ') || '—'}`);
if (missing.length) console.log(`NOT FOUND (add to ALIASES or check the name): ${missing.join(', ')}`);
