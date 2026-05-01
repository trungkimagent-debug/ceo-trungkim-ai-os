import {
  observeThuGopTickets,
  observeThuGopCashHandoverLogs,
  createThuGopTicket,
  updateThuGopTicket,
  uploadThuGopAsset,
  findThuGopTicketByReceiptCode,
  approveThuGopCashHandoverBatch,
  markThuGopCollectedPayment,
  THUGOP_CASH_HANDOVER_STATE,
} from "./legacy-core/thugop-repo.js";

const host = document.getElementById("thugopRootHost");
const THUGOP_PRINT_API_BASE = "https://api-ldnzetqooq-uc.a.run.app";
const THUGOP_LEGACY_INTERNAL_KEY_STORAGE_KEY = "thkd_internal_key";
const THUGOP_POS_SESSION_TOKEN_STORAGE_KEY = "thkd_pos_session_token";
const THUGOP_RECEIPT_QR_PREFIX = "THKD-TG1:";
const THUGOP_RECEIPT_LOGO_URL = "/assets/icons/thkd-brand-1840.png";
let thugopReceiptCodeLibsPromise = null;
let thugopReceiptImageLibPromise = null;
let thugopHtml5QrcodeLibPromise = null;
let thugopOcrLibPromise = null;
let thugopJsQrLibPromise = null;
if (!host) {
  // noop on pages that do not embed this module
} else {
  host.innerHTML = `
    <style>
      #thugopRootHost {
        animation: none !important;
        transform: none !important;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
      }
      .tg-shell {
        --tg-bg: #000;
        --tg-card: linear-gradient(180deg, rgba(18,18,18,.96), rgba(9,9,9,.98));
        --tg-line: rgba(234,179,8,.18);
        --tg-text: #f8fafc;
        --tg-muted: rgba(255,255,255,.58);
        --tg-accent: #fbbf24;
        --tg-accent-strong: #eab308;
        --tg-success: #34d399;
        --tg-danger: #dc2626;
        --tg-shadow: 0 18px 36px rgba(0, 0, 0, .34);
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        display: grid;
        gap: 6px;
        align-content: start;
        min-height: calc(100dvh - 220px);
        padding: 2px 0 0;
        color: var(--tg-text);
        background: #000;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
      }
      .tg-shell.has-handover-bulk-bar {
        padding-bottom: calc(92px + env(safe-area-inset-bottom, 0px));
      }
      .tg-topbar {
        position: sticky;
        top: 0;
        z-index: 4;
        display: grid;
        gap: 2px;
        align-content: start;
        padding: 0 0 2px;
        background: linear-gradient(180deg, rgba(0,0,0,.96), rgba(0,0,0,.82), rgba(0,0,0,0));
        backdrop-filter: blur(12px);
      }
      .tg-mode-tabs {
        display: none;
      }
      .tg-mode-tab {
        height: 40px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: var(--tg-text);
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        box-shadow: none;
      }
      .tg-mode-tab.active {
        background: linear-gradient(135deg, #fbbf24, #eab308);
        color: #111827;
        border-color: transparent;
        box-shadow: 0 12px 24px rgba(234,179,8,.22);
      }
      .tg-mode-tab i {
        font-size: 13px;
      }
      .tg-toolbar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 74px;
        gap: 6px;
        padding: 0;
        background: transparent;
        align-items: stretch;
      }
      .tg-subtoolbar {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 10px;
        min-width: 0;
        position: relative;
        overflow: visible;
      }
      .tg-handover-select-toggle-wrap {
        display: inline-flex;
        align-items: center;
      }
      .tg-handover-select-toggle {
        width: 16px;
        height: 16px;
        accent-color: #fbbf24;
        cursor: pointer;
      }
      .tg-staff-filter-wrap {
        position: relative;
        min-width: 0;
        max-width: 100%;
        flex: 0 1 auto;
      }
      .tg-staff-filter-btn {
        min-width: 0;
        max-width: min(72vw, 240px);
        height: 26px;
        padding: 0;
        border-radius: 0;
        border: 0;
        background: transparent;
        color: var(--tg-text);
        font-size: 11px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .tg-staff-filter-btn span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tg-staff-filter-btn .fa-angle-down {
        margin-left: auto;
        transition: transform .18s ease;
      }
      .tg-staff-filter-btn.open .fa-angle-down {
        transform: rotate(180deg);
      }
      .tg-staff-filter-total {
        flex: 0 0 auto;
        font-size: 11px;
        font-weight: 900;
        color: #f8d56b;
        line-height: 1;
        white-space: nowrap;
      }
      .tg-date-filter-wrap {
        position: relative;
        min-width: 0;
        max-width: 100%;
        flex: 0 0 auto;
        margin-left: auto;
      }
      .tg-date-filter-btn {
        min-width: 0;
        max-width: min(48vw, 180px);
        height: 26px;
        padding: 0;
        border-radius: 0;
        border: 0;
        background: transparent;
        color: var(--tg-text);
        font-size: 11px;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .tg-date-filter-btn span {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tg-date-filter-btn .fa-angle-down {
        margin-left: auto;
        transition: transform .18s ease;
      }
      .tg-date-filter-btn.open .fa-angle-down {
        transform: rotate(180deg);
      }
      .tg-date-filter-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 8;
        min-width: 170px;
        max-width: min(84vw, 220px);
        max-height: min(50vh, 320px);
        overflow: auto;
        display: none;
        gap: 6px;
        padding: 8px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.08);
        background: linear-gradient(180deg, rgba(15,15,15,.985), rgba(5,5,5,.995));
        box-shadow: 0 20px 48px rgba(0,0,0,.36);
      }
      .tg-date-filter-menu.open {
        display: grid;
      }
      .tg-date-filter-option {
        width: 100%;
        min-width: 0;
        padding: 11px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: var(--tg-text);
        font-size: 12px;
        font-weight: 800;
        text-align: left;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .tg-date-filter-option.active {
        border-color: rgba(234,179,8,.22);
        background: rgba(234,179,8,.14);
        color: #f8d56b;
      }
      .tg-staff-filter-menu {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        z-index: 8;
        min-width: 184px;
        max-width: min(84vw, 260px);
        max-height: min(50vh, 320px);
        overflow: auto;
        display: none;
        gap: 6px;
        padding: 8px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.08);
        background: linear-gradient(180deg, rgba(15,15,15,.985), rgba(5,5,5,.995));
        box-shadow: 0 20px 48px rgba(0,0,0,.36);
      }
      .tg-staff-filter-menu.open {
        display: grid;
      }
      .tg-staff-filter-option {
        width: 100%;
        min-width: 0;
        padding: 11px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: var(--tg-text);
        font-size: 12px;
        font-weight: 800;
        text-align: left;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .tg-staff-filter-option.active {
        border-color: rgba(234,179,8,.22);
        background: rgba(234,179,8,.14);
        color: #f8d56b;
      }
      .tg-search-wrap {
        min-width: 0;
        width: 100%;
        height: 42px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 4px 3px 14px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        box-sizing: border-box;
      }
      .tg-search {
        flex: 1 1 auto;
        width: auto;
        min-width: 0;
        height: 100%;
        border: 0;
        background: transparent;
        color: var(--tg-text);
        padding: 0;
        font-size: 14px;
        outline: none;
        box-shadow: none;
        appearance: none;
        -webkit-appearance: none;
      }
      .tg-search::placeholder { color: var(--tg-muted); }
      .tg-search-toggle-btn {
        flex: 0 0 96px;
        width: 96px;
        height: 34px;
        padding: 0 8px;
        border-radius: 11px;
        border: 0;
        background: linear-gradient(135deg, #fbbf24, #eab308);
        color: #111827;
        font-size: 11px;
        font-weight: 900;
        white-space: nowrap;
        justify-content: center;
        align-items: center;
        display: inline-flex;
        text-align: center;
        cursor: pointer;
        box-sizing: border-box;
      }
      .tg-search-toggle-btn.is-unpaid {
        background: linear-gradient(135deg, #fbbf24, #eab308);
        color: #111827;
      }
      .tg-search-toggle-btn.is-paid {
        background: linear-gradient(135deg, #34d399, #10b981);
        color: #052e16;
      }
      .tg-search-toggle-btn.is-pending {
        background: linear-gradient(135deg, #fb923c, #f59e0b);
        color: #431407;
      }
      .tg-search-toggle-btn.is-done {
        background: linear-gradient(135deg, #34d399, #10b981);
        color: #052e16;
      }
      .tg-search-toggle-btn.is-logs {
        background: linear-gradient(135deg, #93c5fd, #60a5fa);
        color: #172554;
      }
      .tg-filter-btn {
        min-width: 48px;
        padding: 0 12px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: var(--tg-text);
        font-weight: 800;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        box-shadow: none;
      }
      .tg-filter-btn span { display: none; }
      .tg-filter-btn.tg-mode-switch-btn {
        flex: 0 0 74px;
        width: 74px;
        min-width: 74px;
        max-width: 74px;
        height: 42px;
        box-sizing: border-box;
        white-space: nowrap;
        overflow: hidden;
      }
      .tg-filter-btn.tg-mode-switch-btn span {
        display: inline;
      }
      .tg-list {
        display: grid;
        gap: 8px;
        align-content: start;
        align-items: start;
      }
      .tg-handover-bulk-bar {
        position: fixed;
        left: 50%;
        bottom: 0;
        transform: translateX(-50%);
        z-index: 120;
        width: min(100vw, 560px);
        display: none;
        align-items: center;
        justify-content: flex-start;
        flex-wrap: nowrap;
        gap: 10px;
        padding: 10px 12px calc(8px + env(safe-area-inset-bottom, 0px));
        border-radius: 18px 18px 0 0;
        background: linear-gradient(135deg, #fbbf24, #eab308);
        border-top: 1px solid rgba(255,255,255,.28);
        box-shadow: 0 -14px 32px rgba(234,179,8,.28);
      }
      .tg-handover-bulk-bar.confirm-mode {
        align-items: center;
        flex-wrap: nowrap;
        gap: 8px;
      }
      .tg-handover-bulk-bar.open.confirm-mode {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        column-gap: 8px;
        row-gap: 6px;
        align-items: center;
      }
      .tg-handover-bulk-left {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1 1 auto;
      }
      .tg-handover-bulk-bar.confirm-mode .tg-handover-bulk-left {
        display: none;
      }
      .tg-handover-bulk-bar.open {
        display: flex;
      }
      .tg-handover-bulk-select {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        min-width: 34px;
        border-radius: 11px;
        border: 1px solid rgba(17,24,39,.18);
        background: rgba(17,24,39,.12);
        cursor: pointer;
        color: #111827;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.24);
      }
      .tg-handover-bulk-select input {
        appearance: none;
        -webkit-appearance: none;
        width: 18px;
        height: 18px;
        margin: 0;
        border-radius: 6px;
        border: 2px solid rgba(17,24,39,.48);
        background: rgba(255,255,255,.28);
        cursor: pointer;
        flex: 0 0 auto;
        position: relative;
      }
      .tg-handover-bulk-select input:checked,
      .tg-handover-bulk-select input:indeterminate {
        background: #111827;
        border-color: #111827;
      }
      .tg-handover-bulk-select input:checked::after {
        content: "";
        position: absolute;
        left: 5px;
        top: 1px;
        width: 4px;
        height: 9px;
        border: solid #fbbf24;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }
      .tg-handover-bulk-select input:indeterminate::after {
        content: "";
        position: absolute;
        left: 3px;
        top: 6px;
        width: 8px;
        height: 2px;
        border-radius: 999px;
        background: #fbbf24;
      }
      .tg-handover-bulk-select span {
        display: none;
      }
      .tg-handover-bulk-meta {
        display: grid;
        gap: 1px;
        min-width: 0;
        text-align: left;
      }
      .tg-handover-bulk-meta strong {
        font-size: 13px;
        color: #111827;
      }
      .tg-handover-bulk-meta span {
        font-size: 11px;
        font-weight: 800;
        color: rgba(17,24,39,.74);
      }
      .tg-handover-bulk-bar .btn.btn-primary {
        margin-left: auto;
        background: linear-gradient(135deg, #111827, #253047 62%, #111827);
        color: #fbbf24;
        border: 1px solid rgba(255,231,150,.28);
        box-shadow:
          0 12px 22px rgba(17,24,39,.22),
          inset 0 1px 0 rgba(255,255,255,.12),
          0 0 0 1px rgba(255,231,150,.08);
      }
      .tg-handover-bulk-bar.confirm-mode .btn.btn-primary {
        margin-left: 0;
        min-width: clamp(82px, 24vw, 102px);
        height: 38px;
        padding: 0 10px;
        border-radius: 12px;
        justify-content: center;
        flex: 0 0 clamp(82px, 24vw, 102px);
        white-space: nowrap;
        grid-column: 2;
        grid-row: 1;
        background:
          radial-gradient(circle at top left, rgba(255,255,255,.16), transparent 38%),
          linear-gradient(135deg, #ff453a, #ff1744 58%, #d70022);
        color: #ffffff;
        border: 1px solid rgba(255,255,255,.24);
        box-shadow:
          0 14px 28px rgba(215,0,34,.28),
          inset 0 1px 0 rgba(255,255,255,.14),
          0 0 0 1px rgba(255,120,120,.14);
      }
      .tg-handover-token-wrap {
        display: inline-flex;
        align-items: center;
        flex-wrap: nowrap;
        gap: 8px;
        min-width: 0;
        max-width: 0;
        opacity: 0;
        overflow: hidden;
        pointer-events: none;
        transition: max-width .22s ease, opacity .18s ease;
      }
      .tg-handover-token-wrap.open {
        max-width: 320px;
        opacity: 1;
        pointer-events: auto;
      }
      .tg-handover-bulk-bar.confirm-mode .tg-handover-token-wrap.open {
        flex: 1 1 auto;
        width: 100%;
        max-width: 100%;
        overflow: visible;
        grid-column: 1;
        grid-row: 1;
      }
      .tg-handover-token-input-wrap {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1 1 auto;
        min-width: 0;
      }
      .tg-handover-token-input {
        width: 100%;
        min-width: 0;
        height: 38px;
        padding: 0 12px 0 40px;
        border-radius: 12px;
        appearance: none;
        -webkit-appearance: none;
        border: 2px solid #16a34a !important;
        background: linear-gradient(135deg, rgba(255,255,255,.99), rgba(255,255,255,.96)) !important;
        color: #166534 !important;
        -webkit-text-fill-color: #166534;
        caret-color: #166534;
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 2px;
        text-align: center;
        box-sizing: border-box;
        transition: border-color .16s ease, box-shadow .16s ease, background .16s ease, color .16s ease;
        box-shadow:
          0 0 0 2px rgba(22,163,74,.34),
          0 8px 18px rgba(22,163,74,.18),
          inset 0 1px 0 rgba(255,255,255,.88);
      }
      .tg-handover-token-input::placeholder {
        color: #166534;
        letter-spacing: 3px;
        opacity: 1;
      }
      .tg-handover-token-input::-webkit-input-placeholder {
        color: #166534;
        opacity: 1;
      }
      .tg-handover-token-input::-moz-placeholder {
        color: #166534;
        opacity: 1;
      }
      .tg-handover-token-input.is-error {
        border-color: #dc2626 !important;
        color: #b91c1c !important;
        -webkit-text-fill-color: #b91c1c;
        caret-color: #b91c1c;
        background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(254,242,242,.98)) !important;
        box-shadow:
          0 0 0 2px rgba(220,38,38,.22),
          0 8px 18px rgba(220,38,38,.14),
          inset 0 1px 0 rgba(255,255,255,.82);
      }
      .tg-handover-token-input.is-error::placeholder {
        color: #b91c1c;
      }
      .tg-handover-token-input.is-error::-webkit-input-placeholder {
        color: #b91c1c;
        opacity: 1;
      }
      .tg-handover-token-input.is-error::-moz-placeholder {
        color: #b91c1c;
        opacity: 1;
      }
      .tg-handover-token-fill-btn {
        position: absolute;
        left: 4px;
        top: 4px;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 1px solid rgba(255,214,102,.24);
        border-radius: 9px;
        background:
          radial-gradient(circle at top left, rgba(255,255,255,.16), transparent 44%),
          linear-gradient(135deg, rgba(17,24,39,.96), rgba(40,40,40,.9));
        color: #ffffff;
        font-size: 13px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 8px 14px rgba(17,24,39,.16), inset 0 1px 0 rgba(255,255,255,.14);
      }
      .tg-handover-token-cancel-btn {
        display: none;
        height: 38px;
        min-width: clamp(62px, 18vw, 78px);
        padding: 0 10px;
        border: 1px solid rgba(17,24,39,.2);
        border-radius: 12px;
        background:
          radial-gradient(circle at top left, rgba(255,255,255,.92), transparent 46%),
          linear-gradient(135deg, rgba(255,255,255,.94), rgba(251,243,214,.72));
        color: #111827;
        font-size: 12px;
        font-weight: 900;
        white-space: nowrap;
        align-items: center;
        justify-content: center;
        flex: 0 0 clamp(62px, 18vw, 78px);
        grid-column: 3;
        grid-row: 1;
        box-shadow: 0 12px 22px rgba(17,24,39,.12), inset 0 1px 0 rgba(255,255,255,.75);
      }
      .tg-handover-bulk-bar.confirm-mode .tg-handover-token-cancel-btn {
        display: inline-flex;
      }
      .tg-handover-confirm-meta {
        display: none;
        width: 100%;
        align-items: center;
        gap: 8px;
        min-width: 0;
        grid-column: 1 / -1;
        grid-row: 2;
        color: rgba(17,24,39,.86);
        font-size: 11px;
        font-weight: 900;
        white-space: nowrap;
        overflow: hidden;
      }
      .tg-handover-confirm-meta.open {
        display: flex;
      }
      .tg-handover-confirm-chip {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tg-handover-confirm-chip i {
        flex: 0 0 auto;
      }
      .tg-handover-confirm-chip span {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tg-handover-confirm-divider {
        flex: 0 0 auto;
        opacity: .5;
      }
      @media (max-width: 380px) {
        .tg-handover-bulk-bar.open.confirm-mode {
          column-gap: 6px;
          row-gap: 5px;
        }
        .tg-handover-token-wrap {
          gap: 6px;
        }
        .tg-handover-token-input {
          height: 36px;
          padding: 0 10px 0 38px;
          font-size: 13px;
          letter-spacing: 1.4px;
        }
        .tg-handover-token-fill-btn {
          width: 28px;
          height: 28px;
        }
        .tg-handover-token-cancel-btn,
        .tg-handover-bulk-bar.confirm-mode .btn.btn-primary {
          height: 36px;
          min-width: 64px;
          padding: 0 8px;
          font-size: 11px;
          flex-basis: 64px;
        }
      }
      .tg-card {
        display: grid;
        gap: 6px;
        padding: 9px 10px;
        border-radius: 14px;
        background: var(--tg-card);
        border: 1px solid var(--tg-line);
        cursor: pointer;
        box-shadow: var(--tg-shadow);
        align-self: start;
        min-height: 0;
        height: auto;
      }
      .tg-card.is-log { cursor: default; }
      .tg-card.is-bank-paid-card {
        position: relative;
        display: block;
        gap: 0;
        padding: 7px 10px;
        min-height: 0 !important;
        height: auto !important;
        align-content: start;
        overflow: hidden;
        background:
          radial-gradient(circle at top right, rgba(251,191,36,.10), transparent 42%),
          linear-gradient(180deg, rgba(20,20,18,.98), rgba(9,9,8,.995));
        border-color: rgba(234,179,8,.18);
        box-shadow:
          0 12px 24px rgba(0,0,0,.26),
          inset 0 1px 0 rgba(255,244,214,.05);
      }
      .tg-card.is-bank-paid-card > * {
        position: relative;
        z-index: 1;
      }
      .tg-card:active { transform: scale(.99); }
      .tg-card-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
        min-width: 0;
      }
      .tg-card-main {
        min-width: 0;
        display: grid;
        gap: 1px;
      }
      .tg-card-side {
        flex: 0 0 auto;
        display: grid;
        justify-items: end;
        align-content: start;
        gap: 4px;
        min-width: 0;
      }
      .tg-card.is-bank-paid-card .tg-card-top {
        align-items: flex-start;
        gap: 6px;
        min-height: 0;
      }
      .tg-card.is-bank-paid-card .tg-card-main {
        gap: 0;
        align-content: start;
      }
      .tg-card.is-bank-paid-card .tg-card-side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: flex-start;
        gap: 2px;
        min-height: 0;
      }
      .tg-card-title {
        font-size: 13px;
        font-weight: 900;
        color: #f8d56b;
      }
      .tg-card-title-row {
        display: block;
        min-width: 0;
      }
      .tg-card-title-text {
        min-width: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 2px 5px;
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
        word-break: break-word;
        overflow-wrap: anywhere;
        line-height: 1.15;
      }
      .tg-card-customer-name {
        min-width: 0;
      }
      .tg-card-contract {
        flex: 0 1 auto;
        min-width: 0;
        font-size: var(--tg-contract-size, 10px);
        font-weight: 800;
        color: #f8fafc;
        text-align: left;
        white-space: nowrap;
        overflow: visible;
        text-overflow: clip;
        line-height: 1;
      }
      .tg-card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 6px;
        font-size: 10.5px;
        color: var(--tg-muted);
      }
      .tg-card-meta span {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .tg-card-staff {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        font-weight: 900;
        line-height: 1.1;
        color: #34d399;
      }
      .tg-card-staff-select {
        gap: 8px;
        cursor: pointer;
      }
      .tg-card-staff-checkbox {
        width: 16px;
        height: 16px;
        margin: 0;
        accent-color: #fbbf24;
        cursor: pointer;
        flex: 0 0 auto;
      }
      .tg-card-staff-arrow {
        color: rgba(255,255,255,.7);
        font-weight: 900;
      }
      .tg-card.is-bank-paid-card .tg-card-title {
        color: #f6dda0;
      }
      .tg-card.is-bank-paid-card .tg-card-contract {
        color: rgba(255,244,214,.82);
      }
      .tg-card.is-bank-paid-card .tg-card-meta {
        gap: 1px 5px;
        font-size: 10px;
        line-height: 1;
        color: rgba(255,255,255,.56);
      }
      .tg-card.is-bank-paid-card .tg-card-staff {
        font-size: 11px;
        line-height: 1;
        color: #86efac;
      }
      .tg-card.is-bank-paid-card .tg-card-amount {
        line-height: 1;
        margin: 0;
        color: #f8d56b;
        letter-spacing: -.02em;
        text-shadow: 0 0 16px rgba(234,179,8,.08);
      }
      .tg-card-amount {
        flex: 0 0 auto;
        font-size: 15px;
        font-weight: 900;
        line-height: 1;
        white-space: nowrap;
        color: #f8d56b;
        text-align: right;
      }
      .tg-pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .tg-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 7px;
        border-radius: 999px;
        font-size: 9.5px;
        font-weight: 800;
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.08);
        color: #f8fafc;
      }
      .tg-pill.collect {
        color: var(--tg-danger);
        border-color: rgba(220,38,38,.18);
        background: rgba(127,29,29,.18);
      }
      .tg-pill.pending {
        color: #f8d56b;
        border-color: rgba(234,179,8,.18);
        background: rgba(234,179,8,.14);
      }
      .tg-pill.done {
        color: var(--tg-success);
        border-color: rgba(52,211,153,.18);
        background: rgba(6,95,70,.2);
      }
      .tg-empty {
        padding: 14px;
        border-radius: 14px;
        border: 1px dashed rgba(148,163,184,.35);
        text-align: center;
        color: var(--tg-muted);
        font-size: 13px;
      }
      .tg-card-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        flex-wrap: wrap;
      }
      .tg-card-status-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-height: 22px;
        padding: 0 8px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        font-size: 10px;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
      }
      .tg-card-status-badge.is-paid {
        background: linear-gradient(180deg, rgba(7,89,74,.30), rgba(4,47,46,.20));
        border-color: rgba(110,231,183,.18);
        color: #d1fae5;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
      }
      .tg-muted {
        color: var(--tg-muted);
        font-size: 12px;
      }
      .tg-small-btn {
        border: 0;
        border-radius: 999px;
        padding: 6px 10px;
        font-weight: 800;
        cursor: pointer;
        font-size: 11px;
        line-height: 1.1;
        white-space: nowrap;
        background: rgba(255,255,255,.04);
        color: var(--tg-text);
        border: 1px solid rgba(255,255,255,.08);
      }
      .tg-small-btn[disabled] {
        opacity: .78;
        cursor: default;
      }
      .tg-card-action-primary {
        background: linear-gradient(135deg, #fbbf24, #eab308);
        color: #111827;
        border-color: transparent;
      }
      .tg-card-action-success {
        background: linear-gradient(135deg, #34d399, #10b981);
        color: #052e16;
        border-color: transparent;
      }
      .tg-card-status-static {
        cursor: pointer;
        pointer-events: auto;
      }
      .tg-shell .btn,
      .tg-sheet .btn {
        min-height: 42px;
        border-radius: 14px;
        font-weight: 800;
        box-shadow: none;
      }
      .tg-shell .btn.btn-primary,
      .tg-sheet .btn.btn-primary {
        background: linear-gradient(135deg, #fbbf24, #eab308);
        border: 0;
        color: #111827;
      }
      .tg-shell .btn.btn-secondary,
      .tg-sheet .btn.btn-secondary {
        background: rgba(255,255,255,.04);
        border: 1px solid rgba(255,255,255,.08);
        color: #f8fafc;
      }
      .tg-fab {
        position: fixed;
        left: calc(10px + env(safe-area-inset-left, 0px));
        bottom: calc(82px + env(safe-area-inset-bottom, 0px));
        width: 58px;
        height: 58px;
        border: 0;
        border-radius: 20px;
        background: linear-gradient(135deg, #fbbf24, #eab308);
        color: #111827;
        box-shadow: 0 18px 34px rgba(234,179,8,.28);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        cursor: pointer;
        z-index: 30;
      }
      .tg-sheet {
        position: fixed;
        inset: 0;
        z-index: 95;
        display: none;
        align-items: flex-end;
        justify-content: center;
        padding: 14px;
        background: rgba(0,0,0,.56);
        backdrop-filter: blur(12px);
      }
      .tg-sheet.open { display: flex; }
      .tg-sheet-panel {
        width: min(100%, 760px);
        max-height: min(90vh, 900px);
        overflow: auto;
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(15,15,15,.99), rgba(5,5,5,.99));
        border: 1px solid rgba(234,179,8,.14);
        box-shadow: 0 32px 80px rgba(0,0,0,.42);
        padding: 16px;
        display: grid;
        gap: 14px;
        color: var(--tg-text);
      }
      .tg-prompt-panel {
        width: min(100%, 420px);
        max-height: none;
        overflow: visible;
        gap: 12px;
        padding: 18px;
      }
      .tg-prompt-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .tg-prompt-title-wrap {
        display: grid;
        gap: 4px;
      }
      .tg-prompt-message {
        white-space: pre-wrap;
        color: rgba(255,255,255,.84);
        line-height: 1.5;
        font-size: 14px;
      }
      .tg-prompt-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }
      .tg-prompt-confirm.is-danger {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: #fff;
      }
      /* LOCKED 2026-04-25: user-approved Thu góp create form layout. Do not modify without explicit user request.
         Backup snapshot: references/locked-ui/thugop-root.locked-2026-04-25.js */
      .tg-sheet-panel-create {
        width: 100%;
        max-width: none;
        max-height: min(860px, calc(100dvh - 6px));
        overflow: hidden;
        grid-template-rows: auto auto auto;
        background: linear-gradient(180deg, rgba(15,15,15,.99), rgba(5,5,5,.99));
        border: 0;
        box-shadow: 0 30px 80px rgba(0,0,0,.42);
        color: #f8fafc;
        border-radius: 26px 26px 0 0;
        transition: max-height .18s ease, padding .18s ease, gap .18s ease;
      }
      .tg-sheet-panel-collect {
        width: 100%;
        max-width: none;
        max-height: min(860px, calc(100dvh - 6px));
        overflow: hidden;
        overscroll-behavior: none;
        grid-template-rows: auto auto auto auto;
        background: linear-gradient(180deg, rgba(15,15,15,.995), rgba(4,4,4,.995));
        border: 0;
        box-shadow: 0 30px 80px rgba(0,0,0,.42);
        color: #f8fafc;
        border-radius: 26px 26px 0 0;
        padding: 12px 14px 0;
        transition: max-height .18s ease, padding .18s ease, gap .18s ease;
      }
      #tgCollectSheet.keyboard-open {
        align-items: flex-end;
      }
      #tgCollectSheet.keyboard-open .tg-sheet-panel-collect {
        max-height: calc(100dvh - 8px);
        gap: 8px;
        padding: 10px 12px 0;
      }
      #tgCreateSheet,
      #tgCollectSheet {
        align-items: flex-end;
        justify-content: stretch;
        padding: 0;
        background: rgba(0,0,0,.56);
      }
      #tgCollectSheet {
        overscroll-behavior: none;
        touch-action: manipulation;
      }
      .tg-sheet-panel-create .tg-eyebrow {
        color: #f8d56b;
      }
      .tg-sheet-panel-create .tg-title {
        color: #f8fafc;
      }
      .tg-sheet-panel-create .tg-sheet-close {
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: #f8fafc;
      }
      .tg-sheet-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .tg-image-sheet {
        z-index: 120;
        align-items: center;
        justify-content: center;
        padding: 14px;
        background: rgba(0,0,0,.86);
        backdrop-filter: blur(10px);
      }
      .tg-image-sheet-panel {
        width: min(100%, 760px);
        max-height: min(92vh, 980px);
        display: grid;
        gap: 12px;
        padding: calc(12px + env(safe-area-inset-top, 0px)) 12px calc(12px + env(safe-area-inset-bottom, 0px));
        border-radius: 24px;
        background: linear-gradient(180deg, rgba(15,15,15,.985), rgba(5,5,5,.995));
        border: 1px solid rgba(255,255,255,.08);
        box-shadow: 0 28px 80px rgba(0,0,0,.46);
      }
      .tg-image-viewer {
        width: 100%;
        min-height: 300px;
        max-height: calc(92vh - 96px);
        overflow: auto;
        border-radius: 20px;
        background: rgba(255,255,255,.02);
        border: 1px solid rgba(255,255,255,.08);
        -webkit-overflow-scrolling: touch;
      }
      .tg-image-viewer img {
        width: 100%;
        height: auto;
        display: block;
        object-fit: contain;
      }
      .tg-sheet-close {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: #f8fafc;
        font-size: 20px;
        cursor: pointer;
      }
      .tg-eyebrow {
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .14em;
        text-transform: uppercase;
        color: #f8d56b;
      }
      .tg-title {
        margin: 0;
        font-size: 20px;
        line-height: 1.08;
        font-weight: 900;
        color: #f8fafc;
      }
      .tg-grid-two {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .tg-field {
        display: grid;
        gap: 8px;
        min-width: 0;
      }
      .tg-field label {
        font-size: 12px;
        font-weight: 800;
        color: rgba(255,255,255,.72);
      }
      .tg-input, .tg-textarea {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: #f8fafc;
        padding: 13px 14px;
        font-size: 14px;
        outline: none;
      }
      .tg-textarea {
        min-height: 92px;
        resize: vertical;
      }
      .tg-input::placeholder, .tg-textarea::placeholder { color: rgba(255,255,255,.34); }
      .tg-detail-card {
        display: grid;
        gap: 10px;
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.08);
      }
      .tg-collect-photo-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .tg-collect-photo-card {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 8px;
        min-width: 0;
      }
      .tg-collect-photo-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 11px;
        font-weight: 900;
        color: rgba(255,255,255,.72);
        letter-spacing: .04em;
        text-transform: uppercase;
      }
      .tg-collect-entry-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 2px;
      }
      .tg-collect-amount-dock,
      .tg-collect-note-dock {
        padding: 0;
      }
      .tg-collect-amount-dock .tg-input,
      .tg-collect-note-dock .tg-input {
        height: 46px;
        min-height: 46px;
        padding-top: 0;
        padding-bottom: 0;
      }
      .tg-collect-preview {
        height: clamp(276px, 43vh, 420px);
        min-height: clamp(276px, 43vh, 420px);
        max-height: clamp(276px, 43vh, 420px);
        border-radius: 20px;
      }
      .tg-collect-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .tg-collect-preview.is-source-scroll {
        display: block;
        place-items: unset;
        overflow: auto;
        background: rgba(255,255,255,.02);
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y pinch-zoom;
      }
      .tg-collect-preview.is-source-scroll img {
        width: 100%;
        height: auto;
        min-height: 100%;
        object-fit: contain;
        object-position: top center;
      }
      .tg-collect-preview.is-upload {
        cursor: pointer;
      }
      .tg-collect-preview.is-upload.has-photo {
        border-style: solid;
      }
      .tg-collect-preview-empty {
        display: grid;
        gap: 8px;
        justify-items: center;
        text-align: center;
        padding: 16px;
        color: rgba(255,255,255,.62);
        font-size: 12px;
        line-height: 1.35;
      }
      .tg-collect-preview-empty i {
        font-size: 24px;
        color: #f8d56b;
      }
      .tg-collect-compare {
        display: none;
        gap: 10px;
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,.035);
        border: 1px solid rgba(255,255,255,.08);
      }
      .tg-collect-compare-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .tg-collect-compare-item {
        display: grid;
        gap: 0;
        padding: 11px 10px;
        border-radius: 14px;
        background: rgba(255,255,255,.03);
        border: 1px solid rgba(255,255,255,.07);
        min-width: 0;
        align-items: center;
      }
      .tg-collect-compare-item small {
        display: none;
      }
      .tg-collect-compare-item strong {
        font-size: 13px;
        font-weight: 900;
        color: #f8fafc;
        min-width: 0;
        word-break: break-word;
      }
      .tg-collect-compare-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        width: fit-content;
        max-width: 100%;
        min-height: 30px;
        padding: 0 12px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 900;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: #f8fafc;
      }
      .tg-collect-compare-status.is-good {
        background: rgba(6,95,70,.24);
        border-color: rgba(52,211,153,.22);
        color: #d1fae5;
      }
      .tg-collect-compare-status.is-warn {
        background: rgba(127,29,29,.22);
        border-color: rgba(248,113,113,.2);
        color: #fecaca;
      }
      .tg-collect-warning {
        display: grid;
        gap: 6px;
        padding: 10px 12px;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.02));
      }
      .tg-collect-warning-main,
      .tg-collect-warning-note {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }
      .tg-collect-warning-main {
        font-size: 12px;
        font-weight: 800;
        color: rgba(255,255,255,.86);
      }
      .tg-collect-warning-main i,
      .tg-collect-warning-note i {
        flex: 0 0 auto;
        width: 15px;
        text-align: center;
      }
      .tg-collect-warning-main strong {
        color: #f8fafc;
      }
      .tg-collect-warning-note {
        font-size: 11px;
        font-weight: 800;
        color: rgba(255,255,255,.62);
      }
      .tg-collect-warning-note.is-warn {
        color: #fca5a5;
      }
      .tg-collect-warning-note.is-good {
        color: #86efac;
      }
      .tg-collect-actions {
        display: flex;
        gap: 10px;
        justify-content: stretch;
        position: sticky;
        bottom: 0;
        z-index: 3;
        margin-top: auto;
        padding: 8px 0 max(8px, env(safe-area-inset-bottom, 0px));
        background: linear-gradient(180deg, rgba(5,5,5,0), rgba(5,5,5,.92) 20%, rgba(5,5,5,.985));
      }
      #tgCollectSheet.keyboard-open .tg-collect-photo-grid {
        gap: 6px;
      }
      #tgCollectSheet.keyboard-open .tg-collect-photo-head {
        font-size: 10px;
      }
      #tgCollectSheet.keyboard-open .tg-collect-entry-row {
        gap: 6px;
      }
      #tgCollectSheet.keyboard-open .tg-collect-amount-dock,
      #tgCollectSheet.keyboard-open .tg-collect-note-dock {
        padding: 0;
      }
      #tgCollectSheet.keyboard-open .tg-collect-amount-dock .tg-input,
      #tgCollectSheet.keyboard-open .tg-collect-note-dock .tg-input {
        height: 42px;
        min-height: 42px;
      }
      .tg-collect-actions .btn {
        flex: 1 1 auto;
      }
      #tgCollectSheet.keyboard-open .tg-collect-preview {
        height: 122px;
        min-height: 122px;
        max-height: 122px;
      }
      #tgCollectSheet.keyboard-open .tg-detail-card {
        gap: 6px;
        padding: 10px;
      }
      #tgCollectSheet.keyboard-open .tg-sheet-head {
        gap: 8px;
      }
      #tgCollectSheet.keyboard-open .tg-title {
        font-size: 17px;
      }
      #tgCollectSheet.keyboard-open .tg-textarea {
        min-height: 40px;
        height: 40px;
      }
      #tgCollectSheet .tg-field label {
        display: none;
      }
      #tgCollectSheet .tg-textarea {
        min-height: 56px;
        height: 56px;
        padding-top: 10px;
        padding-bottom: 10px;
      }
      .tg-detail-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 12px;
        color: rgba(255,255,255,.58);
      }
      .tg-detail-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .tg-create-grid {
        display: grid;
        gap: 8px;
        align-content: start;
        overflow: hidden;
      }
      .tg-create-preview-card {
        display: grid;
        gap: 8px;
      }
      .tg-create-preview {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        min-height: 0;
        max-height: none;
        background: #f8fafc;
        border: 1px dashed rgba(148,163,184,.32);
        overflow: hidden;
        cursor: pointer;
      }
      .tg-create-preview.is-live {
        background: #020617;
        border-style: solid;
        border-color: rgba(234,179,8,.26);
      }
      .tg-create-preview video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: none;
        background: #000;
      }
      .tg-create-preview.is-live video {
        display: block;
      }
      .tg-create-live-scanner {
        position: absolute;
        inset: 0;
        overflow: hidden;
        background: #000;
      }
      .tg-create-live-scanner video,
      .tg-create-live-scanner canvas {
        position: absolute !important;
        inset: 0;
        width: 100% !important;
        height: 100% !important;
        object-fit: cover;
        display: block !important;
        background: #000;
      }
      .tg-create-preview-overlay {
        position: absolute;
        inset: auto 8px 8px 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        pointer-events: none;
      }
      .tg-create-preview-badge,
      .tg-create-preview-tip {
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 900;
        color: #fff;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(255,255,255,.14);
        backdrop-filter: blur(8px);
      }
      .tg-create-preview-badge.success {
        color: #052e16;
        background: rgba(187,247,208,.92);
        border-color: rgba(134,239,172,.95);
      }
      .tg-create-preview-badge.warn {
        color: #fef3c7;
        background: rgba(146,64,14,.82);
        border-color: rgba(251,191,36,.42);
      }
      .tg-create-preview-meta {
        display: none;
      }
      .tg-create-live-status {
        min-height: 16px;
        font-size: 11px;
        font-weight: 800;
        color: rgba(255,255,255,.68);
      }
      .tg-create-live-status.success {
        color: #86efac;
      }
      .tg-create-live-status.warn {
        color: #fcd34d;
      }
      #tgCreateSheet.keyboard-open {
        align-items: flex-end;
      }
      #tgCreateSheet.keyboard-open .tg-sheet-panel-create {
        max-height: calc(100dvh - 8px);
        gap: 8px;
        padding-bottom: 2px;
      }
      #tgCreateSheet.keyboard-open .tg-create-preview {
        width: 100%;
      }
      #tgCreateSheet.keyboard-open .tg-create-grid {
        gap: 6px;
      }
      .tg-create-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .tg-sheet-panel-create .tg-field label {
        display: none;
      }
      .tg-create-grid .tg-input {
        height: 46px;
      }
      .tg-sheet-panel-create .tg-input,
      .tg-sheet-panel-create .tg-textarea {
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: #f8fafc;
      }
      .tg-sheet-panel-create .tg-input::placeholder,
      .tg-sheet-panel-create .tg-textarea::placeholder {
        color: rgba(255,255,255,.34);
      }
      .tg-create-grid .tg-textarea {
        min-height: 48px;
        height: 48px;
        resize: none;
      }
      .tg-create-actions {
        margin-top: 2px;
      }
      .tg-sheet-panel-create .tg-create-actions {
        justify-content: flex-end;
      }
      .tg-print-preview-panel {
        width: 100%;
        max-width: none;
        height: 100dvh;
        max-height: 100dvh;
        border-radius: 0;
        border: 0;
        box-shadow: none;
        padding: calc(14px + env(safe-area-inset-top, 0px)) 16px calc(18px + env(safe-area-inset-bottom, 0px));
        background: linear-gradient(180deg, rgba(0,0,0,.99), rgba(8,8,8,.99));
        grid-template-rows: auto 1fr;
      }
      #tgPrintPreviewSheet {
        align-items: stretch;
        justify-content: stretch;
        padding: 0;
        background: linear-gradient(180deg, rgba(0,0,0,.99), rgba(8,8,8,.99));
        backdrop-filter: none;
      }
      .tg-print-preview-body {
        display: grid;
        grid-template-rows: auto 1fr auto;
        gap: 14px;
        align-content: start;
        justify-items: center;
        overflow: auto;
        padding: 6px 0 0;
      }
      .tg-print-preview-status {
        width: min(100%, 620px);
        display: flex;
        justify-content: space-between;
        gap: 10px;
        color: rgba(255,255,255,.72);
        font-size: 12px;
        font-weight: 700;
        flex-wrap: wrap;
      }
      .tg-print-preview-status strong {
        color: #f8d56b;
      }
      .tg-print-preview-note {
        width: min(100%, 620px);
        font-size: 12px;
        color: rgba(255,255,255,.74);
        text-align: center;
        padding-bottom: 10px;
      }
      .tg-print-preview-actions {
        width: min(100%, 620px);
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .tg-receipt-preview {
        width: min(100%, 360px);
        padding: 10px;
        border-radius: 0;
        border: 1px solid rgba(17,24,39,0.12);
        background: #fff;
        box-shadow: 0 8px 20px rgba(17,24,39,0.06);
        color: #111;
        font-family: Arial, Helvetica, sans-serif;
      }
      .tg-receipt-head {
        display: grid;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 1px dashed #999;
      }
      .tg-receipt-store {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr);
        align-items: flex-start;
        gap: 10px;
      }
      .tg-receipt-logo {
        width: 42px;
        height: 42px;
        object-fit: contain;
        border: 0;
        border-radius: 0;
        flex: 0 0 auto;
      }
      .tg-receipt-brand {
        font-size: 15px;
        font-weight: 900;
        text-transform: uppercase;
        line-height: 1.18;
      }
      .tg-receipt-store-copy {
        display: grid;
        gap: 0;
        min-width: 0;
      }
      .tg-receipt-address,
      .tg-receipt-meta,
      .tg-receipt-footnote {
        font-size: 10px;
        line-height: 1.34;
        color: #555;
      }
      .tg-receipt-title-block {
        display: grid;
        gap: 0;
        margin: 4px 0 2px;
        justify-items: center;
        text-align: center;
      }
      .tg-receipt-title {
        font-size: 14px;
        font-weight: 900;
        line-height: 1.2;
        text-transform: uppercase;
      }
      .tg-receipt-code-main {
        font-size: 19px;
        line-height: 1;
        font-weight: 900;
        letter-spacing: .6px;
        font-family: monospace;
      }
      .tg-receipt-code-subtime {
        font-size: 13px;
        line-height: 1.34;
        color: #4b5563;
        font-weight: 800;
        margin-top: 2px;
      }
      .tg-receipt-section {
        display: grid;
        gap: 6px;
        padding: 12px 0;
        border-bottom: 2px dashed rgba(17,24,39,0.2);
      }
      .tg-receipt-row,
      .tg-receipt-item-line,
      .tg-receipt-total-line {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        font-size: 12px;
        line-height: 1.45;
      }
      .tg-receipt-row span:first-child,
      .tg-receipt-item-line span:first-child,
      .tg-receipt-total-line span:first-child {
        color: #374151;
      }
      .tg-receipt-item-list {
        display: grid;
        gap: 8px;
      }
      .tg-receipt-item {
        display: grid;
        gap: 4px;
      }
      .tg-receipt-item-name {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.4;
      }
      .tg-receipt-item-sub {
        font-size: 12px;
        color: #6b7280;
        line-height: 1.5;
      }
      .tg-receipt-total-line {
        font-weight: 800;
        font-size: 13px;
      }
      .tg-receipt-total-line.grand {
        font-size: 15px;
      }
      .tg-receipt-tail {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed #999;
        font-size: 11px;
        color: #444;
        text-align: center;
        line-height: 1.5;
      }
      .tg-receipt-main {
        display: grid;
        grid-template-columns: 138px minmax(0, 1fr);
        gap: 8px;
        align-items: start;
        margin-top: 4px;
        padding: 0;
        border-bottom: 0;
      }
      .tg-receipt-main-info {
        display: grid;
        gap: 0;
        min-width: 0;
      }
      .tg-receipt-codes {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .tg-receipt-qr-box {
        width: 132px;
        min-height: 132px;
        border: 1px solid #0f172a;
        border-radius: 8px;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: #fff;
        padding: 3px;
      }
      .tg-receipt-qr-box svg,
      .tg-receipt-qr-box img,
      .tg-receipt-barcode-box svg {
        display: block;
        width: 100%;
        height: 100%;
      }
      .tg-receipt-barcode-box {
        width: 70%;
        min-height: 52px;
        display: grid;
        place-items: center;
        overflow: hidden;
        padding: 0;
        background: #fff;
        margin: 0 auto;
      }
      .tg-receipt-barcode-row {
        grid-column: 1 / -1;
        display: grid;
        gap: 4px;
        margin-top: 2px;
        justify-items: center;
      }
      .tg-receipt-note-block {
        grid-column: 1 / -1;
        margin-top: 4px;
        padding-top: 6px;
        border-top: 1px dotted #ddd;
        display: block;
        text-align: left;
      }
      .tg-receipt-note-line {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        flex-wrap: wrap;
      }
      .tg-receipt-note-label {
        font-size: 12px;
        font-weight: 800;
        color: #444;
        flex: 0 0 auto;
      }
      .tg-receipt-note-value {
        font-size: 13px;
        line-height: 1.46;
        color: #111;
        font-weight: 800;
        white-space: pre-wrap;
        word-break: break-word;
        flex: 1 1 220px;
        min-width: 0;
      }
      .tg-receipt-code-text {
        font-size: 11px;
        line-height: 1.2;
        text-align: center;
        font-weight: 700;
        display: none;
      }
      .tg-receipt-code-hint {
        font-size: 9px;
        color: #4b5563;
        text-align: center;
        line-height: 1.28;
        font-weight: 800;
      }
      .tg-receipt-key-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: flex-start;
        padding: 6px 0 9px;
        border-bottom: 1px dotted #ddd;
        font-size: 12px;
        line-height: 1.34;
      }
      .tg-receipt-key-row:last-child {
        border-bottom: 0;
      }
      .tg-receipt-key-row span {
        color: #444;
        font-weight: 700;
        display: block;
        padding-bottom: 1px;
      }
      .tg-receipt-key-row strong {
        text-align: right;
        font-size: 13px;
        max-width: 58%;
        line-height: 1.34;
        word-break: break-word;
        color: #111;
        font-weight: 800;
        display: block;
        padding-bottom: 1px;
      }
      .tg-receipt-key-row.money strong {
        font-size: 16px;
        line-height: 1.14;
        color: #000;
        font-weight: 900;
        padding-bottom: 2px;
      }
      .tg-receipt-note-inline {
        color: #111;
        font-weight: 800;
        min-width: 28px;
      }
      .tg-receipt-tail-meta {
        margin-top: 12px;
        text-align: left;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.45;
      }
      @media (max-width: 380px) {
        .tg-receipt-preview {
          width: min(100%, 340px);
          padding: 10px;
        }
        .tg-receipt-logo {
          width: 32px;
          height: 32px;
        }
        .tg-receipt-brand {
          font-size: 13px;
        }
        .tg-receipt-title {
          font-size: 14px;
        }
        .tg-receipt-code-main {
          font-size: 19px;
        }
        .tg-receipt-main {
          grid-template-columns: 138px minmax(0, 1fr);
          gap: 8px;
        }
        .tg-receipt-qr-box {
          width: 132px;
          min-height: 132px;
        }
        .tg-receipt-key-row strong {
          max-width: 58%;
        }
      }
      #tgCreateQrScannerHost {
        position: fixed;
        left: -9999px;
        top: -9999px;
        width: 1px;
        height: 1px;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
      }
      #tgReceiptRenderStage {
        position: fixed;
        left: -9999px;
        top: 0;
        width: 380px;
        opacity: 0;
        pointer-events: none;
        z-index: -1;
      }
      .tg-preview {
        width: 100%;
        min-height: 180px;
        border-radius: 18px;
        background: rgba(255,255,255,.03);
        border: 1px dashed rgba(255,255,255,.12);
        display: grid;
        place-items: center;
        overflow: hidden;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
      }
      .tg-preview.has-photo {
        border-style: solid;
        border-color: rgba(234,179,8,.24);
      }
      .tg-sheet .btn[disabled] {
        opacity: .48;
        cursor: default;
        filter: grayscale(.08);
      }
      .tg-money {
        font-size: 20px;
        font-weight: 900;
        color: #f8d56b;
      }
      .tg-filter-list {
        display: grid;
        gap: 8px;
      }
      .tg-filter-option {
        width: 100%;
        padding: 13px 14px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
        color: var(--tg-text);
        text-align: left;
        font-weight: 900;
        cursor: pointer;
      }
      .tg-filter-option.active {
        border-color: rgba(234,179,8,.22);
        background: rgba(234,179,8,.14);
        color: #f8d56b;
      }
      .tg-hidden { display: none !important; }
      @media (max-width: 640px) {
        #thugopRootHost,
        .tg-shell {
          overflow-x: hidden;
        }
        .tg-topbar {
          gap: 2px;
        }
        .tg-toolbar {
          grid-template-columns: minmax(0, 1fr) 68px;
          gap: 6px;
          padding: 0;
          border-radius: 0;
        }
        .tg-filter-btn {
          min-width: 52px;
          padding: 0 12px;
        }
        .tg-filter-btn span { display: none; }
        .tg-filter-btn.tg-mode-switch-btn {
          flex-basis: 68px;
          width: 68px;
          min-width: 68px;
          max-width: 68px;
          padding: 0 10px;
        }
        .tg-filter-btn.tg-mode-switch-btn span {
          display: inline;
        }
        .tg-search-wrap {
          height: 40px;
          padding: 2px 3px 2px 12px;
          gap: 5px;
        }
        .tg-subtoolbar {
          gap: 8px;
        }
        .tg-handover-bulk-bar {
          padding: 8px 10px calc(6px + env(safe-area-inset-bottom, 0px));
        }
        .tg-staff-filter-btn {
          min-width: 0;
          max-width: min(76vw, 220px);
          height: 24px;
          padding: 0;
          font-size: 10.5px;
        }
        .tg-staff-filter-total {
          font-size: 10.5px;
        }
        .tg-staff-filter-menu {
          min-width: 170px;
          max-width: min(82vw, 230px);
        }
        .tg-search-toggle-btn {
          width: 96px;
          flex-basis: 96px;
          height: 32px;
          padding: 0 7px;
          font-size: 10px;
        }
        .tg-grid-two { grid-template-columns: 1fr; }
        .tg-collect-photo-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        .tg-collect-preview {
          height: 228px;
          min-height: 228px;
          max-height: 228px;
        }
        .tg-collect-compare-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 6px;
        }
        .tg-collect-compare-item {
          padding: 10px 8px;
        }
        .tg-collect-compare-item strong {
          font-size: 11.5px;
        }
        .tg-card-top { align-items: flex-start; }
        .tg-card-title-row { }
        .tg-detail-actions { flex-direction: column; align-items: stretch; }
        .tg-card-side {
          gap: 4px;
        }
        .tg-card.is-bank-paid-card {
          padding: 6px 10px;
        }
        .tg-card.is-bank-paid-card .tg-card-side {
          gap: 1px;
        }
        .tg-card-amount {
          text-align: right;
          font-size: 13px;
          max-width: none;
          white-space: nowrap;
          word-break: normal;
        }
        .tg-card-title-text {
          gap: 2px 4px;
        }
        .tg-card-contract {
          flex-basis: auto;
          max-width: none;
          font-size: var(--tg-contract-size, 9.5px);
          white-space: nowrap;
        }
        .tg-card-meta {
          font-size: 10px;
          gap: 3px 6px;
        }
        .tg-card-staff {
          font-size: 11px;
        }
        .tg-small-btn {
          padding: 6px 9px;
          font-size: 10.5px;
        }
        .tg-sheet { padding: 10px; }
        .tg-sheet-panel { border-radius: 24px; }
        #tgCreateSheet { padding: 0; align-items: flex-end; justify-content: stretch; }
        #tgCreateSheet .tg-sheet-panel-create {
          width: 100%;
          height: auto;
          max-height: calc(100dvh - 2px);
          border-radius: 24px 24px 0 0;
          gap: 10px;
          padding: 12px 12px calc(10px + env(safe-area-inset-bottom, 0px));
        }
        #tgCreateSheet.keyboard-open .tg-sheet-panel-create {
          max-height: calc(100dvh - 6px);
          gap: 8px;
          padding: 10px 12px 2px;
        }
        #tgCreateSheet .tg-sheet-head {
          position: static;
          margin: 0;
          padding: 0;
          background: transparent;
          border-bottom: 0;
          backdrop-filter: none;
        }
        #tgCreateSheet .tg-create-grid {
          grid-auto-rows: min-content;
          gap: 8px;
          padding-bottom: 0;
          overflow: hidden;
        }
        #tgCreateSheet .tg-create-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }
        #tgCreateSheet .tg-create-preview-card {
          gap: 8px;
        }
        #tgCreateSheet .tg-create-preview {
          width: 100%;
        }
        #tgCreateSheet.keyboard-open .tg-create-preview {
          width: 100%;
        }
        #tgCreateSheet .tg-create-preview-meta {
          display: none;
        }
        #tgCreateSheet .tg-field {
          gap: 0;
        }
        #tgCreateSheet .tg-field label {
          display: none;
        }
        #tgCreateSheet .tg-create-grid .tg-input {
          height: 42px;
          padding: 0 12px;
          font-size: 13px;
        }
        #tgCreateSheet.keyboard-open .tg-create-grid .tg-input {
          height: 40px;
        }
        #tgCreateSheet .tg-create-grid .tg-textarea {
          min-height: 44px;
          height: 44px;
          padding: 10px 12px;
        }
        #tgCreateSheet .tg-create-actions {
          margin: 0;
          padding: 0 0 calc(4px + env(safe-area-inset-bottom, 0px));
        }
        #tgCreateSheet.keyboard-open .tg-create-actions {
          padding-bottom: 0;
          margin-bottom: 0;
        }
        #tgCollectSheet { padding: 0; align-items: flex-end; justify-content: stretch; }
        #tgCollectSheet .tg-sheet-panel-collect {
          width: 100%;
          height: auto;
          max-height: calc(100dvh - 2px);
          border-radius: 24px 24px 0 0;
          gap: 10px;
          padding: 12px 12px 0;
        }
        #tgCollectSheet.keyboard-open .tg-sheet-panel-collect {
          max-height: calc(100dvh - 6px);
          gap: 8px;
          padding: 10px 12px 0;
        }
        #tgCollectSheet .tg-sheet-head {
          position: static;
          margin: 0;
          padding: 0;
          background: transparent;
          border-bottom: 0;
          backdrop-filter: none;
        }
        #tgPrintPreviewSheet .tg-print-preview-panel {
          padding: calc(12px + env(safe-area-inset-top, 0px)) 14px calc(16px + env(safe-area-inset-bottom, 0px));
        }
        #tgPrintPreviewSheet .tg-print-preview-status,
        #tgPrintPreviewSheet .tg-print-preview-note {
          width: 100%;
        }
        #tgPrintPreviewSheet .tg-print-preview-actions {
          width: 100%;
        }
        #tgPrintPreviewSheet .tg-receipt-preview {
          width: min(100%, 380px);
        }
      }
    </style>
    <div class="tg-shell">
      <div class="tg-topbar">
        <div id="tgModeTabs" class="tg-mode-tabs"></div>
        <div class="tg-toolbar">
          <div class="tg-search-wrap">
            <input id="tgSearchInput" class="tg-search" type="search" placeholder="Tìm mã phiếu, khách, SĐT, HĐ" />
            <button id="tgQuickBankToggle" class="tg-search-toggle-btn" type="button">Chưa đóng</button>
          </div>
          <button id="tgOpenFilterBtn" class="tg-filter-btn tg-mode-switch-btn" type="button"><i id="tgModeSwitchIcon" class="fa-solid fa-hand-holding-dollar"></i><span id="tgFilterBtnLabel">Giao</span></button>
        </div>
        <div class="tg-subtoolbar">
          <label id="tgHandoverSelectToggleWrap" class="tg-handover-select-toggle-wrap tg-hidden">
            <input id="tgHandoverSelectToggle" class="tg-handover-select-toggle" type="checkbox" />
          </label>
          <div id="tgStaffFilterWrap" class="tg-staff-filter-wrap">
            <button id="tgStaffFilterBtn" class="tg-staff-filter-btn" type="button" aria-haspopup="true" aria-expanded="false">
              <i class="fa-solid fa-users"></i>
              <span id="tgStaffFilterLabel">All nhân viên</span>
              <i class="fa-solid fa-angle-down"></i>
            </button>
            <div id="tgStaffFilterMenu" class="tg-staff-filter-menu"></div>
          </div>
          <div id="tgStaffFilterTotal" class="tg-staff-filter-total">0đ</div>
          <div id="tgDateFilterWrap" class="tg-date-filter-wrap tg-hidden">
            <button id="tgDateFilterBtn" class="tg-date-filter-btn" type="button" aria-haspopup="true" aria-expanded="false">
              <i class="fa-regular fa-calendar"></i>
              <span id="tgDateFilterLabel">Hôm nay</span>
              <i class="fa-solid fa-angle-down"></i>
            </button>
            <div id="tgDateFilterMenu" class="tg-date-filter-menu"></div>
          </div>
        </div>
      </div>
      <div id="tgMainList" class="tg-list"></div>
      <div id="tgHandoverBulkBar" class="tg-handover-bulk-bar">
        <div class="tg-handover-bulk-left">
          <label class="tg-handover-bulk-select" title="Chọn tất cả phiếu đang hiện">
            <input id="tgHandoverSelectAll" type="checkbox" />
            <span>Tất cả</span>
          </label>
          <div class="tg-handover-bulk-meta">
            <strong id="tgHandoverBulkTitle">Chưa chọn phiếu</strong>
            <span id="tgHandoverBulkAmount">0đ</span>
          </div>
        </div>
        <div id="tgHandoverTokenWrap" class="tg-handover-token-wrap">
          <div class="tg-handover-token-input-wrap">
            <button id="tgHandoverTokenFillBtn" class="tg-handover-token-fill-btn" type="button" title="Tự điền token"><i class="fa-solid fa-shield-halved"></i></button>
            <input id="tgHandoverTokenInput" class="tg-handover-token-input" type="text" inputmode="numeric" maxlength="6" placeholder="- - - - - -" />
          </div>
        </div>
        <button id="tgApproveSelectedBtn" class="btn btn-primary" type="button" disabled><i class="fa-solid fa-check-double"></i> Duyệt</button>
        <button id="tgHandoverTokenCancelBtn" class="tg-handover-token-cancel-btn" type="button">Huỷ</button>
        <div id="tgHandoverConfirmMeta" class="tg-handover-confirm-meta">
          <span class="tg-handover-confirm-chip"><i class="fa-solid fa-users"></i><span id="tgHandoverConfirmActors">NV → QL</span></span>
          <span class="tg-handover-confirm-divider">|</span>
          <span class="tg-handover-confirm-chip"><i class="fa-solid fa-money-bill-wave"></i><span id="tgHandoverConfirmAmount">0đ</span></span>
        </div>
      </div>
      <button id="tgFabCreate" class="tg-fab" type="button" title="Tạo phiếu mới"><i class="fa-solid fa-plus"></i></button>
    </div>

    <div id="tgFilterSheet" class="tg-sheet" aria-hidden="true">
      <div class="tg-sheet-panel">
        <div class="tg-sheet-head">
          <div>
            <div class="tg-eyebrow">Lọc danh sách</div>
            <h3 class="tg-title">Chọn kiểu hiển thị</h3>
          </div>
          <button id="tgCloseFilterBtn" class="tg-sheet-close" type="button">×</button>
        </div>
        <div id="tgFilterList" class="tg-filter-list"></div>
      </div>
    </div>

    <div id="tgDetailSheet" class="tg-sheet" aria-hidden="true">
      <div class="tg-sheet-panel">
        <div class="tg-sheet-head">
          <div>
            <div class="tg-eyebrow">Chi tiết phiếu</div>
            <h3 id="tgDetailTitle" class="tg-title">Phiếu</h3>
          </div>
          <button id="tgCloseDetailBtn" class="tg-sheet-close" type="button">×</button>
        </div>
        <div id="tgDetailBody" class="tg-detail-card"></div>
        <div class="tg-detail-actions">
          <button id="tgDetailCollectBtn" class="btn btn-primary" type="button"><i class="fa-solid fa-money-bill-wave"></i> Thu tiền</button>
          <button id="tgDetailSingleApproveBtn" class="btn btn-secondary" type="button"><i class="fa-solid fa-sack-dollar"></i> Giao tiền</button>
        </div>
      </div>
    </div>

    <div id="tgCollectSheet" class="tg-sheet" aria-hidden="true">
      <div class="tg-sheet-panel tg-sheet-panel-collect">
        <div class="tg-sheet-head">
          <div>
            <div class="tg-eyebrow">Đóng tiền ngân hàng</div>
            <h3 id="tgCollectTitle" class="tg-title">Đóng tiền cho khách</h3>
          </div>
          <button id="tgCloseCollectBtn" class="tg-sheet-close" type="button">×</button>
        </div>
        <div class="tg-collect-photo-grid">
          <div class="tg-collect-photo-card">
            <div class="tg-collect-photo-head"><span>Ảnh nhân viên tạo phiếu</span></div>
            <div id="tgCollectSourcePreview" class="tg-preview tg-collect-preview is-source-scroll" role="button" tabindex="0" aria-label="Kéo để xem ảnh phiếu, chạm để mở ảnh lớn"><span class="tg-muted">Chưa có ảnh phiếu</span></div>
          </div>
          <div class="tg-collect-photo-card">
            <div class="tg-collect-photo-head"><span>Bill quản lý đóng tiền</span></div>
            <div id="tgCollectBillPreview" class="tg-preview tg-collect-preview is-upload" role="button" tabindex="0" aria-label="Chạm để chụp hoặc chọn bill đóng tiền"><span class="tg-muted">Chạm để chụp hoặc chọn bill đóng tiền</span></div>
            <input id="tgCollectBillInput" type="file" accept="image/*" class="tg-hidden" />
          </div>
        </div>
        <div class="tg-collect-entry-row">
          <div class="tg-field tg-collect-amount-dock">
            <label style="display:none">Số tiền quản lý đã đóng</label>
            <input id="tgCollectAmountInput" class="tg-input" type="text" inputmode="numeric" placeholder="Số tiền quản lý đã đóng" />
          </div>
          <div class="tg-field tg-collect-note-dock">
            <label>Ghi chú</label>
            <input id="tgCollectNoteInput" class="tg-input" type="text" placeholder="Ghi chú" />
          </div>
        </div>
        <div class="tg-detail-card">
          <div class="tg-collect-compare">
            <div class="tg-collect-compare-grid">
              <div class="tg-collect-compare-item">
                <small>Số tiền đã thu khách</small>
                <strong id="tgCollectExpectedAmount">0đ</strong>
              </div>
              <div class="tg-collect-compare-item">
                <small>Quản lý đóng</small>
                <strong id="tgCollectEnteredAmount">0đ</strong>
              </div>
              <div class="tg-collect-compare-item">
                <small>Chênh lệch</small>
                <strong id="tgCollectDiffAmount">0đ</strong>
              </div>
            </div>
            <div id="tgCollectCompareStatus" class="tg-collect-compare-status"><i class="fa-solid fa-triangle-exclamation"></i> Chưa đủ điều kiện để lưu</div>
          </div>
          <div id="tgCollectWarning" class="tg-collect-warning"></div>
        </div>
        <div class="tg-collect-actions">
          <button id="tgSaveCollectBtn" class="btn btn-primary" type="button" disabled><i class="fa-solid fa-floppy-disk"></i> Lưu đã đóng</button>
        </div>
      </div>
    </div>

    <div id="tgCollectImageSheet" class="tg-sheet tg-image-sheet" aria-hidden="true">
      <div class="tg-image-sheet-panel">
        <div class="tg-sheet-head">
          <div>
            <div class="tg-eyebrow">Xem ảnh chi tiết</div>
            <h3 id="tgCollectImageTitle" class="tg-title">Ảnh phiếu</h3>
          </div>
          <button id="tgCloseCollectImageBtn" class="tg-sheet-close" type="button">×</button>
        </div>
        <div id="tgCollectImageViewer" class="tg-image-viewer"></div>
      </div>
    </div>

    <!-- LOCKED 2026-04-25: user-approved Thu góp create form shell. Change only on explicit request. -->
    <div id="tgCreateSheet" class="tg-sheet" aria-hidden="true">
      <div class="tg-sheet-panel tg-sheet-panel-create">
        <div class="tg-sheet-head">
          <div>
            <div class="tg-eyebrow">Phiếu mới local</div>
            <h3 class="tg-title">Tạo phiếu Thu góp</h3>
          </div>
          <button id="tgCloseCreateBtn" class="tg-sheet-close" type="button">×</button>
        </div>
        <div class="tg-create-grid">
          <input id="tgCreateReceiptInput" type="file" accept="image/*" capture="environment" class="tg-hidden" />
          <div class="tg-create-preview-card">
            <div id="tgCreateReceiptPreview" class="tg-preview tg-create-preview" role="button" tabindex="0" aria-label="Chạm để chụp ảnh phiếu">
              <video id="tgCreateLiveVideo" playsinline autoplay muted></video>
              <div class="tg-create-preview-overlay">
                <span id="tgCreateLiveBadge" class="tg-create-preview-badge">LIVE</span>
                <span class="tg-create-preview-tip">Chạm để chụp</span>
              </div>
              <span class="tg-muted">Đưa QR chứa MGD vào khung rồi chạm để chụp</span>
            </div>
            <div id="tgCreateLiveStatus" class="tg-create-live-status">Đang mở camera để tự điền thông tin...</div>
            <div class="tg-create-preview-meta" hidden>
              <div class="tg-field">
                <label>Thông tin phiếu</label>
                <input id="tgCreateReceiptInfo" class="tg-input" type="text" placeholder="Nhập thông tin từ phiếu khách" />
              </div>
              <button id="tgRetakeCreateReceiptBtn" class="tg-small-btn" type="button"><i class="fa-solid fa-camera"></i> Chụp ảnh</button>
            </div>
          </div>
          <div class="tg-create-row">
            <div class="tg-field">
              <label>Khách hàng</label>
              <input id="tgCreateCustomerName" class="tg-input" type="text" placeholder="Tên khách" />
            </div>
            <div class="tg-field">
              <label>Số điện thoại</label>
              <input id="tgCreateCustomerPhone" class="tg-input" type="tel" placeholder="Số điện thoại" />
            </div>
          </div>
          <div class="tg-create-row">
            <div class="tg-field">
              <label>Số hợp đồng</label>
              <input id="tgCreateContractNumber" class="tg-input" type="text" placeholder="Số hợp đồng" />
            </div>
            <div class="tg-field">
              <label>Số tiền</label>
              <input id="tgCreateDeposit" class="tg-input" type="text" inputmode="numeric" placeholder="0" />
            </div>
          </div>
          <div class="tg-field">
            <label>Ghi chú</label>
            <textarea id="tgCreateWorkNote" class="tg-textarea" placeholder="Ghi chú phiếu"></textarea>
          </div>
          <div id="tgCreateWarning" class="tg-muted" style="color:#fca5a5"></div>
        </div>
        <div class="tg-create-actions tg-detail-actions">
          <button id="tgSaveCreateBtn" class="btn btn-primary" type="button"><i class="fa-solid fa-file-circle-plus"></i> Tạo phiếu</button>
        </div>
      </div>
    </div>
    <div id="tgPrintPreviewSheet" class="tg-sheet" aria-hidden="true">
      <div class="tg-sheet-panel tg-print-preview-panel">
        <div class="tg-sheet-head">
          <div>
            <div class="tg-eyebrow">Xem trước in</div>
            <h3 class="tg-title">Phiếu Thu góp</h3>
          </div>
          <button id="tgClosePrintPreviewBtn" class="tg-sheet-close" type="button">×</button>
        </div>
        <div class="tg-print-preview-body">
          <div class="tg-print-preview-status">
            <span id="tgPrintPreviewCode">Đang tạo phiếu...</span>
            <strong id="tgPrintPreviewBridgeStatus">Đang gửi máy in...</strong>
          </div>
          <div id="tgPrintPreviewReceipt" class="tg-receipt-preview"></div>
          <div class="tg-print-preview-actions">
            <button id="tgClosePreviewActionBtn" class="btn btn-secondary" type="button"><i class="fa-solid fa-xmark"></i> Đóng</button>
            <button id="tgReprintBtn" class="btn btn-primary" type="button"><i class="fa-solid fa-print"></i> In lại</button>
          </div>
          <div id="tgPrintPreviewNote" class="tg-print-preview-note"></div>
        </div>
      </div>
    </div>
    <div id="tgPromptSheet" class="tg-sheet" aria-hidden="true">
      <div class="tg-sheet-panel tg-prompt-panel">
        <div class="tg-prompt-head">
          <div class="tg-prompt-title-wrap">
            <div id="tgPromptEyebrow" class="tg-eyebrow">Thông báo</div>
            <h3 id="tgPromptTitle" class="tg-title">Thu góp</h3>
          </div>
          <button id="tgClosePromptBtn" class="tg-sheet-close" type="button">×</button>
        </div>
        <div id="tgPromptMessage" class="tg-prompt-message"></div>
        <div class="tg-prompt-actions">
          <button id="tgPromptCancelBtn" class="btn btn-secondary" type="button">Huỷ</button>
          <button id="tgPromptConfirmBtn" class="btn btn-primary tg-prompt-confirm" type="button">OK</button>
        </div>
      </div>
    </div>
    <div id="tgCreateQrScannerHost"></div>
    <div id="tgReceiptRenderStage"></div>
  `;

  const VIEW_MODES = [
    { key: "bank", label: "Đóng", icon: "fa-money-bill-wave" },
    { key: "handover", label: "Giao", icon: "fa-hand-holding-dollar" },
  ];

  const FILTERS_BY_MODE = {
    bank: [
      { key: "unpaid", label: "Chờ đóng tiền", icon: "fa-clock" },
      { key: "paid", label: "Đã đóng tiền", icon: "fa-circle-check" },
    ],
    handover: [
      { key: "pending", label: "Chưa giao tiền", icon: "fa-clock" },
      { key: "done", label: "Đã giao tiền", icon: "fa-circle-check" },
    ],
  };

  const $ = (id) => document.getElementById(id);
  const TG_PORTAL_SHEET_IDS = [
    "tgFilterSheet",
    "tgDetailSheet",
    "tgCollectSheet",
    "tgCollectImageSheet",
    "tgCreateSheet",
    "tgPrintPreviewSheet",
    "tgPromptSheet",
  ];
  const CREATE_LIVE_SCAN_INTERVAL_MS = 120;
  const THUGOP_FAST_QR_VARIANT_LIMIT = 3;
  const DATE_RANGE_FILTERS = [
    { key: "today", label: "Hôm nay" },
    { key: "yesterday", label: "Hôm qua" },
    { key: "this-week", label: "Tuần này" },
    { key: "this-month", label: "Tháng này" },
    { key: "last-month", label: "Tháng trước" },
    { key: "this-year", label: "Năm nay" },
    { key: "last-year", label: "Năm trước" },
    { key: "all", label: "Toàn bộ" },
  ];
  const state = {
    tickets: [],
    logs: [],
    search: "",
    staffFilter: "",
    staffFilterOpen: false,
    dateRangeFilter: "today",
    dateRangeFilterOpen: false,
    handoverSelectMode: false,
    selectedHandoverIds: [],
    handoverApproveTokenOpen: false,
    handoverApproveTokenInput: "",
    handoverApproveTokenError: false,
    viewMode: "bank",
    activeFilter: "unpaid",
    detailId: "",
    collectId: "",
    collectReadOnly: false,
    collectBill: null,
    collectBillPreviewUrl: "",
    collectBillUploadSeq: 0,
    createReceipt: null,
    createReceiptPreviewUrl: "",
    createReservedCode: "",
    createReservedCodePromise: null,
    createReservedCodeSeq: 0,
    createQrText: "",
    printPreviewOrder: null,
    previewTicketId: "",
    actorName: "Nhân viên",
    actorRole: "staff",
    createViewportBaseHeight: 0,
    collectViewportBaseHeight: 0,
    createLiveStream: null,
    createLiveScanTimer: 0,
    createLiveDetector: null,
    createLiveHtml5Scanner: null,
    createLiveLastText: "",
    createLiveDetectedText: "",
    createLiveLookupSeq: 0,
    createSubmitting: false,
    printPreviewRenderSeq: 0,
    printPreviewReadyPromise: Promise.resolve(null),
  };
  let tgOpenSheetCount = 0;
  let tgLockedScreenEl = null;
  let tgLockedScreenOverflow = "";
  let tgLockedScreenOverscroll = "";
  let tgLockedScreenTouchAction = "";
  let tgPromptResolver = null;

  const formatMoney = (value = 0) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
  const digitsOnly = (value = "") => String(value || "").replace(/\D+/g, "");

  async function fetchCurrentActorApproveToken() {
    const data = await callInternalPosApi("/internal/pos/thugop/handover-token", {
      method: "GET",
    });
    const token = digitsOnly(data?.token || "").slice(0, 6);
    if (token.length !== 6) throw new Error("Không lấy được token xác nhận");
    return token;
  }

  async function verifyCurrentActorApproveToken(token = "") {
    return callInternalPosApi("/internal/pos/thugop/handover-token/verify", {
      method: "POST",
      body: { token: digitsOnly(token).slice(0, 6) },
    });
  }

  function resetHandoverApproveTokenState(options = {}) {
    const clearInput = options?.clearInput !== false;
    state.handoverApproveTokenOpen = false;
    if (clearInput) state.handoverApproveTokenInput = "";
    state.handoverApproveTokenError = false;
  }

  function normalizeCustomerDisplayName(value = "") {
    const compact = String(value || "").replace(/\s+/g, " ").trim();
    if (!compact) return "";
    return compact
      .toLocaleLowerCase("vi-VN")
      .replace(/(^|[\s.-]+)(\p{L})/gu, (match, prefix, char) => `${prefix}${char.toLocaleUpperCase("vi-VN")}`);
  }

  function formatContractNumberDisplay(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/[\-/.]/.test(raw)) return raw;
    const compact = raw.replace(/\s+/g, "");
    if (compact.length < 9) return compact;
    const groups = compact.match(/.{1,4}/g);
    return Array.isArray(groups) ? groups.join("-") : compact;
  }

  function getContractCardFontSize(value = "") {
    const length = String(value || "").trim().length;
    if (!length) return 10;
    const shrink = Math.max(0, length - 14) * 0.22;
    const size = Math.max(7.1, Math.min(10, 10 - shrink));
    return Number(size.toFixed(2));
  }

  function toMillis(value) {
    if (!value) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1e6);
    const t = Date.parse(String(value));
    return Number.isFinite(t) ? t : 0;
  }

  function fmtDateTime(value) {
    const ms = toMillis(value);
    if (!ms) return "";
    try {
      return new Intl.DateTimeFormat("vi-VN", {
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(ms));
    } catch (_) {
      return new Date(ms).toLocaleString("vi-VN");
    }
  }

  function fmtDateTimePrint(value) {
    const raw = value ? new Date(value) : new Date();
    const date = Number.isNaN(raw.getTime()) ? new Date() : raw;
    return date.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function escapeHtml(value = "") {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  function sanitizeUrl(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^data:image\//i.test(raw)) return raw;
    try {
      const parsed = new URL(raw, window.location.href);
      const protocol = String(parsed.protocol || "").toLowerCase();
      if (["http:", "https:", "blob:"].includes(protocol)) return parsed.href;
    } catch (_) {}
    return "";
  }

  function money(value = 0) {
    return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
  }

  function moneyReceipt(value = 0) {
    return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
  }

  function formatReceiptCode(value = "") {
    const raw = normalizeReceiptLookupCode(value);
    return raw ? `MGD:${raw}` : "MGD:--";
  }

  function encodeBase64UrlUtf8(value = "") {
    try {
      const bytes = new TextEncoder().encode(String(value || ""));
      let binary = "";
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    } catch (_) {
      return "";
    }
  }

  function encodeBase64UrlBytes(bytes) {
    try {
      const source = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
      let binary = "";
      source.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    } catch (_) {
      return "";
    }
  }

  function decodeBase64UrlUtf8(value = "") {
    try {
      const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (_) {
      return "";
    }
  }

  function decodeBase64UrlBytes(value = "") {
    try {
      const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
      const binary = atob(padded);
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    } catch (_) {
      return new Uint8Array();
    }
  }

  function packDigitString(value = "") {
    const digits = String(value || "").replace(/\D+/g, "");
    if (!digits) return new Uint8Array();
    const bytes = new Uint8Array(Math.ceil(digits.length / 2));
    for (let index = 0; index < digits.length; index += 2) {
      const high = Number(digits[index] || 0);
      const low = index + 1 < digits.length ? Number(digits[index + 1] || 0) : 15;
      bytes[Math.floor(index / 2)] = ((high & 15) << 4) | (low & 15);
    }
    return bytes;
  }

  function unpackDigitString(bytes, length = 0) {
    if (!(bytes instanceof Uint8Array) || !(length > 0)) return "";
    let output = "";
    for (let index = 0; index < bytes.length && output.length < length; index += 1) {
      const byte = bytes[index] || 0;
      const high = (byte >> 4) & 15;
      const low = byte & 15;
      if (high <= 9 && output.length < length) output += String(high);
      if (low <= 9 && output.length < length) output += String(low);
    }
    return output.slice(0, Math.max(0, Number(length) || 0));
  }

  function buildThuGopReceiptQrText(input = {}) {
    return buildThuGopReceiptScanPayload(input);
  }

  function buildThuGopReceiptBarcodeText(input = {}) {
    return buildThuGopReceiptScanPayload(input);
  }

  function buildThuGopReceiptScanPayload(input = {}) {
    const orderCode = normalizeReceiptLookupCode(input.orderCode || input.ticketId || input.code || "");
    if (/^[A-Z0-9._/-]{4,40}$/.test(orderCode)) return `MGD:${orderCode}`;
    return "";
  }

  function parseCompactReceiptPayload(text = "") {
    const raw = String(text || "").trim();
    if (!raw.startsWith("TG2:")) return null;
    const bytes = decodeBase64UrlBytes(raw.slice(4));
    if (!(bytes instanceof Uint8Array) || !bytes.length) return null;
    try {
      let offset = 0;
      const nameLength = bytes[offset] || 0; offset += 1;
      const nameBytes = bytes.slice(offset, offset + nameLength); offset += nameLength;
      const phoneLength = bytes[offset] || 0; offset += 1;
      const phoneBytesLength = Math.ceil(phoneLength / 2);
      const phoneBytes = bytes.slice(offset, offset + phoneBytesLength); offset += phoneBytesLength;
      const contractLength = bytes[offset] || 0; offset += 1;
      const contractBytesLength = Math.ceil(contractLength / 2);
      const contractBytes = bytes.slice(offset, offset + contractBytesLength); offset += contractBytesLength;
      const amountLength = bytes[offset] || 0; offset += 1;
      const amountBytesLength = Math.ceil(amountLength / 2);
      const amountBytes = bytes.slice(offset, offset + amountBytesLength);
      const customerName = new TextDecoder().decode(nameBytes).trim();
      const customerPhone = unpackDigitString(phoneBytes, phoneLength);
      const contractNumberText = unpackDigitString(contractBytes, contractLength);
      const deposit = Number(unpackDigitString(amountBytes, amountLength)) || 0;
      if (!(customerName || customerPhone || contractNumberText || deposit > 0)) return null;
      return {
        customerName,
        customerPhone,
        contractNumberText,
        deposit,
      };
    } catch (_) {
      return null;
    }
  }

  function decodeReceiptFieldValue(value = "") {
    const raw = String(value || "").replace(/\+/g, " ");
    try {
      return decodeURIComponent(raw).trim();
    } catch (_) {
      return raw.trim();
    }
  }

  function parseReceiptFieldPayload(text = "") {
    const raw = String(text || "").trim().replace(/^\?+/, "").replace(/\|/g, "&");
    if (!raw || !/(^|&)(n|p|h|a)=/i.test(raw)) return null;
    const data = {};
    raw.split("&").forEach((part) => {
      const chunk = String(part || "").trim();
      if (!chunk) return;
      const eqIndex = chunk.indexOf("=");
      const key = decodeReceiptFieldValue(eqIndex >= 0 ? chunk.slice(0, eqIndex) : chunk).toLowerCase();
      const value = decodeReceiptFieldValue(eqIndex >= 0 ? chunk.slice(eqIndex + 1) : "");
      if (!key) return;
      data[key] = value;
    });
    const customerName = String(data.n || data.name || "").trim();
    const customerPhone = String(data.p || data.phone || "").trim();
    const contractNumberText = String(data.h || data.contract || "").trim();
    const deposit = Number(String(data.a || data.amount || "").replace(/[^\d.-]/g, "")) || 0;
    if (!(customerName || customerPhone || contractNumberText || deposit > 0)) return null;
    return {
      customerName,
      customerPhone,
      contractNumberText,
      deposit,
    };
  }

  function normalizeLooseReceiptText(value = "") {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  }

  function parseReceiptTextLines(rawText = "") {
    return String(rawText || "")
      .split(/\r?\n+/)
      .map((line) => String(line || "").trim())
      .filter(Boolean);
  }

  function extractReceiptLookupCodeFromText(rawText = "") {
    const normalizedRaw = normalizeLooseReceiptText(rawText).toUpperCase();
    const directMatch = normalizedRaw.match(/M\s*G\s*D\s*[:\-]?\s*([A-Z0-9\s-]{3,24})/i);
    if (directMatch?.[1]) {
      const code = normalizeReceiptLookupCode(String(directMatch[1] || "").replace(/[^A-Z0-9\s-]/gi, ""));
      if (code) return code;
    }
    const lines = parseReceiptTextLines(rawText);
    for (let index = 0; index < lines.length; index += 1) {
      const normalizedLine = normalizeLooseReceiptText(lines[index]).toUpperCase();
      if (!/M\s*G\s*D/.test(normalizedLine)) continue;
      const inlineMatch = normalizedLine.match(/M\s*G\s*D\s*[:\-]?\s*([A-Z0-9\s-]{3,24})/i);
      if (inlineMatch?.[1]) {
        const inlineCode = normalizeReceiptLookupCode(String(inlineMatch[1] || "").replace(/[^A-Z0-9\s-]/gi, ""));
        if (inlineCode) return inlineCode;
      }
      const nextLine = normalizeReceiptLookupCode(lines[index + 1] || "");
      if (nextLine) return nextLine;
    }
    return "";
  }

  function extractReceiptLabelValue(lines = [], patterns = []) {
    for (let index = 0; index < lines.length; index += 1) {
      const line = String(lines[index] || "").trim();
      if (!line) continue;
      const normalized = normalizeLooseReceiptText(line).toLowerCase();
      for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match) continue;
        const trailing = String(match[1] || "").trim();
        if (trailing) return trailing;
        const nextLine = String(lines[index + 1] || "").trim();
        if (nextLine) return nextLine;
      }
    }
    return "";
  }

  function parseThuGopReceiptOcrText(rawText = "") {
    const lines = parseReceiptTextLines(rawText);
    if (!lines.length) return null;
    const orderCode = extractReceiptLookupCodeFromText(rawText);
    const customerName = extractReceiptLabelValue(lines, [/khach\s*hang\s*[:\-]?\s*(.*)$/i]);
    const customerPhone = extractReceiptLabelValue(lines, [/so\s*dien\s*thoai\s*[:\-]?\s*(.*)$/i]).replace(/[^\d+]/g, "");
    const contractNumberText = extractReceiptLabelValue(lines, [/so\s*hop\s*dong\s*[:\-]?\s*(.*)$/i]).replace(/[^\w\-./]/g, "");
    const amountText = extractReceiptLabelValue(lines, [/so\s*tien\s*khach\s*dua\s*[:\-]?\s*(.*)$/i]);
    const deposit = Number(String(amountText || "").replace(/[^\d.-]/g, "")) || 0;
    if (!(orderCode || customerName || customerPhone || contractNumberText || deposit > 0)) return null;
    return {
      orderCode,
      customerName,
      customerPhone,
      contractNumberText,
      deposit,
    };
  }

  function isReliableReceiptData(data = {}) {
    const customerName = String(data?.customerName || "").trim();
    const customerPhone = String(data?.customerPhone || "").replace(/\D+/g, "");
    const contractNumberText = String(data?.contractNumberText || "").trim();
    const deposit = Number(data?.deposit || 0) || 0;
    const nameOk = /^[\p{L}][\p{L}\s.'-]{1,48}$/u.test(customerName);
    const phoneOk = /^\d{8,12}$/.test(customerPhone);
    const contractOk = /^[A-Za-z0-9./-]{6,30}$/.test(contractNumberText);
    const amountOk = deposit > 0;
    return nameOk && phoneOk && contractOk && amountOk;
  }

  function normalizeReceiptLookupCode(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const compact = raw.replace(/^MGD:\s*/i, "").replace(/^THKD-TG:?/i, "").trim();
    return compact.replace(/\s+/g, "").toUpperCase();
  }

  function parseThuGopReceiptScanText(text = "") {
    const raw = String(text || "").trim();
    if (!raw) return null;
    const compactPayload = parseCompactReceiptPayload(raw);
    if (compactPayload) return compactPayload;
    if (raw.startsWith(THUGOP_RECEIPT_QR_PREFIX)) {
      const decoded = decodeBase64UrlUtf8(raw.slice(THUGOP_RECEIPT_QR_PREFIX.length));
      if (!decoded) return null;
      try {
        const payload = JSON.parse(decoded);
        return {
          orderCode: normalizeReceiptLookupCode(payload?.c || ""),
          customerName: String(payload?.n || "").trim(),
          customerPhone: String(payload?.p || "").trim(),
          contractNumberText: String(payload?.h || "").trim(),
          deposit: Number(payload?.a || 0) || 0,
        };
      } catch (_) {
        return parseReceiptFieldPayload(decoded);
      }
    }
    const directFields = parseReceiptFieldPayload(raw);
    if (directFields) return directFields;
    const code = normalizeReceiptLookupCode(raw);
    return code ? { orderCode: code } : null;
  }

  function findTicketByReceiptCode(value = "") {
    const code = normalizeReceiptLookupCode(value);
    if (!code) return null;
    return state.tickets.find((ticket) => {
      const ticketCode = normalizeReceiptLookupCode(ticket?.code || ticket?.orderCode || ticket?.id || "");
      return ticketCode && ticketCode === code;
    }) || null;
  }

  function setCreateInputValue(inputId, value) {
    const input = $(inputId);
    if (!input) return;
    const nextValue = String(value ?? "");
    if (input.value === nextValue) return;
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function applyCreateScanData(data = {}) {
    const nextName = normalizeCustomerDisplayName(data?.customerName || "");
    const nextPhone = String(data?.customerPhone || "").trim();
    const nextContract = String(data?.contractNumberText || "").trim();
    const nextDeposit = Number(data?.deposit || 0) || 0;
    if (nextName) setCreateInputValue("tgCreateCustomerName", nextName);
    if (nextPhone) setCreateInputValue("tgCreateCustomerPhone", nextPhone);
    if (nextContract) setCreateInputValue("tgCreateContractNumber", nextContract);
    if (nextDeposit > 0) setCreateInputValue("tgCreateDeposit", Number(nextDeposit).toLocaleString("vi-VN"));
  }

  function hasCreateAutofillReady() {
    const customerName = String($("tgCreateCustomerName").value || "").trim();
    const customerPhone = String($("tgCreateCustomerPhone").value || "").trim();
    const contractNumberText = String($("tgCreateContractNumber").value || "").trim();
    const deposit = Number(digitsOnly($("tgCreateDeposit").value || "")) || 0;
    return Boolean(state.createReceipt?.file && customerName && customerPhone && contractNumberText && deposit > 0);
  }

  function ensureReceiptCodeScripts() {
    if (thugopReceiptCodeLibsPromise) return thugopReceiptCodeLibsPromise;
    const ensureScript = (src, readyCheck) => new Promise((resolve, reject) => {
      if (readyCheck()) {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[data-thugop-lib="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Load failed: ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.thugopLib = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Load failed: ${src}`));
      document.head.appendChild(script);
    });
    thugopReceiptCodeLibsPromise = Promise.all([
      ensureScript("https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js", () => typeof window.qrcode === "function"),
      ensureScript("https://cdn.jsdelivr.net/npm/jsbarcode@3.12.1/dist/JsBarcode.all.min.js", () => typeof window.JsBarcode === "function"),
    ]).catch((error) => {
      thugopReceiptCodeLibsPromise = null;
      throw error;
    });
    return thugopReceiptCodeLibsPromise;
  }

  function ensureReceiptImageScript() {
    if (thugopReceiptImageLibPromise) return thugopReceiptImageLibPromise;
    const src = "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js";
    thugopReceiptImageLibPromise = new Promise((resolve, reject) => {
      if (window.htmlToImage?.toJpeg) {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[data-thugop-lib="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Load failed: ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.thugopLib = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Load failed: ${src}`));
      document.head.appendChild(script);
    }).catch((error) => {
      thugopReceiptImageLibPromise = null;
      throw error;
    });
    return thugopReceiptImageLibPromise;
  }

  function ensureHtml5QrcodeScript() {
    if (thugopHtml5QrcodeLibPromise) return thugopHtml5QrcodeLibPromise;
    const src = "https://unpkg.com/html5-qrcode@2.3.8/minified/html5-qrcode.min.js";
    thugopHtml5QrcodeLibPromise = new Promise((resolve, reject) => {
      if (typeof window.Html5Qrcode === "function") {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[data-thugop-lib="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Load failed: ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.thugopLib = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Load failed: ${src}`));
      document.head.appendChild(script);
    }).catch((error) => {
      thugopHtml5QrcodeLibPromise = null;
      throw error;
    });
    return thugopHtml5QrcodeLibPromise;
  }

  function ensureOcrScript() {
    if (typeof window.TextDetector === "function") return Promise.resolve();
    if (thugopOcrLibPromise) return thugopOcrLibPromise;
    const src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    thugopOcrLibPromise = new Promise((resolve, reject) => {
      if (window.Tesseract?.recognize) {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[data-thugop-lib="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Load failed: ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.thugopLib = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Load failed: ${src}`));
      document.head.appendChild(script);
    }).catch((error) => {
      thugopOcrLibPromise = null;
      throw error;
    });
    return thugopOcrLibPromise;
  }

  function ensureJsQrScript() {
    if (thugopJsQrLibPromise) return thugopJsQrLibPromise;
    const src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
    thugopJsQrLibPromise = new Promise((resolve, reject) => {
      if (typeof window.jsQR === "function") {
        resolve();
        return;
      }
      const existing = document.querySelector(`script[data-thugop-lib="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Load failed: ${src}`)), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.thugopLib = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Load failed: ${src}`));
      document.head.appendChild(script);
    }).catch((error) => {
      thugopJsQrLibPromise = null;
      throw error;
    });
    return thugopJsQrLibPromise;
  }

  async function renderReceiptCodes(container, order = {}) {
    if (!container) return;
    const qrHost = container.querySelector("[data-receipt-qr]");
    const barcodeHost = container.querySelector("[data-receipt-barcode]");
    const qrText = String(order?.qrText || "").trim();
    const barcodeText = String(order?.barcodeText || "").trim();
    if (!qrHost && !barcodeHost) return;
    try {
      await ensureReceiptCodeScripts();
      if (qrHost && qrText && typeof window.qrcode === "function") {
        const qr = window.qrcode(0, "L");
        qr.addData(qrText);
        qr.make();
        qrHost.innerHTML = qr.createSvgTag(4, 0);
      }
      if (barcodeHost && barcodeText && typeof window.JsBarcode === "function") {
        window.JsBarcode(barcodeHost, barcodeText, {
          format: "CODE128",
          displayValue: false,
          margin: 0,
          height: 40,
          width: 1.5,
        });
      }
    } catch (_) {
      if (qrHost) qrHost.textContent = qrText || "";
      if (barcodeHost) barcodeHost.textContent = barcodeText || "";
    }
  }

  async function waitForReceiptAssets(container) {
    const images = Array.from(container?.querySelectorAll("img") || []).filter((img) => !img.complete);
    if (!images.length) return;
    await Promise.all(images.map((img) => new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    })));
  }

  async function generateReceiptImageDataUrl(order = {}) {
    const stage = $("tgReceiptRenderStage");
    if (!stage) return "";
    await ensureReceiptCodeScripts();
    await ensureReceiptImageScript();
    if (!window.htmlToImage?.toJpeg) return "";

    const receiptNode = document.createElement("div");
    receiptNode.className = "tg-receipt-preview";
    receiptNode.innerHTML = buildThuGopReceiptHtml(order);
    stage.replaceChildren(receiptNode);
    await renderReceiptCodes(receiptNode, order);
    await waitForReceiptAssets(receiptNode);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const renderJpeg = (quality, pixelRatio) => window.htmlToImage.toJpeg(receiptNode, {
      quality,
      pixelRatio,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });

    try {
      let dataUrl = await renderJpeg(0.92, 2);
      if (String(dataUrl || "").length > 850000) dataUrl = await renderJpeg(0.82, 1.7);
      if (String(dataUrl || "").length > 850000) dataUrl = await renderJpeg(0.72, 1.45);
      return String(dataUrl || "");
    } catch (_) {
      return "";
    } finally {
      stage.replaceChildren();
    }
  }

  async function ensureReceiptImagePayload(order = {}) {
    if (String(order?.receiptImageDataUrl || "").trim()) return order;
    const receiptImageDataUrl = await generateReceiptImageDataUrl(order);
    if (!receiptImageDataUrl) return order;
    return {
      ...order,
      receiptImageDataUrl,
    };
  }

  function buildThuGopPrintOrder(input = {}) {
    const totalAmount = Number(input.totalAmount || input.deposit || 0);
    const paidAmount = Math.max(Number(input.paidAmount || 0), 0);
    const debtAmount = Math.max(Number(input.debtAmount ?? (totalAmount - paidAmount)), 0);
    const printCountDisplay = Math.max(1, Number(input.printCountDisplay || input.printedCount || input.printCount || 1) || 1);
    const printActorName = String(input.printActorName || input.printedByName || input.reprintActorName || input.actorName || state.actorName || "Nhân viên").trim() || "Nhân viên";
    const subBits = [
      input.contractNumberText ? `HĐ: ${input.contractNumberText}` : "",
      input.customerPhone ? `SĐT: ${input.customerPhone}` : "",
      input.ticketId ? `Mã: ${input.ticketId}` : "",
    ].filter(Boolean);
    return {
      storeName: "TRUNG HẬU KIM DUNG",
      storeLine1: "BIÊN NHẬN THU HỘ TIỀN GÓP",
      storeLine2: "146 D10 Mỹ Phước 1, Bến Cát, BD - 1900 0365",
      orderId: input.ticketId || "",
      orderCode: input.orderCode || input.ticketId || `TG-${Date.now().toString().slice(-6)}`,
      createdAt: input.createdAt || new Date().toISOString(),
      printedAt: input.printedAt || input.createdAt || new Date().toISOString(),
      printCountDisplay,
      printActorName,
      customerName: input.customerName || "Khách lẻ",
      customerPhone: input.customerPhone || "",
      contractNumberText: input.contractNumberText || "",
      actorName: input.actorName || state.actorName,
      paymentMethod: input.paymentMethod || "Thu hộ tiền mặt",
      paidAmount,
      debtAmount,
      totalAmount,
      note: input.note || "",
      qrText: input.qrText || buildThuGopReceiptQrText({
        orderCode: input.orderCode || input.ticketId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        contractNumberText: input.contractNumberText,
        totalAmount,
        deposit: totalAmount,
      }),
      barcodeText: input.barcodeText || buildThuGopReceiptBarcodeText({
        orderCode: input.orderCode || input.ticketId,
      }),
      receiptImageDataUrl: input.receiptImageDataUrl || "",
      items: [
        {
          productName: "Phiếu Thu góp",
          quantity: 1,
          price: totalAmount,
          subtotal: totalAmount,
          subText: subBits.join(" • "),
        },
      ],
    };
  }

  function buildThuGopReceiptHtml(order = {}) {
    const printedAtText = fmtDateTimePrint(order.printedAt || order.createdAt);
    const printCountDisplay = Math.max(1, Number(order.printCountDisplay || 1) || 1);
    const printActorName = String(order.printActorName || order.actorName || state.actorName || "Nhân viên").trim() || "Nhân viên";
    return `
      <div class="tg-receipt-head">
        <div class="tg-receipt-store">
          <img class="tg-receipt-logo" src="${escapeHtml(THUGOP_RECEIPT_LOGO_URL)}" alt="THKD" />
          <div class="tg-receipt-store-copy">
            <div class="tg-receipt-brand">${escapeHtml(order.storeName || "TRUNG HẬU KIM DUNG")}</div>
            <div class="tg-receipt-address">${escapeHtml(order.storeLine2 || "")}</div>
          </div>
        </div>
        <div class="tg-receipt-title-block">
          <div class="tg-receipt-title">${escapeHtml(order.storeLine1 || "BIÊN NHẬN THU HỘ TRẢ GÓP")}</div>
          <div class="tg-receipt-code-main">${escapeHtml(formatReceiptCode(order.orderCode || ""))}</div>
          <div class="tg-receipt-code-subtime">Thời gian tạo: ${escapeHtml(fmtDateTimePrint(order.createdAt))}</div>
        </div>
      </div>
      <div class="tg-receipt-main">
        <div class="tg-receipt-codes">
          ${order.qrText ? `<div class="tg-receipt-qr-box" data-receipt-qr></div>` : ""}
          <div class="tg-receipt-code-hint">Quét QR</div>
        </div>
        <div class="tg-receipt-main-info">
          <div class="tg-receipt-key-row"><span>Nhân viên</span><strong>${escapeHtml(order.actorName || state.actorName || "--")}</strong></div>
          <div class="tg-receipt-key-row"><span>Khách hàng</span><strong>${escapeHtml(order.customerName || "Khách hàng")}</strong></div>
          <div class="tg-receipt-key-row"><span>Số điện thoại</span><strong>${escapeHtml(order.customerPhone || "--")}</strong></div>
          <div class="tg-receipt-key-row"><span>Số hợp đồng</span><strong>${escapeHtml(order.contractNumberText || "--")}</strong></div>
          <div class="tg-receipt-key-row money"><span>Tiền khách đưa</span><strong>${escapeHtml(moneyReceipt(order.paidAmount || order.totalAmount || 0))}</strong></div>
        </div>
        <div class="tg-receipt-note-block">
          <div class="tg-receipt-note-line">
            <span class="tg-receipt-note-label">Ghi chú</span>
            <span class="tg-receipt-note-value">${escapeHtml(order.note || "—")}</span>
          </div>
        </div>
        ${order.barcodeText ? `
          <div class="tg-receipt-barcode-row">
            <div class="tg-receipt-barcode-box"><svg data-receipt-barcode></svg></div>
            <div class="tg-receipt-code-hint">Quét mã vạch</div>
          </div>
        ` : ""}
      </div>
      <div class="tg-receipt-tail">
        Cảm ơn Quý khách đã sử dụng dịch vụ<br/>
        Vui lòng kiểm tra thông tin trước khi rời quầy
        <div class="tg-receipt-tail-meta">In lúc: ${escapeHtml(printedAtText)} • Lần in: ${escapeHtml(String(printCountDisplay))} • NV in: ${escapeHtml(printActorName)}</div>
      </div>
    `;
  }

  async function reserveThuGopPrintMeta(order = {}) {
    const sourceCode = String(order?.orderCode || order?.orderId || "").trim();
    const fallbackCount = Math.max(1, Number(order?.printCountDisplay || 0) + 1 || 1);
    const fallbackActorName = String(state.actorName || order?.printActorName || order?.actorName || "Nhân viên").trim() || "Nhân viên";
    const fallback = {
      printedAt: new Date().toISOString(),
      printCountDisplay: fallbackCount,
      printActorName: fallbackActorName,
    };
    if (!sourceCode) return fallback;
    try {
      const data = await callPrintApi("/internal/pos/print/jobs/reserve", {
        method: "POST",
        body: {
          type: "thugop_receipt",
          sourceId: order?.orderId || "",
          sourceCode,
        },
      });
      return {
        printedAt: data?.printedAt || fallback.printedAt,
        printCountDisplay: Math.max(1, Number(data?.printCountDisplay || fallback.printCountDisplay) || fallback.printCountDisplay),
        printActorName: String(data?.printActorName || fallback.printActorName).trim() || fallback.printActorName,
      };
    } catch (_) {
      return fallback;
    }
  }

  function applyThuGopPrintMeta(order = {}, meta = {}) {
    return {
      ...order,
      printedAt: meta?.printedAt || order?.printedAt || new Date().toISOString(),
      printCountDisplay: Math.max(1, Number(meta?.printCountDisplay || order?.printCountDisplay || 1) || 1),
      printActorName: String(meta?.printActorName || order?.printActorName || state.actorName || order?.actorName || "Nhân viên").trim() || "Nhân viên",
      receiptImageDataUrl: "",
    };
  }

  function renderPrintPreviewSheet(order = {}, bridgeText = "", note = "") {
    state.printPreviewOrder = order;
    const renderSeq = state.printPreviewRenderSeq + 1;
    state.printPreviewRenderSeq = renderSeq;
    const noteEl = $("tgPrintPreviewNote");
    const receiptEl = $("tgPrintPreviewReceipt");
    const safeNote = String(note || "").trim();
    $("tgPrintPreviewCode").textContent = order.orderCode || "Phiếu Thu góp";
    $("tgPrintPreviewBridgeStatus").textContent = bridgeText || "Đang gửi máy in...";
    receiptEl.innerHTML = buildThuGopReceiptHtml(order);
    noteEl.textContent = safeNote;
    noteEl.style.display = safeNote ? "" : "none";
    state.printPreviewReadyPromise = (async () => {
      try {
        await renderReceiptCodes(receiptEl, order);
        const enrichedOrder = await ensureReceiptImagePayload(order);
        if (renderSeq !== state.printPreviewRenderSeq) return enrichedOrder || order;
        if (enrichedOrder?.receiptImageDataUrl) {
          state.printPreviewOrder = enrichedOrder;
          return enrichedOrder;
        }
      } catch (_) {}
      return order;
    })();
    return state.printPreviewReadyPromise;
  }

  async function callInternalPosApi(path = "", options = {}) {
    const sessionToken = String(localStorage.getItem(THUGOP_POS_SESSION_TOKEN_STORAGE_KEY) || "").trim();
    const internalKey = String(localStorage.getItem(THUGOP_LEGACY_INTERNAL_KEY_STORAGE_KEY) || "").trim();
    if (!sessionToken && !internalKey) throw new Error("Thiếu đăng nhập nội bộ");
    const response = await fetch(THUGOP_PRINT_API_BASE + path, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { "x-pos-session-token": sessionToken } : {}),
        ...(!sessionToken && internalKey ? { "x-internal-admin-key": internalKey } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = text;
    }
    if (!response.ok) {
      throw new Error(typeof data === "string" ? data : (data?.error || `HTTP ${response.status}`));
    }
    return data;
  }

  async function callPrintApi(path = "", options = {}) {
    return callInternalPosApi(path, options);
  }

  function normalizeReservedCreateCode(value = "") {
    return String(value || "").trim().replace(/\D+/g, "");
  }

  function resetReservedCreateCode() {
    state.createReservedCodeSeq += 1;
    state.createReservedCode = "";
    state.createReservedCodePromise = null;
  }

  async function reserveThuGopCreateCode(force = false) {
    if (!force && state.createReservedCode) return state.createReservedCode;
    if (!force && state.createReservedCodePromise) return state.createReservedCodePromise;
    const requestSeq = state.createReservedCodeSeq + 1;
    state.createReservedCodeSeq = requestSeq;
    state.createReservedCodePromise = (async () => {
      const data = await callInternalPosApi("/internal/pos/thugop/reserve-code", {
        method: "POST",
        body: {},
      });
      const code = normalizeReservedCreateCode(data?.code || "");
      if (!code) throw new Error("Không lấy được mã Thu góp mới");
      if (requestSeq === state.createReservedCodeSeq) {
        state.createReservedCode = code;
      }
      return code;
    })();
    try {
      return await state.createReservedCodePromise;
    } finally {
      if (requestSeq === state.createReservedCodeSeq) {
        state.createReservedCodePromise = null;
      }
    }
  }

  function prefetchThuGopCreateCode() {
    reserveThuGopCreateCode().catch(() => {});
  }

  async function queueThuGopPrintJob(order = {}) {
    const payload = await ensureReceiptImagePayload(order);
    return callPrintApi("/internal/pos/print/jobs", {
      method: "POST",
      body: {
        type: "thugop_receipt",
        sourceId: payload.orderId || "",
        sourceCode: payload.orderCode || "",
        bridgeTarget: "android-lan-80mm",
        payload,
      },
    });
  }

  async function reprintCurrentPreview() {
    const order = state.printPreviewOrder;
    if (!order?.items?.length) return;
    const printMeta = await reserveThuGopPrintMeta(order);
    const orderForPrint = applyThuGopPrintMeta(order, printMeta);
    const readyOrder = await renderPrintPreviewSheet(orderForPrint, "Đang gửi máy in...", "App đang dựng bản in chuẩn rồi gửi lại qua Android bridge.");
    try {
      const printResult = await queueThuGopPrintJob(readyOrder || orderForPrint);
      renderPrintPreviewSheet(readyOrder || orderForPrint, `Đã gửi ${printResult?.sourceCode || order.orderCode}`, "");
    } catch (error) {
      renderPrintPreviewSheet(readyOrder || orderForPrint, "Gửi lệnh in lỗi", error?.message || String(error || "Lỗi in"));
    }
  }

  function parseExpectedAmount(ticket = {}) {
    const amount = Number(ticket?.deposit || ticket?.estimateCost || ticket?.price || 0);
    return amount > 0 ? amount : 0;
  }

  function parseBankPaidAmount(ticket = {}) {
    let amount = Number(digitsOnly(ticket?.bankPaidAmount ?? ticket?.paymentCloseAmount ?? "")) || 0;
    if (!(amount > 0) && String(ticket?.bankPaidAt || ticket?.paymentCloseAt || ticket?.paymentCloseBillUrl || "").trim()) {
      amount = parseExpectedAmount(ticket);
    }
    return amount > 0 ? amount : 0;
  }

  function parseHandoverAmount(ticket = {}) {
    let amount = Number(digitsOnly(ticket?.cashHandoverAmount ?? "")) || 0;
    if (!(amount > 0)) amount = parseExpectedAmount(ticket);
    return amount > 0 ? amount : 0;
  }

  function resolveTicketOwnerName(ticket = {}) {
    return String(
      ticket?.cashHandoverByName ||
      ticket?.creatorName ||
      ticket?.createdByName ||
      ticket?.staffName ||
      ticket?.techName ||
      ticket?.paymentCloseByName ||
      ticket?.paymentCloseBy ||
      ""
    ).trim() || "Nhân viên";
  }

  function resolveCollectedStaffName(ticket = {}) {
    return String(
      ticket?.paymentCloseByName ||
      ticket?.paymentCloseBy ||
      ticket?.handoverToName ||
      ticket?.techName ||
      ticket?.lastStatusByName ||
      ticket?.creatorName ||
      ticket?.createdByName ||
      ticket?.staffName ||
      ""
    ).trim() || "Nhân viên";
  }

  function isActiveTicket(ticket = {}) {
    return String(ticket?.status || "") !== "delivered" && ticket?.active !== false;
  }

  function hasCollectedProof(ticket = {}) {
    return Boolean(
      String(ticket?.paymentCloseBillUrl || "").trim() ||
      ticket?.paymentCloseAt ||
      (Number(digitsOnly(ticket?.paymentCloseAmount ?? "")) || 0) > 0 ||
      (Number(digitsOnly(ticket?.paymentAmount ?? ticket?.paidAmount ?? "")) || 0) > 0
    );
  }

  function isBankPaid(ticket = {}) {
    return Boolean(
      String(ticket?.bankPaidState || "").trim() === "done" ||
      ticket?.bankPaidAt ||
      ticket?.paymentCloseAt ||
      String(ticket?.paymentCloseBillUrl || "").trim()
    );
  }

  function isDoneCashTicket(ticket = {}) {
    return String(ticket?.cashHandoverState || "").trim() === THUGOP_CASH_HANDOVER_STATE.DONE || Boolean(ticket?.cashHandoverAt);
  }

  function isPendingCashTicket(ticket = {}) {
    return isActiveTicket(ticket) && !isDoneCashTicket(ticket);
  }

  function getTicketBankStage(ticket = {}) {
    return isBankPaid(ticket) ? "paid" : "unpaid";
  }

  function getTicketHandoverStage(ticket = {}) {
    return isDoneCashTicket(ticket) ? "done" : "pending";
  }

  function buildTicketSearchBlob(ticket = {}) {
    return [
      ticket?.code,
      ticket?.customerName,
      ticket?.customerPhone,
      ticket?.contractNumberText,
      resolveCollectedStaffName(ticket),
      ticket?.paymentCloseByName,
      ticket?.paymentCloseBy,
      getTicketBankStage(ticket),
      getTicketHandoverStage(ticket),
    ].map((x) => String(x || "").trim().toLowerCase()).join(" ");
  }

  function buildLogSearchBlob(log = {}) {
    return [
      log?.batchId,
      log?.giverName,
      ...(Array.isArray(log?.giverNames) ? log.giverNames : []),
      log?.receiverName,
      ...(Array.isArray(log?.tickets) ? log.tickets.map((item) => [item?.ticketCode, item?.customerName].join(" ")) : []),
    ].map((x) => String(x || "").trim().toLowerCase()).join(" ");
  }

  function getTicketById(ticketId = "") {
    const id = String(ticketId || "").trim();
    return state.tickets.find((ticket) => String(ticket?.id || "").trim() === id) || null;
  }

  function getActiveFilters() {
    return FILTERS_BY_MODE[state.viewMode] || FILTERS_BY_MODE.bank;
  }

  function normalizeStaffFilterValue(value = "") {
    return String(value || "").trim().toLocaleLowerCase("vi-VN");
  }

  function resolveFilterStaffName(ticket = {}) {
    return state.viewMode === "handover"
      ? resolveTicketOwnerName(ticket)
      : resolveCollectedStaffName(ticket);
  }

  function getStaffFilterOptions() {
    const unique = new Map();
    state.tickets.forEach((ticket) => {
      const name = String(resolveFilterStaffName(ticket) || "").trim();
      const key = normalizeStaffFilterValue(name);
      if (!key || unique.has(key)) return;
      unique.set(key, name);
    });
    return Array.from(unique.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "vi-VN"))
      .map(([key, label]) => ({ key, label }));
  }

  function ensureStaffFilter() {
    const options = getStaffFilterOptions();
    if (state.staffFilter && !options.some((item) => item.key === state.staffFilter)) {
      state.staffFilter = "";
    }
    return options;
  }

  function getHeaderStaffFilterOptions() {
    const unique = new Map();
    state.tickets.forEach((ticket) => {
      [resolveTicketOwnerName(ticket), resolveCollectedStaffName(ticket)].forEach((name) => {
        const label = String(name || "").trim();
        const key = normalizeStaffFilterValue(label);
        if (!key || unique.has(key)) return;
        unique.set(key, label);
      });
    });
    return Array.from(unique.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "vi-VN"))
      .map(([key, label]) => ({ key, label }));
  }

  function matchesTicketStaffFilter(ticket = {}) {
    if (!state.staffFilter) return true;
    return normalizeStaffFilterValue(resolveFilterStaffName(ticket)) === state.staffFilter;
  }

  function getThuGopHeaderSummary() {
    const managerView = canCurrentActorCloseBankPayment();
    const headerOptions = getHeaderStaffFilterOptions();
    const selected = headerOptions.find((item) => item.key === state.staffFilter) || null;
    const subjectLabel = managerView
      ? (selected?.label || "Tất cả nhân viên")
      : (String(state.actorName || "Nhân viên").trim() || "Nhân viên");
    const subjectKey = managerView ? state.staffFilter : normalizeStaffFilterValue(subjectLabel);
    const activeTickets = state.tickets.filter(isActiveTicket);
    const handoverTickets = activeTickets.filter((ticket) => {
      if (getTicketHandoverStage(ticket) !== "pending") return false;
      if (!subjectKey) return true;
      return normalizeStaffFilterValue(resolveTicketOwnerName(ticket)) === subjectKey;
    });
    const unpaidTickets = activeTickets.filter((ticket) => {
      if (getTicketBankStage(ticket) !== "unpaid") return false;
      if (!subjectKey) return true;
      return normalizeStaffFilterValue(resolveCollectedStaffName(ticket)) === subjectKey;
    });
    return {
      canFilterStaff: managerView,
      selectedStaffKey: state.staffFilter,
      selectedStaffLabel: subjectLabel,
      handoverLabel: managerView ? (state.staffFilter ? "Cần thu quản lý" : "Cần thu của tất cả nhân viên") : "Cần giao quản lý",
      handoverAmount: handoverTickets.reduce((sum, ticket) => sum + parseHandoverAmount(ticket), 0),
      handoverCount: handoverTickets.length,
      unpaidLabel: "Đã nhận chưa đóng",
      unpaidAmount: unpaidTickets.reduce((sum, ticket) => sum + parseExpectedAmount(ticket), 0),
      unpaidCount: unpaidTickets.length,
      filterOptions: managerView ? [{ key: "", label: "Tất cả nhân viên" }, ...headerOptions] : [],
    };
  }

  function publishThuGopHeaderSummary() {
    const detail = getThuGopHeaderSummary();
    window.__THKD_THUGOP_HEADER_SUMMARY__ = detail;
    try {
      window.dispatchEvent(new CustomEvent("thkd:thugop-header-summary", { detail }));
    } catch (_) {}
  }

  function applyThuGopHeaderStaffFilter(value = "") {
    state.staffFilter = normalizeStaffFilterValue(value);
    state.staffFilterOpen = false;
    render();
  }

  function ensureActiveFilter() {
    const filters = getActiveFilters();
    if (!filters.some((item) => item.key === state.activeFilter)) {
      state.activeFilter = filters[0]?.key || "unpaid";
    }
  }

  function getFilterLabel(key = state.activeFilter) {
    ensureActiveFilter();
    return getActiveFilters().find((item) => item.key === key)?.label || "Chưa đóng";
  }

  function shouldShowDateRangeFilter() {
    return (state.viewMode === "bank" && state.activeFilter === "paid")
      || (state.viewMode === "handover" && state.activeFilter === "done");
  }

  function startOfLocalDay(date = new Date()) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function getDateRangeBounds(key = state.dateRangeFilter) {
    const today = startOfLocalDay(new Date());
    if (key === "today") {
      return { start: today.getTime(), end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() };
    }
    if (key === "yesterday") {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
      return { start: start.getTime(), end: today.getTime() };
    }
    if (key === "this-week") {
      const start = new Date(today);
      const weekday = start.getDay();
      const diffToMonday = (weekday + 6) % 7;
      start.setDate(start.getDate() - diffToMonday);
      return { start: start.getTime(), end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() };
    }
    if (key === "this-month") {
      return { start: new Date(today.getFullYear(), today.getMonth(), 1).getTime(), end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() };
    }
    if (key === "last-month") {
      return {
        start: new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime(),
        end: new Date(today.getFullYear(), today.getMonth(), 1).getTime(),
      };
    }
    if (key === "this-year") {
      return { start: new Date(today.getFullYear(), 0, 1).getTime(), end: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).getTime() };
    }
    if (key === "last-year") {
      return { start: new Date(today.getFullYear() - 1, 0, 1).getTime(), end: new Date(today.getFullYear(), 0, 1).getTime() };
    }
    return null;
  }

  function getTicketDateRangeMillis(ticket = {}) {
    if (state.viewMode === "handover" && state.activeFilter === "done") {
      return toMillis(ticket?.cashHandoverAt || ticket?.updatedAt || ticket?.paymentCloseAt || ticket?.sortAt || ticket?.createdAt);
    }
    return toMillis(ticket?.paymentCloseAt || ticket?.bankPaidAt || ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt);
  }

  function matchesActiveDateRange(ticket = {}) {
    if (!shouldShowDateRangeFilter()) return true;
    const bounds = getDateRangeBounds();
    if (!bounds) return true;
    const time = getTicketDateRangeMillis(ticket);
    if (!Number.isFinite(time)) return false;
    return time >= bounds.start && time < bounds.end;
  }

  function getVisibleTickets() {
    ensureActiveFilter();
    ensureStaffFilter();
    const term = state.search.trim().toLowerCase();
    let source = state.tickets.filter(isActiveTicket).filter(matchesTicketStaffFilter);
    if (state.viewMode === "bank") {
      source = source.filter((ticket) => getTicketBankStage(ticket) === state.activeFilter);
    } else if (state.activeFilter !== "logs") {
      source = source.filter((ticket) => getTicketHandoverStage(ticket) === state.activeFilter);
    }
    source = source.filter(matchesActiveDateRange);
    if (term) source = source.filter((ticket) => buildTicketSearchBlob(ticket).includes(term));
    return source.sort((a, b) =>
      toMillis(b?.cashHandoverAt || b?.paymentCloseAt || b?.updatedAt || b?.sortAt || b?.createdAt) -
      toMillis(a?.cashHandoverAt || a?.paymentCloseAt || a?.updatedAt || a?.sortAt || a?.createdAt)
    );
  }

  function getVisibleLogs() {
    ensureStaffFilter();
    const term = state.search.trim().toLowerCase();
    let source = state.logs.slice();
    if (state.staffFilter) {
      source = source.filter((log) => {
        const names = [
          log?.giverName,
          ...(Array.isArray(log?.giverNames) ? log.giverNames : []),
          log?.receiverName,
        ];
        return names.some((name) => normalizeStaffFilterValue(name) === state.staffFilter);
      });
    }
    if (term) source = source.filter((log) => buildLogSearchBlob(log).includes(term));
    return source.sort((a, b) => toMillis(b?.createdAt || b?.createdAtMillis) - toMillis(a?.createdAt || a?.createdAtMillis));
  }

  function mountSheetsToBody() {
    TG_PORTAL_SHEET_IDS.forEach((id) => {
      const el = $(id);
      if (!el || el.parentElement === document.body) return;
      document.body.appendChild(el);
    });
  }

  function setBackgroundScreenLocked(locked) {
    const screenEl = host.closest(".screen") || null;
    if (!screenEl) return;
    if (locked) {
      if (tgLockedScreenEl !== screenEl) {
        tgLockedScreenEl = screenEl;
        tgLockedScreenOverflow = screenEl.style.overflow || "";
        tgLockedScreenOverscroll = screenEl.style.overscrollBehavior || "";
        tgLockedScreenTouchAction = screenEl.style.touchAction || "";
      }
      screenEl.style.overflow = "hidden";
      screenEl.style.overscrollBehavior = "none";
      screenEl.style.touchAction = "none";
      return;
    }
    if (tgLockedScreenEl) {
      tgLockedScreenEl.style.overflow = tgLockedScreenOverflow;
      tgLockedScreenEl.style.overscrollBehavior = tgLockedScreenOverscroll;
      tgLockedScreenEl.style.touchAction = tgLockedScreenTouchAction;
      tgLockedScreenEl = null;
      tgLockedScreenOverflow = "";
      tgLockedScreenOverscroll = "";
      tgLockedScreenTouchAction = "";
    }
  }

  function openSheet(id) {
    const el = $(id);
    if (!el) return;
    if (el.classList.contains("open")) return;
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
    tgOpenSheetCount += 1;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    setBackgroundScreenLocked(true);
  }

  function closeSheet(id) {
    const el = $(id);
    if (!el) return;
    if (!el.classList.contains("open")) return;
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
    tgOpenSheetCount = Math.max(0, tgOpenSheetCount - 1);
    if (tgOpenSheetCount === 0) {
      document.documentElement.style.overflow = "";
      document.documentElement.style.overscrollBehavior = "";
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
      setBackgroundScreenLocked(false);
    }
  }

  function finishPrompt(result = false) {
    const resolver = tgPromptResolver;
    tgPromptResolver = null;
    closeSheet("tgPromptSheet");
    if (typeof resolver === "function") resolver(Boolean(result));
  }

  function openPromptDialog(options = {}) {
    if (typeof tgPromptResolver === "function") {
      try {
        tgPromptResolver(false);
      } catch (_) {}
      tgPromptResolver = null;
    }
    const title = String(options?.title || "Thu góp").trim() || "Thu góp";
    const message = String(options?.message || "").trim();
    const eyebrow = String(options?.eyebrow || "Thông báo").trim() || "Thông báo";
    const confirmText = String(options?.confirmText || "OK").trim() || "OK";
    const cancelText = String(options?.cancelText || "").trim();
    const danger = Boolean(options?.danger);
    const titleEl = $("tgPromptTitle");
    const messageEl = $("tgPromptMessage");
    const eyebrowEl = $("tgPromptEyebrow");
    const confirmBtn = $("tgPromptConfirmBtn");
    const cancelBtn = $("tgPromptCancelBtn");
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (eyebrowEl) eyebrowEl.textContent = eyebrow;
    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
      confirmBtn.classList.toggle("is-danger", danger);
    }
    if (cancelBtn) {
      cancelBtn.textContent = cancelText || "Huỷ";
      cancelBtn.style.display = cancelText ? "" : "none";
    }
    openSheet("tgPromptSheet");
    requestAnimationFrame(() => confirmBtn?.focus());
    return new Promise((resolve) => {
      tgPromptResolver = resolve;
    });
  }

  function showUiAlert(message = "", options = {}) {
    return openPromptDialog({
      title: options?.title || "Thu góp",
      eyebrow: options?.eyebrow || "Thông báo",
      message,
      confirmText: options?.confirmText || "Đã hiểu",
      cancelText: "",
      danger: Boolean(options?.danger),
    });
  }

  function showUiConfirm(message = "", options = {}) {
    return openPromptDialog({
      title: options?.title || "Thu góp",
      eyebrow: options?.eyebrow || "Xác nhận",
      message,
      confirmText: options?.confirmText || "Đồng ý",
      cancelText: options?.cancelText || "Huỷ",
      danger: Boolean(options?.danger),
    });
  }

  function getViewportHeight() {
    return Number(window.visualViewport?.height || window.innerHeight || 0) || 0;
  }

  function setCreateSheetKeyboardOpen(open) {
    const sheet = $("tgCreateSheet");
    if (!sheet) return;
    sheet.classList.toggle("keyboard-open", Boolean(open));
  }

  function setCollectSheetKeyboardOpen(open) {
    const sheet = $("tgCollectSheet");
    if (!sheet) return;
    sheet.classList.toggle("keyboard-open", Boolean(open));
  }

  function isCreateTypingField(target) {
    if (!target || typeof target.matches !== "function") return false;
    return target.matches('input:not([type="file"]):not([type="hidden"]), textarea');
  }

  function syncCreateSheetKeyboardState() {
    const sheet = $("tgCreateSheet");
    if (!sheet?.classList.contains("open")) {
      setCreateSheetKeyboardOpen(false);
      return;
    }
    const active = document.activeElement;
    const typingFocused = sheet.contains(active) && isCreateTypingField(active);
    const viewportHeight = getViewportHeight();
    if (!viewportHeight) {
      setCreateSheetKeyboardOpen(false);
      return;
    }
    if (!typingFocused) {
      state.createViewportBaseHeight = viewportHeight;
      setCreateSheetKeyboardOpen(false);
      return;
    }
    state.createViewportBaseHeight = Math.max(state.createViewportBaseHeight || 0, viewportHeight);
    const baseHeight = Math.max(state.createViewportBaseHeight || 0, viewportHeight);
    const keyboardHeight = Math.max(0, baseHeight - viewportHeight);
    const threshold = Math.max(120, Math.round(baseHeight * 0.18));
    setCreateSheetKeyboardOpen(keyboardHeight > threshold);
  }

  function syncCollectSheetKeyboardState() {
    const sheet = $("tgCollectSheet");
    if (!sheet?.classList.contains("open")) {
      setCollectSheetKeyboardOpen(false);
      return;
    }
    const active = document.activeElement;
    const typingFocused = sheet.contains(active) && isCreateTypingField(active);
    const viewportHeight = getViewportHeight();
    if (!viewportHeight) {
      setCollectSheetKeyboardOpen(false);
      return;
    }
    if (!typingFocused) {
      state.collectViewportBaseHeight = viewportHeight;
      setCollectSheetKeyboardOpen(false);
      return;
    }
    state.collectViewportBaseHeight = Math.max(state.collectViewportBaseHeight || 0, viewportHeight);
    const baseHeight = Math.max(state.collectViewportBaseHeight || 0, viewportHeight);
    const keyboardHeight = Math.max(0, baseHeight - viewportHeight);
    const threshold = Math.max(120, Math.round(baseHeight * 0.18));
    const open = keyboardHeight > threshold;
    setCollectSheetKeyboardOpen(open);
  }

  function updateActorName(nextName = "") {
    const raw = String(nextName || "").trim();
    state.actorName = raw || "Nhân viên";
  }

  function updateActorRole(nextRole = "") {
    const raw = String(nextRole || "").trim().toLowerCase();
    state.actorRole = raw || "staff";
  }

  function canCurrentActorCloseBankPayment() {
    return ["manager", "admin", "ceo", "chairman"].includes(getCurrentActorRole());
  }

  function canCurrentActorApproveHandover() {
    return canCurrentActorCloseBankPayment();
  }

  function getCurrentActorRole() {
    const liveRole = String(window.__THKD_POS_CURRENT_ACTOR__?.role || "").trim().toLowerCase();
    if (liveRole) return liveRole;
    return String(state.actorRole || "").trim().toLowerCase() || "staff";
  }

  function syncActorFromApp(actor = null) {
    const currentActor = actor || window.__THKD_POS_CURRENT_ACTOR__ || null;
    const name = String(
      currentActor?.name ||
      currentActor?.displayName ||
      localStorage.getItem("thkd_thugop_actor_name") ||
      document.getElementById("userName")?.textContent ||
      "Nhân viên"
    ).trim();
    const role = String(
      currentActor?.role ||
      window.__THKD_POS_CURRENT_ACTOR__?.role ||
      "staff"
    ).trim().toLowerCase();
    updateActorName(name);
    updateActorRole(role);
  }

  function isHandoverSelectableView() {
    return state.viewMode === "handover" && state.activeFilter === "pending";
  }

  function normalizeSelectedHandoverIds(ids = []) {
    const seen = new Set();
    return (Array.isArray(ids) ? ids : []).map((id) => String(id || "").trim()).filter((id) => {
      if (!id || seen.has(id)) return false;
      const ticket = getTicketById(id);
      if (!ticket || getTicketHandoverStage(ticket) !== "pending") return false;
      seen.add(id);
      return true;
    });
  }

  function getSelectedHandoverTickets() {
    state.selectedHandoverIds = normalizeSelectedHandoverIds(state.selectedHandoverIds);
    return state.selectedHandoverIds.map((id) => getTicketById(id)).filter(Boolean);
  }

  function getVisibleSelectableHandoverTickets() {
    if (!canCurrentActorApproveHandover() || !isHandoverSelectableView()) return [];
    return getVisibleTickets().filter((ticket) => getTicketHandoverStage(ticket) === "pending");
  }

  function isHandoverConfirmModeActive() {
    return canCurrentActorApproveHandover()
      && state.viewMode === "handover"
      && isHandoverSelectableView()
      && state.handoverSelectMode
      && state.handoverApproveTokenOpen
      && getSelectedHandoverTickets().length > 0;
  }

  function toggleAllVisibleHandoverTickets(checked = false) {
    const visibleIds = getVisibleSelectableHandoverTickets().map((ticket) => String(ticket?.id || "").trim()).filter(Boolean);
    if (!checked) {
      state.selectedHandoverIds = [];
      return;
    }
    state.selectedHandoverIds = visibleIds;
  }

  function toggleHandoverTicketSelection(ticketId = "", checked = false) {
    const id = String(ticketId || "").trim();
    if (!id) return;
    const next = new Set(normalizeSelectedHandoverIds(state.selectedHandoverIds));
    if (checked) next.add(id);
    else next.delete(id);
    state.selectedHandoverIds = Array.from(next);
  }

  function syncHandoverSelectionState() {
    if (!canCurrentActorApproveHandover() || state.viewMode !== "handover") {
      state.handoverSelectMode = false;
      state.selectedHandoverIds = [];
      resetHandoverApproveTokenState();
      return;
    }
    state.selectedHandoverIds = normalizeSelectedHandoverIds(state.selectedHandoverIds);
    if (!state.handoverSelectMode || !isHandoverSelectableView()) resetHandoverApproveTokenState();
  }

  function revokeCreateReceiptPreviewUrl() {
    if (!state.createReceiptPreviewUrl) return;
    if (String(state.createReceiptPreviewUrl).startsWith("blob:")) {
      try {
        URL.revokeObjectURL(state.createReceiptPreviewUrl);
      } catch (_) {}
    }
    state.createReceiptPreviewUrl = "";
  }

  function updateCreateReceiptPreview(url = "") {
    const preview = $("tgCreateReceiptPreview");
    const safe = sanitizeUrl(url);
    preview.classList.toggle("has-photo", Boolean(safe));
    preview.classList.toggle("is-live", false);
    preview.style.backgroundImage = safe ? `url(${JSON.stringify(safe)})` : "";
    preview.innerHTML = safe
      ? ""
      : '<span class="tg-muted">Chưa chụp biên nhận</span>';
  }

  function setCreateLiveStatus(text = "", tone = "") {
    const el = $("tgCreateLiveStatus");
    const badge = $("tgCreateLiveBadge");
    if (el) {
      el.textContent = String(text || "").trim();
      el.classList.toggle("success", tone === "success");
      el.classList.toggle("warn", tone === "warn");
    }
    if (badge) {
      badge.textContent = tone === "success" ? "ĐÃ BẮT" : tone === "warn" ? "LIVE" : "LIVE";
      badge.classList.toggle("success", tone === "success");
      badge.classList.toggle("warn", tone === "warn");
    }
  }

  function renderCreateLivePreviewIdle() {
    if (state.createReceiptPreviewUrl) return;
    const preview = $("tgCreateReceiptPreview");
    const video = $("tgCreateLiveVideo");
    if (!preview || !video) return;
    preview.style.backgroundImage = "";
    preview.classList.remove("has-photo");
    preview.classList.toggle("is-live", Boolean(state.createLiveStream || state.createLiveHtml5Scanner));
    preview.innerHTML = "";
    if (state.createLiveHtml5Scanner) {
      const scannerMount = document.createElement("div");
      scannerMount.id = "tgCreateLiveScannerMount";
      scannerMount.className = "tg-create-live-scanner";
      preview.appendChild(scannerMount);
    } else {
      preview.appendChild(video);
    }
    const overlay = document.createElement("div");
    overlay.className = "tg-create-preview-overlay";
    overlay.innerHTML = `
      <span id="tgCreateLiveBadge" class="tg-create-preview-badge">LIVE</span>
      <span class="tg-create-preview-tip">Chạm để chụp</span>
    `;
    preview.appendChild(overlay);
    const placeholder = document.createElement("span");
    placeholder.className = "tg-muted";
    placeholder.textContent = (state.createLiveStream || state.createLiveHtml5Scanner)
      ? "Đưa QR chứa MGD vào khung, hệ thống sẽ tự điền trước khi chụp"
      : "Chạm để chụp biên nhận";
    preview.appendChild(placeholder);
  }

  function stopCreateLiveScanner() {
    if (state.createLiveScanTimer) {
      clearTimeout(state.createLiveScanTimer);
      state.createLiveScanTimer = 0;
    }
    if (state.createLiveHtml5Scanner) {
      const scanner = state.createLiveHtml5Scanner;
      state.createLiveHtml5Scanner = null;
      Promise.resolve()
        .then(() => scanner.stop?.())
        .catch(() => {})
        .then(() => scanner.clear?.())
        .catch(() => {});
    }
    if (state.createLiveStream) {
      try {
        state.createLiveStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
    }
    state.createLiveStream = null;
    state.createLiveDetector = null;
    state.createLiveLastText = "";
    state.createLiveLookupSeq += 1;
    const video = $("tgCreateLiveVideo");
    if (video) {
      try {
        video.pause();
      } catch (_) {}
      try {
        video.srcObject = null;
      } catch (_) {}
    }
    renderCreateLivePreviewIdle();
  }

  async function resolveTicketFromReceiptCode(value = "") {
    const localTicket = findTicketByReceiptCode(value);
    if (localTicket) return localTicket;
    try {
      return await findThuGopTicketByReceiptCode(value);
    } catch (_) {
      return null;
    }
  }

  async function applyDetectedReceiptCode(qrText = "", sourceLabel = "") {
    const raw = String(qrText || "").trim();
    if (!raw) return false;
    const lookupSeq = state.createLiveLookupSeq + 1;
    state.createLiveLookupSeq = lookupSeq;
    state.createQrText = raw;
    const parsedPayload = parseThuGopReceiptScanText(raw);
    const matchedTicket = parsedPayload?.orderCode ? await resolveTicketFromReceiptCode(parsedPayload.orderCode) : null;
    if (lookupSeq !== state.createLiveLookupSeq) return false;
    if (matchedTicket) {
      applyCreateScanData({
        customerName: matchedTicket?.customerName || "",
        customerPhone: matchedTicket?.customerPhone || "",
        contractNumberText: matchedTicket?.contractNumberText || "",
        deposit: parseExpectedAmount(matchedTicket),
      });
      setCreateLiveStatus(`Đã tự điền từ ${sourceLabel || "QR MGD"}: ${parsedPayload?.orderCode || matchedTicket?.code || matchedTicket?.id || ""}`.trim(), "success");
      revealCreateInputs();
      return true;
    }
    const hasDirectFields = Boolean(
      String(parsedPayload?.customerName || "").trim()
      || String(parsedPayload?.customerPhone || "").trim()
      || String(parsedPayload?.contractNumberText || "").trim()
      || Number(parsedPayload?.deposit || 0) > 0,
    );
    if (parsedPayload && hasDirectFields) {
      applyCreateScanData(parsedPayload);
      setCreateLiveStatus(`Đã tự điền từ ${sourceLabel || "QR MGD"}${parsedPayload?.orderCode ? `: ${parsedPayload.orderCode}` : ""}`.trim(), "success");
      revealCreateInputs();
      return true;
    }
    if (parsedPayload?.orderCode) {
      setCreateLiveStatus(`Đã quét ra mã ${parsedPayload.orderCode} nhưng chưa kéo được phiếu cũ`, "warn");
      return false;
    }
    const contractCandidate = extractLikelyContractNumber(raw);
    if (contractCandidate && !String($("tgCreateContractNumber").value || "").trim()) {
      $("tgCreateContractNumber").value = contractCandidate;
      setCreateLiveStatus(`Đã bắt ${sourceLabel || "mã"}, tự điền số hợp đồng ${contractCandidate}`, "success");
      revealCreateInputs();
      return true;
    }
    return false;
  }

  async function scanCreateLiveFrame() {
    if (!state.createLiveStream) return;
    const video = $("tgCreateLiveVideo");
    const detector = state.createLiveDetector;
    if (!video || !detector) return;
    if (video.readyState < 2) {
      state.createLiveScanTimer = window.setTimeout(scanCreateLiveFrame, CREATE_LIVE_SCAN_INTERVAL_MS);
      return;
    }
    try {
      const results = await detector.detect(video);
      const preferred = Array.isArray(results)
        ? results.find((item) => String(item?.format || "") === "qr_code") || results[0]
        : null;
      const rawValue = String(preferred?.rawValue || "").trim();
      if (rawValue && rawValue !== state.createLiveLastText) {
        state.createLiveLastText = rawValue;
        state.createLiveDetectedText = rawValue;
        await applyDetectedReceiptCode(rawValue, "QR MGD");
      }
    } catch (_) {
      setCreateLiveStatus("Camera đang mở, chưa bắt được QR MGD rõ", "warn");
    } finally {
      if (state.createLiveStream) {
        state.createLiveScanTimer = window.setTimeout(scanCreateLiveFrame, CREATE_LIVE_SCAN_INTERVAL_MS);
      }
    }
  }

  async function startCreateHtml5LiveScanner() {
    await ensureHtml5QrcodeScript();
    if (typeof window.Html5Qrcode !== "function") return false;
    state.createLiveHtml5Scanner = {};
    renderCreateLivePreviewIdle();
    const mount = $("tgCreateLiveScannerMount");
    if (!mount) {
      state.createLiveHtml5Scanner = null;
      return false;
    }
    const supportedFormats = window.Html5QrcodeSupportedFormats || {};
    const formatsToSupport = [
      supportedFormats.QR_CODE,
    ].filter((value) => value != null);
    const scanner = new window.Html5Qrcode("tgCreateLiveScannerMount", { formatsToSupport, verbose: false });
    state.createLiveHtml5Scanner = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 18,
          aspectRatio: 1,
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          qrbox: (viewWidth, viewHeight) => {
            const size = Math.max(240, Math.floor(Math.min(viewWidth, viewHeight) * 0.92));
            return { width: size, height: size };
          },
          disableFlip: false,
        },
        async (decodedText, decodedResult) => {
          const rawValue = String(decodedText || "").trim();
          if (!rawValue || rawValue === state.createLiveLastText) return;
          state.createLiveLastText = rawValue;
          state.createLiveDetectedText = rawValue;
          await applyDetectedReceiptCode(rawValue, "QR MGD");
        },
        () => {},
      );
      setCreateLiveStatus("Đưa QR chứa MGD vào khung, app sẽ tự điền trước khi chụp", "");
      return true;
    } catch (_) {
      try {
        await scanner.clear?.();
      } catch (_) {}
      state.createLiveHtml5Scanner = null;
      renderCreateLivePreviewIdle();
      return false;
    }
  }

  async function startCreateLiveScanner() {
    if (state.createReceipt?.file) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCreateLiveStatus("Máy này không mở được camera live, chuyển sang chụp thường", "warn");
      return false;
    }
    stopCreateLiveScanner();
    const html5Started = await startCreateHtml5LiveScanner().catch(() => false);
    if (html5Started) return true;
    renderCreateLivePreviewIdle();
    const video = $("tgCreateLiveVideo");
    if (!video) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      });
      state.createLiveStream = stream;
      state.createLiveDetector = typeof window.BarcodeDetector === "function"
        ? new window.BarcodeDetector({ formats: ["qr_code"] })
        : null;
      video.srcObject = stream;
      await video.play().catch(() => {});
      renderCreateLivePreviewIdle();
      if (state.createLiveDetector) {
        setCreateLiveStatus("Đưa QR chứa MGD vào khung, app sẽ tự điền trước khi chụp", "");
        state.createLiveScanTimer = window.setTimeout(scanCreateLiveFrame, 120);
      } else {
        setCreateLiveStatus("Camera live đã mở, nhưng máy này không hỗ trợ quét live. Vẫn quét sau khi chụp được.", "warn");
      }
      return true;
    } catch (_) {
      stopCreateLiveScanner();
      setCreateLiveStatus("Không mở được camera live, chuyển sang chụp thường", "warn");
      return false;
    }
  }

  function looksLikeShortCode(text = "") {
    const raw = String(text || "").trim();
    if (!raw) return false;
    if (raw.length > 40) return false;
    if (/^https?:\/\//i.test(raw)) return false;
    if (/^000201/.test(raw)) return false;
    return /^[A-Za-z0-9_\-./ ]{4,40}$/.test(raw);
  }

  function extractLikelyContractNumber(text = "") {
    const raw = String(text || "").trim();
    if (!raw) return "";
    const tagged = raw.match(/(?:HD|HĐ|HOP\s*DONG|CONTRACT)[:\s#-]*([A-Za-z0-9_\-./]{4,40})/i);
    if (tagged?.[1]) return String(tagged[1]).trim();
    const lines = raw.split(/\r?\n+/).map((item) => item.trim()).filter(Boolean);
    const compact = lines.find(looksLikeShortCode);
    return compact || (looksLikeShortCode(raw) ? raw : "");
  }

  async function buildReceiptScanFileVariants(file) {
    const variants = [file].filter(Boolean);
    if (!file || typeof createImageBitmap !== "function") return variants;
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return variants;
    try {
      const width = bitmap.width || 0;
      const height = bitmap.height || 0;
      if (!(width > 0 && height > 0)) return variants;
      const cropBoxes = [
        { x: 0.08, y: 0.16, w: 0.84, h: 0.78 },
        { x: 0.00, y: 0.20, w: 0.72, h: 0.68 },
        { x: 0.00, y: 0.18, w: 0.52, h: 0.64 },
        { x: 0.02, y: 0.24, w: 0.42, h: 0.46 },
        { x: 0.10, y: 0.28, w: 0.72, h: 0.58 },
        { x: 0.00, y: 0.28, w: 0.58, h: 0.56 },
      ];
      for (let index = 0; index < cropBoxes.length; index += 1) {
        const crop = cropBoxes[index];
        const sx = Math.max(0, Math.floor(width * crop.x));
        const sy = Math.max(0, Math.floor(height * crop.y));
        const sw = Math.max(1, Math.floor(width * crop.w));
        const sh = Math.max(1, Math.floor(height * crop.h));
        const canvas = document.createElement("canvas");
        const targetWidth = Math.min(1800, Math.max(sw, Math.round(sw * 1.2)));
        const targetHeight = Math.max(1, Math.round(targetWidth * (sh / sw)));
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: false });
        if (!ctx) continue;
        ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
        if (!blob) continue;
        variants.push(new File([blob], `receipt-crop-${index + 1}.jpg`, { type: "image/jpeg" }));
      }
    } finally {
      try {
        bitmap.close?.();
      } catch (_) {}
    }
    return variants;
  }

  function getReceiptScanVariantsForStep(variants = [], limit = 0) {
    const list = Array.isArray(variants) ? variants.filter(Boolean) : [];
    if (!(limit > 0) || list.length <= limit) return list;
    return list.slice(0, limit);
  }

  function warmThuGopScanLibs() {
    ensureJsQrScript().catch(() => {});
    ensureHtml5QrcodeScript().catch(() => {});
  }

  async function detectQrWithBarcodeDetector(file) {
    if (typeof window.BarcodeDetector !== "function" || typeof createImageBitmap !== "function") return "";
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    const bitmap = await createImageBitmap(file);
    try {
      const results = await detector.detect(bitmap);
      const preferred = Array.isArray(results)
        ? results.find((item) => String(item?.format || "") === "qr_code") || results[0]
        : null;
      return String(preferred?.rawValue || "").trim();
    } finally {
      try {
        bitmap.close?.();
      } catch (_) {}
    }
  }

  async function detectQrWithJsQr(file) {
    await ensureJsQrScript();
    if (typeof window.jsQR !== "function" || typeof createImageBitmap !== "function") return "";
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return "";
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return "";
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const tryDecode = (data) => {
        const result = window.jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" });
        return String(result?.data || "").trim();
      };
      const direct = tryDecode(imageData);
      if (direct) return direct;

      const boostedBuffer = new Uint8ClampedArray(imageData.data);
      for (let index = 0; index < boostedBuffer.length; index += 4) {
        const gray = Math.round((boostedBuffer[index] * 0.299) + (boostedBuffer[index + 1] * 0.587) + (boostedBuffer[index + 2] * 0.114));
        const boosted = Math.max(0, Math.min(255, Math.round(((gray - 128) * 1.55) + 128)));
        const binary = boosted >= 164 ? 255 : (boosted <= 92 ? 0 : boosted);
        boostedBuffer[index] = binary;
        boostedBuffer[index + 1] = binary;
        boostedBuffer[index + 2] = binary;
      }
      return tryDecode(new ImageData(boostedBuffer, imageData.width, imageData.height));
    } catch (_) {
      return "";
    } finally {
      try {
        bitmap.close?.();
      } catch (_) {}
    }
  }

  async function detectQrWithHtml5Qrcode(file) {
    await ensureHtml5QrcodeScript();
    if (typeof window.Html5Qrcode !== "function") return "";
    const scanner = new window.Html5Qrcode("tgCreateQrScannerHost");
    try {
      const result = await scanner.scanFile(file, false);
      return String(result?.decodedText || result?.text || result || "").trim();
    } finally {
      try {
        await scanner.clear();
      } catch (_) {}
    }
  }

  async function detectReceiptTextWithTextDetector(file) {
    if (typeof window.TextDetector !== "function" || typeof createImageBitmap !== "function") return "";
    const bitmap = await createImageBitmap(file);
    try {
      const detector = new window.TextDetector();
      const blocks = await detector.detect(bitmap);
      return (Array.isArray(blocks) ? blocks : []).map((block) => {
        const directText = String(block?.rawValue || "").trim();
        if (directText) return directText;
        const lines = Array.isArray(block?.lines) ? block.lines : [];
        return lines.map((line) => String(line?.rawValue || "").trim()).filter(Boolean).join("\n");
      }).filter(Boolean).join("\n");
    } catch (_) {
      return "";
    } finally {
      try {
        bitmap.close?.();
      } catch (_) {}
    }
  }

  async function detectReceiptTextWithTesseract(file) {
    await ensureOcrScript();
    if (!window.Tesseract?.recognize) return "";
    try {
      const result = await window.Tesseract.recognize(file, "eng", {
        logger: () => {},
      });
      return String(result?.data?.text || "").trim();
    } catch (_) {
      return "";
    }
  }

  async function detectReceiptDataFromImage(file) {
    try {
      const variants = await buildReceiptScanFileVariants(file).catch(() => [file]);
      for (const variant of variants) {
        const detectorText = await detectReceiptTextWithTextDetector(variant);
        const parsedDetectorText = parseThuGopReceiptOcrText(detectorText);
        if (parsedDetectorText) return parsedDetectorText;
      }
    } catch (_) {}
    try {
      const variants = await buildReceiptScanFileVariants(file).catch(() => [file]);
      for (const variant of variants) {
        const tesseractText = await detectReceiptTextWithTesseract(variant);
        const parsedTesseractText = parseThuGopReceiptOcrText(tesseractText);
        if (parsedTesseractText) return parsedTesseractText;
      }
    } catch (_) {}
    return null;
  }

  async function detectQrFromReceiptFile(file) {
    const variants = await buildReceiptScanFileVariants(file).catch(() => [file]);
    try {
      for (const variant of getReceiptScanVariantsForStep(variants, THUGOP_FAST_QR_VARIANT_LIMIT)) {
        const direct = await detectQrWithBarcodeDetector(variant);
        if (direct) return direct;
      }
    } catch (_) {}
    try {
      for (const variant of getReceiptScanVariantsForStep(variants, THUGOP_FAST_QR_VARIANT_LIMIT)) {
        const jsQrResult = await detectQrWithJsQr(variant);
        if (jsQrResult) return jsQrResult;
      }
    } catch (_) {}
    try {
      for (const variant of getReceiptScanVariantsForStep(variants, 1)) {
        const html5Result = await detectQrWithHtml5Qrcode(variant);
        if (html5Result) return html5Result;
      }
    } catch (_) {
      // continue fallback
    }
    return String(state.createLiveDetectedText || state.createLiveLastText || state.createQrText || "").trim();
  }

  function revealCreateInputs() {
    const nameInput = $("tgCreateCustomerName");
    setTimeout(() => {
      try {
        nameInput?.focus({ preventScroll: true });
      } catch (_) {
        nameInput?.focus();
      }
    }, 120);
  }

  async function buildCreateReceiptPreviewUrl(file) {
    if (!file) return "";
    const dataUrl = await new Promise((resolve) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      } catch (_) {
        resolve("");
      }
    });
    if (dataUrl) return dataUrl;
    try {
      return URL.createObjectURL(file);
    } catch (_) {
      return "";
    }
  }

  function buildThuGopNormalizedUploadName(fileName = "", fallback = "upload.jpg") {
    const raw = String(fileName || "").trim() || String(fallback || "upload.jpg").trim() || "upload.jpg";
    return raw.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  }

  function loadImageElementFromSrc(src = "") {
    return new Promise((resolve) => {
      const safeSrc = String(src || "").trim();
      if (!safeSrc) {
        resolve(null);
        return;
      }
      try {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = safeSrc;
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function loadDrawableFromImageFile(file) {
    if (!file || !String(file?.type || "").toLowerCase().startsWith("image/")) return null;
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (bitmap) {
        return {
          source: bitmap,
          width: Math.max(1, Number(bitmap.width || 0) || 1),
          height: Math.max(1, Number(bitmap.height || 0) || 1),
          release() {
            try {
              bitmap.close?.();
            } catch (_) {}
          },
        };
      }
    }

    let objectUrl = "";
    try {
      objectUrl = URL.createObjectURL(file);
    } catch (_) {
      objectUrl = "";
    }
    if (objectUrl) {
      const objectImg = await loadImageElementFromSrc(objectUrl);
      if (objectImg) {
        return {
          source: objectImg,
          width: Math.max(1, Number(objectImg.naturalWidth || objectImg.width || 0) || 1),
          height: Math.max(1, Number(objectImg.naturalHeight || objectImg.height || 0) || 1),
          release() {
            try {
              URL.revokeObjectURL(objectUrl);
            } catch (_) {}
          },
        };
      }
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (_) {}
    }

    const dataUrl = await readFileAsDataUrl(file).catch(() => "");
    if (!dataUrl) return null;
    const dataImg = await loadImageElementFromSrc(dataUrl);
    if (!dataImg) return null;
    return {
      source: dataImg,
      width: Math.max(1, Number(dataImg.naturalWidth || dataImg.width || 0) || 1),
      height: Math.max(1, Number(dataImg.naturalHeight || dataImg.height || 0) || 1),
      release() {},
    };
  }

  function canvasToJpegBlob(canvas, quality = 0.82) {
    return new Promise((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob || null), "image/jpeg", quality);
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function normalizeThuGopUploadImageFile(file, options = {}) {
    if (!file || !String(file?.type || "").toLowerCase().startsWith("image/")) return file;
    const drawable = await loadDrawableFromImageFile(file);
    if (!drawable) return file;
    const maxEdge = Math.max(720, Number(options?.maxEdge || 1280) || 1280);
    const targetBytes = Math.max(48 * 1024, Number(options?.targetBytes || (520 * 1024)) || (520 * 1024));
    const qualities = [0.86, 0.78, 0.7, 0.62, 0.54];
    const scales = [1, 0.9, 0.8, 0.72, 0.64, 0.56];
    let bestBlob = null;
    try {
      const width = Math.max(1, Number(drawable.width || 0) || 1);
      const height = Math.max(1, Number(drawable.height || 0) || 1);
      const fitScale = Math.min(1, maxEdge / Math.max(width, height));
      for (const scale of scales) {
        const outputWidth = Math.max(1, Math.round(width * fitScale * scale));
        const outputHeight = Math.max(1, Math.round(height * fitScale * scale));
        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: false });
        if (!ctx) continue;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, outputWidth, outputHeight);
        ctx.drawImage(drawable.source, 0, 0, outputWidth, outputHeight);
        for (const quality of qualities) {
          const blob = await canvasToJpegBlob(canvas, quality);
          if (!blob) continue;
          if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
          if (blob.size <= targetBytes) {
            return new File([blob], buildThuGopNormalizedUploadName(file.name, options?.fallbackName || "upload.jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
          }
        }
      }
    } finally {
      try {
        drawable.release?.();
      } catch (_) {}
    }
    if (!bestBlob) return file;
    return new File([bestBlob], buildThuGopNormalizedUploadName(file.name, options?.fallbackName || "upload.jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("Thiếu file ảnh"));
        return;
      }
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("Không đọc được file ảnh"));
        reader.readAsDataURL(file);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function applyCreateReceiptFile(file) {
    if (!file) return;
    stopCreateLiveScanner();
    revokeCreateReceiptPreviewUrl();
    state.createReceipt = { file };
    state.createReceiptPreviewUrl = await buildCreateReceiptPreviewUrl(file);
    updateCreateReceiptPreview(state.createReceiptPreviewUrl);
    openSheet("tgCreateSheet");
    revealCreateInputs();
    warmThuGopScanLibs();

    setCreateLiveStatus("Đang quét mã MGD trên ảnh...", "");
    const qrText = await detectQrFromReceiptFile(file);
    if (state.createReceipt?.file !== file) return;
    state.createQrText = qrText;
    let didAutofill = false;
    if (qrText) {
      didAutofill = await applyDetectedReceiptCode(qrText, "ảnh chụp");
    }
    if (!didAutofill) {
      setCreateLiveStatus(qrText
        ? "Đã quét ra mã nhưng chưa kéo được phiếu cũ. Nhập tay luôn giúp em."
        : "Không thấy QR / mã MGD. App không đọc chữ ảnh nữa, nhân viên nhập tay luôn.", "warn");
    } else if (hasCreateAutofillReady()) {
      setCreateLiveStatus("Vui lòng kiểm tra số tiền trước khi tạo phiếu", "success");
    }
  }

  function promptCreateReceiptCapture() {
    setCreateLiveStatus("Đang mở camera chụp phiếu...", "");
    warmThuGopScanLibs();
    $("tgCreateReceiptInput").click();
  }

  async function uploadCreateReceipt() {
    if (!state.createReceipt?.file) return {};
    const originalFile = state.createReceipt.file;
    const file = await normalizeThuGopUploadImageFile(originalFile, {
      maxEdge: 720,
      targetBytes: 120 * 1024,
      fallbackName: "phieu_khach.jpg",
    }).catch(() => originalFile);
    const uploadedUrl = await readFileAsDataUrl(file).catch(() => "");
    if (!uploadedUrl) return {};
    return {
      contractImageUrl: uploadedUrl,
      contractImagePath: `inline:thugop_contract_images/create/${Date.now()}`,
      contractImageName: file.name || "phieu_khach.jpg",
      billReceiptUrl: uploadedUrl,
      billReceiptPath: `inline:thugop_contract_images/create/${Date.now()}`,
      billReceiptName: file.name || "phieu_khach.jpg",
    };
  }

  function resetCreateForm() {
    state.createViewportBaseHeight = getViewportHeight();
    setCreateSheetKeyboardOpen(false);
    stopCreateLiveScanner();
    revokeCreateReceiptPreviewUrl();
    state.createReceipt = null;
    resetReservedCreateCode();
    state.createQrText = "";
    state.createLiveDetectedText = "";
    $("tgCreateCustomerName").value = "";
    $("tgCreateCustomerPhone").value = "";
    $("tgCreateContractNumber").value = "";
    $("tgCreateDeposit").value = "";
    $("tgCreateReceiptInfo").value = "";
    $("tgCreateWorkNote").value = "";
    $("tgCreateReceiptInput").value = "";
    updateCreateReceiptPreview("");
    renderCreateLivePreviewIdle();
    setCreateLiveStatus("Đưa QR chứa MGD vào khung, app sẽ tự điền trước khi chụp", "");
    $("tgCreateWarning").textContent = "";
  }

  function revokeCollectBillPreviewUrl() {
    const url = String(state.collectBillPreviewUrl || "").trim();
    if (!url || !url.startsWith("blob:")) return;
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
    state.collectBillPreviewUrl = "";
  }

  function getCollectSourceUrl(ticket = {}) {
    return sanitizeUrl(ticket?.contractImageUrl || ticket?.billReceiptUrl || "");
  }

  function getCollectBillUrl(ticket = {}) {
    return sanitizeUrl(ticket?.paymentCloseBillUrl || ticket?.bankPaidBillUrl || "");
  }

  function getCollectSavedNote(ticket = {}) {
    return String(ticket?.paymentCloseNote || ticket?.bankPaidNote || "").trim();
  }

  function updateCollectSourcePreview(url = "") {
    const preview = $("tgCollectSourcePreview");
    if (!preview) return;
    const safe = sanitizeUrl(url);
    preview.classList.toggle("has-photo", Boolean(safe));
    preview.dataset.sourceUrl = safe || "";
    preview.scrollTop = 0;
    preview.innerHTML = safe
      ? `<img src="${escapeHtml(safe)}" alt="Ảnh lúc nhân viên tạo phiếu" />`
      : '<div class="tg-collect-preview-empty"><i class="fa-regular fa-image"></i><span>Chưa có ảnh lúc nhân viên tạo phiếu</span></div>';
  }

  async function uploadCollectBillAsset(ticketId = "", file = null) {
    const safeTicketId = String(ticketId || "").trim();
    if (!safeTicketId || !file) return null;
    const normalizedFile = await normalizeThuGopUploadImageFile(file, {
      maxEdge: 1280,
      targetBytes: 520 * 1024,
      fallbackName: "bill_dong_tien.jpg",
    }).catch(() => file);
    const uploaded = await uploadThuGopAsset(normalizedFile, {
      kind: "payment_bill",
      ticketId: safeTicketId,
      fileName: normalizedFile.name || file.name || "bill_dong_tien.jpg",
      contentType: normalizedFile.type || file.type || "image/jpeg",
    });
    return {
      billUrl: uploaded?.url || "",
      billPath: uploaded?.path || "",
      billName: uploaded?.name || normalizedFile.name || file.name || "bill_dong_tien.jpg",
    };
  }

  async function buildCollectBillInlinePayload(file = null) {
    if (!file) return null;
    const normalizedFile = await normalizeThuGopUploadImageFile(file, {
      maxEdge: 560,
      targetBytes: 90 * 1024,
      fallbackName: "bill_dong_tien.jpg",
    }).catch(() => file);
    const billUrl = await readFileAsDataUrl(normalizedFile).catch(() => "");
    if (!billUrl) return null;
    return {
      billUrl,
      billPath: `inline:thugop_bills/${Date.now()}`,
      billName: normalizedFile.name || file.name || "bill_dong_tien.jpg",
    };
  }

  function applyLocalCollectedPaymentToState(ticketId = "", payment = {}) {
    const safeTicketId = String(ticketId || "").trim();
    if (!safeTicketId) return;
    const amount = Number(payment?.amount || 0) || 0;
    const billUrl = String(payment?.billUrl || "").trim();
    const billPath = String(payment?.billPath || "").trim();
    const billName = String(payment?.billName || "").trim();
    const note = String(payment?.note || "").trim();
    const nowIso = new Date().toISOString();
    state.tickets = state.tickets.map((item) => {
      if (String(item?.id || "").trim() !== safeTicketId) return item;
      return {
        ...item,
        paymentCloseAmount: amount,
        paymentCloseBillUrl: billUrl,
        paymentCloseBillPath: billPath,
        paymentCloseBillName: billName,
        paymentCloseNote: note,
        paymentCloseByName: state.actorName,
        paymentCloseAt: nowIso,
        bankPaidState: "done",
        bankPaidAmount: amount,
        bankPaidByName: state.actorName,
        bankPaidBillUrl: billUrl,
        bankPaidBillPath: billPath,
        bankPaidBillName: billName,
        bankPaidNote: note,
        bankPaidAt: nowIso,
        updatedAt: nowIso,
        sortAt: nowIso,
      };
    });
  }

  function startCollectBillUpload(file = null) {
    const ticketId = String(state.collectId || "").trim();
    if (!ticketId || !file || !state.collectBill) return Promise.resolve(null);
    const nextSeq = Number(state.collectBillUploadSeq || 0) + 1;
    state.collectBillUploadSeq = nextSeq;
    const uploadPromise = uploadCollectBillAsset(ticketId, file)
      .then((payload) => {
        if (state.collectBill?.uploadSeq !== nextSeq) return payload;
        state.collectBill.uploaded = payload;
        state.collectBill.uploadError = null;
        return payload;
      })
      .catch((error) => {
        if (state.collectBill?.uploadSeq === nextSeq) {
          state.collectBill.uploadError = error;
        }
        throw error;
      });
    state.collectBill.uploadSeq = nextSeq;
    state.collectBill.uploadPromise = uploadPromise;
    state.collectBill.uploaded = null;
    state.collectBill.uploadError = null;
    return uploadPromise;
  }

  function openCollectImageViewer(url = "", title = "Ảnh phiếu") {
    const safe = sanitizeUrl(url);
    if (!safe) return;
    const viewer = $("tgCollectImageViewer");
    const titleEl = $("tgCollectImageTitle");
    if (titleEl) titleEl.textContent = String(title || "Ảnh phiếu").trim() || "Ảnh phiếu";
    if (viewer) {
      viewer.scrollTop = 0;
      viewer.innerHTML = `<img src="${escapeHtml(safe)}" alt="${escapeHtml(title || "Ảnh phiếu")}" />`;
    }
    openSheet("tgCollectImageSheet");
  }

  function updateBillPreview(url = "", options = {}) {
    const preview = $("tgCollectBillPreview");
    if (!preview) return;
    const safe = sanitizeUrl(url);
    const readOnly = Boolean(options?.readOnly);
    preview.classList.toggle("has-photo", Boolean(safe));
    preview.classList.toggle("is-source-scroll", readOnly && Boolean(safe));
    preview.classList.toggle("is-upload", !readOnly);
    preview.dataset.sourceUrl = safe || "";
    preview.scrollTop = 0;
    preview.setAttribute("aria-label", readOnly
      ? "Kéo để xem bill đóng tiền, chạm để mở ảnh lớn"
      : "Chạm để chụp hoặc chọn bill đóng tiền");
    preview.innerHTML = safe
      ? `<img src="${escapeHtml(safe)}" alt="Bill quản lý đóng tiền" />`
      : `<div class="tg-collect-preview-empty"><i class="fa-solid ${readOnly ? "fa-image" : "fa-camera"}"></i><span>${readOnly ? "Chưa có bill đóng tiền" : "Chạm để chụp hoặc chọn bill đóng tiền"}</span></div>`;
  }

  function applyCollectReadOnlyState(ticket = null) {
    const readOnly = Boolean(state.collectReadOnly);
    const amountInput = $("tgCollectAmountInput");
    const noteInput = $("tgCollectNoteInput");
    const billInput = $("tgCollectBillInput");
    const saveBtn = $("tgSaveCollectBtn");
    const actionsEl = saveBtn?.closest(".tg-collect-actions") || null;
    const titleEl = $("tgCollectTitle");
    if (titleEl) {
      titleEl.textContent = readOnly
        ? `Đã đóng • ${String(ticket?.code || ticket?.id || "Phiếu").trim() || "Phiếu"}`
        : (String(ticket?.code || ticket?.id || "Phiếu").trim() || "Đóng tiền");
    }
    if (amountInput) {
      amountInput.readOnly = readOnly;
      amountInput.disabled = false;
    }
    if (noteInput) {
      noteInput.readOnly = readOnly;
      noteInput.disabled = false;
    }
    if (billInput) {
      billInput.disabled = readOnly;
    }
    if (actionsEl) {
      actionsEl.style.display = readOnly ? "none" : "flex";
    }
    if (saveBtn) {
      saveBtn.disabled = readOnly;
      saveBtn.style.display = readOnly ? "none" : "";
    }
  }

  function renderCollectWarning(validation = {}, forcedMessage = "") {
    const warningEl = $("tgCollectWarning");
    if (!warningEl) return;
    const expectedText = formatMoney(validation?.expected || 0);
    const closedAtText = String(validation?.closedAtText || "").trim();
    let note = "";
    let noteClass = "";
    let noteIcon = "fa-regular fa-message";
    if (forcedMessage) {
      note = forcedMessage;
      noteClass = "is-warn";
      noteIcon = "fa-solid fa-triangle-exclamation";
    } else if (validation.readOnly) {
      note = closedAtText
        ? `Phiếu đóng tiền đã được đóng ngày: ${closedAtText}`
        : "Phiếu đóng tiền đã được đóng.";
      noteIcon = "fa-solid fa-eye";
    } else if (!(validation.amount > 0)) {
      note = "Nhập số tiền quản lý đã đóng.";
      noteIcon = "fa-solid fa-pen";
    } else if (!validation.isAmountMatch) {
      note = "Cảnh báo: số tiền quản lý đóng không khớp.";
      noteClass = "is-warn";
      noteIcon = "fa-solid fa-triangle-exclamation";
    } else if (!validation.hasBill) {
      note = "Chụp hoặc chọn bill đóng tiền để lưu.";
      noteIcon = "fa-solid fa-camera";
    } else if (validation.isReady) {
      note = "Số tiền quản lý đóng đã khớp, có thể lưu.";
      noteClass = "is-good";
      noteIcon = "fa-solid fa-circle-check";
    }
    warningEl.innerHTML = `
      <div class="tg-collect-warning-main"><i class="fa-solid fa-sack-dollar"></i><span>Số tiền đã thu khách: <strong>${escapeHtml(expectedText)}</strong></span></div>
      ${note ? `<div class="tg-collect-warning-note ${noteClass}"><i class="${noteIcon}"></i><span>${escapeHtml(note)}</span></div>` : ""}
    `;
  }

  function syncCollectCompareState() {
    const ticket = getTicketById(state.collectId);
    const expected = parseExpectedAmount(ticket || {});
    const amount = Number(digitsOnly($("tgCollectAmountInput")?.value || "")) || 0;
    const hasBill = state.collectReadOnly
      ? Boolean(getCollectBillUrl(ticket || {}))
      : Boolean(state.collectBill?.file);
    const expectedText = formatMoney(expected);
    const closedAtText = fmtDateTime(ticket?.paymentCloseAt || ticket?.bankPaidAt || ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt) || "";
    const enteredText = amount > 0 ? formatMoney(amount) : "0đ";
    const diffValue = Math.max(0, Math.abs(expected - amount));
    const isAmountMatch = expected > 0 ? amount === expected : amount > 0;
    const isReady = !state.collectReadOnly && isAmountMatch && hasBill;
    $("tgCollectExpectedAmount").textContent = expectedText;
    $("tgCollectEnteredAmount").textContent = enteredText;
    $("tgCollectDiffAmount").textContent = formatMoney(diffValue);
    const statusEl = $("tgCollectCompareStatus");
    if (statusEl) {
      statusEl.classList.remove("is-good", "is-warn");
      if (state.collectReadOnly) {
        statusEl.classList.add(isAmountMatch ? "is-good" : "is-warn");
        statusEl.innerHTML = closedAtText
          ? `<i class="fa-solid fa-eye"></i> Phiếu đóng tiền đã được đóng ngày: ${escapeHtml(closedAtText)}`
          : '<i class="fa-solid fa-eye"></i> Phiếu đóng tiền đã được đóng';
      } else if (isReady) {
        statusEl.classList.add("is-good");
        statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> Tiền đã khớp và đã có bill, có thể lưu';
      } else {
        statusEl.classList.add("is-warn");
        if (!amount) {
          statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Nhập số tiền quản lý đã đóng';
        } else if (!isAmountMatch) {
          statusEl.innerHTML = `<i class="fa-solid fa-scale-balanced"></i> Số tiền quản lý đóng không khớp ${escapeHtml(expectedText)}`;
        } else if (!hasBill) {
          statusEl.innerHTML = '<i class="fa-solid fa-camera"></i> Cần chụp hoặc chọn bill đóng tiền';
        } else {
          statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Chưa đủ điều kiện để lưu';
        }
      }
    }
    const validation = { expected, amount, hasBill, isAmountMatch, isReady, readOnly: state.collectReadOnly, closedAtText };
    renderCollectWarning(validation);
    const saveBtn = $("tgSaveCollectBtn");
    if (saveBtn) saveBtn.disabled = !isReady;
    return validation;
  }

  function resetCollectForm() {
    state.collectId = "";
    state.collectReadOnly = false;
    state.collectBill = null;
    state.collectBillUploadSeq = Number(state.collectBillUploadSeq || 0) + 1;
    state.collectViewportBaseHeight = getViewportHeight();
    revokeCollectBillPreviewUrl();
    $("tgCollectBillInput").value = "";
    $("tgCollectNoteInput").value = "";
    $("tgCollectAmountInput").value = "";
    renderCollectWarning({ expected: 0, amount: 0, hasBill: false, isAmountMatch: false, isReady: false });
    updateCollectSourcePreview("");
    updateBillPreview("", { readOnly: false });
    applyCollectReadOnlyState(null);
    setCollectSheetKeyboardOpen(false);
    syncCollectCompareState();
  }

  function buildPreviewOrderFromTicket(ticket = {}) {
    const amount = parseExpectedAmount(ticket);
    return buildThuGopPrintOrder({
      ticketId: String(ticket?.id || "").trim(),
      orderCode: String(ticket?.code || ticket?.id || "").trim(),
      createdAt: ticket?.createdAtIso || ticket?.createdAt || new Date().toISOString(),
      customerName: ticket?.customerName || "Khách lẻ",
      customerPhone: ticket?.customerPhone || "",
      contractNumberText: ticket?.contractNumberText || "",
      deposit: amount,
      paidAmount: amount,
      debtAmount: 0,
      note: [ticket?.receiptInfo, ticket?.workNote].filter(Boolean).join(" • "),
      actorName: ticket?.creatorName || ticket?.createdByName || state.actorName,
    });
  }

  function renderModeTabs() {
    const hostEl = $("tgModeTabs");
    if (!hostEl) return;
    hostEl.innerHTML = "";
  }

  function ticketMetaHtml(ticket = {}) {
    const parts = [
      ticket?.customerPhone ? `<span><i class="fa-solid fa-phone"></i>${escapeHtml(ticket.customerPhone)}</span>` : "",
      fmtDateTime(ticket?.cashHandoverAt || ticket?.paymentCloseAt || ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt)
        ? `<span><i class="fa-regular fa-clock"></i>${escapeHtml(fmtDateTime(ticket?.cashHandoverAt || ticket?.paymentCloseAt || ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt))}</span>`
        : "",
    ];
    return parts.filter(Boolean).join("");
  }

  function renderFilterButton() {
    const labelEl = $("tgFilterBtnLabel");
    const iconEl = $("tgModeSwitchIcon");
    const filterBtn = $("tgOpenFilterBtn");
    if (!labelEl || !iconEl || !filterBtn) return;
    labelEl.textContent = "Giao";
    iconEl.className = "fa-solid fa-hand-holding-dollar";
    filterBtn.classList.remove("active");
    filterBtn.setAttribute("title", state.viewMode === "handover" ? "Chạm để về Đóng" : "Chạm để sang Giao");
  }

  function renderStaffFilter() {
    const btn = $("tgStaffFilterBtn");
    const labelEl = $("tgStaffFilterLabel");
    const menuEl = $("tgStaffFilterMenu");
    const totalEl = $("tgStaffFilterTotal");
    if (!btn || !labelEl || !menuEl || !totalEl) return;
    const options = ensureStaffFilter();
    const selected = options.find((item) => item.key === state.staffFilter) || null;
    labelEl.textContent = selected?.label || "All nhân viên";
    btn.classList.toggle("open", Boolean(state.staffFilterOpen));
    btn.setAttribute("aria-expanded", state.staffFilterOpen ? "true" : "false");
    menuEl.classList.toggle("open", Boolean(state.staffFilterOpen));
    menuEl.innerHTML = [
      `<button class="tg-staff-filter-option ${!state.staffFilter ? "active" : ""}" type="button" data-staff-filter-key=""><i class="fa-solid fa-users"></i> All nhân viên</button>`,
      ...options.map((item) => `<button class="tg-staff-filter-option ${state.staffFilter === item.key ? "active" : ""}" type="button" data-staff-filter-key="${escapeHtml(item.key)}"><i class="fa-solid fa-user"></i> ${escapeHtml(item.label)}</button>`),
    ].join("");
    const totalAmount = state.viewMode === "handover" && state.activeFilter === "logs"
      ? getVisibleLogs().reduce((sum, log) => sum + Number(log?.totalAmount || 0), 0)
      : getVisibleTickets().reduce((sum, ticket) => sum + parseExpectedAmount(ticket), 0);
    totalEl.textContent = `Tổng ${formatMoney(totalAmount)}`;
  }

  function renderDateRangeFilter() {
    const wrap = $("tgDateFilterWrap");
    const btn = $("tgDateFilterBtn");
    const labelEl = $("tgDateFilterLabel");
    const menuEl = $("tgDateFilterMenu");
    if (!wrap) return;
    const visible = shouldShowDateRangeFilter();
    wrap.classList.toggle("tg-hidden", !visible);
    if (!visible) {
      state.dateRangeFilterOpen = false;
      if (menuEl) menuEl.innerHTML = "";
      return;
    }
    const selected = DATE_RANGE_FILTERS.find((item) => item.key === state.dateRangeFilter) || DATE_RANGE_FILTERS[0];
    if (labelEl) labelEl.textContent = selected?.label || "Hôm nay";
    if (btn) {
      btn.classList.toggle("open", Boolean(state.dateRangeFilterOpen));
      btn.setAttribute("aria-expanded", state.dateRangeFilterOpen ? "true" : "false");
    }
    if (menuEl) {
      menuEl.classList.toggle("open", Boolean(state.dateRangeFilterOpen));
      menuEl.innerHTML = DATE_RANGE_FILTERS.map((item) => `<button class="tg-date-filter-option ${state.dateRangeFilter === item.key ? "active" : ""}" type="button" data-date-filter-key="${escapeHtml(item.key)}"><i class="fa-regular fa-calendar"></i> ${escapeHtml(item.label)}</button>`).join("");
    }
  }

  function renderHandoverSelectToggle() {
    const wrap = $("tgHandoverSelectToggleWrap");
    const checkbox = $("tgHandoverSelectToggle");
    if (!wrap || !checkbox) return;
    syncHandoverSelectionState();
    const visible = canCurrentActorApproveHandover() && state.viewMode === "handover";
    wrap.classList.toggle("tg-hidden", !visible);
    checkbox.checked = Boolean(state.handoverSelectMode);
    checkbox.disabled = !visible;
  }

  function renderHandoverBulkBar() {
    const bar = $("tgHandoverBulkBar");
    const titleEl = $("tgHandoverBulkTitle");
    const amountEl = $("tgHandoverBulkAmount");
    const approveBtn = $("tgApproveSelectedBtn");
    const selectAllCheckbox = $("tgHandoverSelectAll");
    const tokenWrap = $("tgHandoverTokenWrap");
    const tokenInput = $("tgHandoverTokenInput");
    const tokenFillBtn = $("tgHandoverTokenFillBtn");
    const tokenCancelBtn = $("tgHandoverTokenCancelBtn");
    const confirmMeta = $("tgHandoverConfirmMeta");
    const confirmActors = $("tgHandoverConfirmActors");
    const confirmAmount = $("tgHandoverConfirmAmount");
    const fab = $("tgFabCreate");
    const appNav = document.querySelector(".nav");
    const shell = host?.querySelector(".tg-shell");
    if (!bar || !titleEl || !amountEl || !approveBtn || !selectAllCheckbox || !tokenWrap || !tokenInput || !tokenFillBtn || !tokenCancelBtn || !confirmMeta || !confirmActors || !confirmAmount || !fab) return;
    syncHandoverSelectionState();
    const visibleTickets = getVisibleSelectableHandoverTickets();
    const visibleIds = new Set(visibleTickets.map((ticket) => String(ticket?.id || "").trim()).filter(Boolean));
    const selectedTickets = getSelectedHandoverTickets();
    const selectedVisibleCount = selectedTickets.filter((ticket) => visibleIds.has(String(ticket?.id || "").trim())).length;
    const totalAmount = selectedTickets.reduce((sum, ticket) => sum + parseHandoverAmount(ticket), 0);
    const giverNames = Array.from(new Set(selectedTickets.map((ticket) => resolveTicketOwnerName(ticket)).filter(Boolean)));
    const giverLabel = giverNames.length <= 1 ? (giverNames[0] || "NV") : `${giverNames.length} NV`;
    const receiverLabel = String(state.actorName || "Quản lý").trim() || "Quản lý";
    const showSelectionUi = canCurrentActorApproveHandover() && state.handoverSelectMode && isHandoverSelectableView();
    const confirmMode = showSelectionUi && state.handoverApproveTokenOpen && selectedTickets.length > 0;
    const allVisibleSelected = visibleTickets.length > 0 && selectedVisibleCount === visibleTickets.length;
    const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
    bar.classList.toggle("open", showSelectionUi);
    bar.classList.toggle("confirm-mode", confirmMode);
    fab.classList.toggle("tg-hidden", showSelectionUi);
    document.documentElement.classList.toggle("thkd-hide-bottom-nav", showSelectionUi);
    appNav?.classList.toggle("tg-hidden", showSelectionUi);
    shell?.classList.toggle("has-handover-bulk-bar", showSelectionUi);
    window.dispatchEvent(new Event("resize"));
    if (!selectedTickets.length && state.handoverApproveTokenOpen) resetHandoverApproveTokenState();
    tokenWrap.classList.toggle("open", confirmMode);
    tokenInput.value = state.handoverApproveTokenInput;
    tokenInput.disabled = !confirmMode;
    tokenInput.classList.toggle("is-error", confirmMode && state.handoverApproveTokenError);
    tokenInput.setAttribute("aria-invalid", confirmMode && state.handoverApproveTokenError ? "true" : "false");
    tokenFillBtn.disabled = !confirmMode;
    tokenCancelBtn.disabled = !confirmMode;
    confirmMeta.classList.toggle("open", confirmMode);
    confirmActors.textContent = `${giverLabel} → ${receiverLabel}`;
    confirmAmount.textContent = formatMoney(totalAmount);
    selectAllCheckbox.checked = allVisibleSelected;
    selectAllCheckbox.indeterminate = someVisibleSelected;
    selectAllCheckbox.disabled = visibleTickets.length === 0;
    titleEl.textContent = selectedTickets.length ? `Đã chọn ${selectedTickets.length} phiếu` : "Chưa chọn phiếu";
    amountEl.textContent = `Tổng ${formatMoney(totalAmount)}`;
    approveBtn.disabled = selectedTickets.length === 0;
    approveBtn.innerHTML = confirmMode ? 'Xác nhận' : '<i class="fa-solid fa-check-double"></i> Duyệt';
  }

  function renderQuickBankFilters() {
    const toggleBtn = $("tgQuickBankToggle");
    if (!toggleBtn) return;
    const isBankMode = state.viewMode === "bank";
    toggleBtn.style.display = "inline-flex";
    toggleBtn.classList.remove("is-unpaid", "is-paid", "is-pending", "is-done", "is-logs");
    if (isBankMode) {
      const isPaid = state.activeFilter === "paid";
      toggleBtn.textContent = isPaid ? "Đã đóng" : "Chưa đóng";
      toggleBtn.classList.add(isPaid ? "is-paid" : "is-unpaid");
      toggleBtn.setAttribute("aria-label", `Đổi trạng thái: ${toggleBtn.textContent}`);
      toggleBtn.setAttribute("title", `Chạm để đổi sang ${isPaid ? "Chưa đóng" : "Đã đóng"}`);
      return;
    }
    const handoverState = state.activeFilter === "done" ? "done" : "pending";
    toggleBtn.textContent = handoverState === "done" ? "Đã giao tiền" : "Chưa giao tiền";
    toggleBtn.classList.add(`is-${handoverState}`);
    toggleBtn.setAttribute("aria-label", `Đổi trạng thái giao: ${toggleBtn.textContent}`);
    toggleBtn.setAttribute("title", `Chạm để đổi sang ${handoverState === "done" ? "Chưa giao tiền" : "Đã giao tiền"}`);
  }

  function renderFilterSheet() {
    ensureActiveFilter();
    const list = $("tgFilterList");
    list.innerHTML = getActiveFilters().map((item) => `
      <button class="tg-filter-option ${state.activeFilter === item.key ? "active" : ""}" type="button" data-filter-key="${escapeHtml(item.key)}"><i class="fa-solid ${escapeHtml(item.icon || "fa-circle")}"></i> ${escapeHtml(item.label)}</button>
    `).join("");
  }

  function renderTicketCard(ticket = {}) {
    const id = String(ticket?.id || "").trim();
    const bankStage = getTicketBankStage(ticket);
    const handoverStage = getTicketHandoverStage(ticket);
    const amount = parseExpectedAmount(ticket);
    const creatorName = resolveCollectedStaffName(ticket);
    const ownerName = resolveTicketOwnerName(ticket);
    const receiverName = String(ticket?.cashHandoverReceivedByName || "").trim();
    const contractDisplay = formatContractNumberDisplay(ticket?.contractNumberText || "");
    const contractFontSize = getContractCardFontSize(contractDisplay);
    const showSelection = canCurrentActorApproveHandover() && state.viewMode === "handover" && state.handoverSelectMode && handoverStage === "pending";
    const staffLine = state.viewMode === "handover"
      ? (handoverStage === "done" && ownerName
          ? `<div class="tg-card-staff"><i class="fa-solid fa-user"></i><span>${escapeHtml(ownerName)}</span>${receiverName ? `<span class="tg-card-staff-arrow">→</span><span>${escapeHtml(receiverName)}</span>` : ""}</div>`
          : (ownerName ? `<label class="tg-card-staff tg-card-staff-select"><input class="tg-card-staff-checkbox" type="checkbox" data-handover-select="${escapeHtml(id)}" ${showSelection ? "" : "style=\"display:none\""} ${state.selectedHandoverIds.includes(id) ? "checked" : ""} /><span>${escapeHtml(ownerName)}</span></label>` : ""))
      : (creatorName ? `<div class="tg-card-staff"><i class="fa-solid fa-user"></i>${escapeHtml(creatorName)}</div>` : "");
    const actionRow = state.viewMode === "bank"
      ? `<div class="tg-card-actions">${bankStage === "unpaid"
          ? `<button class="tg-small-btn tg-card-action-primary" type="button" data-open-collect="${escapeHtml(id)}"><i class="fa-solid fa-money-bill-wave"></i> Chờ đóng tiền</button>`
          : `<button class="tg-small-btn tg-card-action-success tg-card-status-static" type="button" data-open-collect="${escapeHtml(id)}" data-collect-readonly="true"><i class="fa-solid fa-circle-check"></i> Đã đóng tiền</button>`}</div>`
      : `<div class="tg-card-actions">${handoverStage === "pending"
          ? `<button class="tg-small-btn tg-card-action-primary" type="button" data-single-approve="${escapeHtml(id)}"><i class="fa-solid fa-hand-holding-dollar"></i> Chờ giao tiền</button>`
          : `<button class="tg-small-btn" type="button" disabled><i class="fa-solid fa-circle-check"></i> Đã giao tiền</button>`}</div>`;
    return `
      <article class="tg-card" data-open-preview="${escapeHtml(id)}">
        <div class="tg-card-top">
          <div class="tg-card-main">
            <div class="tg-card-title-row">
              <div class="tg-card-title tg-card-title-text"><span class="tg-card-customer-name">${escapeHtml(normalizeCustomerDisplayName(ticket?.customerName || "Khách lẻ"))}</span>${contractDisplay ? `<span class="tg-card-contract" style="--tg-contract-size:${escapeHtml(contractFontSize)}px">• HĐ ${escapeHtml(contractDisplay)}</span>` : ""}</div>
            </div>
            <div class="tg-card-meta">${ticketMetaHtml(ticket)}</div>
            ${staffLine}
          </div>
          <div class="tg-card-side">
            <div class="tg-card-amount">${escapeHtml(formatMoney(amount))}</div>
            ${actionRow}
          </div>
        </div>
      </article>
    `;
  }

  function renderLogCard(log = {}) {
    const totalTickets = Number(log?.totalTickets || 0);
    return `
      <article class="tg-card is-log">
        <div class="tg-card-top">
          <div class="tg-card-main">
            <div class="tg-card-title"><i class="fa-solid fa-book"></i> ${escapeHtml(log?.receiverName || 'Quản lý')}</div>
            <div class="tg-card-meta">
              <span>${escapeHtml(log?.giverName || 'Nhân viên')}</span>
              <span>${escapeHtml(fmtDateTime(log?.createdAt || log?.createdAtMillis) || '')}</span>
            </div>
          </div>
          <div class="tg-card-amount">${escapeHtml(formatMoney(log?.totalAmount || 0))}</div>
        </div>
        <div class="tg-pill-row">
          <span class="tg-pill done">${escapeHtml(`${totalTickets} phiếu`)}</span>
          ${log?.batchId ? `<span class="tg-pill">${escapeHtml(log.batchId)}</span>` : ''}
        </div>
      </article>
    `;
  }

  function renderMainList() {
    const container = $("tgMainList");
    if (state.viewMode === "handover" && state.activeFilter === "logs") {
      state.activeFilter = "pending";
    }
    const items = (isHandoverConfirmModeActive() ? getSelectedHandoverTickets() : getVisibleTickets()).slice(0, 120);
    container.innerHTML = items.length
      ? items.map(renderTicketCard).join("")
      : '<div class="tg-empty">Không có phiếu phù hợp.</div>';
  }

  function renderDetailSheet() {
    const ticket = getTicketById(state.detailId);
    if (!ticket) {
      closeSheet("tgDetailSheet");
      return;
    }
    const stage = ticketStage(ticket);
    const billUrl = sanitizeUrl(ticket?.paymentCloseBillUrl || "");
    const contractUrl = sanitizeUrl(ticket?.contractImageUrl || ticket?.billReceiptUrl || "");
    $("tgDetailTitle").textContent = String(ticket?.code || ticket?.id || "Phiếu").trim() || "Phiếu";
    $("tgDetailBody").innerHTML = `
      <div class="tg-detail-card">
        <div class="tg-card-title">${escapeHtml(normalizeCustomerDisplayName(ticket?.customerName || 'Khách lẻ'))}</div>
        <div class="tg-detail-meta">
          <span>${escapeHtml(ticket?.customerPhone || '')}</span>
          <span>${escapeHtml(formatContractNumberDisplay(ticket?.contractNumberText || ''))}</span>
          <span>${escapeHtml(resolveCollectedStaffName(ticket))}</span>
        </div>
        <div class="tg-pill-row">
          <span class="tg-pill ${stage}">${escapeHtml(stage === 'collect' ? 'Chưa đóng' : stage === 'pending' ? 'Chờ giao' : 'Đã giao')}</span>
          <span class="tg-pill">Thu dự kiến ${escapeHtml(formatMoney(parseExpectedAmount(ticket)))}</span>
          <span class="tg-pill">Đã đóng ${escapeHtml(formatMoney(parseCollectedAmount(ticket)))}</span>
        </div>
      </div>
      <div class="tg-detail-card">
        <div class="tg-detail-meta"><span>Mã phiếu: ${escapeHtml(ticket?.code || ticket?.id || '')}</span></div>
        <div class="tg-detail-meta"><span>Khách: ${escapeHtml(normalizeCustomerDisplayName(ticket?.customerName || 'Khách lẻ'))}</span></div>
        <div class="tg-detail-meta"><span>SĐT: ${escapeHtml(ticket?.customerPhone || '')}</span></div>
        <div class="tg-detail-meta"><span>HĐ: ${escapeHtml(formatContractNumberDisplay(ticket?.contractNumberText || ''))}</span></div>
        <div class="tg-detail-meta"><span>Nhân viên: ${escapeHtml(resolveCollectedStaffName(ticket))}</span></div>
        <div class="tg-detail-meta"><span>Cập nhật: ${escapeHtml(fmtDateTime(ticket?.cashHandoverAt || ticket?.paymentCloseAt || ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt) || '')}</span></div>
        ${ticket?.workNote ? `<div class="tg-muted">${escapeHtml(ticket.workNote)}</div>` : ''}
      </div>
      <div class="tg-grid-two">
        <div class="tg-detail-card">
          <h3 style="margin:0;color:#fff">Ảnh hợp đồng / gốc</h3>
          ${contractUrl ? `<div class="tg-preview"><img src="${escapeHtml(contractUrl)}" alt="contract" /></div><a class="btn btn-secondary" href="${escapeHtml(contractUrl)}" target="_blank" rel="noopener noreferrer">Mở ảnh gốc</a>` : '<div class="tg-empty">Chưa có ảnh gốc</div>'}
        </div>
        <div class="tg-detail-card">
          <h3 style="margin:0;color:#fff">Bill đóng tiền</h3>
          ${billUrl ? `<div class="tg-preview"><img src="${escapeHtml(billUrl)}" alt="bill" /></div><a class="btn btn-secondary" href="${escapeHtml(billUrl)}" target="_blank" rel="noopener noreferrer">Mở bill đóng tiền</a>` : '<div class="tg-empty">Chưa có bill đóng tiền</div>'}
        </div>
      </div>
    `;
    $("tgDetailCollectBtn").style.display = stage === "collect" ? "" : "none";
    $("tgDetailSingleApproveBtn").style.display = stage === "pending" ? "" : "none";
  }

  function openPrintPreviewForTicket(ticketId = "") {
    const ticket = getTicketById(ticketId);
    if (!ticket) return;
    state.previewTicketId = String(ticketId || "").trim();
    renderPrintPreviewSheet(
      buildPreviewOrderFromTicket(ticket),
      "Sẵn sàng in lại",
      "Bấm In lại nếu cần in thêm cho khách."
    );
    openSheet("tgPrintPreviewSheet");
  }

  function render() {
    syncHandoverSelectionState();
    renderModeTabs();
    renderFilterButton();
    renderHandoverSelectToggle();
    renderStaffFilter();
    renderDateRangeFilter();
    renderQuickBankFilters();
    renderFilterSheet();
    renderMainList();
    renderHandoverBulkBar();
    publishThuGopHeaderSummary();
  }

  function openDetail(ticketId = "") {
    openPrintPreviewForTicket(ticketId);
  }

  function openCollect(ticketId = "", options = {}) {
    const ticket = getTicketById(ticketId);
    if (!ticket) return;
    const readOnly = Boolean(options?.readOnly);
    state.collectId = String(ticketId || "").trim();
    state.collectReadOnly = readOnly;
    state.collectBill = null;
    state.collectBillUploadSeq = Number(state.collectBillUploadSeq || 0) + 1;
    state.collectViewportBaseHeight = getViewportHeight();
    revokeCollectBillPreviewUrl();
    $("tgCollectAmountInput").value = readOnly ? (parseBankPaidAmount(ticket) ? Number(parseBankPaidAmount(ticket)).toLocaleString("vi-VN") : "") : "";
    $("tgCollectNoteInput").value = readOnly ? getCollectSavedNote(ticket) : "";
    renderCollectWarning({ expected: parseExpectedAmount(ticket), amount: readOnly ? parseBankPaidAmount(ticket) : 0, hasBill: Boolean(getCollectBillUrl(ticket)), isAmountMatch: readOnly ? parseBankPaidAmount(ticket) === parseExpectedAmount(ticket) : false, isReady: false });
    $("tgCollectBillInput").value = "";
    updateCollectSourcePreview(getCollectSourceUrl(ticket));
    updateBillPreview(readOnly ? getCollectBillUrl(ticket) : "", { readOnly });
    applyCollectReadOnlyState(ticket);
    setCollectSheetKeyboardOpen(false);
    syncCollectCompareState();
    openSheet("tgCollectSheet");
  }

  async function createTicket() {
    if (state.createSubmitting) return;
    const customerName = normalizeCustomerDisplayName($("tgCreateCustomerName").value || "");
    const customerPhone = String($("tgCreateCustomerPhone").value || "").trim();
    const contractNumberText = String($("tgCreateContractNumber").value || "").trim();
    const deposit = Number(digitsOnly($("tgCreateDeposit").value || "")) || 0;
    const receiptInfo = String($("tgCreateReceiptInfo").value || "").trim();
    const workNote = String($("tgCreateWorkNote").value || "").trim();
    if (!state.createReceipt?.file) {
      $("tgCreateWarning").textContent = "Chưa chụp phiếu khách.";
      return;
    }
    if (!customerName) {
      $("tgCreateWarning").textContent = "Nhập tên khách hàng.";
      return;
    }
    setCreateInputValue("tgCreateCustomerName", customerName);
    const btn = $("tgSaveCreateBtn");
    const original = btn.innerHTML;
    const createdAtIso = new Date().toISOString();
    const reservedCodePromise = reserveThuGopCreateCode();
    const receiptPayloadPromise = uploadCreateReceipt().catch((error) => ({ __uploadError: error }));
    const immediateReservedCode = state.createReservedCode || "";
    state.createSubmitting = true;
    const draftPreviewOrder = buildThuGopPrintOrder({
      ticketId: "",
      orderCode: immediateReservedCode || "ĐANG TẠO...",
      createdAt: createdAtIso,
      customerName,
      customerPhone,
      contractNumberText,
      deposit,
      paidAmount: deposit,
      debtAmount: 0,
      note: [receiptInfo, workNote].filter(Boolean).join(" • "),
      actorName: state.actorName,
    });
    btn.disabled = true;
    btn.textContent = "Đang tạo...";
    renderPrintPreviewSheet(draftPreviewOrder, "Đang tạo phiếu...", "App đang lưu phiếu và đẩy lệnh in ngay khi có mã.");
    closeSheet("tgCreateSheet");
    openSheet("tgPrintPreviewSheet");
    try {
      const reservedCode = await reservedCodePromise;
      const receiptPayload = await receiptPayloadPromise;
      const result = await createThuGopTicket({
        code: reservedCode,
        status: "received",
        customerName,
        customerPhone,
        contractNumberText,
        deposit,
        estimateCost: deposit,
        price: deposit,
        customerReceivedAmount: deposit,
        customerReceivedAtMs: Date.now(),
        workNote,
        receiptInfo,
        contractImageNote: receiptInfo,
        creatorName: state.actorName,
        createdByName: state.actorName,
        staffName: state.actorName,
        lastStatusByName: state.actorName,
        cashHandoverState: THUGOP_CASH_HANDOVER_STATE.PENDING,
        cashHandoverAmount: deposit,
        cashHandoverByName: state.actorName,
        contractQrText: state.createQrText,
        createdAtIso,
        ...(receiptPayload && !receiptPayload.__uploadError ? receiptPayload : {}),
      });
      const createdRef = result?.ref;
      const createdPayload = result?.payload || {};
      const previewOrder = buildThuGopPrintOrder({
        ticketId: String(createdRef?.id || "").trim(),
        orderCode: String(createdPayload?.code || reservedCode || createdRef?.id || "").trim(),
        createdAt: createdAtIso,
        customerName,
        customerPhone,
        contractNumberText,
        deposit,
        paidAmount: deposit,
        debtAmount: 0,
        note: [receiptInfo, workNote].filter(Boolean).join(" • "),
        actorName: state.actorName,
      });
      const printMeta = await reserveThuGopPrintMeta(previewOrder);
      const printableOrder = applyThuGopPrintMeta(previewOrder, printMeta);
      const readyPreviewOrder = await renderPrintPreviewSheet(printableOrder, "Đang dựng bản in chuẩn...", "Phiếu đã tạo, app đang dựng đúng bản preview rồi mới gửi máy in.");

      const printOutcomePromise = queueThuGopPrintJob(readyPreviewOrder || printableOrder)
        .then((printResult) => {
          renderPrintPreviewSheet(
            readyPreviewOrder || printableOrder,
            `Đã gửi ${printResult?.sourceCode || printableOrder.orderCode}`,
            ""
          );
          return { ok: true, printResult };
        })
        .catch((printError) => {
          renderPrintPreviewSheet(
            readyPreviewOrder || printableOrder,
            "Gửi lệnh in lỗi",
            printError?.message || String(printError || "Lỗi in")
          );
          return { ok: false, printError };
        });

      resetCreateForm();
      const printOutcome = await printOutcomePromise;
      if (receiptPayload?.__uploadError) {
        renderPrintPreviewSheet(
          readyPreviewOrder || printableOrder,
          printOutcome?.ok ? `Đã gửi ${printOutcome?.printResult?.sourceCode || printableOrder.orderCode}` : "Gửi lệnh in lỗi",
          `Đã tạo phiếu nhưng xử lý ảnh phiếu lỗi: ${receiptPayload.__uploadError?.message || String(receiptPayload.__uploadError)}`
        );
      }
    } catch (error) {
      closeSheet("tgPrintPreviewSheet");
      openSheet("tgCreateSheet");
      $("tgCreateWarning").textContent = error?.message || String(error);
    } finally {
      state.createSubmitting = false;
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  async function singleApprove(ticketId = "") {
    const ticket = getTicketById(ticketId);
    if (!ticket) return;
    syncActorFromApp(window.__THKD_POS_CURRENT_ACTOR__ || null);
    const ok = await showUiConfirm(`Xác nhận giao tiền phiếu ${ticket.code || ticket.id}?`, {
      title: "Giao tiền",
      confirmText: "Xác nhận",
      cancelText: "Huỷ",
    });
    if (!ok) return;
    try {
      await approveThuGopCashHandoverBatch([ticket], { name: state.actorName, role: getCurrentActorRole() });
      render();
      openDetail(ticketId);
    } catch (error) {
      await showUiAlert(error?.message || String(error), { title: "Giao tiền" });
    }
  }

  async function approveSelectedHandoverTickets() {
    syncActorFromApp(window.__THKD_POS_CURRENT_ACTOR__ || null);
    const tickets = getSelectedHandoverTickets();
    if (!tickets.length) return;
    if (!state.handoverApproveTokenOpen) {
      state.handoverApproveTokenOpen = true;
      state.handoverApproveTokenError = false;
      render();
      requestAnimationFrame(() => $("tgHandoverTokenInput")?.focus());
      return;
    }
    const enteredToken = digitsOnly(state.handoverApproveTokenInput).slice(0, 6);
    if (enteredToken.length !== 6) {
      state.handoverApproveTokenError = true;
      renderHandoverBulkBar();
      requestAnimationFrame(() => $("tgHandoverTokenInput")?.focus());
      return;
    }
    state.handoverApproveTokenError = false;
    const btn = $("tgApproveSelectedBtn");
    const original = btn?.innerHTML || "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Đang duyệt...";
    }
    try {
      await verifyCurrentActorApproveToken(enteredToken);
      await approveThuGopCashHandoverBatch(tickets, { name: state.actorName, role: getCurrentActorRole() });
      state.selectedHandoverIds = [];
      resetHandoverApproveTokenState();
      render();
    } catch (error) {
      await showUiAlert(error?.message || String(error), { title: "Duyệt giao tiền" });
      renderHandoverBulkBar();
      if (state.handoverApproveTokenOpen) {
        requestAnimationFrame(() => $("tgHandoverTokenInput")?.focus());
      }
    } finally {
      if (btn) btn.innerHTML = original;
      renderHandoverBulkBar();
    }
  }

  async function saveCollectedPayment() {
    syncActorFromApp(window.__THKD_POS_CURRENT_ACTOR__ || null);
    const ticket = getTicketById(state.collectId);
    if (!ticket) {
      await showUiAlert("Không tìm thấy phiếu.", { title: "Lưu đã đóng" });
      return;
    }
    const validation = syncCollectCompareState();
    if (!(validation.amount > 0)) {
      renderCollectWarning(validation, "Nhập số tiền quản lý đã đóng hợp lệ.");
      return;
    }
    if (!validation.isAmountMatch) {
      renderCollectWarning(validation, "Cảnh báo: số tiền quản lý đóng không khớp.");
      return;
    }
    if (!validation.hasBill) {
      renderCollectWarning(validation, "Chưa có bill quản lý đóng tiền.");
      return;
    }
    const btn = $("tgSaveCollectBtn");
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Đang lưu...";
    try {
      const file = state.collectBill?.file || null;
      const billPayload = await buildCollectBillInlinePayload(file);
      if (!billPayload) {
        throw new Error("Chưa chuẩn bị được ảnh bill để lưu.");
      }
      const paymentPayload = {
        amount: validation.amount,
        billUrl: billPayload?.billUrl || "",
        billPath: billPayload?.billPath || "",
        billName: billPayload?.billName || file?.name || "bill_dong_tien.jpg",
        note: $("tgCollectNoteInput").value || "",
      };
      const previousTicket = ticket ? { ...ticket } : null;
      applyLocalCollectedPaymentToState(ticket.id, paymentPayload);
      resetCollectForm();
      closeSheet("tgCollectSheet");
      render();
      markThuGopCollectedPayment(ticket, paymentPayload, {
        name: state.actorName,
        role: getCurrentActorRole(),
      }).catch(async (error) => {
        if (previousTicket?.id) {
          state.tickets = state.tickets.map((item) => String(item?.id || "") === String(previousTicket.id || "") ? previousTicket : item);
          render();
        }
        await showUiAlert(error?.message || String(error), { title: "Đóng tiền ngân hàng" });
      });
    } catch (error) {
      renderCollectWarning(validation, error?.message || String(error));
      syncCollectCompareState();
    } finally {
      btn.innerHTML = original;
      syncCollectCompareState();
    }
  }

  function bindSheetClose(sheetId, closeBtnId, cleanup = null) {
    const handler = () => {
      if (typeof cleanup === "function") cleanup();
      closeSheet(sheetId);
    };
    $(closeBtnId)?.addEventListener("click", handler);
    $(sheetId)?.addEventListener("click", (event) => {
      if (event.target === $(sheetId)) handler();
    });
  }

  function bindEvents() {
    $("tgSearchInput").addEventListener("input", (event) => {
      state.search = String(event.target?.value || "").trim();
      render();
    });

    $("tgHandoverSelectToggle").addEventListener("change", (event) => {
      state.handoverSelectMode = Boolean(event.target?.checked);
      if (!state.handoverSelectMode) {
        state.selectedHandoverIds = [];
        resetHandoverApproveTokenState();
      }
      render();
    });

    $("tgHandoverTokenInput").addEventListener("input", (event) => {
      state.handoverApproveTokenInput = digitsOnly(event.target?.value || "").slice(0, 6);
      state.handoverApproveTokenError = false;
      event.target.value = state.handoverApproveTokenInput;
      event.target.classList.remove("is-error");
      event.target.setAttribute("aria-invalid", "false");
    });
    $("tgHandoverTokenInput").addEventListener("keydown", (event) => {
      if (String(event.key || "") !== "Enter") return;
      event.preventDefault();
      approveSelectedHandoverTickets();
    });
    $("tgHandoverTokenFillBtn").addEventListener("click", async (event) => {
      const btn = event.currentTarget;
      const original = btn?.innerHTML || '<i class="fa-solid fa-shield-halved"></i>';
      try {
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        }
        state.handoverApproveTokenInput = await fetchCurrentActorApproveToken();
        state.handoverApproveTokenError = false;
        renderHandoverBulkBar();
        requestAnimationFrame(() => $("tgHandoverTokenInput")?.focus());
      } catch (error) {
        await showUiAlert(error?.message || String(error), { title: "Lấy mã duyệt" });
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = original;
        }
      }
    });
    $("tgHandoverTokenCancelBtn").addEventListener("click", () => {
      resetHandoverApproveTokenState();
      render();
    });

    $("tgStaffFilterBtn").addEventListener("click", (event) => {
      event.stopPropagation();
      state.dateRangeFilterOpen = false;
      state.staffFilterOpen = !state.staffFilterOpen;
      renderStaffFilter();
      renderDateRangeFilter();
    });
    $("tgStaffFilterMenu").addEventListener("click", (event) => {
      const button = event.target.closest("[data-staff-filter-key]");
      if (!button) return;
      state.staffFilter = String(button.dataset.staffFilterKey || "").trim().toLocaleLowerCase("vi-VN");
      state.staffFilterOpen = false;
      render();
    });
    $("tgDateFilterWrap").addEventListener("click", (event) => {
      const button = event.target.closest("[data-date-filter-key]");
      if (!button) return;
      state.dateRangeFilter = String(button.dataset.dateFilterKey || "all").trim() || "all";
      state.dateRangeFilterOpen = false;
      render();
    });
    $("tgDateFilterBtn").addEventListener("click", (event) => {
      event.stopPropagation();
      state.staffFilterOpen = false;
      state.dateRangeFilterOpen = !state.dateRangeFilterOpen;
      renderStaffFilter();
      renderDateRangeFilter();
    });
    document.addEventListener("click", (event) => {
      let rerenderStaff = false;
      let rerenderDate = false;
      if (state.staffFilterOpen) {
        const wrap = $("tgStaffFilterWrap");
        if (!wrap?.contains(event.target)) {
          state.staffFilterOpen = false;
          rerenderStaff = true;
        }
      }
      if (state.dateRangeFilterOpen) {
        const wrap = $("tgDateFilterWrap");
        if (!wrap?.contains(event.target)) {
          state.dateRangeFilterOpen = false;
          rerenderDate = true;
        }
      }
      if (rerenderStaff) renderStaffFilter();
      if (rerenderDate) renderDateRangeFilter();
    });

    $("tgModeTabs").addEventListener("click", () => {});

    $("tgOpenFilterBtn").addEventListener("click", () => {
      state.viewMode = state.viewMode === "handover" ? "bank" : "handover";
      ensureActiveFilter();
      render();
    });
    $("tgQuickBankToggle").addEventListener("click", () => {
      if (state.viewMode === "bank") {
        state.activeFilter = state.activeFilter === "paid" ? "unpaid" : "paid";
        render();
        return;
      }
      state.activeFilter = state.activeFilter === "done" ? "pending" : "done";
      render();
    });
    $("tgFilterList").addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter-key]");
      if (!button) return;
      state.activeFilter = String(button.dataset.filterKey || "unpaid").trim() || "unpaid";
      closeSheet("tgFilterSheet");
      render();
    });

    $("tgFabCreate").addEventListener("click", async () => {
      resetCreateForm();
      openSheet("tgCreateSheet");
      state.createViewportBaseHeight = getViewportHeight();
      prefetchThuGopCreateCode();
      const started = await startCreateLiveScanner();
      if (!started) {
        setTimeout(() => {
          promptCreateReceiptCapture();
        }, 120);
      }
    });

    $("tgCreateReceiptPreview").addEventListener("click", () => {
      promptCreateReceiptCapture();
    });
    $("tgCreateReceiptPreview").addEventListener("keydown", (event) => {
      if (!["Enter", " ", "Spacebar"].includes(String(event.key || ""))) return;
      event.preventDefault();
      promptCreateReceiptCapture();
    });

    $("tgRetakeCreateReceiptBtn").addEventListener("click", () => {
      promptCreateReceiptCapture();
    });

    $("tgCreateReceiptInput").addEventListener("change", async (event) => {
      const file = event.target?.files?.[0];
      openSheet("tgCreateSheet");
      if (!file) return;
      $("tgCreateWarning").textContent = "";
      try {
        await applyCreateReceiptFile(file);
      } catch (error) {
        $("tgCreateWarning").textContent = error?.message || String(error);
      }
    });

    $("tgCreateSheet").addEventListener("focusin", () => {
      setTimeout(syncCreateSheetKeyboardState, 80);
    });
    $("tgCreateSheet").addEventListener("focusout", () => {
      setTimeout(syncCreateSheetKeyboardState, 80);
    });
    $("tgCollectSheet").addEventListener("focusin", () => {
      setTimeout(syncCollectSheetKeyboardState, 80);
    });
    $("tgCollectSheet").addEventListener("focusout", () => {
      setTimeout(syncCollectSheetKeyboardState, 80);
    });

    window.visualViewport?.addEventListener("resize", syncCreateSheetKeyboardState);
    window.visualViewport?.addEventListener("scroll", syncCreateSheetKeyboardState);
    window.addEventListener("resize", syncCreateSheetKeyboardState);
    window.visualViewport?.addEventListener("resize", syncCollectSheetKeyboardState);
    window.visualViewport?.addEventListener("scroll", syncCollectSheetKeyboardState);
    window.addEventListener("resize", syncCollectSheetKeyboardState);

    $("tgCreateCustomerName").addEventListener("blur", (event) => {
      const nextName = normalizeCustomerDisplayName(event.target?.value || "");
      if (nextName) setCreateInputValue("tgCreateCustomerName", nextName);
    });
    $("tgCreateDeposit").addEventListener("input", (event) => {
      const digits = digitsOnly(event.target.value || "");
      event.target.value = digits ? Number(digits).toLocaleString("vi-VN") : "";
    });
    $("tgSaveCreateBtn").addEventListener("click", createTicket);
    $("tgClosePreviewActionBtn").addEventListener("click", () => closeSheet("tgPrintPreviewSheet"));
    $("tgReprintBtn").addEventListener("click", reprintCurrentPreview);
    $("tgClosePromptBtn").addEventListener("click", () => finishPrompt(false));
    $("tgPromptCancelBtn").addEventListener("click", () => finishPrompt(false));
    $("tgPromptConfirmBtn").addEventListener("click", () => finishPrompt(true));
    $("tgPromptSheet").addEventListener("click", (event) => {
      if (event.target === $("tgPromptSheet")) finishPrompt(false);
    });

    $("tgHandoverSelectAll").addEventListener("change", (event) => {
      toggleAllVisibleHandoverTickets(Boolean(event.target?.checked));
      render();
    });

    $("tgMainList").addEventListener("change", (event) => {
      const checkbox = event.target.closest("[data-handover-select]");
      if (!checkbox) return;
      toggleHandoverTicketSelection(checkbox.getAttribute("data-handover-select"), Boolean(checkbox.checked));
      renderHandoverBulkBar();
    });

    $("tgMainList").addEventListener("click", (event) => {
      const handoverCheckbox = event.target.closest("[data-handover-select]");
      if (handoverCheckbox) {
        event.stopPropagation();
        return;
      }
      const collectBtn = event.target.closest("[data-open-collect]");
      if (collectBtn) {
        event.stopPropagation();
        const ticketId = collectBtn.getAttribute("data-open-collect");
        const readOnly = String(collectBtn.getAttribute("data-collect-readonly") || "") === "true";
        if (readOnly) {
          openCollect(ticketId, { readOnly: true });
        } else if (canCurrentActorCloseBankPayment()) {
          openCollect(ticketId);
        } else {
          openPrintPreviewForTicket(ticketId);
        }
        return;
      }
      const approveBtn = event.target.closest("[data-single-approve]");
      if (approveBtn) {
        event.stopPropagation();
        singleApprove(approveBtn.getAttribute("data-single-approve"));
        return;
      }
      const card = event.target.closest("[data-open-preview]");
      if (!card) return;
      openDetail(card.getAttribute("data-open-preview"));
    });

    $("tgCollectSourcePreview").addEventListener("click", () => {
      const url = sanitizeUrl($("tgCollectSourcePreview")?.dataset?.sourceUrl || "");
      if (!url) return;
      openCollectImageViewer(url, "Ảnh nhân viên tạo phiếu");
    });
    $("tgCollectSourcePreview").addEventListener("keydown", (event) => {
      if (!["Enter", " ", "Spacebar"].includes(String(event.key || ""))) return;
      event.preventDefault();
      const url = sanitizeUrl($("tgCollectSourcePreview")?.dataset?.sourceUrl || "");
      if (!url) return;
      openCollectImageViewer(url, "Ảnh nhân viên tạo phiếu");
    });
    $("tgCollectBillPreview").addEventListener("click", () => {
      const url = sanitizeUrl($("tgCollectBillPreview")?.dataset?.sourceUrl || "");
      if (state.collectReadOnly) {
        if (!url) return;
        openCollectImageViewer(url, "Bill quản lý đóng tiền");
        return;
      }
      $("tgCollectBillInput").click();
    });
    $("tgCollectBillPreview").addEventListener("keydown", (event) => {
      if (!["Enter", " ", "Spacebar"].includes(String(event.key || ""))) return;
      event.preventDefault();
      const url = sanitizeUrl($("tgCollectBillPreview")?.dataset?.sourceUrl || "");
      if (state.collectReadOnly) {
        if (!url) return;
        openCollectImageViewer(url, "Bill quản lý đóng tiền");
        return;
      }
      $("tgCollectBillInput").click();
    });
    $("tgCollectBillInput").addEventListener("change", (event) => {
      if (state.collectReadOnly) {
        event.target.value = "";
        return;
      }
      const file = event.target?.files?.[0];
      if (!file) {
        state.collectBill = null;
        state.collectBillUploadSeq = Number(state.collectBillUploadSeq || 0) + 1;
        revokeCollectBillPreviewUrl();
        updateBillPreview("");
        syncCollectCompareState();
        return;
      }
      state.collectBill = {
        file,
        uploadSeq: 0,
        uploadPromise: null,
        uploaded: null,
        uploadError: null,
      };
      revokeCollectBillPreviewUrl();
      try {
        state.collectBillPreviewUrl = URL.createObjectURL(file);
        updateBillPreview(state.collectBillPreviewUrl);
      } catch (_) {
        state.collectBillPreviewUrl = "";
        updateBillPreview("");
      }
      syncCollectCompareState();
    });
    $("tgCollectAmountInput").addEventListener("input", (event) => {
      const digits = digitsOnly(event.target.value || "");
      event.target.value = digits ? Number(digits).toLocaleString("vi-VN") : "";
      syncCollectCompareState();
    });
    $("tgSaveCollectBtn").addEventListener("click", saveCollectedPayment);
    $("tgApproveSelectedBtn").addEventListener("click", approveSelectedHandoverTickets);

    bindSheetClose("tgFilterSheet", "tgCloseFilterBtn");
    bindSheetClose("tgDetailSheet", "tgCloseDetailBtn");
    bindSheetClose("tgCollectSheet", "tgCloseCollectBtn", resetCollectForm);
    bindSheetClose("tgCollectImageSheet", "tgCloseCollectImageBtn", () => {
      const viewer = $("tgCollectImageViewer");
      if (viewer) viewer.innerHTML = "";
    });
    bindSheetClose("tgCreateSheet", "tgCloseCreateBtn", resetCreateForm);
    bindSheetClose("tgPrintPreviewSheet", "tgClosePrintPreviewBtn");

    window.addEventListener("thkd:actor-changed", (event) => {
      syncActorFromApp(event?.detail || null);
      render();
    });
  }

  function boot() {
    mountSheetsToBody();
    syncActorFromApp(window.__THKD_POS_CURRENT_ACTOR__ || null);
    window.__THKD_THUGOP__ = {
      getHeaderSummary: getThuGopHeaderSummary,
      setHeaderStaffFilter: applyThuGopHeaderStaffFilter,
    };
    bindEvents();
    observeThuGopTickets((rows) => {
      state.tickets = Array.isArray(rows) ? rows.slice() : [];
      render();
    }, (error) => console.error("observeThuGopTickets error", error));
    observeThuGopCashHandoverLogs((rows) => {
      state.logs = Array.isArray(rows) ? rows.slice() : [];
      render();
    }, (error) => console.error("observeThuGopCashHandoverLogs error", error));
    render();
  }

  boot();
}
