# Module context — Global performance/runtime cooling

Last reviewed: 2026-05-01.

## Scope

- `public/index.html` global boot/version config, update polling, API helper, tab switching.
- `public/realtime-runtime.js` cache cleanup/update runtime.
- `public/home-rank.js` Home Rank Firestore refresh loop.
- `public/version.json` version/update metadata.

## Current behavior after v20260501_2022_local_web_vitals_cooldown

- Duplicate background version polling was reduced: `window.__TK_RT_ROLLOUT__.enabled = false`; visible topbar update check remains active every 60s via `APP_UPDATE_CHECK_MS`.
- Legacy service-worker/cache cleanup is delayed to idle time in `realtime-runtime.js` instead of competing with first paint.
- `callApi()` can write GET snapshots only when callers pass `cacheTtlMs`; it does not cache every GET by default to avoid storage quota/jank. Snapshots are now hybrid sessionStorage + short-lived localStorage so fixed UI/data can appear immediately even after the PWA is killed and reopened.
- `renderApiSnapshot()` shows cached data immediately before network refresh for Dashboard, Recent Purchases, Stock summary/search, Supplier debt, Customer debt, Supplier returns. This is the preferred “static shell + stale-while-revalidate” path: fixed layout first, old data instantly, fresh data in background.
- Home Rank renders a session snapshot immediately, refreshes only when the page/screen is visible, and polls every 60s instead of 30s.
- Tab switching uses instant `scrollTo({behavior:'auto'})` only when needed instead of smooth scrolling every tab open.


## Added in v20260501_1936_full_perf_foundation

- Added IndexedDB hot cache (`tk-os-hot-cache`) behind the existing API snapshot path. Read-only GET snapshots now hydrate from memory/session/localStorage immediately and can fall back to IndexedDB for larger durable snapshots.
- Added a small Web Worker foundation for off-main-thread performance tasks/signatures, ready for heavier filtering/sorting phases without blocking touch/scroll.
- Added `renderProgressiveList()` to progressively/virtually render large lists in chunks during idle time instead of blocking the frame with one huge `innerHTML`.
- Applied progressive rendering to large debt/stock lists: supplier debts, customer debts, stock IMEI, stock accessories.
- Kept POST/mutation paths unchanged; business writes still refresh affected data normally.


## Added in v20260501_1936_perf_delta_monitor

- Added lightweight performance samples for API/render durations, stored locally only when useful for diagnosing slow paths.
- Added fast payload signatures to skip redundant snapshot writes when the API response did not change.
- Added render signatures to skip rebuilding large lists when inputs are unchanged.
- Progressive list render now records slow render samples so future optimization can target the real bottleneck.


## Added in v20260501_1939_battery_visibility_saver

- Added low-device/data-saver detection (`state.batterySaver`) using network saveData, CPU cores, and device memory hints.
- Added `getRealtimeDelay()` so non-urgent realtime timers slow down automatically when app is hidden or device is likely weak/low-power.
- Throttled app update checks, sales accessory polling, stock auto refresh, and stock request polling through visibility/battery-aware delays.
- Debounced layout recalculation and ignored layout sync while app is hidden to reduce resize/visualViewport jank.
- Visibility resume now avoids heavy refresh if the app was hidden only briefly.


## Added in v20260501_1943_instant_paint_worldclass

- Added preconnect hints for Google Fonts, Google font static host, and Font Awesome CDN to reduce first paint latency.
- Made Font Awesome stylesheet non-render-blocking (`media=print` + onload) with noscript fallback, so text/shell can paint immediately while icons hydrate after.
- Added CSS containment and `content-visibility:auto` to large cards/lists so offscreen rows do not cost layout/paint until needed.
- Battery saver and reduced-motion modes now cut animations/transitions aggressively to prevent heat/jank.
- Progressive list rendering uses smaller first/chunk sizes in battery saver mode, keeping touch/scroll responsive on weaker phones.


## Added in v20260501_1947_lazy_scanner_cool_boot

- Removed the boot-time `<script defer>` download for `/vendor/html5-qrcode.min.js`.
- Purchase IMEI camera scanner now lazy-loads html5-qrcode only when the user actually taps scan. This removes a non-essential boot network/parse task from normal app opening.
- Scanner loading keeps the modal feedback visible and retries cleanly if the script download fails.
- Scanner format lookup now uses `window.Html5QrcodeSupportedFormats` explicitly after lazy load.

## Added in v20260501_1958_cool_instant_scheduler

- Added a shared UI task scheduler using modern `scheduler.postTask` when available, plus `requestAnimationFrame` alignment and visibility guards.
- Debounced/coalesced hot mobile input renders for purchase receipt filtering, supplier debt search, customer debt search, returns source search, and purchase quick catalog preview so typing stays smooth and avoids repeated main-thread rebuilds.
- Progressive list background chunks now pause while the app is hidden and resume only when visible, avoiding wasted battery/heat from offscreen DOM work.
- `scheduleIdle()` now uses background-priority scheduler tasks when supported, keeping non-urgent cache/render chunks behind touch/visible UI work.

## Added in v20260501_2010_smart_module_warmup

- Added `rel="modulepreload"` for the critical Home Rank module using the current app version query, so the default home screen module can arrive before the first dynamic import needs it.
- Added `warmDynamicModule()` import promise caching so repeated Home/Star opens reuse the same module import promise instead of creating duplicate dynamic import work.
- Added battery/data-saver-aware idle warmup for the Star module: it only preloads when the page is visible, not in battery saver mode, not on `saveData`, and not on 2G/slow-2G.
- Visibility/focus/screen-open now opportunistically schedules this warmup without blocking first paint or active touch work.

## Added in v20260501_2022_local_web_vitals_cooldown

- Added local-only Web Vitals style observers using `PerformanceObserver` for FCP, LCP, CLS, long tasks, navigation timing, and BFCache resume samples.
- Samples remain local in `tk_perf_samples_v1`; nothing is sent externally. They include app version and active screen so future optimization can target real bottlenecks.
- Added adaptive performance cooldown: if recent local samples show repeated long tasks/slow renders/slow API, the app toggles `html.tk-performance-cooldown`, increases hot input debounce, and reduces progressive list chunk sizes.
- Added `pageshow` BFCache sample handling so fast browser/PWA resume behavior is tracked without extra network work.

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
- `/1` contains current `window.__TK_APP_VERSION__`, `rel="modulepreload"` for Home Rank, `API_SNAPSHOT_PREFIX`, `API_SNAPSHOT_IDB_NAME`, `PERF_SAMPLE_STORAGE_KEY`, `PERF_COOLDOWN_LONGTASK_MS`, `BATTERY_SAVER_MEMORY_GB`, `UI_INPUT_DEBOUNCE_MS`, `getRealtimeDelay`, `scheduleUiTask`, `runUiTask`, `warmDynamicModule`, `scheduleDynamicModuleWarmup`, `initLocalPerformanceObservers`, `PerformanceObserver`, `tk-performance-cooldown`, `syncBatterySaverState`, `ensurePurchaseScannerLibrary`, `shouldSkipRender`, `renderProgressiveList`, `content-visibility`, nonblocking Font Awesome, `APP_UPDATE_CHECK_MS = 60000`, and rollout `enabled: false`; it should not boot-load `/vendor/html5-qrcode.min.js` via a static script tag.
- `/home-rank.js` contains `HOME_RANK_CACHE_KEY`, visible-screen guard, and `AUTO_REFRESH_MS = 60_000`.
- `/realtime-runtime.js` contains `scheduleIdleCleanupLegacyBrowserCache()`.
