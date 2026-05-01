# Module context — Sales / Bán

Last reviewed: 2026-05-01.

## Scope

- Bottom nav tab: `data-screen="sales"`, label `Bán`.
- Main DOM: `public/index.html` section `#screen-sales` lines around 14490-14908.
- Logic/CSS are inline in `public/index.html`; there is no separate sales module file.
- Current artifact rule still applies: production Hosting artifact under `public/` must remain full 85 files before deploy.

## Main UI structure

- `#screen-sales.screen.sales-screen.menu-only`
- Hidden file input for accessory photo: `#salesAccessoryCameraInput`.
- Accessory flow bar: `#salesAccessoryFlowBar` with status, photo thumb, selected items, warehouse status/actions.
- Accessory selection popup: `#salesAccessoryPopup`, search `#salesAccessoryPopupSearchInput`, catalog grid `#salesAccessoryPopupGrid`, editor `#salesAccessoryPopupEditor`.
- Payment/processing popup for accessory flow: `#salesProcessingPopup`, includes split cash/transfer inputs, debt info trigger, due date, order sheet.
- Debt info popup: `#salesDebtInfoPopup`, presets: NCH, FE Credit, Home Credit, HD Saison, Mcredit, Mirae Asset, Rút thẻ.
- Main POS shell: `.sales-pos-shell`.
- Request toolbar: `#salesRequestSearchInput`, `#salesRequestFilterSelect` with waiting/processing/completed.
- Menu cards: `[data-sales-menu="phone"]`, `[data-sales-menu="accessory"]`, `[data-sales-menu="exchange"]`, `[data-sales-menu="gift"]`.
- Pending queue: `#salesAccessoryPendingQueuePanel`, `#salesAccessoryPendingQueueList`.
- Standard POS area: IMEI search `#imeiInput/#imeiLookupBtn/#imeiResult`, accessory search `#accessoryInput/#accessorySearchBtn/#accessoryResults`, recent orders `#salesRecentOrders`.
- Order form/cart: `#customerName`, `#customerPhone`, `#paymentMethod`, `#paidAmount`, `#dueDate`, `#orderNote`, `#cartItems`, `#cartTotal`, `#cartPaid`, `#cartDebt`, `#checkoutBtn`.

## State fields

- Cart/order: `state.cart`, `state.recentOrders`.
- Mode/ticket: `state.salesMode`, `state.salesFlowTicketCode`, `state.salesFlowTicketMode`.
- Accessory requests: `state.salesAccessoryFlow`, `state.salesAccessoryPendingFinalize`, `state.salesAccessoryPendingSummary`, `state.salesAccessoryPendingBuckets`, `state.salesAccessoryPendingFocusId`.
- Search/filter/cache: `state.salesRequestFilter`, `state.salesRequestQuery`, `state.salesAccessoryCatalog`, `state.salesAccessoryCatalogQuery`, `state.salesAccessoryCatalogUpdatedAt`.
- Popups: `state.salesAccessoryPopupOpen`, `state.salesAccessoryPopupPendingCreate`, `state.salesProcessingPopupOpen`, `state.salesProcessingPopupOrderSheetOpen`, `state.salesDebtInfoPopupOpen`.
- Payments/debt: `state.salesDebtEntries`, `state.salesProcessingSplitPayments`.
- Popup editor: `state.salesAccessoryPopupEditor`.

## Key functions

