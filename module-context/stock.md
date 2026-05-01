# Module context — Stock / Kho

Last reviewed: 2026-05-01.

## Scope

- Main stock screen: `#screen-stock` in `public/index.html`.
- Stock accessory request panel:
  - `#stockAccessoryRequestList`
  - `#stockAccessoryRequestRefreshBtn`
  - `#stockAccessoryRequestMsg`
  - request confirm buttons with `data-request-confirm`.
- Supporting global realtime helpers used by this panel:
  - `isRealtimePageVisible()`
  - `getRealtimeDelay()`
  - `patchRealtimeKeyedList()`
  - `getAccessoryRealtimeItemsSignature()`.

## Request queue API boundary

- Read: `GET /internal/pos/sales/accessory-requests/pending-warehouse`.
- Confirm by warehouse: `POST /internal/pos/sales/accessory-requests/{id}/warehouse-confirm`.
- Sales-side queue is refreshed after confirm with `loadSalesAccessoryPendingFinalizeQueue(...)`.

## Current behavior

- `loadStockAccessoryRequestQueue()` loads only the small pending warehouse queue, not the whole stock inventory.
- `renderStockAccessoryRequestQueue()` uses `patchRealtimeKeyedList()` so unchanged cards are kept and only changed/new/removed request cards are patched.
- `handleStockAccessoryAudioAlerts()` announces new/reminder states but is guarded by `shouldWatchStockAccessoryRequestBackground()`.
- `syncStockAccessoryRequestBackgroundWatch()` starts/stops the watcher when Stock is active or native tablet mode is visible.

## 2026-05-01 — Live/cool request watch

- Goal: Kho receives accessory request tickets without pressing refresh, while avoiding hot device / battery drain.
- Added foreground Stock watcher delay tiers:
  - first/changed rounds: `STOCK_ACCESSORY_REQUEST_LIVE_ACTIVE_MS = 2500`
  - quiet stable rounds: `STOCK_ACCESSORY_REQUEST_LIVE_QUIET_MS = 5000`
  - long-idle foreground: `STOCK_ACCESSORY_REQUEST_LIVE_IDLE_MS = 8000`
- Existing `getRealtimeDelay()` still doubles/triples delays under battery saver/performance cooldown and stretches to 60s when hidden.
- Added `stockAccessoryRequestAutoRefreshErrorRounds` exponential backoff up to sleep delay so network/API failures do not spin.
- No inventory list refresh was made faster; only the small pending request queue uses this near-realtime watch.

## Safe edit points

- Delay constants and `getStockAccessoryRequestLiveDelay()`.
- `loadStockAccessoryRequestQueue()` signature/diff handling.
- Card HTML in `buildStockAccessoryRequestCardHtml()`.

## Do not touch unless requested

- Full stock inventory APIs, IMEI/accessory list rendering, purchase workspace, sales checkout flow.
- `warehouse-confirm` semantics and sale-side `confirm-picked-up` semantics.

## Verification

- `public/` remains 85 files.
- `/1` contains `#screen-stock`, `stockAccessoryRequestList`, version marker, and `getStockAccessoryRequestLiveDelay`.
- `home-rank.js`, `star-native.js`, `internal-access.js` remain JS MIME after deploy.
