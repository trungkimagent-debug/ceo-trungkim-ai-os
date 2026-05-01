# Trung Kim OS production system map

Generated after production incident on 2026-05-01. Treat this as the baseline before edits.

## Current safe live baseline

- Firebase Hosting stable rollback version: `ada41e3d8d509184`.
- Local repo synced to full 85-file production artifact.
- Critical: do not deploy partial 17/18-file preview artifacts; they miss runtime modules and break dynamic imports.

## Hosting entry/config

- Main app entry: `public/index.html`.
- `/1`, `/thkd`, root and fallback route to `index.html` in stable config.
- Dynamic modules required by `index.html`:
  - `public/home-rank.js` for Home Rank screen.
  - `public/star-native.js` for Star screen.
- Runtime scripts required:
  - `public/realtime-runtime.js`
  - `public/realtime-bootstrap.js`
  - `public/vendor/html5-qrcode.min.js`

## Bottom nav tabs

| data-screen | Label | Main DOM section / module |
|---|---|---|
| `home` | Home | `#screen-home`, dynamic import `./home-rank.js` |
| `print` | Thu góp | `#screen-print`, plus `thugop*.js/html`, `legacy-core/thugop*` |
| `posgoc` | POS | `#screen-posgoc`, `pos-goc*.js/html/css`, `pos*.js/html` |
| `thumay` | Thu máy | `#screen-thumay`, `thumay*.js/html`, `legacy-core/thumay-repo.js` |
| `sales` | Bán | `#screen-sales` inside `index.html` |
| `purchase` | Nhập | `#screen-purchase` inside `index.html` |
| `stock` | Kho | `#screen-stock` inside `index.html` |
| `star` | Star | `#screen-star`, dynamic import `./star-native.js`, `star-*` files |
| `returns` | Trả | `#screen-returns` inside `index.html` |
| `supplier` | NCC | `#screen-supplier` inside `index.html` |
| `customer` | Nợ | `#screen-customer` inside `index.html` |
| `team` | NV | `#screen-team` inside `index.html` |

## Fast scoped deploy rule

- "Deploy phần đó thôi" means: change only the requested tab/module files and avoid touching unrelated code.
- For Firebase Hosting, still deploy from the complete safe `public/` artifact so required modules are not deleted. The diff must be scoped even if Firebase releases the full site version.
- Before deploying, inspect `git diff --stat` and confirm only intended files/sections changed.

## Safe edit rule

When Chủ tịch requests a change in one tab/screen:

1. Identify the exact `data-screen` and DOM section/module above.
2. Edit only that section/module unless Chủ tịch explicitly expands scope.
3. Preserve all files in the 85-file artifact when deploying.
4. Before live deploy, verify at minimum:
   - `/1` returns real app HTML containing `TRUNG HẬU KIM DUNG` and `Rank TOP`.
   - All dynamic imports for touched/untouched screens return JS MIME, especially `/home-rank.js` and `/star-native.js`.
   - The requested tab works and unrelated tabs are not missing assets.
5. If unsure, stop and ask; do not guess in production.
