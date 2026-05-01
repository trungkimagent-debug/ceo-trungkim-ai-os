import {
  collection,
  query,
  limit,
  onSnapshot,
  orderBy,
  doc,
  getDocsFromServer,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getLegacyClient, normalizeDocSnapshot } from "./firebase-client.js";

const THUMAY_INTERNAL_API_BASE = "https://api-ldnzetqooq-uc.a.run.app";
const THUMAY_LEGACY_INTERNAL_KEY_STORAGE_KEY = "thkd_internal_key";
const THUMAY_POS_SESSION_TOKEN_STORAGE_KEY = "thkd_pos_session_token";

export const THUMAY_COLLECTIONS = {
  STAFFS: "thumay_staffs",
  TECHS: "thumay_techs",
  POSTS: "thumay_posts",
  UI_PREFS: "tk_ui_prefs",
};

export const THUMAY_LOGIN_STAFF_COLLECTIONS = ["staffs", THUMAY_COLLECTIONS.STAFFS];

async function callThuMayInternalApi(path = "", options = {}) {
  const sessionToken = String(localStorage.getItem(THUMAY_POS_SESSION_TOKEN_STORAGE_KEY) || "").trim();
  const internalKey = String(localStorage.getItem(THUMAY_LEGACY_INTERNAL_KEY_STORAGE_KEY) || "").trim();
  if (!sessionToken && !internalKey) throw new Error("Thiếu đăng nhập nội bộ");

  const response = await fetch(`${THUMAY_INTERNAL_API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { "x-pos-session-token": sessionToken } : {}),
      ...(!sessionToken && internalKey ? { "x-internal-admin-key": internalKey } : {}),
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

const THUMAY_PROGRESS_LABELS = {
  processing: "Đang xử lý",
  stock_in: "Nhập kho",
  liquidation: "Thanh lý",
  return_ncc: "Trả NCC",
};

function getThuMayProgressLabel(progress = "") {
  return THUMAY_PROGRESS_LABELS[String(progress || "").trim()] || "Đang xử lý";
}

function rowsFromSnapshot(snapshot) {
  return snapshot.docs.map(normalizeDocSnapshot).filter(Boolean);
}

function onServerSnapshotOnly(q, onRows, onError) {
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites) return;
      onRows(rowsFromSnapshot(snapshot));
    },
    onError,
  );
}

export function observeThuMayTickets(onRows, onError) {
  const { db } = getLegacyClient();
  const q = query(collection(db, THUMAY_COLLECTIONS.POSTS), orderBy("sortAt", "desc"), limit(500));
  return onServerSnapshotOnly(q, onRows, onError);
}

export function observeThuMayStaffs(onRows, onError) {
  const { db } = getLegacyClient();
  const q = query(collection(db, "staffs"), limit(600));
  return onServerSnapshotOnly(q, onRows, onError);
}

export function observeThuMayStaffsDedicated(onRows, onError) {
  const { db } = getLegacyClient();
  const q = query(collection(db, THUMAY_COLLECTIONS.STAFFS), limit(600));
  return onServerSnapshotOnly(q, onRows, onError);
}

export function observeThuMayTechs(onRows, onError) {
  const { db } = getLegacyClient();
  const q = query(collection(db, THUMAY_COLLECTIONS.TECHS), limit(200));
  return onServerSnapshotOnly(q, onRows, onError);
}

export async function createThuMayTicket(data = {}) {
  const payload = await callThuMayInternalApi("/internal/pos/thumay/tickets", {
    method: "POST",
    body: data,
  });
  return { id: String(payload?.item?.id || "").trim(), ...(payload?.item || {}) };
}

export function updateThuMayTicket(ticketId, data = {}) {
  return callThuMayInternalApi(`/internal/pos/thumay/tickets/${encodeURIComponent(String(ticketId || "").trim())}`, {
    method: "PATCH",
    body: data,
  });
}

export function updateThuMayTicketStatus(ticketId, payload = {}) {
  return updateThuMayTicket(ticketId, payload);
}

export function appendThuMayStatusHistory(ticketId, ticket = {}, nextStatus = "received", note = "") {
  return updateThuMayTicket(ticketId, {
    status: nextStatus,
    statusHistory: [
      ...(Array.isArray(ticket?.statusHistory) ? ticket.statusHistory : []),
      {
        from: ticket?.status || "received",
        to: nextStatus,
        toLabel: nextStatus,
        note: String(note || "").trim(),
        at: new Date().toISOString(),
        atMillis: Date.now(),
      },
    ],
  });
}

export function saveThuMayProgressUpdate(ticket = {}, update = {}, actor = {}) {
  const ticketId = String(ticket?.id || "").trim();
  if (!ticketId) throw new Error("Thiếu mã phiếu.");
  return callThuMayInternalApi(`/internal/pos/thumay/tickets/${encodeURIComponent(ticketId)}/progress`, {
    method: "POST",
    body: {
      progress: String(update?.progress || "processing").trim() || "processing",
      note: String(update?.note || "").trim(),
      buyPrice: Number(update?.buyPrice || 0) || 0,
      progressInfo: update?.progressInfo ?? null,
      techId: update?.techId ?? null,
      techName: update?.techName ?? null,
      handoverToId: update?.handoverToId ?? null,
      handoverToName: update?.handoverToName ?? null,
    },
  });
}

export async function approveThuMayTickets(selectedTickets = [], actor = {}, progress = "") {
  const tickets = Array.isArray(selectedTickets) ? selectedTickets.filter(Boolean) : [];
  if (!tickets.length) throw new Error("Chưa có phiếu để duyệt.");
  return callThuMayInternalApi("/internal/pos/thumay/approval-batches/approve", {
    method: "POST",
    body: {
      ticketIds: tickets.map((ticket) => String(ticket?.id || "").trim()).filter(Boolean),
      progress: String(progress || tickets[0]?.handoverProgress || "processing").trim() || "processing",
    },
  });
}