- Debt/payment helpers: `normalizeSalesPaymentMethod`, `getSalesPaymentMethodLabel`, `getSalesDebtPresetList`, `createSalesDebtEntry`, `normalizeSalesDebtEntries`, `validateSalesDebtInfo`, `syncSalesDebtInfoPopupUi`, `syncSalesPaymentUi`.
- Cart helpers: `findCartImeiItem`, `getCartAccessoryQuantity`, `getCartTotals`, `addImeiToCart`, `addAccessoryToCart`, `resetSalesOrderDraft`, `renderCart`.
- Ticket/mode: `startSalesFlowTicket`, `resetSalesFlowTicket`, `renderSalesFlowTicketBadge`, `setSalesScreenMode`, `syncSalesMenuOnlyVisibility`.
- Accessory flow: `createEmptySalesAccessoryFlow`, `buildSalesAccessoryFlowSnapshot`, `normalizeSalesAccessoryFlow`, `getSalesAccessoryModeCopy`, `renderSalesAccessoryFlow`, `syncSalesAccessoryCheckoutGate`.
- Accessory catalog: `loadSalesAccessoryCatalog`, `renderAccessoryResults`, `renderSalesAccessoryPopupCatalog`, `openSalesAccessoryPopupEditor`, `saveSalesAccessoryPopupEditorSelection`.
- Warehouse/request queue: `loadSalesAccessoryPendingFinalizeQueue`, `openSalesAccessoryPendingFinalizeRequest`, `confirmSalesAccessoryPickedUpAndOpenPendingQueue`, `confirmSalesAccessoryPickupFromQueue`, `loadStockAccessoryRequestQueue`.
- Ready popup/watch: `loadSalesAccessoryReadyPopupRequest`, `syncSalesAccessoryReadyPopupWatch`, `confirmSalesAccessoryPickupFromReadyPopup`, `syncSalesAccessoryFlowRealtimeWatch`.
- Checkout: click handler on `#checkoutBtn` validates cart, accessory warehouse status, debt info/due date, then posts checkout.

## API endpoints used by Sales

- `POST /internal/pos/sales/tickets/start` — create sales ticket/code.
- `GET /internal/pos/imei-lookup?imei=` — lookup phone IMEI for sale.
- `GET /internal/pos/sales/accessory-catalog?query=` — accessory catalog/search.
- `POST /internal/pos/sales/accessory-requests/start` — start accessory request/photo or popup flow.
- `POST /internal/pos/sales/accessory-requests/{id}/request-warehouse` — send selected accessory items to warehouse.
- `GET /internal/pos/sales/accessory-requests/list?status=all&query=` — queue list for sales.
- `GET /internal/pos/sales/accessory-requests/{id}` — request detail.
- `POST /internal/pos/sales/accessory-requests/{id}/confirm-picked-up` — sales confirms received from warehouse.
- `POST /internal/pos/sales/accessory-requests/{id}/warehouse-confirm` — warehouse side confirms request; used by stock request panel.
- `POST /internal/pos/sales/accessory-requests/{id}/cancel` — cancel accessory flow.
- `GET /internal/pos/sales/accessory-requests/ready-popup` — ready request popup/watch.
- `GET /internal/pos/sales/accessory-requests/pending-warehouse` — stock-side pending queue.
- `POST /internal/pos/sales/checkout` — final checkout.

## Checkout payload

`/internal/pos/sales/checkout` receives:

- `customerName`, `customerPhone`, `paymentMethod`, `paidAmount`, `dueDate`, `note`.
- `orderCode` from accessory flow or sales ticket.
- `saleMode`: accessory/gift modes or `default`.
- `accessoryRequestId` for accessory flow.
- `splitPayments`, `debtEntries`, `debtCustomerName`.
- `items[]`: `{ kind, imei, batchId, quantity, salePrice }`.

After success: `renderPrintPreview(result)`, optionally `queueReceiptPrint`, clears cart/flow state, refreshes dashboard/stock/accessory queues, returns to sales.

## Event bindings / user flow

- Menu card `phone`: starts default ticket, clears cart, enters standard mode, focuses IMEI.
- Menu cards `accessory` / `gift`: start ticket and open accessory popup flow.
- IMEI lookup button calls `/internal/pos/imei-lookup`, then `renderImeiResult` and add button inserts phone into cart.
- Accessory search button calls `loadSalesAccessoryCatalog`; accessory cards add/update accessory cart lines.
- Accessory popup search/editor controls update cart selection and send warehouse request.
- Pending queue cards open ready/processing requests; pickup buttons confirm picked up.
- Clear cart invalidates accessory warehouse status if accessory items exist.
- Checkout validates cart/debt/warehouse gate, posts checkout, prints when allowed.

