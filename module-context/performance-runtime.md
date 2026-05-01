# Module context — Global performance/runtime cooling

Last reviewed: 2026-05-01.

## Scope

- `public/index.html` global boot/version config, update polling, API helper, tab switching.
- `public/realtime-runtime.js` cache cleanup/update runtime.
- `public/home-rank.js` Home Rank Firestore refresh loop.
- `public/version.json` version/update metadata.

## Current behavior after v20260501_1927_static_snapshot_runtime

- Duplicate background version polling was reduced: `window.__TK_RT_ROLLOUT__.enabled = false`; visible topbar update check remains active every 60s via `APP_UPDATE_CHECK_MS`.
- Legacy service-worker/cache cleanup is delayed to idle time in `realtime-runtime.js` instead of competing with first paint.
- `callApi()` can write GET snapshots only when callers pass `cacheTtlMs`; it does not cache every GET by default to avoid storage quota/jank. Snapshots are now hybrid sessionStorage + short-lived localStorage so fixed UI/data can appear immediately even after the PWA is killed and reopened.
- `renderApiSnapshot()` shows cached data immediately before network refresh for Dashboard, Recent Purchases, Stock summary/search, Supplier debt, Customer debt, Supplier returns. This is the preferred “static shell + stale-while-revalidate” path: fixed layout first, old data instantly, fresh data in background.
- Home Rank renders a session snapshot immediately, refreshes only when the page/screen is visible, and polls every 60s instead of 30s.
- Tab switching uses instant `scrollTo({behavior:'auto'})` only when needed instead of smooth scrolling every tab open.

## Safe edit points

- Increase/decrease `APP_UPDATE_CHECK_MS`, `AUTO_REFRESH_MS`, or API snapshot TTLs.
- Add `renderApiSnapshot()` to more read-only GET loaders.
- Further gate timers by `isRealtimePageVisible()` and `state.activeScreen`.

## Do not touch without focused regression

- Login/session restore and lock/unlock flow.
- POST/PUT/DELETE mutation paths; snapshots should be read-only only and mutations should force-refresh affected data.
- Home Rank Firestore query semantics (`staffs`, `staff_punches`, `tk_worktime_states`, `star_wallets`).

## Verification

- `public/` remains 85 files.
- `/1` contains current `window.__TK_APP_VERSION__`, `API_SNAPSHOT_PREFIX`, `API_SNAPSHOT_PERSIST_MAX_AGE_MS`, `APP_UPDATE_CHECK_MS = 60000`, and rollout `enabled: false`.
- `/home-rank.js` contains `HOME_RANK_CACHE_KEY`, visible-screen guard, and `AUTO_REFRESH_MS = 60_000`.
- `/realtime-runtime.js` contains `scheduleIdleCleanupLegacyBrowserCache()`.
