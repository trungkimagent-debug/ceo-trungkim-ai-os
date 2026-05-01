# Module context — Customer / Nợ KH

Last reviewed: 2026-05-01.

## Scope

- Bottom nav tab: `data-screen="customer"`, label `Nợ` / requested as `Nợ KH`.
- DOM section: `public/index.html` lines around `#screen-customer`.
- Detail modal: `#customerDebtDetailModal` immediately after customer section.
- Business logic lives inline in `public/index.html`; no separate customer JS module.

## Source boundaries read

- CSS: `.customer-debt-*` block around lines 4138-4730.
- HTML: `#screen-customer` through `#customerDebtDetailModal`, before `#screen-print` around lines 13035-13164.
- DOM refs: `customerDebt*` constants around lines 14430-14460.
- JS functions: `getCustomerDebtTimeMs` through `loadCustomerDebtHub` around lines 22990-23360.
- Event bindings: `customerDebtSearchInput`, refresh, filters, list click, detail modal, payment/reminder around lines 25544-25620.

## Data / API flow

- Loads overview with `callApi('/internal/pos/customer-debts/overview')`.
- Pay debt with `POST /internal/pos/customer-debts/pay` body `{ debtId, amount, note }`.
- Reminder with `POST /internal/pos/customer-debts/{id}/remind`.
- State keys:
  - `state.customerDebtItems`
  - `state.customerDebtSummary`
  - `state.customerDebtQuery`
  - `state.customerDebtStatusFilter`
  - `state.customerDebtFetchedAt`
  - `state.customerDebtLoading`
  - `state.customerDebtActiveId`
  - `state.customerDebtPaying`
  - `state.customerDebtReminding`

## Important functions

- `normalizeCustomerDebtItem(item)`: normalizes API item, computes amount/original/paid/status/due/overdue/searchText.
- `renderCustomerDebtSummary(summary, fetchedAt)`: updates KPI stats/caption/status badge.
- `buildCustomerDebtItemHtml(item)`: renders each debt row/card. Safe visual-only edits here if row markup must change.
- `getFilteredCustomerDebtItems(items)`: query/filter/sort logic.
- `renderCustomerDebtList(items)`: updates title/meta/filter active and list HTML.
- `renderCustomerDebtDetail()`: fills modal/drawer detail.
- `loadCustomerDebtHub(options)`: fetches overview and refreshes UI.

## Safe edit points

- Visual-only scoped CSS under `.customer-debt-*`.
- Customer section class names/containers only within `#screen-customer`.
- Detail modal presentation classes only if IDs remain unchanged.
- Text labels/placeholders can change if IDs and data attributes remain unchanged.

## Do not touch

- Sales debt creation logic; customer debts depend on sales orders.
- API paths and payload keys unless backend changes are explicitly requested.
- Shared bottom nav, Home Rank, Star module, POS/Thu góp/Thu máy modules.
- Firebase/auth/config files for unrelated app `trungkimstar`.

## Style target

- Follow `style-reference/trungkimstar-chairman-suite.md`:
  - light SaaS dashboard, `#f3f4f6` bg, white cards, dark text, amber `#f59e0b` active/brand.
  - card radius 16, soft border/shadow.
  - Manrope-like clean layout using existing fonts if global font unchanged; numbers remain JetBrains Mono.
  - responsive mobile should keep compact bottom-nav usability.

## Verification checklist

- `/1` loads real app (`TRUNG HẬU KIM DUNG`, `Rank TOP`).
- Customer tab visible and `#screen-customer` contains style marker.
- `/home-rank.js`, `/star-native.js`, `/internal-access.js` return JS MIME.
- Diff is scoped to `public/index.html`, `public/version.json`, and context docs only.
- No Firebase config/auth copied from `trungkimstar`.

## 2026-05-01 — Nợ KH 1:1 with Nợ NCC