## Safe edit points

- Visual-only scoped CSS under `#screen-sales`, `.sales-*`, `#salesAccessoryPopup`, `#salesProcessingPopup`, `#salesDebtInfoPopup`.
- Sales section top/menu/list markup if IDs remain unchanged.
- Text labels/placeholders and compact layout wrappers, preserving existing IDs/data attributes.
- `renderCart`, `renderAccessoryResults`, pending card HTML if only display changes.

## Risky / do not touch without explicit instruction

- Checkout payload keys and `/internal/pos/sales/checkout` flow.
- Accessory warehouse request statuses: `waiting_warehouse`, `warehouse_confirmed`, `picked_up`.
- Realtime/watch timers and cache freshness logic unless fixing that exact bug.
- Debt validation rules, especially NCH due-date requirement.
- Shared stock request queue functions used by Kho tab.
- Print queue integration after checkout.

## Verification checklist for future Sales edits

- `node -e "JSON.parse(fs.readFileSync('public/version.json','utf8'))"` if version touched.
- Confirm `find public -type f | wc -l` is 85 before deploy.
- Check `#screen-sales`, `#checkoutBtn`, `#salesAccessoryPopup`, `#salesProcessingPopup`, `#salesDebtInfoPopup` markers still exist once each.
- If touching checkout/debt logic, inspect payload and run a no-network/static syntax check at minimum; deploy only after full diff review.
- After deploy, verify `/version.json`, `/1` app markers, and JS MIME for `home-rank.js`, `star-native.js`, `internal-access.js`.

## 2026-05-01 — Sync Bán UI with Nợ KH dark/gold

- User requested “Nâng cấp phong cách y chang Nợ KH” after Sales/Bán review.
- Scoped visual update to `#screen-sales` only by adding `sales-debt-sync-screen` and Nợ-style dark/gold CSS override.
- Added `sales-debt-summary-bar` above the Sales request/search controls and made the request toolbar act as `sales-debt-top-controls`, mirroring the compact KPI + top-control order from Nợ KH.
- Restyled Sales menu cards, request toolbar, panels, accessory flow/status, and Sales payment/debt popups to dark glass/gold while preserving all Sales IDs, API endpoints, state, checkout payload, warehouse statuses, and event handlers.
- Version deployed target: `v20260501_1929_sales_sync_debt_ui`.

## 2026-05-01 — Gift popup contrast/luxury correction

- Trigger: screenshot of `Tặng miễn phí` popup showed the bottom dock remained white and the left summary text (`Chưa chọn quà tặng`) was nearly invisible, so the gift flow did not actually match the accepted Nợ KH dark/gold style.
- Scoped fix target: `#salesAccessoryPopup` only, shared by gift/accessory popup inside Sales/Bán.
- Added mode classes in `syncSalesAccessoryPopupUi()`:
  - `.mode-gift` when `isSalesAccessoryGiftMode()` is true.
  - `.mode-accessory` otherwise.
- Added CSS marker: `Bán • gift/accessory popup luxury correction`.
- Visual rules: popup shell/sheet/search/footer/summary/send button now use dark/gold glass, high-contrast text, and no white bottom dock. Gift title receives a small `· 0đ` suffix through `.mode-gift`.
- Preserve IDs and behavior: `#salesAccessoryPopupGrid`, `#salesAccessoryPopupSummary`, `#salesAccessoryPopupSendBtn`, warehouse request flow, cart state, price/qty editor, checkout payload unchanged.
- Verification markers: version `v20260501_1938_sales_gift_popup_luxury`, full 85-file artifact, `salesAccessoryPopupEl.classList.toggle('mode-gift'...)`, `sales-accessory-popup-footer` dark override.

## 2026-05-01 — Gift editor free-mode cleanup

