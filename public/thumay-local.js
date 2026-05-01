import {
  observeThuMayTickets,
  observeThuMayTechs,
  observeThuMayStaffs,
  createThuMayTicket,
  saveThuMayProgressUpdate,
  approveThuMayTickets,
} from "./legacy-core/thumay-repo.js";

const $ = (id) => document.getElementById(id);
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

const state = {
  tickets: [],
  techs: [],
  staffs: [],
  search: "",
  actorName: localStorage.getItem("thkd_thumay_actor_name") || "NV",
  detailId: "",
  progressId: "",
  selected: new Set(),
  reviewFilter: "all",
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

function updateActorName(nextName = "") {
  const raw = String(nextName || "").trim();
  state.actorName = raw || "NV";
  if ($("actorNameInput")) $("actorNameInput").value = state.actorName;
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
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

function escapeHtml(value = "") {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
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
  if (!rows.length) {
    return '<div class="empty">Chưa có lịch sử cập nhật.</div>';
  }
  return rows.map((item) => `
    <div class="detail-meta"><span>${escapeHtml(item.label)}</span><span>${escapeHtml(fmtDateTime(item.at) || "")}</span>${item.user ? `<span>${escapeHtml(item.user)}</span>` : ""}</div>
    ${item.note ? `<div class="hint">${escapeHtml(item.note)}</div>` : ""}
  `).join("");
}

function reviewExtraHtml(ticket = {}) {
  const progress = normalizeProgress(ticket);
  if (progress === HANDOVER_PROGRESS.LIQUIDATION && String(ticket?.handoverProgressInfo || "").trim()) {
    const amount = Number(digitsOnly(ticket.handoverProgressInfo)) || 0;
    return `<span class="pill">Thanh lý ${escapeHtml(amount > 0 ? formatMoney(amount) : ticket.handoverProgressInfo)}</span>`;
  }
  if ((progress === HANDOVER_PROGRESS.STOCK_IN || progress === HANDOVER_PROGRESS.RETURN_NCC) && String(ticket?.handoverProgressInfo || "").trim()) {
    return `<span class="pill">${escapeHtml(ticket.handoverProgressInfo)}</span>`;
  }
  return "";
}

function syncSelection() {
  const visibleIds = new Set(getFilteredTickets("review").map((ticket) => String(ticket?.id || "").trim()));
  state.selected = new Set(Array.from(state.selected).filter((id) => visibleIds.has(id)));
  const selectedTickets = getFilteredTickets("review").filter((ticket) => state.selected.has(String(ticket?.id || "").trim()));
  const liquidationTotal = selectedTickets.reduce((sum, ticket) => {
    if (normalizeProgress(ticket) !== HANDOVER_PROGRESS.LIQUIDATION) return sum;
    return sum + (Number(digitsOnly(ticket?.handoverProgressInfo || "")) || 0);
  }, 0);
  $("selectedCount").textContent = String(selectedTickets.length);
  $("selectedMeta").textContent = selectedTickets.length
    ? `${selectedTickets.length} phiếu${liquidationTotal > 0 ? ` • ${formatMoney(liquidationTotal)}` : ""}`
    : "0 phiếu";
}

function renderSummary() {
  $("processingCount").textContent = String(state.tickets.filter((ticket) => getStage(ticket) === "processing").length);
  $("reviewCount").textContent = String(state.tickets.filter((ticket) => getStage(ticket) === "review").length);
  $("completedCount").textContent = String(state.tickets.filter((ticket) => getStage(ticket) === "completed").length);
  syncSelection();
}

function renderProcessingList() {
  const container = $("processingList");
  const items = getFilteredTickets("processing").slice(0, 80);
  if (!items.length) {
    container.innerHTML = '<div class="empty">Không có phiếu đang xử lý.</div>';
    return;
  }
  container.innerHTML = items.map((ticket) => `
    <article class="ticket-card" data-open-detail="${escapeHtml(ticket?.id || "")}">
      <div class="card-head">
        <div>
          <div class="ticket-title">${escapeHtml(ticket?.code || ticket?.id || "Phiếu")}</div>
          <div class="ticket-meta">${ticketMetaHtml(ticket)}</div>
        </div>
        <div class="money">${escapeHtml(formatMoney(ticketPrice(ticket)))}</div>
      </div>
      <div class="pill-row">
        <span class="pill processing">Đang xử lý</span>
        <span class="pill">${escapeHtml(progressLabel(normalizeProgress(ticket)))}</span>
        ${ticket?.imei ? `<span class="pill">${escapeHtml(ticket.imei)}</span>` : ""}
      </div>
      <div class="ticket-actions">
        <div class="hint">${escapeHtml(ticket?.symptom || ticket?.workNote || "Chưa có ghi chú")}</div>
        <button class="small-btn" type="button" data-open-progress="${escapeHtml(ticket?.id || "")}">Cập nhật</button>
      </div>
    </article>
  `).join("");
}

function renderReviewFilters() {
  document.querySelectorAll("[data-review-filter]").forEach((button) => {
    button.classList.toggle("active", String(button.dataset.reviewFilter || "") === state.reviewFilter);
  });
}

function renderReviewList() {
  renderReviewFilters();
  const container = $("reviewList");
  const items = getFilteredTickets("review").slice(0, 100);
  syncSelection();
  if (!items.length) {
    container.innerHTML = '<div class="empty">Không có phiếu chờ duyệt.</div>';
    return;
  }
  container.innerHTML = items.map((ticket) => {
    const id = String(ticket?.id || "").trim();
    const checked = state.selected.has(id) ? "checked" : "";
    return `
      <article class="ticket-card" data-open-detail="${escapeHtml(id)}">
        <div class="card-head">
          <div>
            <div class="ticket-title">${escapeHtml(ticket?.code || id || "Phiếu")}</div>
            <div class="ticket-meta">${ticketMetaHtml(ticket)}</div>
          </div>
          <div class="money">${escapeHtml(formatMoney(ticketPrice(ticket)))}</div>
        </div>
        <div class="pill-row">
          <span class="pill review">Chờ duyệt</span>
          <span class="pill">${escapeHtml(progressLabel(normalizeProgress(ticket)))}</span>
          ${reviewExtraHtml(ticket)}
        </div>
        <div class="ticket-actions">
          <label class="ticket-check">
            <input class="ticket-select" type="checkbox" data-id="${escapeHtml(id)}" ${checked} />
            Chọn phiếu này
          </label>
          <button class="small-btn" type="button" data-single-approve="${escapeHtml(id)}">Duyệt phiếu này</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderCompletedList() {
  const container = $("completedList");
  const items = getFilteredTickets("completed").slice(0, 40);
  if (!items.length) {
    container.innerHTML = '<div class="empty">Chưa có phiếu đã duyệt.</div>';
    return;
  }
  container.innerHTML = items.map((ticket) => `
    <article class="ticket-card" data-open-detail="${escapeHtml(ticket?.id || "")}">
      <div class="card-head">
        <div>
          <div class="ticket-title">${escapeHtml(ticket?.code || ticket?.id || "Phiếu")}</div>
          <div class="ticket-meta">
            <span>${escapeHtml(ticket?.customerName || "Khách lẻ")}</span>
            <span>${escapeHtml(resolveChairmanName(ticket))}</span>
            <span>${escapeHtml(fmtDateTime(chairmanApprovedAt(ticket)) || "")}</span>
          </div>
        </div>
        <div class="money">${escapeHtml(formatMoney(ticketPrice(ticket)))}</div>
      </div>
      <div class="pill-row">
        <span class="pill completed">Đã duyệt</span>
        <span class="pill">${escapeHtml(progressLabel(normalizeProgress(ticket)))}</span>
      </div>
    </article>
  `).join("");
}

function renderDetail() {
  const ticket = getTicketById(state.detailId);
  if (!ticket) {
    closeSheet("detailSheet");
    return;
  }
  $("detailTitle").textContent = String(ticket?.code || ticket?.id || "Phiếu").trim() || "Phiếu";
  $("detailBody").innerHTML = `
    <div class="detail-card">
      <div class="ticket-title">${escapeHtml(ticket?.customerName || "Khách lẻ")}</div>
      <div class="detail-meta">
        <span>${escapeHtml(ticket?.customerPhone || "")}</span>
        <span>${escapeHtml(ticket?.model || "")}</span>
        <span>${escapeHtml(ticket?.imei || "")}</span>
      </div>
      <div class="pill-row">
        <span class="pill ${getStage(ticket) === "completed" ? "completed" : getStage(ticket) === "review" ? "review" : "processing"}">${escapeHtml(progressLabel(normalizeProgress(ticket)))}</span>
        <span class="pill">${escapeHtml(resolveAssignedName(ticket))}</span>
        <span class="pill">Giá mua ${escapeHtml(formatMoney(ticketPrice(ticket)))}</span>
      </div>
    </div>
    <div class="detail-card">
      <h3>Thông tin phiếu</h3>
      <div class="detail-meta"><span>Mã phiếu: ${escapeHtml(ticket?.code || ticket?.id || "")}</span></div>
      <div class="detail-meta"><span>Loại: ${escapeHtml(ticket?.type === "warranty" ? "Đổi máy" : "Thu ngoài")}</span></div>
      <div class="detail-meta"><span>Model: ${escapeHtml(ticket?.model || "")}</span></div>
      <div class="detail-meta"><span>IMEI: ${escapeHtml(ticket?.imei || "")}</span></div>
      <div class="detail-meta"><span>Lỗi / mô tả: ${escapeHtml(ticket?.symptom || ticket?.machineCondition || "")}</span></div>
      <div class="detail-meta"><span>Ghi chú: ${escapeHtml(ticket?.workNote || ticket?.lastStatusNote || "")}</span></div>
      <div class="detail-meta"><span>Người xử lý: ${escapeHtml(resolveAssignedName(ticket))}</span></div>
      ${String(ticket?.handoverProgressInfo || "").trim() ? `<div class="detail-meta"><span>${escapeHtml(progressInfoLabel(normalizeProgress(ticket)))}: ${escapeHtml(ticket.handoverProgressInfo)}</span></div>` : ""}
      ${getStage(ticket) === "completed" ? `<div class="detail-meta"><span>Duyệt bởi: ${escapeHtml(resolveChairmanName(ticket))}</span><span>${escapeHtml(fmtDateTime(chairmanApprovedAt(ticket)) || "")}</span></div>` : ""}
    </div>
    <div class="detail-card">
      <h3>Lịch sử cập nhật</h3>
      ${renderHistoryHtml(ticket)}
    </div>
  `;
  $("detailUpdateBtn").style.display = getStage(ticket) === "completed" ? "none" : "";
  $("detailApproveBtn").style.display = getStage(ticket) === "review" ? "" : "none";
}

function render() {
  renderSummary();
  renderProcessingList();
  renderReviewList();
  renderCompletedList();
  if (state.detailId) renderDetail();
}

function resetCreateForm() {
  $("createTypeSelect").value = "repair";
  $("createCustomerName").value = "";
  $("createCustomerPhone").value = "";
  $("createModel").value = "";
  $("createImei").value = "";
  $("createDevicePass").value = "";
  $("createBuyPrice").value = "";
  $("createSymptom").value = "";
  $("createWorkNote").value = "";
  $("createWarning").textContent = "";
}

function fillTechOptions() {
  const select = $("techSelect");
  const rows = [...state.techs, ...state.staffs]
    .filter(Boolean)
    .map((row) => ({
      id: String(row?.id || row?.phone || "").trim(),
      name: String(row?.name || row?.phone || row?.id || "").trim(),
    }))
    .filter((row) => row.id && row.name);
  const seen = new Set();
  const uniq = rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  select.innerHTML = '<option value="">Chọn người xử lý</option>' + uniq.map((row) => `<option value="${escapeHtml(row.id)}">${escapeHtml(row.name)}</option>`).join("");
}

function syncProgressForm() {
  const progress = String($("progressSelect").value || HANDOVER_PROGRESS.PROCESSING).trim();
  const isProcessing = progress === HANDOVER_PROGRESS.PROCESSING;
  $("processingTechField").style.display = isProcessing ? "" : "none";
  $("progressInfoField").style.display = isProcessing ? "none" : "";
  $("progressInfoLabel").textContent = progressInfoLabel(progress);
  $("progressInfoInput").placeholder = progressInfoLabel(progress);
}

function openDetail(ticketId = "") {
  state.detailId = String(ticketId || "").trim();
  renderDetail();
  openSheet("detailSheet");
}

function openProgress(ticketId = "") {
  const ticket = getTicketById(ticketId);
  if (!ticket) return;
  state.progressId = String(ticketId || "").trim();
  $("progressTitle").textContent = String(ticket?.code || ticket?.id || "Phiếu").trim() || "Phiếu";
  $("progressSelect").value = normalizeProgress(ticket);
  $("buyPriceInput").value = ticketPrice(ticket) > 0 ? ticketPrice(ticket).toLocaleString("vi-VN") : "";
  $("progressInfoInput").value = String(ticket?.handoverProgressInfo || "").trim();
  $("progressNoteInput").value = String(ticket?.lastStatusNote || "").trim();
  fillTechOptions();
  const techId = String(ticket?.handoverToId || ticket?.techId || "").trim();
  if (techId) $("techSelect").value = techId;
  syncProgressForm();
  openSheet("progressSheet");
}

function saveActorName() {
  const next = String($("actorNameInput").value || "").trim() || "NV";
  updateActorName(next);
  localStorage.setItem("thkd_thumay_actor_name", next);
  $("saveActorStatus").textContent = "Đã lưu";
  window.setTimeout(() => {
    if ($("saveActorStatus")) $("saveActorStatus").textContent = "";
  }, 1200);
}

async function createTicket() {
  const customerName = String($("createCustomerName").value || "").trim();
  const customerPhone = digitsOnly($("createCustomerPhone").value || "");
  const model = String($("createModel").value || "").trim();
  const symptom = String($("createSymptom").value || "").trim();
  const buyPrice = Number(digitsOnly($("createBuyPrice").value || "")) || 0;
  if (!customerName) {
    $("createWarning").textContent = "Nhập tên khách hàng.";
    return;
  }
  if (!model) {
    $("createWarning").textContent = "Nhập model máy.";
    return;
  }
  if (!symptom) {
    $("createWarning").textContent = "Nhập lỗi / mô tả máy.";
    return;
  }
  const btn = $("saveCreateBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang tạo...";
  try {
    await createThuMayTicket({
      type: String($("createTypeSelect").value || "repair").trim() || "repair",
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
      imei: String($("createImei").value || "").trim(),
      devicePass: String($("createDevicePass").value || "").trim(),
      estimateCost: buyPrice,
      price: buyPrice,
      deposit: buyPrice,
      symptom,
      workNote: String($("createWorkNote").value || "").trim(),
      creatorName: state.actorName,
      createdByName: state.actorName,
      staffName: state.actorName,
      lastStatusByName: state.actorName,
      statusHistory: [{
        from: "draft",
        to: "received",
        toLabel: "Tiếp nhận",
        note: "Tạo phiếu local.",
        at: new Date(),
        atMillis: Date.now(),
        user: state.actorName,
      }],
    });
    resetCreateForm();
    closeSheet("createSheet");
  } catch (error) {
    $("createWarning").textContent = error?.message || String(error);
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
  const progress = String($("progressSelect").value || HANDOVER_PROGRESS.PROCESSING).trim();
  const note = String($("progressNoteInput").value || "").trim();
  const buyPrice = Number(digitsOnly($("buyPriceInput").value || "")) || 0;
  const payload = { progress, note, buyPrice };
  if (progress === HANDOVER_PROGRESS.PROCESSING) {
    const techId = String($("techSelect").value || "").trim();
    const techName = String($("techSelect").selectedOptions?.[0]?.textContent || "").trim();
    payload.techId = techId || null;
    payload.techName = techName || null;
    payload.handoverToId = techId || null;
    payload.handoverToName = techName || null;
    payload.progressInfo = null;
  } else {
    payload.progressInfo = String($("progressInfoInput").value || "").trim() || null;
    payload.techId = null;
    payload.techName = null;
    payload.handoverToId = null;
    payload.handoverToName = null;
  }
  const btn = $("saveProgressBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang lưu...";
  try {
    await saveThuMayProgressUpdate(ticket, payload, { name: state.actorName });
    closeSheet("progressSheet");
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
  const btn = $("approveSelectedBtn");
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
  $("searchInput").addEventListener("input", (event) => {
    state.search = String(event.target?.value || "").trim();
    render();
  });
  $("approveSelectedBtn").addEventListener("click", approveSelected);
  $("saveActorBtn").addEventListener("click", saveActorName);
  $("actorNameInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveActorName();
  });
  $("openCreateBtn").addEventListener("click", () => {
    resetCreateForm();
    openSheet("createSheet");
  });
  $("createBuyPrice").addEventListener("input", (event) => {
    const digits = digitsOnly(event.target.value || "");
    event.target.value = digits ? Number(digits).toLocaleString("vi-VN") : "";
  });
  $("saveCreateBtn").addEventListener("click", createTicket);

  document.querySelectorAll("[data-review-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.reviewFilter = String(button.dataset.reviewFilter || "all").trim() || "all";
      render();
    });
  });

  $("processingList").addEventListener("click", (event) => {
    const progressBtn = event.target.closest("[data-open-progress]");
    if (progressBtn) {
      event.stopPropagation();
      openProgress(progressBtn.getAttribute("data-open-progress"));
      return;
    }
    const card = event.target.closest("[data-open-detail]");
    if (card) openDetail(card.getAttribute("data-open-detail"));
  });

  $("reviewList").addEventListener("click", (event) => {
    const approveBtn = event.target.closest("[data-single-approve]");
    if (approveBtn) {
      event.stopPropagation();
      approveSingle(approveBtn.getAttribute("data-single-approve"));
      return;
    }
    const card = event.target.closest("[data-open-detail]");
    if (card && !event.target.closest(".ticket-select")) openDetail(card.getAttribute("data-open-detail"));
  });
  $("reviewList").addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("ticket-select")) return;
    const id = String(input.dataset.id || "").trim();
    if (!id) return;
    if (input.checked) state.selected.add(id);
    else state.selected.delete(id);
    syncSelection();
  });

  $("completedList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-open-detail]");
    if (card) openDetail(card.getAttribute("data-open-detail"));
  });

  $("detailUpdateBtn").addEventListener("click", () => {
    if (state.detailId) openProgress(state.detailId);
  });
  $("detailApproveBtn").addEventListener("click", () => {
    if (state.detailId) approveSingle(state.detailId);
  });

  $("progressSelect").addEventListener("change", syncProgressForm);
  $("buyPriceInput").addEventListener("input", (event) => {
    const digits = digitsOnly(event.target.value || "");
    event.target.value = digits ? Number(digits).toLocaleString("vi-VN") : "";
  });
  $("saveProgressBtn").addEventListener("click", saveProgress);

  bindSheetClose("detailSheet", "closeDetailBtn");
  bindSheetClose("progressSheet", "closeProgressBtn");
  bindSheetClose("createSheet", "closeCreateBtn");
}

function boot() {
  syncActorFromApp(window.__THKD_POS_CURRENT_ACTOR__ || null);
  bindEvents();
  syncActorFromSession();
  observeThuMayTickets((rows) => {
    state.tickets = Array.isArray(rows) ? rows.slice() : [];
    render();
  }, (error) => console.error("observeThuMayTickets error", error));
  observeThuMayTechs((rows) => {
    state.techs = Array.isArray(rows) ? rows.slice() : [];
    fillTechOptions();
  }, (error) => console.error("observeThuMayTechs error", error));
  observeThuMayStaffs((rows) => {
    state.staffs = Array.isArray(rows) ? rows.slice() : [];
    fillTechOptions();
  }, (error) => console.error("observeThuMayStaffs error", error));
  render();
}

boot();
