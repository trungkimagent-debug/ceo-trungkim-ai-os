# Module context — Purchase / Nhập

Last reviewed: 2026-05-01.

## Scope

- Bottom nav tab: `data-screen="purchase"`, label `Nhập`.
- DOM section: `public/index.html` `#screen-purchase`.
- Purchase modal: `#purchaseModal`, product modal `#createProductModal`, supplier modal `#createSupplierModal`, item editor/scanner modals.
- Business logic is inline in `public/index.html`; no separate purchase JS module.

## Source boundaries read

- Global/purchase CSS around lines 1836-2600, purchase card CSS around 3293-3404, modal/workspace CSS around 7088-7828 and 8462-8495.
- Purchase section HTML around `#screen-purchase`, purchase modal around `#purchaseModal`.
- State/DOM refs around purchase state and refs: `purchaseFilter`, `purchaseQuickCatalog`, `purchaseDraftItems`, `purchaseReceiptContext`, `purchaseSummary*`, `purchaseFilterInput`, `purchaseWorkspace*`, `purchaseQuick*`, `purchaseSupplier*`, `recentPurchases*`.
- Key functions/events read: `getPurchaseReceiptContext`, workspace mount/restore/sync, `openPurchaseWorkspace`, `syncPurchaseModalModeUi`, `openPurchaseModal`, `openPurchaseReceipt`, `renderPurchaseWorkspaceCatalog`, `renderRecentPurchases`, `loadRecentPurchases`, purchase filter and recent-card open/delete bindings.

## Data / API flow

- Recent list: `callApi('/internal/pos/purchase/recent')` → `state.recentPurchases` → `renderRecentPurchases()`.
- Receipt detail: `GET /internal/pos/purchase/receipts/{id}` via `openPurchaseReceipt()`.
- Delete receipt: `POST /internal/pos/purchase/receipts/{id}/delete`.
- Product/supplier creation and draft save/submit remain existing inline flows; not changed for visual sync.

## Important selectors / IDs

- `#screen-purchase`, `.purchase-debt-summary-bar`, `.purchase-debt-top-controls`.
- `#purchaseSummaryReceiptCount`, `#purchaseSummaryTotalAmount`, `#purchaseCount`.
- `#purchaseFilterInput`, `#purchaseToolbarAddBtn`, `#purchaseBackBtn`.
- `#recentPurchases`, `#purchaseWorkspaceMount`, `#purchaseModal`.

## Safe edit points

- Visual-only scoped CSS under `#screen-purchase` / `#purchaseModal`.
- Purchase section wrapper/classes and top summary/control markup, preserving existing IDs.
- `renderRecentPurchases()` display-only summary updates.

## Do not touch

- API paths/payload keys for purchase create/edit/delete unless backend change is explicit.
- Stock, supplier debt, customer debt, sales, Home Rank, Star dynamic modules.
- Purchase workspace behavior (`purchase-accessory-workspace`) except scoped hiding of regular top summary while workspace is active.

## 2026-05-01 — Sync Nhập UI with Nợ KH

- User requested reading the whole Nhập tab and syncing its interface with Nợ.
- Added Nợ-style dark/gold KPI row at the top of `#screen-purchase`: `PHIẾU NHẬP` and `TỔNG NHẬP`.
- Added one visible top control row: back + search + add, matching the compact top-controls pattern from Nợ KH.
- Added scoped dark/gold styling for main purchase list, recent receipt cards, and `#purchaseModal` controls/forms/buttons.
- `renderRecentPurchases()` now updates the new purchase KPI values from recent receipt count and summed total amount.
- Version deployed target: `v20260501_1919_purchase_sync_debt_ui`.
