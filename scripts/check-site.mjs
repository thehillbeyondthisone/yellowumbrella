// Checks that the site is complete before it is pushed: every page is there, every local
// link and image on every page points at a file that exists, and the floor-plan flow still
// reads the way it was designed. The two Gaussian-splat demos stay on yellowumbrella.group
// (they are ~260 MB), so pages link to them there instead of to local copies.
//
// Usage: npm run check
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'index.html',
  'capture.html',
  'floorplans.html',
  'checklist.html',
  'paperwork.html',
  'vr.html',
  'og.png',
  'splat-scenes.js',
  'floorplans/grotto-brochure.webp',
  'floorplans/grotto-3d.webp',
  'floorplans/poster.webp',
  'flatiron/index.html',
  'flatiron/collection.css',
  'flatiron/collection.js',
  'flatiron/plans.js',
  'flatiron/vendor/three.module.js',
  'demos/apartment/poster.jpg',
  'demos/engineroom/poster.jpg',
];

for (const file of required) {
  if (!existsSync(resolve(root, file))) throw new Error(`Missing required site file: ${file}`);
}

// Every hand-written page: the top level plus the floor-plan viewer.
const pages = [
  ...readdirSync(root).filter(name => name.endsWith('.html')),
  ...readdirSync(resolve(root, 'flatiron')).filter(name => name.endsWith('.html')).map(name => `flatiron/${name}`),
];

const broken = [];
let links = 0;
for (const page of pages) {
  const html = readFileSync(resolve(root, page), 'utf8');
  for (const [, target] of html.matchAll(/\s(?:href|src|data-demo|data-src)="([^"]+)"/g)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue; // another site, mailto:, data:, or an in-page anchor
    let file = resolve(root, dirname(page), decodeURIComponent(target.split(/[?#]/)[0]));
    if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, 'index.html');
    links++;
    if (!existsSync(file)) broken.push(`${page} -> ${target}`);
    else if (relative(root, file).startsWith('..')) broken.push(`${page} -> ${target} (outside the site)`);
  }
}
if (broken.length) throw new Error(`Broken local links:\n  ${broken.join('\n  ')}`);

const home = readFileSync(resolve(root, 'index.html'), 'utf8');
const service = readFileSync(resolve(root, 'floorplans.html'), 'utf8');
const capture = readFileSync(resolve(root, 'capture.html'), 'utf8');
const viewer = readFileSync(resolve(root, 'flatiron/index.html'), 'utf8');
const viewerScript = readFileSync(resolve(root, 'flatiron/collection.js'), 'utf8');

const checks = [
  [home.includes('href="floorplans.html"'), 'Home page must link to the floor-plan service.'],
  [service.includes('data-src="flatiron/"'), 'Floor-plan service must load the local viewer.'],
  [capture.includes('data-demo="https://yellowumbrella.group/demos/apartment/index.html"'), 'Capture page must load the hosted apartment demo.'],
  [capture.includes('data-demo="https://yellowumbrella.group/demos/engineroom/index.html"'), 'Capture page must load the hosted engine room demo.'],
  [viewer.includes('CHOOSE A RESIDENCE'), 'Viewer must make residence selection explicit.'],
  [viewer.includes('Choose a view'), 'Viewer must label its primary view controls.'],
  [viewer.includes('Jump to a room'), 'Viewer must label room navigation.'],
  [!viewer.includes('<body class="home">'), 'Viewer must open on a residence, not the decorative overview.'],
  [viewerScript.includes("selectPlan(initialPlan&&byId[initialPlan]?initialPlan:'elle',false)"), 'Viewer must select a residence by default.'],
];

for (const [passed, message] of checks) {
  if (!passed) throw new Error(message);
}

console.log(`Site check passed: ${required.length} required files, ${links} local links across ${pages.length} pages, and ${checks.length} flow checks.`);
