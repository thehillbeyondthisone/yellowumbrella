# History

Recent changes to the site, newest first.

## 2026-10-12 — Three services, new home page animations

- Home page: 3D modeling and 3D printing removed. The services are now spatial capture, 3D floor plans, and large-format print & apparel, with the copy, form options, share text and `og.png` tagline updated to match.
- Spatial capture animation now cycles through the twelve industry scenes from the capture page. Their code moved out of `capture.html` into the shared `splat-scenes.js`, which both pages load.
- 3D floor plans animation now builds the Grotto from `flatiron/plans.js`: brochure drawing, floors and walls, furniture, then dusk and the lamps. It needs a web server (`npm run serve`); opened as a plain file, that one viewer stays empty.
- "How a project goes" steps 2 and 3 and the United States card reworded; "3d assets" removed from the hero badge.

## 2026-10-10 — Sync with the latest site from `splat/website`

- Home page, floor-plan service page and site checklist updated to the 2 Oct versions (industry explorer, project form, 3D floor-plan service copy).
- Added `og.png` (social preview image) and the VR page's thumbnails and QR codes.
- VR page now links to the hosted splat demos on `yellowumbrella.group`, matching the capture page, since the demos themselves aren't in this repo.
- `scripts/check-site.mjs` now checks every local link on every page; `scripts/serve.mjs` serves `.svg`, `.jpg` and `.docx` correctly.
- README links to the live GitHub Pages site.
- `send.php` intentionally left out: Pages can't run it, and the form falls back to email.

## 2026-09-29 — First Pages deployment

- Created the site repo with the capture, floor-plan, Flatiron, paperwork and VR pages, and the Pages deploy workflow.
