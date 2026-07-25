// One-off generator: build a local icon set from the Barakath design-system bundle (exact glyphs the
// prototype renders) plus a few Remix-family extras for items the design set doesn't cover. Writes
// raw .svg files to src/assets/icons/ and a typed registry to src/components/icons/registry.ts.
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import * as Ri from '@remixicon/react';

// --- 1) parse the design bundle icon registry (committed in-repo for reproducibility) ---
const bundle = fs.readFileSync(
  path.resolve('../../docs/design/design-system/_ds_bundle.js'),
  'utf8',
);
const reg = {};
const re = /"([A-Za-z0-9]+)":\s*\{\s*viewBox:\s*"([^"]+)",\s*body:\s*"((?:[^"\\]|\\.)*)"/g;
let m;
while ((m = re.exec(bundle))) {
  const body = m[3].replace(/\\"/g, '"').replace(/\\n/g, '').replace(/\\\\/g, '\\');
  reg[m[1]] = { viewBox: m[2], body };
}
const designCount = Object.keys(reg).length;

// --- 2) extras from Remix (same icon family) for items/states the design set lacks ---
const extras = {
  FlashlightLine: 'RiFlashlightLine',
  SparklingLine: 'RiSparklingLine',
  LockPasswordLine: 'RiLockPasswordLine',
  Loader4Line: 'RiLoader4Line',
  LogoutBoxRLine: 'RiLogoutBoxRLine',
  ToolsLine: 'RiToolsLine',
  ImageLine: 'RiImageLine',
};
for (const [name, comp] of Object.entries(extras)) {
  const html = renderToStaticMarkup(createElement(Ri[comp]));
  const viewBox = (html.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 24 24';
  const body = html.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  reg[name] = { viewBox, body };
}

// --- 3) write raw .svg files ---
const svgDir = 'src/assets/icons';
fs.mkdirSync(svgDir, { recursive: true });
for (const [name, v] of Object.entries(reg)) {
  fs.writeFileSync(
    path.join(svgDir, name + '.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.viewBox}" fill="currentColor">${v.body}</svg>\n`,
  );
}

// --- 4) write the typed registry module ---
const regDir = 'src/components/icons';
fs.mkdirSync(regDir, { recursive: true });
const entries = Object.keys(reg)
  .sort()
  .map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(reg[n])},`)
  .join('\n');
const ts = `// AUTO-GENERATED — Barakath icon set.
// ${designCount} glyphs materialized verbatim from the design system bundle
// (docs/design/design-system) + ${Object.keys(extras).length} Remix-family extras for states/items the
// design set doesn't cover (spinner, lock, logout, tools, flash sale, new arrivals).
// Regenerate with apps/admin/gen-icons.mjs. Do not edit by hand.
export const iconRegistry = {
${entries}
} as const;

export type IconName = keyof typeof iconRegistry;
`;
fs.writeFileSync(path.join(regDir, 'registry.ts'), ts);
console.log(
  `wrote ${Object.keys(reg).length} icons (${designCount} design + ${Object.keys(extras).length} extra) -> ${svgDir} and ${regDir}/registry.ts`,
);
