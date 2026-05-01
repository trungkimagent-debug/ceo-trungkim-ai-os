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
