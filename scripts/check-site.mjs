import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'index.html',
  'capture.html',
  'floorplans.html',
  'floorplans/grotto-brochure.webp',
  'floorplans/grotto-3d.webp',
  'floorplans/poster.webp',
  'flatiron/index.html',
  'flatiron/collection.css',
  'flatiron/collection.js',
  'flatiron/plans.js',
  'flatiron/vendor/three.module.js',
];

for (const file of required) {
  if (!existsSync(resolve(root, file))) throw new Error(`Missing required site file: ${file}`);
}

const home = readFileSync(resolve(root, 'index.html'), 'utf8');
const service = readFileSync(resolve(root, 'floorplans.html'), 'utf8');
const viewer = readFileSync(resolve(root, 'flatiron/index.html'), 'utf8');
const viewerScript = readFileSync(resolve(root, 'flatiron/collection.js'), 'utf8');

const checks = [
  [home.includes('href="floorplans.html"'), 'Home page must link to the floor-plan service.'],
  [service.includes('data-src="flatiron/"'), 'Floor-plan service must load the local viewer.'],
  [viewer.includes('CHOOSE A RESIDENCE'), 'Viewer must make residence selection explicit.'],
  [viewer.includes('Choose a view'), 'Viewer must label its primary view controls.'],
  [viewer.includes('Jump to a room'), 'Viewer must label room navigation.'],
  [!viewer.includes('<body class="home">'), 'Viewer must open on a residence, not the decorative overview.'],
  [viewerScript.includes("selectPlan(initialPlan&&byId[initialPlan]?initialPlan:'elle',false)"), 'Viewer must select a residence by default.'],
];

for (const [passed, message] of checks) {
  if (!passed) throw new Error(message);
}

console.log(`Site check passed: ${required.length} required files and ${checks.length} floor-plan flow checks.`);
