import {
  observeThuMayTickets,
  createThuMayTicket,
  saveThuMayProgressUpdate,
  approveThuMayTickets,
} from "./legacy-core/thumay-repo.js";

const host = document.getElementById("thumayRootHost");
const POS_SESSION_TOKEN_STORAGE_KEY = "thkd_pos_session_token";
const POS_SESSION_ENDPOINT = "/internal/pos/session";
const HANDOVER_PROGRESS = {
  PROCESSING: "processing",
  STOCK_IN: "stock_in",
  LIQUIDATION: "liquidation",
  RETURN_NCC: "return_ncc",
};
const REVIEW_PROGRESS = new Set([
  HANDOVER_PROGRESS.STOCK_IN,
  HANDOVER_PROGRESS.LIQUIDATION,
  HANDOVER_PROGRESS.RETURN_NCC,
]);

if (!host) {
  // noop on pages that do not embed this module
} else {
  host.innerHTML = `
    <style>
      #thumayRootHost {
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
      }
      .tm-shell {
        --tm-bg: #000;
        --tm-card: linear-gradient(180deg, rgba(18,18,18,.96), rgba(9,9,9,.98));
        --tm-line: rgba(234,179,8,.18);
        --tm-text: #f8fafc;
        --tm-muted: rgba(255,255,255,.58);
        --tm-accent: #fbbf24;
        --tm-accent-strong: #eab308;
        --tm-blue: #60a5fa;
        --tm-success: #34d399;
        --tm-danger: #f87171;
        --tm-shadow: 0 18px 36px rgba(0, 0, 0, .34);
        color: var(--tm-text);
        background: #000;
        font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        min-height: calc(100dvh - 220px);
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 2px 0 calc(18px + env(safe-area-inset-bottom, 0px));
      }
      .tm-topbar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: grid;
        gap: 10px;
        background: linear-gradient(180deg, rgba(0,0,0,.96), rgba(0,0,0,.82), rgba(0,0,0,.18), rgba(0,0,0,0));
        backdrop-filter: blur(12px);
        padding-bottom: 4px;
      }
      .tm-hero {
        border: 1px solid var(--tm-line);
        background: linear-gradient(135deg, rgba(251,191,36,.16), rgba(30,41,59,.3));
        border-radius: 24px;
        padding: 14px;
        display: grid;
        gap: 12px;
        box-shadow: var(--tm-shadow);
      }
      .tm-hero-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .tm-eyebrow {
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .16em;
        text-transform: uppercase;
        color: #f8d56b;
      }
      .tm-title {
        margin: 4px 0 0;
        font-size: 25px;
        font-weight: 900;
        line-height: 1.02;
      }
      .tm-sub {
        margin: 6px 0 0;
        color: var(--tm-muted);
        font-size: 13px;
      }
      .tm-create-btn,
      .tm-primary-btn,
      .tm-ghost-btn,
      .tm-small-btn,
      .tm-tab-btn,
      .tm-filter-chip,
      .tm-sheet-close {
        border: 0;
        cursor: pointer;
        font: inherit;
      }
      .tm-create-btn,
      .tm-primary-btn {
        min-height: 44px;
        border-radius: 16px;
        padding: 0 16px;
        background: linear-gradient(135deg, #fbbf24, #eab308);
        color: #111827;
        font-size: 14px;
        font-weight: 900;
        box-shadow: 0 14px 28px rgba(234,179,8,.2);
        white-space: nowrap;
      }
      .tm-ghost-btn,
      .tm-small-btn {
        min-height: 42px;
        border-radius: 16px;
        padding: 0 14px;
        background: rgba(255,255,255,.06);
        color: var(--tm-text);
        border: 1px solid rgba(255,255,255,.08);
        font-size: 13px;
        font-weight: 800;
      }
      .tm-small-btn {
        min-height: 38px;
        padding: 0 12px;
      }
      .tm-toolbar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
      }
      .tm-search,
      .tm-input,
      .tm-select,
      .tm-textarea {
        width: 100%;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.06);
        color: var(--tm-text);
        padding: 14px 16px;
        font: inherit;
        outline: none;
      }
      .tm-search::placeholder,
      .tm-input::placeholder,
      .tm-textarea::placeholder {
        color: rgba(255,255,255,.38);
      }
      .tm-actor-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 8px;
        align-items: center;
      }
      .tm-status-text {
        color: #f8d56b;
        font-size: 12px;
        font-weight: 800;
        min-width: 56px;
        text-align: right;
      }
      .tm-summary-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .tm-summary-card {
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,.06);
        background: rgba(255,255,255,.05);
        padding: 12px;
        display: grid;
        gap: 6px;
      }
      .tm-summary-card span {
        font-size: 11px;
        font-weight: 800;
        color: var(--tm-muted);
      }
      .tm-summary-card b {
        font-size: 24px;
        line-height: 1;
      }
      .tm-tabs {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .tm-tab-btn {
        min-height: 42px;
        border-radius: 16px;
        padding: 0 12px;
        background: rgba(255,255,255,.05);
        color: var(--tm-text);
        border: 1px solid rgba(255,255,255,.08);
        font-size: 13px;
        font-weight: 900;
      }
      .tm-tab-btn.active {
        background: linear-gradient(135deg, rgba(251,191,36,.98), rgba(234,179,8,.94));
        color: #111827;
        border-color: transparent;
      }
      .tm-filter-wrap {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }
      .tm-filter-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .tm-filter-chip {
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        background: rgba(255,255,255,.04);
        color: var(--tm-text);
        border: 1px solid rgba(255,255,255,.08);
        font-size: 12px;
        font-weight: 900;
      }
      .tm-filter-chip.active {
        background: rgba(96,165,250,.16);
        color: #dbeafe;
        border-color: rgba(96,165,250,.34);
      }
      .tm-filter-meta {
        color: #f8d56b;
        font-size: 12px;
        font-weight: 900;
      }
      .tm-list {
        display: grid;
        gap: 10px;
        padding-bottom: 78px;
      }
      .tm-card,
      .tm-sheet-card {
        border-radius: 22px;
        border: 1px solid var(--tm-line);
        background: var(--tm-card);
        box-shadow: var(--tm-shadow);
        padding: 14px;
        display: grid;
        gap: 12px;
      }
      .tm-card {
        cursor: pointer;
      }
      .tm-card:active {
        transform: scale(.995);
      }
      .tm-card-head,
      .tm-card-actions,
      .tm-sheet-head,
      .tm-sheet-actions,
      .tm-bulkbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .tm-ticket-title {
        font-size: 16px;
        font-weight: 900;
      }
      .tm-ticket-meta,
      .tm-detail-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        color: var(--tm-muted);
        font-size: 12px;
      }
      .tm-money {
        font-size: 21px;
        font-weight: 900;
        color: #fde68a;
        text-align: right;
      }
      .tm-pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .tm-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 30px;
        padding: 0 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.05);
        color: var(--tm-text);
      }
      .tm-pill.processing {
        color: #fde68a;
        background: rgba(251,191,36,.14);
        border-color: rgba(251,191,36,.22);
      }
      .tm-pill.review {
        color: #dbeafe;
        background: rgba(96,165,250,.14);
        border-color: rgba(96,165,250,.26);
      }
      .tm-pill.completed {
        color: #d1fae5;
        background: rgba(52,211,153,.14);
        border-color: rgba(52,211,153,.22);
      }
      .tm-hint {
        color: var(--tm-muted);
        font-size: 12px;
      }
      .tm-check {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        font-weight: 800;
      }
      .tm-check input {
        width: 18px;
        height: 18px;
        accent-color: #60a5fa;
      }
      .tm-empty {
        padding: 22px 16px;
        border-radius: 22px;
        border: 1px dashed rgba(255,255,255,.16);
        color: var(--tm-muted);
        text-align: center;
        font-size: 13px;
      }
      .tm-sheet {
        position: fixed;
        inset: 0;
        z-index: 90;
        display: none;
        align-items: flex-end;
        justify-content: center;
        padding: 14px;
        background: rgba(0,0,0,.58);
      }
      .tm-sheet.open {
        display: flex;
      }
      .tm-sheet-panel {
        width: min(100%, 760px);
        max-height: min(90vh, 940px);
        overflow: auto;
        border-radius: 28px;
        border: 1px solid var(--tm-line);
        background: linear-gradient(180deg, rgba(17,17,17,.98), rgba(7,7,7,.98));
        color: var(--tm-text);
        padding: 16px;
        display: grid;
        gap: 14px;
        box-shadow: 0 32px 80px rgba(0,0,0,.5);
      }
      .tm-sheet-close {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        background: rgba(255,255,255,.06);
        color: var(--tm-text);
        border: 1px solid rgba(255,255,255,.08);
        font-size: 20px;
      }
      .tm-field-grid,
      .tm-detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .tm-field {
        display: grid;
        gap: 8px;
      }
      .tm-field label {
        font-size: 12px;
        font-weight: 800;
        color: #f8d56b;
      }
      .tm-textarea {
        min-height: 92px;
        resize: vertical;
      }
      .tm-bulkbar {
        position: sticky;
        bottom: 0;
        z-index: 4;
        border: 1px solid rgba(96,165,250,.22);
        background: linear-gradient(180deg, rgba(15,23,42,.96), rgba(2,6,23,.98));
        border-radius: 18px;
        padding: 12px 14px calc(12px + env(safe-area-inset-bottom, 0px));
        box-shadow: 0 18px 36px rgba(0,0,0,.38);
      }
      .tm-bulkbar.hidden,
      .tm-filter-wrap.hidden {
        display: none !important;
      }
      .tm-bulk-meta {
        display: grid;
        gap: 2px;
      }
      .tm-bulk-meta strong {
        font-size: 14px;
      }
      .tm-bulk-meta span {
        font-size: 12px;
        color: var(--tm-muted);
      }
      @media (max-width: 640px) {
        .tm-hero-head,
        .tm-toolbar,
        .tm-actor-row,
        .tm-card-head,
        .tm-card-actions,
        .tm-sheet-head,
        .tm-sheet-actions,
        .tm-bulkbar,
        .tm-filter-wrap {
          grid-template-columns: 1fr;
          flex-direction: column;
          align-items: stretch;
        }
        .tm-summary-grid,
        .tm-field-grid,
        .tm-detail-grid {
          grid-template-columns: 1fr 1fr;
        }
        .tm-summary-card b {
          font-size: 20px;
        }
        .tm-money {
          text-align: left;
          font-size: 18px;
        }
        .tm-sheet {
          padding: 10px;
        }
      }
    </style>

    <div class="tm-shell">
      <header class="tm-topbar">
        <div class="tm-hero">
          <div class="tm-hero-head">
            <div>
              <div class="tm-eyebrow">THKD main module</div>
              <div class="tm-title">Thu máy</div>
              <p class="tm-sub">Lấy dữ liệu trực tiếp từ Thu máy, nhưng giao diện mới trong app chính theo phong cách Thu góp.</p>
            </div>
            <button id="tmOpenCreateBtn" class="tm-create-btn" type="button">+ Phiếu mới</button>
          </div>

          <div class="tm-toolbar">
            <input id="tmSearchInput" class="tm-search" type="search" placeholder="Tìm mã phiếu, khách, model, IMEI" />
            <button id="tmRefreshBtn" class="tm-ghost-btn" type="button">Làm mới</button>
          </div>

          <div class="tm-actor-row">
            <input id="tmActorNameInput" class="tm-input" type="text" maxlength="60" placeholder="Tên người thao tác" />
            <button id="tmSaveActorBtn" class="tm-ghost-btn" type="button">Lưu tên</button>
            <div id="tmSaveActorStatus" class="tm-status-text"></div>
          </div>

          <div class="tm-summary-grid">
            <div class="tm-summary-card"><span>Đang xử lý</span><b id="tmProcessingCount">0</b></div>
            <div class="tm-summary-card"><span>Chờ duyệt</span><b id="tmReviewCount">0</b></div>
            <div class="tm-summary-card"><span>Đã duyệt</span><b id="tmCompletedCount">0</b></div>
            <div class="tm-summary-card"><span>Đã chọn</span><b id="tmSelectedCount">0</b></div>
          </div>

          <div class="tm-tabs">
            <button class="tm-tab-btn active" type="button" data-tm-tab="processing">Đang xử lý</button>
            <button class="tm-tab-btn" type="button" data-tm-tab="review">Chờ duyệt</button>
            <button class="tm-tab-btn" type="button" data-tm-tab="completed">Đã duyệt</button>
          </div>

          <div id="tmReviewFiltersWrap" class="tm-filter-wrap hidden">
            <div class="tm-filter-row">
              <button class="tm-filter-chip active" type="button" data-review-filter="all">Tất cả</button>
              <button class="tm-filter-chip" type="button" data-review-filter="stock_in">Nhập kho</button>
              <button class="tm-filter-chip" type="button" data-review-filter="liquidation">Thanh lý</button>
              <button class="tm-filter-chip" type="button" data-review-filter="return_ncc">Trả NCC</button>
            </div>
            <div id="tmSelectedMeta" class="tm-filter-meta">0 phiếu</div>
          </div>
        </div>
      </header>

      <section id="tmList" class="tm-list"></section>

      <div id="tmBulkBar" class="tm-bulkbar hidden">
        <div class="tm-bulk-meta">
          <strong id="tmBulkTitle">Chưa chọn phiếu</strong>
          <span id="tmBulkHint">Chọn phiếu ở tab chờ duyệt để duyệt hàng loạt.</span>
        </div>
        <button id="tmApproveSelectedBtn" class="tm-primary-btn" type="button">Duyệt đã chọn</button>
      </div>
    </div>

    <div id="tmDetailSheet" class="tm-sheet" aria-hidden="true">
      <div class="tm-sheet-panel">
        <div class="tm-sheet-head">
          <div>
            <div class="tm-eyebrow">Chi tiết phiếu</div>
            <div id="tmDetailTitle" class="tm-title" style="font-size:22px">Phiếu</div>
          </div>
          <button id="tmCloseDetailBtn" class="tm-sheet-close" type="button">×</button>
        </div>
        <div id="tmDetailBody"></div>
        <div class="tm-sheet-actions">
          <button id="tmDetailUpdateBtn" class="tm-primary-btn" type="button">Cập nhật tiến độ</button>
          <button id="tmDetailApproveBtn" class="tm-ghost-btn" type="button">Duyệt phiếu này</button>
        </div>
      </div>
    </div>

    <div id="tmProgressSheet" class="tm-sheet" aria-hidden="true">
      <div class="tm-sheet-panel">
        <div class="tm-sheet-head">
          <div>
            <div class="tm-eyebrow">Cập nhật tiến độ</div>
            <div id="tmProgressTitle" class="tm-title" style="font-size:22px">Phiếu</div>
          </div>
          <button id="tmCloseProgressBtn" class="tm-sheet-close" type="button">×</button>
        </div>

        <div class="tm-field-grid">
          <div class="tm-field">
            <label>Tiến độ</label>
            <select id="tmProgressSelect" class="tm-select">
              <option value="processing">Đang xử lý</option>
              <option value="stock_in">Nhập kho</option>
              <option value="liquidation">Thanh lý</option>
              <option value="return_ncc">Trả NCC</option>
            </select>
          </div>
          <div class="tm-field">
            <label>Giá mua</label>
            <input id="tmBuyPriceInput" class="tm-input" type="text" inputmode="numeric" placeholder="0" />
          </div>
        </div>

        <div id="tmAssigneeField" class="tm-field">
          <label>Người xử lý</label>
          <input id="tmAssigneeInput" class="tm-input" type="text" placeholder="Tên người xử lý" />
        </div>

        <div id="tmProgressInfoField" class="tm-field" style="display:none">
          <label id="tmProgressInfoLabel">Thông tin thêm</label>
          <input id="tmProgressInfoInput" class="tm-input" type="text" placeholder="Nhập thông tin" />
        </div>

        <div class="tm-field">
          <label>Ghi chú</label>
          <textarea id="tmProgressNoteInput" class="tm-textarea" placeholder="Ghi chú cập nhật"></textarea>
        </div>

        <div class="tm-sheet-actions">
          <button id="tmSaveProgressBtn" class="tm-primary-btn" type="button">Lưu cập nhật</button>
        </div>
      </div>
    </div>

    <div id="tmCreateSheet" class="tm-sheet" aria-hidden="true">
      <div class="tm-sheet-panel">
        <div class="tm-sheet-head">
          <div>
            <div class="tm-eyebrow">Phiếu mới</div>
            <div class="tm-title" style="font-size:22px">Tạo phiếu Thu máy</div>
          </div>
          <button id="tmCloseCreateBtn" class="tm-sheet-close" type="button">×</button>
        </div>

        <div class="tm-field-grid">
          <div class="tm-field">
            <label>Loại phiếu</label>
            <select id="tmCreateTypeSelect" class="tm-select">
              <option value="repair">Thu ngoài</option>
              <option value="warranty">Đổi máy</option>
            </select>
          </div>
          <div class="tm-field">
            <label>Giá mua</label>
            <input id="tmCreateBuyPrice" class="tm-input" type="text" inputmode="numeric" placeholder="0" />
          </div>
        </div>

        <div class="tm-field-grid">
          <div class="tm-field">
            <label>Khách hàng</label>
            <input id="tmCreateCustomerName" class="tm-input" type="text" placeholder="Tên khách" />
          </div>
          <div class="tm-field">
            <label>Số điện thoại</label>
            <input id="tmCreateCustomerPhone" class="tm-input" type="tel" placeholder="Số điện thoại" />
          </div>
        </div>

        <div class="tm-field-grid">
          <div class="tm-field">
            <label>Model máy</label>
            <input id="tmCreateModel" class="tm-input" type="text" placeholder="Ví dụ: iPhone 13 Pro Max" />
          </div>
          <div class="tm-field">
            <label>IMEI</label>
            <input id="tmCreateImei" class="tm-input" type="text" placeholder="IMEI / Serial" />
          </div>
        </div>

        <div class="tm-field-grid">
          <div class="tm-field">
            <label>Mật khẩu máy</label>
            <input id="tmCreateDevicePass" class="tm-input" type="text" placeholder="Nếu có" />
          </div>
          <div class="tm-field">
            <label>Ghi chú thêm</label>
            <input id="tmCreateWorkNote" class="tm-input" type="text" placeholder="Ghi chú ngắn" />
          </div>
        </div>

        <div class="tm-field">
          <label>Lỗi / mô tả máy</label>
          <textarea id="tmCreateSymptom" class="tm-textarea" placeholder="Mô tả tình trạng máy"></textarea>
        </div>

        <div id="tmCreateWarning" class="tm-hint" style="color:#fca5a5"></div>

        <div class="tm-sheet-actions">
          <button id="tmSaveCreateBtn" class="tm-primary-btn" type="button">Tạo phiếu</button>
        </div>
      </div>
    </div>
  `;

  const $ = (id) => document.getElementById(id);
  const state = {
    tickets: [],
    search: "",
    actorName: localStorage.getItem("thkd_thumay_actor_name") || "NV",
    detailId: "",
    progressId: "",
    selected: new Set(),
    reviewFilter: "all",
    activeTab: "processing",
  };

  const formatMoney = (value = 0) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
  const digitsOnly = (value = "") => String(value || "").replace(/\D+/g, "");

  function getStoredPosSessionToken() {
    try {
      return String(localStorage.getItem(POS_SESSION_TOKEN_STORAGE_KEY) || "").trim();
    } catch (_) {
      return "";
    }
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
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(ms));
    } catch (_) {
      return new Date(ms).toLocaleString("vi-VN");
    }
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

  function updateActorName(nextName = "") {
    const raw = String(nextName || "").trim();
    state.actorName = raw || "NV";
    if ($("tmActorNameInput")) $("tmActorNameInput").value = state.actorName;
  }

  function syncActorFromApp(actor = null) {
    const name = String(
      actor?.name ||
      actor?.displayName ||
      window.__THKD_POS_CURRENT_ACTOR__?.name ||
      localStorage.getItem("thkd_thumay_actor_name") ||
      document.getElementById("userName")?.textContent ||
      "NV"
    ).trim();
    updateActorName(name);
  }

  async function syncActorFromSession() {
    const token = getStoredPosSessionToken();
    if (!token) {
      syncActorFromApp(window.__THKD_POS_CURRENT_ACTOR__ || null);
      return;
    }
    try {
      const response = await fetch(POS_SESSION_ENDPOINT, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`SESSION_${response.status}`);
      const data = await response.json();
      syncActorFromApp(data?.actor || null);
    } catch (_) {
      syncActorFromApp(window.__THKD_POS_CURRENT_ACTOR__ || null);
    }
  }

  function normalizeProgress(ticket = {}) {
    const raw = String(ticket?.handoverProgress || "").trim();
    return Object.values(HANDOVER_PROGRESS).includes(raw) ? raw : HANDOVER_PROGRESS.PROCESSING;
  }

  function progressLabel(value = "") {
    const key = String(value || "").trim();
    if (key === HANDOVER_PROGRESS.STOCK_IN) return "Nhập kho";
    if (key === HANDOVER_PROGRESS.LIQUIDATION) return "Thanh lý";
    if (key === HANDOVER_PROGRESS.RETURN_NCC) return "Trả NCC";
    return "Đang xử lý";
  }

  function progressInfoLabel(value = "") {
    const key = String(value || "").trim();
    if (key === HANDOVER_PROGRESS.STOCK_IN) return "Mã phút nhập";
    if (key === HANDOVER_PROGRESS.LIQUIDATION) return "Số tiền thanh lý";
    if (key === HANDOVER_PROGRESS.RETURN_NCC) return "Nhà cung cấp";
    return "Thông tin thêm";
  }

  function ticketPrice(ticket = {}) {
    return Number(ticket?.deposit || ticket?.estimateCost || ticket?.price || 0) || 0;
  }

  function resolveAssignedName(ticket = {}) {
    return String(
      ticket?.handoverToName ||
      ticket?.techName ||
      ticket?.lastStatusByName ||
      ticket?.creatorName ||
      ticket?.createdByName ||
      ticket?.staffName ||
      ""
    ).trim() || "Chưa gán";
  }

  function resolveChairmanName(ticket = {}) {
    return String(ticket?.chairmanApprovedByName || ticket?.lastStatusByName || "").trim() || "Chủ tịch";
  }

  function chairmanApprovedAt(ticket = {}) {
    return ticket?.chairmanApprovedAt || ticket?.handoverApprovedAt || ticket?.reviewedByChairmanAt || ticket?.approvedAt || ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt;
  }

  function getTicketById(ticketId = "") {
    const id = String(ticketId || "").trim();
    return state.tickets.find((ticket) => String(ticket?.id || "").trim() === id) || null;
  }

  function getStage(ticket = {}) {
    if (String(ticket?.status || "") === "delivered" || ticket?.active === false) return "completed";
    if (ticket?.chairmanApprovedAt || ticket?.reviewedByChairmanAt || ticket?.approvedAt || ticket?.handoverApprovedAt) return "completed";
    if (REVIEW_PROGRESS.has(normalizeProgress(ticket))) return "review";
    return "processing";
  }

  function buildSearchBlob(ticket = {}) {
    return [
      ticket?.code,
      ticket?.customerName,
      ticket?.customerPhone,
      ticket?.model,
      ticket?.imei,
      ticket?.symptom,
      ticket?.workNote,
      resolveAssignedName(ticket),
      resolveChairmanName(ticket),
    ].map((x) => String(x || "").trim().toLowerCase()).join(" ");
  }

  function getVisibleTickets() {
    const term = state.search.trim().toLowerCase();
    const filtered = term ? state.tickets.filter((ticket) => buildSearchBlob(ticket).includes(term)) : state.tickets.slice();
    return filtered.sort((a, b) => toMillis(b?.updatedAt || b?.sortAt || b?.createdAt) - toMillis(a?.updatedAt || a?.sortAt || a?.createdAt));
  }

  function getFilteredTickets(stage = "all") {
    const source = getVisibleTickets();
    if (stage === "processing") return source.filter((ticket) => getStage(ticket) === "processing");
    if (stage === "review") {
      const items = source.filter((ticket) => getStage(ticket) === "review");
      if (state.reviewFilter === "all") return items;
      return items.filter((ticket) => normalizeProgress(ticket) === state.reviewFilter);
    }
    if (stage === "completed") {
      return source.filter((ticket) => getStage(ticket) === "completed").sort((a, b) => toMillis(chairmanApprovedAt(b)) - toMillis(chairmanApprovedAt(a)));
    }
    return source;
  }

  function openSheet(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
  }

  function closeSheet(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
  }

  function ticketMetaHtml(ticket = {}) {
    return [
      ticket?.customerName || "Khách lẻ",
      ticket?.model || "Chưa có model",
      resolveAssignedName(ticket),
      fmtDateTime(ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt),
    ].filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
  }

  function reviewExtraHtml(ticket = {}) {
    const progress = normalizeProgress(ticket);
    if (progress === HANDOVER_PROGRESS.LIQUIDATION && String(ticket?.handoverProgressInfo || "").trim()) {
      const amount = Number(digitsOnly(ticket.handoverProgressInfo)) || 0;
      return `<span class="tm-pill">Thanh lý ${escapeHtml(amount > 0 ? formatMoney(amount) : ticket.handoverProgressInfo)}</span>`;
    }
    if ((progress === HANDOVER_PROGRESS.STOCK_IN || progress === HANDOVER_PROGRESS.RETURN_NCC) && String(ticket?.handoverProgressInfo || "").trim()) {
      return `<span class="tm-pill">${escapeHtml(ticket.handoverProgressInfo)}</span>`;
    }
    return "";
  }

  function getHistoryRows(ticket = {}) {
    const rows = Array.isArray(ticket?.statusHistory) ? ticket.statusHistory.slice() : [];
    return rows
      .map((item, index) => ({
        id: `${String(ticket?.id || "ticket")}::${index}`,
        label: String(item?.toLabel || item?.to || item?.status || progressLabel(ticket?.handoverProgress || "processing") || "Cập nhật").trim() || "Cập nhật",
        note: String(item?.note || "").trim(),
        user: String(item?.user || item?.byName || item?.actorName || "").trim(),
        at: item?.atMillis || item?.at || item?.createdAt || item?.updatedAt || null,
      }))
      .sort((a, b) => toMillis(b.at) - toMillis(a.at));
  }

  function renderHistoryHtml(ticket = {}) {
    const rows = getHistoryRows(ticket);
    if (!rows.length) return '<div class="tm-empty">Chưa có lịch sử cập nhật.</div>';
    return rows.map((item) => `
      <div class="tm-sheet-card">
        <div class="tm-detail-meta"><span>${escapeHtml(item.label)}</span><span>${escapeHtml(fmtDateTime(item.at) || "")}</span>${item.user ? `<span>${escapeHtml(item.user)}</span>` : ""}</div>
        ${item.note ? `<div class="tm-hint">${escapeHtml(item.note)}</div>` : ""}
      </div>
    `).join("");
  }

  function syncSelection() {
    const visibleIds = new Set(getFilteredTickets("review").map((ticket) => String(ticket?.id || "").trim()));
    state.selected = new Set(Array.from(state.selected).filter((id) => visibleIds.has(id)));
    const selectedTickets = getFilteredTickets("review").filter((ticket) => state.selected.has(String(ticket?.id || "").trim()));
    const liquidationTotal = selectedTickets.reduce((sum, ticket) => {
      if (normalizeProgress(ticket) !== HANDOVER_PROGRESS.LIQUIDATION) return sum;
      return sum + (Number(digitsOnly(ticket?.handoverProgressInfo || "")) || 0);
    }, 0);

    $("tmSelectedCount").textContent = String(selectedTickets.length);
    $("tmSelectedMeta").textContent = selectedTickets.length
      ? `${selectedTickets.length} phiếu${liquidationTotal > 0 ? ` • ${formatMoney(liquidationTotal)}` : ""}`
      : "0 phiếu";

    const bulkBar = $("tmBulkBar");
    const showBulk = state.activeTab === "review" && selectedTickets.length > 0;
    bulkBar.classList.toggle("hidden", !showBulk);
    $("tmBulkTitle").textContent = showBulk ? `Đã chọn ${selectedTickets.length} phiếu` : "Chưa chọn phiếu";
    $("tmBulkHint").textContent = showBulk
      ? `Duyệt hàng loạt${liquidationTotal > 0 ? ` • Tổng thanh lý ${formatMoney(liquidationTotal)}` : ""}`
      : "Chọn phiếu ở tab chờ duyệt để duyệt hàng loạt.";
  }

  function renderSummary() {
    $("tmProcessingCount").textContent = String(state.tickets.filter((ticket) => getStage(ticket) === "processing").length);
    $("tmReviewCount").textContent = String(state.tickets.filter((ticket) => getStage(ticket) === "review").length);
    $("tmCompletedCount").textContent = String(state.tickets.filter((ticket) => getStage(ticket) === "completed").length);
    syncSelection();
  }

  function renderTabs() {
    document.querySelectorAll("[data-tm-tab]").forEach((button) => {
      button.classList.toggle("active", String(button.dataset.tmTab || "") === state.activeTab);
    });
    $("tmReviewFiltersWrap").classList.toggle("hidden", state.activeTab !== "review");
  }

  function renderReviewFilters() {
    document.querySelectorAll("[data-review-filter]").forEach((button) => {
      button.classList.toggle("active", String(button.dataset.reviewFilter || "") === state.reviewFilter);
    });
  }

  function getCurrentListItems() {
    if (state.activeTab === "completed") return getFilteredTickets("completed").slice(0, 60);
    if (state.activeTab === "review") return getFilteredTickets("review").slice(0, 120);
    return getFilteredTickets("processing").slice(0, 120);
  }

  function renderProcessingCard(ticket = {}) {
    return `
      <article class="tm-card" data-open-detail="${escapeHtml(ticket?.id || "")}">
        <div class="tm-card-head">
          <div>
            <div class="tm-ticket-title">${escapeHtml(ticket?.code || ticket?.id || "Phiếu")}</div>
            <div class="tm-ticket-meta">${ticketMetaHtml(ticket)}</div>
          </div>
          <div class="tm-money">${escapeHtml(formatMoney(ticketPrice(ticket)))}</div>
        </div>
        <div class="tm-pill-row">
          <span class="tm-pill processing">Đang xử lý</span>
          <span class="tm-pill">${escapeHtml(progressLabel(normalizeProgress(ticket)))}</span>
          ${ticket?.imei ? `<span class="tm-pill">${escapeHtml(ticket.imei)}</span>` : ""}
        </div>
        <div class="tm-card-actions">
          <div class="tm-hint">${escapeHtml(ticket?.symptom || ticket?.workNote || "Chưa có ghi chú")}</div>
          <button class="tm-small-btn" type="button" data-open-progress="${escapeHtml(ticket?.id || "")}">Cập nhật</button>
        </div>
      </article>
    `;
  }

  function renderReviewCard(ticket = {}) {
    const id = String(ticket?.id || "").trim();
    const checked = state.selected.has(id) ? "checked" : "";
    return `
      <article class="tm-card" data-open-detail="${escapeHtml(id)}">
        <div class="tm-card-head">
          <div>
            <div class="tm-ticket-title">${escapeHtml(ticket?.code || id || "Phiếu")}</div>
            <div class="tm-ticket-meta">${ticketMetaHtml(ticket)}</div>
          </div>
          <div class="tm-money">${escapeHtml(formatMoney(ticketPrice(ticket)))}</div>
        </div>
        <div class="tm-pill-row">
          <span class="tm-pill review">Chờ duyệt</span>
          <span class="tm-pill">${escapeHtml(progressLabel(normalizeProgress(ticket)))}</span>
          ${reviewExtraHtml(ticket)}
        </div>
        <div class="tm-card-actions">
          <label class="tm-check">
            <input class="tm-ticket-select" type="checkbox" data-id="${escapeHtml(id)}" ${checked} />
            Chọn phiếu này
          </label>
          <button class="tm-small-btn" type="button" data-single-approve="${escapeHtml(id)}">Duyệt phiếu này</button>
        </div>
      </article>
    `;
  }

  function renderCompletedCard(ticket = {}) {
    return `
      <article class="tm-card" data-open-detail="${escapeHtml(ticket?.id || "")}">
        <div class="tm-card-head">
          <div>
            <div class="tm-ticket-title">${escapeHtml(ticket?.code || ticket?.id || "Phiếu")}</div>
            <div class="tm-ticket-meta">
              <span>${escapeHtml(ticket?.customerName || "Khách lẻ")}</span>
              <span>${escapeHtml(resolveChairmanName(ticket))}</span>
              <span>${escapeHtml(fmtDateTime(chairmanApprovedAt(ticket)) || "")}</span>
            </div>
          </div>
          <div class="tm-money">${escapeHtml(formatMoney(ticketPrice(ticket)))}</div>
        </div>
        <div class="tm-pill-row">
          <span class="tm-pill completed">Đã duyệt</span>
          <span class="tm-pill">${escapeHtml(progressLabel(normalizeProgress(ticket)))}</span>
        </div>
      </article>
    `;
  }

  function renderList() {
    renderReviewFilters();
    const container = $("tmList");
    const items = getCurrentListItems();
    syncSelection();

    if (!items.length) {
      container.innerHTML = `<div class="tm-empty">${state.activeTab === "completed" ? "Chưa có phiếu đã duyệt." : state.activeTab === "review" ? "Không có phiếu chờ duyệt." : "Không có phiếu đang xử lý."}</div>`;
      return;
    }

    if (state.activeTab === "completed") {
      container.innerHTML = items.map(renderCompletedCard).join("");
      return;
    }
    if (state.activeTab === "review") {
      container.innerHTML = items.map(renderReviewCard).join("");
      return;
    }
    container.innerHTML = items.map(renderProcessingCard).join("");
  }

  function renderDetail() {
    const ticket = getTicketById(state.detailId);
    if (!ticket) {
      closeSheet("tmDetailSheet");
      return;
    }
    $("tmDetailTitle").textContent = String(ticket?.code || ticket?.id || "Phiếu").trim() || "Phiếu";
    $("tmDetailBody").innerHTML = `
      <div class="tm-sheet-card">
        <div class="tm-ticket-title">${escapeHtml(ticket?.customerName || "Khách lẻ")}</div>
        <div class="tm-detail-grid">
          <div class="tm-detail-meta"><span>${escapeHtml(ticket?.customerPhone || "")}</span><span>${escapeHtml(ticket?.model || "")}</span></div>
          <div class="tm-detail-meta"><span>${escapeHtml(ticket?.imei || "")}</span><span>${escapeHtml(fmtDateTime(ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt) || "")}</span></div>
        </div>
        <div class="tm-pill-row">
          <span class="tm-pill ${getStage(ticket) === "completed" ? "completed" : getStage(ticket) === "review" ? "review" : "processing"}">${escapeHtml(progressLabel(normalizeProgress(ticket)))}</span>
          <span class="tm-pill">${escapeHtml(resolveAssignedName(ticket))}</span>
          <span class="tm-pill">Giá mua ${escapeHtml(formatMoney(ticketPrice(ticket)))}</span>
        </div>
      </div>
      <div class="tm-sheet-card">
        <div class="tm-detail-meta"><span>Mã phiếu: ${escapeHtml(ticket?.code || ticket?.id || "")}</span></div>
        <div class="tm-detail-meta"><span>Loại: ${escapeHtml(ticket?.type === "warranty" ? "Đổi máy" : "Thu ngoài")}</span></div>
        <div class="tm-detail-meta"><span>Model: ${escapeHtml(ticket?.model || "")}</span></div>
        <div class="tm-detail-meta"><span>IMEI: ${escapeHtml(ticket?.imei || "")}</span></div>
        <div class="tm-detail-meta"><span>Lỗi / mô tả: ${escapeHtml(ticket?.symptom || ticket?.machineCondition || "")}</span></div>
        <div class="tm-detail-meta"><span>Ghi chú: ${escapeHtml(ticket?.workNote || ticket?.lastStatusNote || "")}</span></div>
        <div class="tm-detail-meta"><span>Người xử lý: ${escapeHtml(resolveAssignedName(ticket))}</span></div>
        ${String(ticket?.handoverProgressInfo || "").trim() ? `<div class="tm-detail-meta"><span>${escapeHtml(progressInfoLabel(normalizeProgress(ticket)))}: ${escapeHtml(ticket.handoverProgressInfo)}</span></div>` : ""}
        ${getStage(ticket) === "completed" ? `<div class="tm-detail-meta"><span>Duyệt bởi: ${escapeHtml(resolveChairmanName(ticket))}</span><span>${escapeHtml(fmtDateTime(chairmanApprovedAt(ticket)) || "")}</span></div>` : ""}
      </div>
      <div style="display:grid;gap:10px">
        ${renderHistoryHtml(ticket)}
      </div>
    `;
    $("tmDetailUpdateBtn").style.display = getStage(ticket) === "completed" ? "none" : "";
    $("tmDetailApproveBtn").style.display = getStage(ticket) === "review" ? "" : "none";
  }

  function render() {
    renderSummary();
    renderTabs();
    renderList();
    if (state.detailId) renderDetail();
  }

  function resetCreateForm() {
    $("tmCreateTypeSelect").value = "repair";
    $("tmCreateCustomerName").value = "";
    $("tmCreateCustomerPhone").value = "";
    $("tmCreateModel").value = "";
    $("tmCreateImei").value = "";
    $("tmCreateDevicePass").value = "";
    $("tmCreateBuyPrice").value = "";
    $("tmCreateSymptom").value = "";
    $("tmCreateWorkNote").value = "";
    $("tmCreateWarning").textContent = "";
  }

  function syncProgressForm() {
    const progress = String($("tmProgressSelect").value || HANDOVER_PROGRESS.PROCESSING).trim();
    const isProcessing = progress === HANDOVER_PROGRESS.PROCESSING;
    $("tmAssigneeField").style.display = isProcessing ? "" : "none";
    $("tmProgressInfoField").style.display = isProcessing ? "none" : "";
    $("tmProgressInfoLabel").textContent = progressInfoLabel(progress);
    $("tmProgressInfoInput").placeholder = progressInfoLabel(progress);
  }

  function openDetail(ticketId = "") {
    state.detailId = String(ticketId || "").trim();
    renderDetail();
    openSheet("tmDetailSheet");
  }

  function openProgress(ticketId = "") {
    const ticket = getTicketById(ticketId);
    if (!ticket) return;
    state.progressId = String(ticketId || "").trim();
    $("tmProgressTitle").textContent = String(ticket?.code || ticket?.id || "Phiếu").trim() || "Phiếu";
    $("tmProgressSelect").value = normalizeProgress(ticket);
    $("tmBuyPriceInput").value = ticketPrice(ticket) > 0 ? ticketPrice(ticket).toLocaleString("vi-VN") : "";
    $("tmProgressInfoInput").value = String(ticket?.handoverProgressInfo || "").trim();
    $("tmProgressNoteInput").value = String(ticket?.lastStatusNote || "").trim();
    $("tmAssigneeInput").value = String(ticket?.handoverToName || ticket?.techName || "").trim();
    syncProgressForm();
    openSheet("tmProgressSheet");
  }

  function saveActorName() {
    const next = String($("tmActorNameInput").value || "").trim() || "NV";
    updateActorName(next);
    localStorage.setItem("thkd_thumay_actor_name", next);
    $("tmSaveActorStatus").textContent = "Đã lưu";
    window.setTimeout(() => {
      if ($("tmSaveActorStatus")) $("tmSaveActorStatus").textContent = "";
    }, 1200);
  }

  async function createTicket() {
    const customerName = String($("tmCreateCustomerName").value || "").trim();
    const customerPhone = digitsOnly($("tmCreateCustomerPhone").value || "");
    const model = String($("tmCreateModel").value || "").trim();
    const symptom = String($("tmCreateSymptom").value || "").trim();
    const buyPrice = Number(digitsOnly($("tmCreateBuyPrice").value || "")) || 0;
    if (!customerName) {
      $("tmCreateWarning").textContent = "Nhập tên khách hàng.";
      return;
    }
    if (!model) {
      $("tmCreateWarning").textContent = "Nhập model máy.";
      return;
    }
    if (!symptom) {
      $("tmCreateWarning").textContent = "Nhập lỗi / mô tả máy.";
      return;
    }
    const btn = $("tmSaveCreateBtn");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Đang tạo...";
    try {
      await createThuMayTicket({
        type: String($("tmCreateTypeSelect").value || "repair").trim() || "repair",
        status: "received",
        transferState: "waiting",
        transferReceiptUrl: "",
        transferReceiptPath: "",
        transferReceiptName: "",
        transferReceiptUrls: [],
        transferReceiptPaths: [],
        transferReceiptNames: [],
        transferTokenVerified: false,
        handoverProgress: HANDOVER_PROGRESS.PROCESSING,
        customerName,
        customerPhone,
        model,
        imei: String($("tmCreateImei").value || "").trim(),
        devicePass: String($("tmCreateDevicePass").value || "").trim(),
        estimateCost: buyPrice,
        price: buyPrice,
        deposit: buyPrice,
        symptom,
        workNote: String($("tmCreateWorkNote").value || "").trim(),
        creatorName: state.actorName,
        createdByName: state.actorName,
        staffName: state.actorName,
        lastStatusByName: state.actorName,
        statusHistory: [{
          from: "draft",
          to: "received",
          toLabel: "Tiếp nhận",
          note: "Tạo phiếu trong app chính.",
          at: new Date(),
          atMillis: Date.now(),
          user: state.actorName,
        }],
      });
      resetCreateForm();
      closeSheet("tmCreateSheet");
      state.activeTab = "processing";
      render();
    } catch (error) {
      $("tmCreateWarning").textContent = error?.message || String(error);
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function saveProgress() {
    const ticket = getTicketById(state.progressId);
    if (!ticket) {
      window.alert("Không tìm thấy phiếu.");
      return;
    }
    const progress = String($("tmProgressSelect").value || HANDOVER_PROGRESS.PROCESSING).trim();
    const note = String($("tmProgressNoteInput").value || "").trim();
    const buyPrice = Number(digitsOnly($("tmBuyPriceInput").value || "")) || 0;
    const payload = { progress, note, buyPrice };
    if (progress === HANDOVER_PROGRESS.PROCESSING) {
      const techName = String($("tmAssigneeInput").value || "").trim();
      payload.techId = null;
      payload.techName = techName || null;
      payload.handoverToId = null;
      payload.handoverToName = techName || null;
      payload.progressInfo = null;
    } else {
      payload.progressInfo = String($("tmProgressInfoInput").value || "").trim() || null;
      payload.techId = null;
      payload.techName = null;
      payload.handoverToId = null;
      payload.handoverToName = null;
    }
    const btn = $("tmSaveProgressBtn");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Đang lưu...";
    try {
      await saveThuMayProgressUpdate(ticket, payload, { name: state.actorName });
      closeSheet("tmProgressSheet");
      render();
      openDetail(ticket.id);
    } catch (error) {
      window.alert(error?.message || String(error));
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  async function approveSingle(ticketId = "") {
    const ticket = getTicketById(ticketId);
    if (!ticket) return;
    const ok = window.confirm(`Xác nhận duyệt phiếu ${ticket.code || ticket.id}?`);
    if (!ok) return;
    try {
      await approveThuMayTickets([ticket], { name: state.actorName });
      state.selected.delete(String(ticket.id || "").trim());
      render();
      openDetail(ticketId);
    } catch (error) {
      window.alert(error?.message || String(error));
    }
  }

  async function approveSelected() {
    const tickets = getFilteredTickets("review").filter((ticket) => state.selected.has(String(ticket?.id || "").trim()));
    if (!tickets.length) {
      window.alert("Chưa chọn phiếu để duyệt.");
      return;
    }
    const ok = window.confirm(`Xác nhận duyệt ${tickets.length} phiếu cho ${state.actorName}?`);
    if (!ok) return;
    const btn = $("tmApproveSelectedBtn");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Đang duyệt...";
    try {
      await approveThuMayTickets(tickets, { name: state.actorName });
      state.selected.clear();
      render();
    } catch (error) {
      window.alert(error?.message || String(error));
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  function bindSheetClose(sheetId, closeBtnId) {
    const handler = () => closeSheet(sheetId);
    $(closeBtnId)?.addEventListener("click", handler);
    $(sheetId)?.addEventListener("click", (event) => {
      if (event.target === $(sheetId)) handler();
    });
  }

  function bindEvents() {
    window.addEventListener("thkd:actor-changed", (event) => {
      syncActorFromApp(event?.detail || null);
    });

    $("tmSearchInput").addEventListener("input", (event) => {
      state.search = String(event.target?.value || "").trim();
      render();
    });

    $("tmRefreshBtn").addEventListener("click", () => render());
    $("tmOpenCreateBtn").addEventListener("click", () => {
      resetCreateForm();
      openSheet("tmCreateSheet");
    });
    $("tmApproveSelectedBtn").addEventListener("click", approveSelected);
    $("tmSaveActorBtn").addEventListener("click", saveActorName);
    $("tmActorNameInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveActorName();
    });
    $("tmCreateBuyPrice").addEventListener("input", (event) => {
      const digits = digitsOnly(event.target.value || "");
      event.target.value = digits ? Number(digits).toLocaleString("vi-VN") : "";
    });
    $("tmSaveCreateBtn").addEventListener("click", createTicket);

    document.querySelectorAll("[data-tm-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTab = String(button.dataset.tmTab || "processing").trim() || "processing";
        render();
      });
    });

    document.querySelectorAll("[data-review-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.reviewFilter = String(button.dataset.reviewFilter || "all").trim() || "all";
        render();
      });
    });

    $("tmList").addEventListener("click", (event) => {
      const progressBtn = event.target.closest("[data-open-progress]");
      if (progressBtn) {
        event.stopPropagation();
        openProgress(progressBtn.getAttribute("data-open-progress"));
        return;
      }
      const approveBtn = event.target.closest("[data-single-approve]");
      if (approveBtn) {
        event.stopPropagation();
        approveSingle(approveBtn.getAttribute("data-single-approve"));
        return;
      }
      const card = event.target.closest("[data-open-detail]");
      if (card && !event.target.closest(".tm-ticket-select")) openDetail(card.getAttribute("data-open-detail"));
    });

    $("tmList").addEventListener("change", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.classList.contains("tm-ticket-select")) return;
      const id = String(input.dataset.id || "").trim();
      if (!id) return;
      if (input.checked) state.selected.add(id);
      else state.selected.delete(id);
      syncSelection();
    });

    $("tmDetailUpdateBtn").addEventListener("click", () => {
      if (state.detailId) openProgress(state.detailId);
    });
    $("tmDetailApproveBtn").addEventListener("click", () => {
      if (state.detailId) approveSingle(state.detailId);
    });

    $("tmProgressSelect").addEventListener("change", syncProgressForm);
    $("tmBuyPriceInput").addEventListener("input", (event) => {
      const digits = digitsOnly(event.target.value || "");
      event.target.value = digits ? Number(digits).toLocaleString("vi-VN") : "";
    });
    $("tmSaveProgressBtn").addEventListener("click", saveProgress);

    bindSheetClose("tmDetailSheet", "tmCloseDetailBtn");
    bindSheetClose("tmProgressSheet", "tmCloseProgressBtn");
    bindSheetClose("tmCreateSheet", "tmCloseCreateBtn");
  }

  function boot() {
    syncActorFromApp(window.__THKD_POS_CURRENT_ACTOR__ || null);
    bindEvents();
    syncActorFromSession();
    observeThuMayTickets((rows) => {
      state.tickets = Array.isArray(rows) ? rows.slice() : [];
      render();
    }, (error) => console.error("observeThuMayTickets error", error));
    render();
  }

  boot();
}
