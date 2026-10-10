# History

Recent changes to the site, newest first.

## 2026-10-10 — Sync with the latest site from `splat/website`

- Home page, floor-plan service page and site checklist updated to the 2 Oct versions (industry explorer, project form, 3D floor-plan service copy).
- Added `og.png` (social preview image) and the VR page's thumbnails and QR codes.
- VR page now links to the hosted splat demos on `yellowumbrella.group`, matching the capture page, since the demos themselves aren't in this repo.
- `scripts/check-site.mjs` now checks every local link on every page; `scripts/serve.mjs` serves `.svg`, `.jpg` and `.docx` correctly.
- README links to the live GitHub Pages site.
- `send.php` intentionally left out: Pages can't run it, and the form falls back to email.

## 2026-09-29 — First Pages deployment

- Created the site repo with the capture, floor-plan, Flatiron, paperwork and VR pages, and the Pages deploy workflow.
