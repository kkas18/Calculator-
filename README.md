# Calculator — Android PWA build

Complete, integrated build. Nothing to patch: `index.html` already contains the
manifest links, install controller, offline worker registration and back-gesture
handling.

```
index.html                  the app
manifest.webmanifest        name, colours, icons, shortcuts
sw.js                       offline shell + font cache
icon.svg
icon-192.png                icon-512.png                any
icon-maskable-192.png       icon-maskable-512.png       adaptive (Android masks these)
icon-mono-192.png           icon-mono-512.png           One UI themed icons
test.js                     55 jsdom tests — node test.js
```

## Deploy

Serve all files from the same directory over `https://` or `localhost`.
`file://` gives you neither install nor service worker. GitHub Pages is enough:
commit the folder, enable Pages, open the URL on the S24.

## Verify on the S24

1. Chrome → `⋮` → Add to Home screen. The icon should be the dark tile with keys,
   masked to the One UI shape — not a screenshot of the page in a circle.
2. Long-press the icon: **Pro mode** and **Convert** appear as shortcuts.
3. Launch it. No URL bar; the status bar takes the app's colour and flips with the
   light/dark toggle.
4. Airplane mode, then launch: loads with Fraunces and Manrope intact.
5. Open History, swipe back: the sheet closes and the app stays open.

## Shipping updates

Bump `VERSION` in `sw.js` (`calc-v4` → `calc-v5`). Old caches drop on activate, the
Update chip appears in the plate, and tapping it swaps the build and reloads.

Chrome installs Android PWAs as a WebAPK, so **name, icon, shortcuts and theme colour
are baked at install time**. Manifest edits take up to a day to propagate — uninstall
and reinstall when checking icon changes.

## Optional — richer install dialog

On Android, Chrome shows a large install card when the manifest carries screenshots.
Take two portrait shots on the S24, save as `shot-1.png` / `shot-2.png`, and add:

```json
  "screenshots": [
    { "src": "shot-1.png", "sizes": "1080x2340", "type": "image/png", "form_factor": "narrow", "label": "Standard mode" },
    { "src": "shot-2.png", "sizes": "1080x2340", "type": "image/png", "form_factor": "narrow", "label": "Pro mode" }
  ],
```

`sizes` must match the real pixel dimensions or Chrome ignores them.

## What changed from the previous file

- The blob-URL manifest and the canvas icon painter are gone. Chromium needs a
  fetchable manifest with 192 and 512 px icons, `start_url`, `display` and `name`;
  real files are the reliable route and they drop a paint from every cold start.
- `sw.js` is now a real file — the only way a worker can register. The old copy was
  pasted inline in the page, where `register('sw.js')` was 404ing silently.
- Sheets push a history entry, so the back gesture closes the sheet rather than the app.
- Fonts are cached as opaque responses, so an offline launch keeps the typography.
- Install chip: native prompt when Chrome offers one, a how-to sheet otherwise.
