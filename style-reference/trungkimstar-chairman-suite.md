# Style reference — trungkimstar Chairman Suite

Source inspected: `https://trungkimstar.web.app/chutich.html` and `chutich.js` on 2026-05-01.

Security note: login credentials were provided by Chủ tịch for viewing only and are not stored here.

## Overall style direction

- Desktop/admin dashboard style, clean enterprise SaaS.
- Light theme primary, with optional dark theme variables.
- Layout: left sidebar + topbar + scrollable content area.
- Visual tone: modern, crisp, professional, low clutter, high whitespace.
- Brand accent: amber/gold `#f59e0b` with dark slate/navy surfaces.

## Core CSS tokens

- Background: `#f3f4f6`
- Surface/card: `#ffffff`
- Sidebar: `#111827`
- Main text: `#1f2937`
- Secondary text: `#6b7280`
- Border: `#e5e7eb`
- Brand/gold: `#f59e0b`
- Accent/blue: `#3b82f6`
- Success: `#10b981`
- Danger: `#ef4444`
- Radius: `12px`; cards often `16px`, modals `20px`
- Shadow: soft SaaS shadow `0 4px 6px -1px rgba(0,0,0,.05)`
- Fonts: `Manrope` for UI, `JetBrains Mono` for numbers.

## Layout patterns

- `.app-shell`: full viewport flex.
- `.sidebar`: 260px desktop, dark navy, nav items stacked.
- `.main`: flex column, hidden overflow.
- `.topbar`: 70px desktop / 60px mobile, white surface, border bottom.
- `.content`: scrollable, 24px desktop padding / 16px mobile.
- `.card`: white surface, 16px radius, subtle border/shadow, `slideUp` animation.
- `.stats-grid`: responsive grid cards, `minmax(160px, 1fr)`.

## Navigation behavior

- Desktop sidebar with `.nav-item` rows.
- Active nav item: gold background, white text, gold glow.
- <=1024px sidebar collapses to 80px icon rail.
- <=820px sidebar hidden and `.bottom-nav` appears fixed at bottom.
- Bottom nav items are icon above label; active is gold.

## Components to copy into Trung Kim OS when requested

- Card/head pattern: `.card`, `.card-head`, `.card-title`.
- Dashboard KPI cards: `.stats-grid`, `.stat-card`, `.stat-val`, `.stat-lbl`.
- Responsive table-card transformation on mobile.
- Drawer modal pattern: `.modal.drawer`, `.modal-box`, `slideInRight`.
- Inputs/buttons: 40px buttons, 48px form inputs, 10-12px radius, bold labels.

## Do-not-copy blindly

- Do not replace Trung Kim OS production bundle/layout globally.
- Do not copy Firebase config/auth from `trungkimstar` into `trungkim-os`.
- Only adapt visual language per requested tab/screen.
- Keep Trung Kim OS existing modules/imports/assets intact.

## Implementation guidance

For future tab upgrades, use this as a style target:

1. Keep existing business logic untouched.
2. Wrap the specific tab content in card/stat/table primitives inspired by this reference.
3. Use scoped CSS marker for that tab only, e.g. `.tk-<screen>-chairman-suite-v1`.
4. Verify unrelated tabs and JS module MIME after deploy.
