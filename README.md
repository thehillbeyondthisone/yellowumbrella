# Yellow Umbrella Group

**Live site: [thehillbeyondthisone.github.io/yellowumbrella](https://thehillbeyondthisone.github.io/yellowumbrella/)**

Source for the Yellow Umbrella Group website and its interactive Flatiron LV floor-plan collection. Every push to `main` deploys to GitHub Pages through `.github/workflows/pages.yml`.

## Preview locally

This is a static site. From the repository root:

```powershell
npm run check
npm run serve
```

Then open `http://localhost:4173/`.

## Main routes

- `/` — studio overview and project form
- `/capture.html` — 3D spatial capture
- `/floorplans.html` — 3D floor-plan service
- `/flatiron/` — interactive nine-residence sample
- `/vr.html` — the sample scenes in a VR headset
- `/checklist.html` — site preparation checklist
- `/paperwork.html` — client paperwork (Word downloads in `/paperwork/`)

## Notes

- The two Gaussian-splat demos (about 260 MB) stay on the `yellowumbrella.group` host so this repository remains lightweight. The capture and VR pages link to them there; only their posters, thumbnails and QR codes live here.
- The project form posts to `send.php` on a PHP host. GitHub Pages cannot run PHP, so on Pages the form falls back to opening the visitor's email app with the enquiry filled in.
- The working copy of this site lives in the `splat` project under `website/`; see `HISTORY.md` for recent changes.
