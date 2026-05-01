# Module context — Global navigation / logo drawer

Last reviewed: 2026-05-01.

## Scope

- Global topbar logo trigger: `#topbarLogoBtn` inside `.topbar`.
- Global nav: `<nav class="nav">` with buttons using `data-screen`.
- Backdrop: `#landscapeNavBackdrop` (kept existing ID; now used for all logo drawer sizes).
- Screen switching remains `openScreen(name)` and nav button click handlers.

## Current behavior

- Bottom nav is hidden by default because `.nav` is styled as a left drawer off-screen.
- Clicking/tapping the logo toggles `body.drawer-open`; drawer slides from left to right with dark/gold premium styling.
- In non-embed mode `isLandscapeDrawerModeActive()` returns true for all viewport sizes, so the logo trigger is always active.
- Escape/backdrop/nav item closes the drawer through existing `closeLandscapeNavDrawer()` path.

## Safe edit points

- Visual CSS for `.nav`, `.nav button`, `.landscape-nav-backdrop`, `.brand-logo-trigger`.
- Drawer open/close helpers only if preserving `openScreen`, `data-screen`, permissions, and active state.

## Do not touch

- `data-screen` values unless tab inventory changes.
- `openScreen()` business side effects for loading Home/Star/POS/Thu máy/etc.
- Permission filtering in `applyScreenAccess()`.

## Verification

- `public/` must remain 85 files before deploy.
- `/1` contains `topbarLogoBtn`, `landscapeNavBackdrop`, `<nav class="nav">`, all required `data-screen` buttons, and the version marker.
- `home-rank.js`, `star-native.js`, `internal-access.js` must remain JS MIME.
