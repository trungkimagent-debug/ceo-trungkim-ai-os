import {
  observeThuGopTickets,
  observeThuGopCashHandoverLogs,
  createThuGopTicket,
  approveThuGopCashHandoverBatch,
  markThuGopCollectedPayment,
  uploadThuGopAsset,
  THUGOP_CASH_HANDOVER_STATE,
} from "./legacy-core/thugop-repo.js";

const $ = (id) => document.getElementById(id);
const state = {
  tickets: [],
  logs: [],
  search: "",
  selected: new Set(),
  actorName: localStorage.getItem("thkd_thugop_actor_name") || "Quản lý",
  detailId: "",
  collectId: "",
  collectBill: null,
};

const formatMoney = (value = 0) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
const digitsOnly = (value = "") => String(value || "").replace(/\D+/g, "");

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

function sanitizeUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, window.location.href);
    const protocol = String(parsed.protocol || "").toLowerCase();
    if (["http:", "https:", "blob:"].includes(protocol)) return parsed.href;
  } catch (_) {}
  return "";
}

function parseExpectedAmount(ticket = {}) {
  const amount = Number(ticket?.deposit || ticket?.estimateCost || ticket?.price || 0);
  return amount > 0 ? amount : 0;
}

function parseCollectedAmount(ticket = {}) {
  let amount = Number(digitsOnly(ticket?.paymentCloseAmount ?? "")) || 0;
  if (!(amount > 0)) amount = Number(digitsOnly(ticket?.paymentAmount ?? ticket?.paidAmount ?? "")) || 0;
  if (!(amount > 0) && String(ticket?.paymentCloseBillUrl || "").trim()) amount = parseExpectedAmount(ticket);
  return amount > 0 ? amount : 0;
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

function isPendingCashTicket(ticket = {}) {
  if (!isActiveTicket(ticket)) return false;
  if (String(ticket?.cashHandoverState || "").trim() === THUGOP_CASH_HANDOVER_STATE.DONE) return false;
  return hasCollectedProof(ticket);
}

function isDoneCashTicket(ticket = {}) {
  return String(ticket?.cashHandoverState || "").trim() === THUGOP_CASH_HANDOVER_STATE.DONE || Boolean(ticket?.cashHandoverAt);
}

function isCollectableTicket(ticket = {}) {
  return isActiveTicket(ticket) && !hasCollectedProof(ticket) && !isDoneCashTicket(ticket);
}

function buildSearchBlob(ticket = {}) {
  return [
    ticket?.code,
    ticket?.customerName,
    ticket?.customerPhone,
    ticket?.contractNumberText,
    resolveCollectedStaffName(ticket),
    ticket?.paymentCloseByName,
    ticket?.paymentCloseBy,
  ].map((x) => String(x || "").trim().toLowerCase()).join(" ");
}

function getTicketById(ticketId = "") {
  const id = String(ticketId || "").trim();
  return state.tickets.find((ticket) => String(ticket?.id || "").trim() === id) || null;
}

function getFilteredTickets(stage) {
  const term = state.search.trim().toLowerCase();
  const source = stage === "collect"
    ? state.tickets.filter(isCollectableTicket)
    : stage === "pending"
      ? state.tickets.filter(isPendingCashTicket)
      : stage === "done"
        ? state.tickets.filter(isDoneCashTicket)
        : state.tickets;
  const filtered = term ? source.filter((ticket) => buildSearchBlob(ticket).includes(term)) : source;
  return filtered.sort((a, b) =>
    toMillis(b?.cashHandoverAt || b?.paymentCloseAt || b?.updatedAt || b?.sortAt || b?.createdAt) -
    toMillis(a?.cashHandoverAt || a?.paymentCloseAt || a?.updatedAt || a?.sortAt || a?.createdAt)
  );
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

function resetCreateForm() {
  $("createCustomerName").value = "";
  $("createCustomerPhone").value = "";
  $("createContractNumber").value = "";
  $("createDeposit").value = "";
  $("createWorkNote").value = "";
  $("createWarning").textContent = "";
}

function resetCollectForm() {
  state.collectId = "";
  state.collectBill = null;
  $("collectBillInput").value = "";
  $("collectNoteInput").value = "";
  $("collectWarning").textContent = "";
  updateBillPreview("");
}

function ticketMetaHtml(ticket = {}) {
  const parts = [
    ticket?.customerName || "Khách lẻ",
    resolveCollectedStaffName(ticket),
    fmtDateTime(ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt),
  ];
  return parts.filter(Boolean).map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function renderSummary() {
  $("collectCount").textContent = String(state.tickets.filter(isCollectableTicket).length);
  $("pendingCount").textContent = String(state.tickets.filter(isPendingCashTicket).length);
  $("doneCount").textContent = String(state.tickets.filter(isDoneCashTicket).length);
  $("logCount").textContent = String(state.logs.length);
}

function syncSelection() {
  const validIds = new Set(getFilteredTickets("pending").map((ticket) => String(ticket?.id || "").trim()));
  state.selected = new Set(Array.from(state.selected).filter((id) => validIds.has(id)));
  const selectedTickets = getFilteredTickets("pending").filter((ticket) => state.selected.has(String(ticket?.id || "").trim()));
  const total = selectedTickets.reduce((sum, ticket) => sum + parseCollectedAmount(ticket), 0);
  $("selectedMeta").textContent = `${selectedTickets.length} phiếu • ${formatMoney(total)}`;
}

function renderCollectList() {
  const container = $("collectList");
  const items = getFilteredTickets("collect").slice(0, 60);
  if (!items.length) {
    container.innerHTML = '<div class="empty">Không có phiếu chờ thu tiền.</div>';
    return;
  }
  container.innerHTML = items.map((ticket) => {
    const id = String(ticket?.id || "").trim();
    return `
      <article class="ticket-card" data-open-detail="${escapeHtml(id)}">
        <div class="card-head">
          <div class="ticket-main">
            <div class="ticket-title">${escapeHtml(ticket?.code || id || "Phiếu")}</div>
            <div class="ticket-meta">${ticketMetaHtml(ticket)}</div>
          </div>
          <div class="money">${escapeHtml(formatMoney(parseExpectedAmount(ticket)))}</div>
        </div>
        <div class="pill-row">
          <span class="pill danger">Chưa đóng</span>
          ${ticket?.customerPhone ? `<span class="pill">${escapeHtml(ticket.customerPhone)}</span>` : ""}
          ${ticket?.contractNumberText ? `<span class="pill">HĐ ${escapeHtml(ticket.contractNumberText)}</span>` : ""}
        </div>
        <div class="ticket-actions">
          <div class="muted">Bấm vào phiếu để xem chi tiết</div>
          <button class="small-btn" type="button" data-open-collect="${escapeHtml(id)}">Thu tiền</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderPendingList() {
  const container = $("pendingList");
  const items = getFilteredTickets("pending").slice(0, 80);
  syncSelection();
  if (!items.length) {
    container.innerHTML = '<div class="empty">Chưa có phiếu chờ giao tiền.</div>';
    return;
  }
  container.innerHTML = items.map((ticket) => {
    const id = String(ticket?.id || "").trim();
    const checked = state.selected.has(id) ? "checked" : "";
    return `
      <article class="ticket-card" data-open-detail="${escapeHtml(id)}">
        <div class="card-head">
          <div class="ticket-main">
            <div class="ticket-title">${escapeHtml(ticket?.code || id || "Phiếu")}</div>
            <div class="ticket-meta">${ticketMetaHtml(ticket)}</div>
          </div>
          <div class="money">${escapeHtml(formatMoney(parseCollectedAmount(ticket)))}</div>
        </div>
        <div class="pill-row">
          <span class="pill pending">Chờ giao</span>
          ${ticket?.paymentCloseBillUrl ? '<span class="pill">Có bill</span>' : ''}
          ${ticket?.cashHandoverByName ? `<span class="pill">${escapeHtml(ticket.cashHandoverByName)}</span>` : ''}
        </div>
        <div class="ticket-actions">
          <label class="ticket-check">
            <input class="ticket-select" type="checkbox" data-id="${escapeHtml(id)}" ${checked} />
            Chọn phiếu này
          </label>
          <button class="small-btn" type="button" data-single-approve="${escapeHtml(id)}">Giao phiếu này</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderDoneList() {
  const container = $("doneList");
  const items = getFilteredTickets("done").slice(0, 20);
  if (!items.length) {
    container.innerHTML = '<div class="empty">Chưa có phiếu đã giao tiền.</div>';
    return;
  }
  container.innerHTML = items.map((ticket) => `
    <article class="ticket-card" data-open-detail="${escapeHtml(ticket?.id || '')}">
      <div class="card-head">
        <div class="ticket-main">
          <div class="ticket-title">${escapeHtml(ticket?.code || ticket?.id || 'Phiếu')}</div>
          <div class="ticket-meta">
            <span>${escapeHtml(ticket?.customerName || 'Khách lẻ')}</span>
            <span>${escapeHtml(ticket?.cashHandoverReceivedByName || 'Quản lý')}</span>
            <span>${escapeHtml(fmtDateTime(ticket?.cashHandoverAt || ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt) || '')}</span>
          </div>
        </div>
        <div class="money">${escapeHtml(formatMoney(ticket?.cashHandoverAmount || parseCollectedAmount(ticket)))}</div>
      </div>
      <div class="pill-row">
        <span class="pill done">Đã giao</span>
        ${ticket?.cashHandoverBatchId ? `<span class="pill">${escapeHtml(ticket.cashHandoverBatchId)}</span>` : ''}
      </div>
    </article>
  `).join("");
}

function renderLogsList() {
  const container = $("logsList");
  const items = [...state.logs].sort((a, b) => toMillis(b?.createdAt || b?.createdAtMillis) - toMillis(a?.createdAt || a?.createdAtMillis)).slice(0, 20);
  if (!items.length) {
    container.innerHTML = '<div class="empty">Chưa có log batch giao tiền.</div>';
    return;
  }
  container.innerHTML = items.map((log) => `
    <article class="log-card">
      <div class="card-head">
        <div>
          <div class="ticket-title">${escapeHtml(log?.receiverName || 'Quản lý')}</div>
          <div class="ticket-meta">
            <span>${escapeHtml(log?.giverName || 'Nhân viên')}</span>
            <span>${escapeHtml(fmtDateTime(log?.createdAt || log?.createdAtMillis) || '')}</span>
          </div>
        </div>
        <div class="money">${escapeHtml(formatMoney(log?.totalAmount || 0))}</div>
      </div>
      <div class="pill-row">
        <span class="pill">${escapeHtml(`${Number(log?.totalTickets || 0)} phiếu`)}</span>
        ${log?.batchId ? `<span class="pill">${escapeHtml(log.batchId)}</span>` : ''}
      </div>
    </article>
  `).join("");
}

function renderDetailSheet() {
  const ticket = getTicketById(state.detailId);
  if (!ticket) {
    closeSheet("detailSheet");
    return;
  }
  const billUrl = sanitizeUrl(ticket?.paymentCloseBillUrl || "");
  const contractUrl = sanitizeUrl(ticket?.contractImageUrl || ticket?.billReceiptUrl || "");
  $("detailTitle").textContent = String(ticket?.code || ticket?.id || "Phiếu").trim() || "Phiếu";
  $("detailBody").innerHTML = `
    <div class="detail-card">
      <div class="ticket-title">${escapeHtml(ticket?.customerName || 'Khách lẻ')}</div>
      <div class="detail-meta">
        <span>${escapeHtml(ticket?.customerPhone || '')}</span>
        <span>${escapeHtml(ticket?.contractNumberText || '')}</span>
        <span>${escapeHtml(resolveCollectedStaffName(ticket))}</span>
      </div>
      <div class="pill-row">
        ${isDoneCashTicket(ticket) ? '<span class="pill done">Đã giao tiền</span>' : isPendingCashTicket(ticket) ? '<span class="pill pending">Chờ giao tiền</span>' : '<span class="pill danger">Chưa đóng tiền</span>'}
        <span class="pill">Thu dự kiến ${escapeHtml(formatMoney(parseExpectedAmount(ticket)))}</span>
        <span class="pill">Đã đóng ${escapeHtml(formatMoney(parseCollectedAmount(ticket)))}</span>
      </div>
    </div>
    <div class="detail-card">
      <h3>Thông tin phiếu</h3>
      <div class="detail-meta"><span>Mã phiếu: ${escapeHtml(ticket?.code || ticket?.id || '')}</span></div>
      <div class="detail-meta"><span>Khách: ${escapeHtml(ticket?.customerName || 'Khách lẻ')}</span></div>
      <div class="detail-meta"><span>SĐT: ${escapeHtml(ticket?.customerPhone || '')}</span></div>
      <div class="detail-meta"><span>HĐ: ${escapeHtml(ticket?.contractNumberText || '')}</span></div>
      <div class="detail-meta"><span>Nhân viên: ${escapeHtml(resolveCollectedStaffName(ticket))}</span></div>
      <div class="detail-meta"><span>Cập nhật: ${escapeHtml(fmtDateTime(ticket?.updatedAt || ticket?.sortAt || ticket?.createdAt) || '')}</span></div>
      ${ticket?.workNote ? `<div class="hint">${escapeHtml(ticket.workNote)}</div>` : ''}
    </div>
    <div class="two-col">
      <div class="detail-card">
        <h3>Ảnh hợp đồng / gốc</h3>
        ${contractUrl ? `<div class="preview"><img src="${escapeHtml(contractUrl)}" alt="contract" /></div><a class="small-btn" href="${escapeHtml(contractUrl)}" target="_blank" rel="noopener noreferrer">Mở ảnh gốc</a>` : '<div class="empty">Chưa có ảnh gốc</div>'}
      </div>
      <div class="detail-card">
        <h3>Bill đóng tiền</h3>
        ${billUrl ? `<div class="preview"><img src="${escapeHtml(billUrl)}" alt="bill" /></div><a class="small-btn" href="${escapeHtml(billUrl)}" target="_blank" rel="noopener noreferrer">Mở bill đóng tiền</a>` : '<div class="empty">Chưa có bill đóng tiền</div>'}
      </div>
    </div>
  `;
  $("detailCollectBtn").style.display = isCollectableTicket(ticket) ? "" : "none";
  $("detailSingleApproveBtn").style.display = isPendingCashTicket(ticket) ? "" : "none";
}

function updateBillPreview(url = "") {
  const preview = $("collectBillPreview");
  const safe = sanitizeUrl(url);
  preview.innerHTML = safe ? `<img src="${escapeHtml(safe)}" alt="bill preview" />` : '<span class="hint">Chưa có ảnh</span>';
}

function render() {
  renderSummary();
  renderCollectList();
  renderPendingList();
  renderDoneList();
  renderLogsList();
  if (state.detailId) renderDetailSheet();
}

function openDetail(ticketId = "") {
  state.detailId = String(ticketId || "").trim();
  renderDetailSheet();
  openSheet("detailSheet");
}

function openCollect(ticketId = "") {
  const ticket = getTicketById(ticketId);
  if (!ticket) return;
  state.collectId = String(ticketId || "").trim();
  state.collectBill = null;
  $("collectTitle").textContent = String(ticket?.code || ticket?.id || "Phiếu").trim() || "Đóng tiền";
  const expected = parseExpectedAmount(ticket);
  $("collectExpectedAmount").textContent = formatMoney(expected);
  $("collectAmountInput").value = expected ? Number(expected).toLocaleString("vi-VN") : "";
  $("collectNoteInput").value = "";
  $("collectWarning").textContent = "";
  $("collectBillInput").value = "";
  updateBillPreview("");
  openSheet("collectSheet");
}

function saveActorName() {
  const next = String($("actorNameInput").value || "").trim() || "Quản lý";
  state.actorName = next;
  localStorage.setItem("thkd_thugop_actor_name", next);
  $("saveActorStatus").textContent = "Đã lưu";
  window.setTimeout(() => {
    if ($("saveActorStatus")) $("saveActorStatus").textContent = "";
  }, 1200);
}

async function createTicket() {
  const customerName = String($("createCustomerName").value || "").trim();
  const customerPhone = String($("createCustomerPhone").value || "").trim();
  const contractNumberText = String($("createContractNumber").value || "").trim();
  const deposit = Number(digitsOnly($("createDeposit").value || "")) || 0;
  const workNote = String($("createWorkNote").value || "").trim();
  if (!customerName) {
    $("createWarning").textContent = "Nhập tên khách hàng.";
    return;
  }
  const btn = $("saveCreateBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang tạo...";
  try {
    await createThuGopTicket({
      status: "received",
      customerName,
      customerPhone,
      contractNumberText,
      deposit,
      estimateCost: deposit,
      price: deposit,
      workNote,
      creatorName: state.actorName,
      createdByName: state.actorName,
      staffName: state.actorName,
      lastStatusByName: state.actorName,
      paymentCloseByName: state.actorName,
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

async function singleApprove(ticketId = "") {
  const ticket = getTicketById(ticketId);
  if (!ticket) return;
  const ok = window.confirm(`Xác nhận giao tiền phiếu ${ticket.code || ticket.id}?`);
  if (!ok) return;
  try {
    await approveThuGopCashHandoverBatch([ticket], { name: state.actorName });
    state.selected.delete(String(ticket.id || "").trim());
    render();
    openDetail(ticketId);
  } catch (error) {
    window.alert(error?.message || String(error));
  }
}

async function approveSelected() {
  const tickets = getFilteredTickets("pending").filter((ticket) => state.selected.has(String(ticket?.id || "").trim()));
  if (!tickets.length) {
    window.alert("Chưa chọn phiếu giao tiền.");
    return;
  }
  const ok = window.confirm(`Xác nhận giao ${tickets.length} phiếu cho ${state.actorName}?`);
  if (!ok) return;
  const btn = $("approveSelectedBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang giao...";
  try {
    await approveThuGopCashHandoverBatch(tickets, { name: state.actorName });
    state.selected.clear();
    render();
  } catch (error) {
    window.alert(error?.message || String(error));
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function saveCollectedPayment() {
  const ticket = getTicketById(state.collectId);
  if (!ticket) {
    window.alert("Không tìm thấy phiếu.");
    return;
  }
  const expected = parseExpectedAmount(ticket);
  const amount = Number(digitsOnly($("collectAmountInput").value || "")) || 0;
  if (!(amount > 0)) {
    $("collectWarning").textContent = "Nhập số tiền đóng hợp lệ.";
    return;
  }
  if (expected > 0 && amount !== expected) {
    $("collectWarning").textContent = "Số tiền đóng chưa khớp số tiền dự kiến.";
    return;
  }
  if (!state.collectBill?.file) {
    $("collectWarning").textContent = "Chưa có ảnh bill đóng tiền.";
    return;
  }
  const btn = $("saveCollectBtn");
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Đang lưu...";
  try {
    const file = state.collectBill.file;
    const uploaded = await uploadThuGopAsset(file, {
      kind: "payment_bill",
      ticketId: String(ticket.id || "").trim(),
      fileName: file.name || "bill_dong_tien.jpg",
      contentType: file.type || "image/jpeg",
    });
    await markThuGopCollectedPayment(ticket, {
      amount,
      billUrl: uploaded?.url || "",
      billPath: uploaded?.path || "",
      billName: uploaded?.name || file.name || "bill_dong_tien.jpg",
      note: $("collectNoteInput").value || "",
    }, {
      name: state.actorName,
    });
    resetCollectForm();
    closeSheet("collectSheet");
    state.detailId = String(ticket.id || "").trim();
  } catch (error) {
    $("collectWarning").textContent = error?.message || String(error);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
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

  $("createDeposit").addEventListener("input", (event) => {
    const digits = digitsOnly(event.target.value || "");
    event.target.value = digits ? Number(digits).toLocaleString("vi-VN") : "";
  });
  $("saveCreateBtn").addEventListener("click", createTicket);

  $("collectList").addEventListener("click", (event) => {
    const collectBtn = event.target.closest("[data-open-collect]");
    if (collectBtn) {
      event.stopPropagation();
      openCollect(collectBtn.getAttribute("data-open-collect"));
      return;
    }
    const card = event.target.closest("[data-open-detail]");
    if (card) openDetail(card.getAttribute("data-open-detail"));
  });

  $("pendingList").addEventListener("click", (event) => {
    const approveBtn = event.target.closest("[data-single-approve]");
    if (approveBtn) {
      event.stopPropagation();
      singleApprove(approveBtn.getAttribute("data-single-approve"));
      return;
    }
    const card = event.target.closest("[data-open-detail]");
    if (card && !event.target.closest(".ticket-select")) openDetail(card.getAttribute("data-open-detail"));
  });
  $("pendingList").addEventListener("change", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.classList.contains("ticket-select")) return;
    const id = String(input.dataset.id || "").trim();
    if (!id) return;
    if (input.checked) state.selected.add(id);
    else state.selected.delete(id);
    syncSelection();
  });

  $("doneList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-open-detail]");
    if (card) openDetail(card.getAttribute("data-open-detail"));
  });

  $("detailCollectBtn").addEventListener("click", () => {
    if (state.detailId) openCollect(state.detailId);
  });
  $("detailSingleApproveBtn").addEventListener("click", () => {
    if (state.detailId) singleApprove(state.detailId);
  });

  $("pickBillBtn").addEventListener("click", () => $("collectBillInput").click());
  $("collectBillInput").addEventListener("change", (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;
    state.collectBill = { file };
    try {
      updateBillPreview(URL.createObjectURL(file));
    } catch (_) {
      updateBillPreview("");
    }
  });
  $("collectAmountInput").addEventListener("input", (event) => {
    const digits = digitsOnly(event.target.value || "");
    event.target.value = digits ? Number(digits).toLocaleString("vi-VN") : "";
    $("collectWarning").textContent = "";
  });
  $("saveCollectBtn").addEventListener("click", saveCollectedPayment);

  bindSheetClose("detailSheet", "closeDetailBtn");
  bindSheetClose("collectSheet", "closeCollectBtn", resetCollectForm);
  bindSheetClose("createSheet", "closeCreateBtn", resetCreateForm);
}

function boot() {
  $("actorNameInput").value = state.actorName;
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