- Trigger: screenshot after gift popup polish showed `Chọn quà tặng` editor still displayed a `Giá tặng` money input with value `0`, which is bad UX for a free gift.
- Scoped fix target: gift mode inside `#salesAccessoryPopupEditor` only.
- In gift mode (`.sales-accessory-popup.mode-gift`), hide `.sales-accessory-popup-editor-field` entirely so staff only chooses quantity.
- `openSalesAccessoryPopupEditor()` no longer auto-focuses the price input when `isSalesAccessoryGiftMode()` is true.
- Gift base price chip now reads `Giá gốc ... • Tặng 0đ`; sale price remains normalized to `0` by existing `normalizeSalesAccessoryEditorSalePrice()`.
- Preserve behavior: same cart item structure, quantity stepper, `Bỏ chọn`, `Xong`, warehouse request flow, and `saleMode='gift_menu'` remain unchanged.
- Verification marker/version: `v20260501_1944_sales_gift_editor_free_mode`.

## 2026-05-01 — Staff-only sales request queue scope

- Trigger: Chủ tịch yêu cầu “Nhân viên tạo phiếu chỉ nhìn thấy phiếu mình tạo”.
- Scoped target: Sales/Bán accessory request queue and ready popup only; Stock/Kho queue is intentionally unchanged so warehouse can see all pending requests.
- Added ownership helpers in `public/index.html`:
  - `canCurrentActorSeeAllSalesAccessoryRequests()` lets manager/admin/ceo/chairman see all.
  - staff-role accounts are scoped by `createdBy`, `createdByStaffCode`, `staffId/staffCode`, `warehouseRequestedBy`, seller/cashier/employee aliases, and matching creator/staff names as fallback.
  - current active `state.salesAccessoryFlow.requestId` is allowed so a staff member never loses their own in-progress flow.
- `syncSalesAccessoryPendingCache()`, `renderSalesAccessoryPendingFinalizeQueue()`, `loadSalesAccessoryPendingFinalizeQueue()`, warm cache, ready popup, and detail open now apply the same owner scope.
- Summaries/count chips are recomputed after filtering so staff does not see totals from other employees.
- Preserve: checkout payload, warehouse confirm, stock request queue, and realtime timer behavior unchanged.
- Verification marker/version: `v20260501_2126_sales_request_owner_scope`.

## 2026-05-01 — Creator name at top of request cards

- Trigger: Chủ tịch yêu cầu “Hiển thị tên nhân viên lên card nên phải phía trên”.
- Added `getSalesAccessoryRequestCreatorLabel()` and `buildSalesAccessoryRequestCreatorMarkup()` in `public/index.html`.
- Sales pending cards and stock waiting request cards now render `NV tạo: <tên>` as the first/top row of the card.
- Card signatures include creator label so realtime DOM patch updates name changes without rebuilding unrelated UI.
- Verification marker/version: `v20260501_2132_request_card_staff_top`.

## 2026-05-01 — Product name under request item frame

- Trigger: Chủ tịch gửi ảnh Kho và yêu cầu “Hiển thị tên sản phẩm dưới khung sản phẩm”.
- Added `.sales-accessory-item-name` and rendered the product label directly under each item image frame, before the quantity pill.
- Applies to both Sales waiting cards and Stock/Kho accessory request cards because they share the same item tile markup.
- Verification marker/version: `v20260501_2136_request_item_name_under_frame`.

## 2026-05-01 — Compact creator badge and product name outside frame

- Trigger: Chủ tịch yêu cầu bỏ chữ `NV tạo:`, chỉ còn icon + tên nhân viên và chuyển sang phải cùng hàng mã HĐ; tên sản phẩm nằm ngoài khung sản phẩm.
- `buildSalesAccessoryRequestCreatorMarkup()` now renders only icon + employee name.
- Creator badge moved from top standalone row into `.sales-accessory-ticket-code-row`, aligned right of the HĐ/amount row.
- Item tile now uses `.sales-accessory-item-frame` around image + quantity only; `.sales-accessory-item-name` renders below/outside that frame.
- Applies to Sales waiting cards and Stock/Kho request cards.
- Verification marker/version: `v20260501_2142_request_card_compact_staff_product_name`.
