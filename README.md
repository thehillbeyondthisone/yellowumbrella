# Yellow Umbrella Group

Source for the Yellow Umbrella Group website and its interactive Flatiron LV floor-plan collection.

## Preview locally

This is a static site. From the repository root:

```powershell
npm run check
npm run serve
```

Then open `http://localhost:4173/`.

## Main routes

- `/` — studio overview
- `/capture.html` — 3D spatial capture
- `/floorplans.html` — 3D floor-plan service
- `/flatiron/` — interactive nine-residence sample

The capture page keeps its two large Gaussian-splat demos on the existing `yellowumbrella.group` host so this repository remains lightweight. The Flatiron collection is included in this repository and works without a build step.