- Current visual target: mirror Supplier/Nợ NCC layout, not old `.tk-customer-chairman-v1` compact card shell.
- `#screen-customer` now uses `.supplier-screen customer-debt-screen-1to1` and supplier table/card classes:
  - `.supplier-overview-card`, `.supplier-summary-grid`, `.supplier-debt-list`, `.supplier-table-head-*`, `.supplier-activity-list`.
- Customer detail modal now mirrors NCC detail modal:
  - `.supplier-detail-modal-card`, `.supplier-detail-summary`, `.supplier-detail-list`, `.supplier-pay-panel`.
- Keep customer DOM IDs unchanged (`customerDebt*`) because JS/payment/reminder APIs depend on them.
- Extra CSS scoped to `#screen-customer` and `#customerDebtDetailModal` sits near the existing customer CSS block and is only for parity with supplier styles.
- If refining again, compare against Supplier/Nợ NCC sections first, then only adjust customer-specific copy/data mapping.


## 2026-05-01 — Reference correction: TrungKimStar Quyết toán

- User clarified screenshots: Nợ KH must match TrungKimStar `Quyết toán` style, not Nợ NCC.
- Correct target: white header/content, 2x2 filters, search + download button, orange summary bar, white settlement cards with label/value rows.
- Current classes: `customer-settlement-screen`, `customer-settlement-shell`, `customer-settlement-card`.
- Keep Nợ KH APIs and `customerDebt*` IDs unchanged; visual-only mapping from debt fields into settlement-card rows.


## 2026-05-01 — Compact settlement density

- User asked Nợ KH to be more compact after seeing the debt screen.
- Reduced header/filter/search/summary vertical spacing and changed customer debt cards from 6 label rows to 4 compact rows.
- Keep white/orange Quyết toán reference style; no API changes.


## 2026-05-01 — Dense top cleanup

- After screenshot review, the top area still had too much blank space.
- Hidden the inactive 2x2 filter block and tightened title/search/orange summary spacing.
- Keep compact settlement cards and all `customerDebt*` IDs unchanged.


## 2026-05-01 — Ultra dense polish

- User said to keep going without repeated prompts.
- Further tightened Nợ KH: smaller title/icon/search/summary/card padding, blank search placeholder to match reference screenshot more closely, card rows slightly smaller.
- Preserve current white/orange Quyết toán visual language and all `customerDebt*` IDs.


## 2026-05-01 — Detail popup blank hotfix

- Screenshot showed customer debt detail/Thu tiền popup had a huge blank white pay area and unusable density.
- Added scoped `#customerDebtDetailModal` overrides to make pay panel non-sticky, compact, visible inputs/textarea/buttons, smaller summary and detail row.
- Preserve payment/reminder IDs and APIs.


## 2026-05-01 — All places 1:1 correction

- User clarified angrily: `1:1 ở tất cả mọi nơi` means list, detail modal, pay form, buttons, and spacing must all share the same reference visual language.
- Replaced customer detail modal HTML/classes away from NCC/supplier style into `customer-settlement-detail-*` and `customer-settlement-pay-*`.
- Detail modal now uses the same white/orange compact settlement language as the Nợ KH list.


## 2026-05-01 — Zero supplier-style trace audit

- Removed obsolete customer detail drawer CSS and old `customer-debt-detail-card` selectors.
- Customer Nợ KH section and modal HTML now contain no `supplier-*`/NCC classes/text.
- Customer debt activity renderer also uses `customer-settlement-*` classes, not supplier table classes.

## 2026-05-01 — Pay form visible input frame fix

- Screenshot showed `Thu tiền` area looked blank because amount/note controls were too subtle and too tall.
- Scoped CSS to `#customerDebtDetailModal .customer-settlement-pay-fields input/textarea` with stronger specificity and visible light-gray frames, dark text, compact heights, focus ring, and mobile compact overrides.
- Only touched Nợ KH detail pay-form presentation plus app version; preserved all `customerDebt*` IDs, payment/reminder API flow, and unrelated tabs.
