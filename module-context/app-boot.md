# Module context — App boot / cold start splash

Last reviewed: 2026-05-01.

## Scope

- Main PWA entry: `public/index.html`.
- Early head bootstrap/version block: `window.__TK_APP_VERSION__` and critical boot CSS.
- Boot splash DOM: `#bootSplash`, `#bootSplashNote`.
- Boot splash helpers: `showBootSplash()`, `hideBootSplash()`, `playBootSplashSteps()`.
- Heavy optional barcode scanner library: `/vendor/html5-qrcode.min.js`.

## Current behavior

- On cold app launch after iOS/PWA process is killed, the browser can show default white before full HTML/CSS/JS finishes parsing.
- Critical inline CSS at the very top of `<head>` forces a dark branded fallback immediately.
- A tiny inline script at the top of `<body>` disables the fallback as soon as body parsing starts, then the normal `#bootSplash` takes over.
- `html5-qrcode.min.js` is not boot-loaded; purchase scanner lazy-loads it only when the scanner is opened so normal cold start avoids scanner network/parse work.

## Safe edit points

- Text/color of `#tk-critical-boot-style` fallback.
- Version marker and `version.json`.
- Boot note copy and timing.

## Do not touch without full regression

- Session resume/unlock flow around `unlockApp()`, `showManualLoginOverlay()`, `fetchBootstrapState()`.
- `clearLocalFootprint()`, panic/cache-bust logic, or lock/unlock behavior.
- Dynamic import paths for Home/Star.

## Verification

- `public/` remains exactly 85 files.
- `/1` contains `tk-critical-boot-style`, `tk-boot-fallback-off`, current `window.__TK_APP_VERSION__`, `#bootSplash`, and `ensurePurchaseScannerLibrary`; it should not contain a static boot script for `/vendor/html5-qrcode.min.js`.
- `/vendor/html5-qrcode.min.js`, `/home-rank.js`, `/star-native.js`, `/realtime-runtime.js`, `/realtime-bootstrap.js` return JS MIME.
