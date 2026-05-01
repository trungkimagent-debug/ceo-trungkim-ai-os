import {
  collection,
  query,
  limit,
  onSnapshot,
  orderBy,
  doc,
  getDoc,
  getDocsFromServer,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getLegacyClient, normalizeDocSnapshot } from "./firebase-client.js";

const THUGOP_INTERNAL_API_BASE = "https://api-ldnzetqooq-uc.a.run.app";
const THUGOP_LEGACY_INTERNAL_KEY_STORAGE_KEY = "thkd_internal_key";
const THUGOP_POS_SESSION_TOKEN_STORAGE_KEY = "thkd_pos_session_token";

export const THUGOP_COLLECTIONS = {
  STAFFS: "thugop_staffs",
  POSTS: "thugop_posts",
  PRODUCT_IMAGE_ARCHIVE: "thugop_product_image_archive",
  CASH_HANDOVER_LOGS: "thugop_cash_handover_logs",
  UI_PREFS: "tk_ui_prefs",
};

export const THUGOP_TICKET_SOURCE = "thugop";
export const THUGOP_CASH_HANDOVER_STATE = {
  PENDING: "pending",
  DONE: "done",
};
export const THUGOP_LOGIN_STAFF_COLLECTIONS = ["staffs", THUGOP_COLLECTIONS.STAFFS];

async function callThuGopInternalApi(path = "", options = {}) {
  const sessionToken = String(localStorage.getItem(THUGOP_POS_SESSION_TOKEN_STORAGE_KEY) || "").trim();
  const internalKey = String(localStorage.getItem(THUGOP_LEGACY_INTERNAL_KEY_STORAGE_KEY) || "").trim();
  if (!sessionToken && !internalKey) throw new Error("Thiếu đăng nhập nội bộ");

  const response = await fetch(`${THUGOP_INTERNAL_API_BASE}${path}`, {
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Thiếu file upload"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Không đọc được file upload"));
    reader.readAsDataURL(file);
  });
}

export async function uploadThuGopAsset(file, options = {}) {
  if (!file) throw new Error("Thiếu file upload");
  const dataUrl = await readFileAsDataUrl(file);
  const payload = await callThuGopInternalApi("/internal/pos/thugop/uploads", {
    method: "POST",
    body: {
      kind: String(options?.kind || "").trim(),
      ticketId: String(options?.ticketId || "").trim(),
      fileName: String(options?.fileName || file.name || "").trim(),
      contentType: String(options?.contentType || file.type || "").trim(),
      dataUrl,
    },
  });
  return payload?.asset || null;
}

function rowsFromSnapshot(snapshot) {
  return snapshot.docs.map(normalizeDocSnapshot).filter(Boolean);
}

function normalizeReceiptLookupCode(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const compact = raw.replace(/^MGD:\s*/i, "").replace(/^THKD-TG:?/i, "").trim();
  return compact.replace(/\s+/g, "").toUpperCase();
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

export function observeThuGopTickets(onRows, onError) {
  const { db } = getLegacyClient();
  const q = query(collection(db, THUGOP_COLLECTIONS.POSTS), orderBy("sortAt", "desc"));
  return onServerSnapshotOnly(q, onRows, onError);
}

export async function findThuGopTicketByReceiptCode(value = "") {
  const { db } = getLegacyClient();
  const code = normalizeReceiptLookupCode(value);
  if (!code) return null;

  const directDoc = await getDoc(doc(db, THUGOP_COLLECTIONS.POSTS, code)).catch(() => null);
  if (directDoc?.exists?.()) {
    return normalizeDocSnapshot(directDoc);
  }

  const candidates = Array.from(new Set([
    code,
    String(value || "").trim(),
    /^\d+$/.test(code) ? code.replace(/^0+/, "") : "",
  ].filter(Boolean)));

  for (const candidate of candidates) {
    const snapshot = await getDocsFromServer(query(
      collection(db, THUGOP_COLLECTIONS.POSTS),
      where("code", "==", candidate),
      limit(1),
    )).catch(() => null);
    if (snapshot && !snapshot.empty) {
      return normalizeDocSnapshot(snapshot.docs[0]);
    }
  }

  return null;
}

export function observeThuGopStaffs(onRows, onError) {
  const { db } = getLegacyClient();
  const q = query(collection(db, THUGOP_COLLECTIONS.STAFFS), limit(600));
  return onServerSnapshotOnly(q, onRows, onError);
}

export function observeThuGopLegacyStaffs(onRows, onError) {
  const { db } = getLegacyClient();
  const q = query(collection(db, "staffs"), limit(600));
  return onServerSnapshotOnly(q, onRows, onError);
}

export function observeThuGopCashHandoverLogs(onRows, onError) {
  const { db } = getLegacyClient();
  const q = query(collection(db, THUGOP_COLLECTIONS.CASH_HANDOVER_LOGS), orderBy("createdAt", "desc"), limit(120));
  return onServerSnapshotOnly(q, onRows, onError);
}

export async function createThuGopTicket(data = {}) {
  const payload = await callThuGopInternalApi("/internal/pos/thugop/tickets", {
    method: "POST",
    body: data,
  });
  return {
    ref: { id: String(payload?.item?.id || "").trim() },
    payload: payload?.item || {},
  };
}

export function updateThuGopTicket(ticketId, data = {}) {
  return callThuGopInternalApi(`/internal/pos/thugop/tickets/${encodeURIComponent(String(ticketId || "").trim())}`, {
    method: "PATCH",
    body: data,
  });
}

export function updateThuGopTicketStatus(ticketId, payload = {}) {
  return updateThuGopTicket(ticketId, payload);
}

function canActorManageThuGopMoney(actor = {}) {
  const role = String(actor?.role || actor?.actorRole || "").trim().toLowerCase();
  return ["manager", "admin", "ceo", "chairman"].includes(role);
}

export function markThuGopCollectedPayment(ticket = {}, payment = {}, actor = {}) {
  const ticketId = String(ticket?.id || "").trim();
  if (!ticketId) throw new Error("Thiếu mã phiếu.");
  if (!canActorManageThuGopMoney(actor)) throw new Error("Chỉ quản lý mới được đóng tiền Thu góp.");

  const amount = Number(payment?.amount || 0);
  if (!(amount > 0)) throw new Error("Số tiền đóng không hợp lệ.");
  const billUrl = String(payment?.billUrl || "").trim();
  if (!billUrl) throw new Error("Thiếu ảnh bill đóng tiền.");
  return callThuGopInternalApi(`/internal/pos/thugop/tickets/${encodeURIComponent(ticketId)}/collect-payment`, {
    method: "POST",
    body: {
      amount,
      billUrl,
      billPath: String(payment?.billPath || "").trim(),
      billName: String(payment?.billName || "").trim(),
      note: String(payment?.note || "").trim(),
    },
  });
}

export async function approveThuGopCashHandoverBatch(selectedTickets = [], actor = {}) {
  const tickets = Array.isArray(selectedTickets) ? selectedTickets.filter(Boolean) : [];
  if (!tickets.length) throw new Error("Chưa có phiếu giao tiền.");
  if (!canActorManageThuGopMoney(actor)) throw new Error("Chỉ quản lý mới được nhận tiền giao Thu góp.");
  return callThuGopInternalApi("/internal/pos/thugop/handover-batches/approve", {
    method: "POST",
    body: {
      ticketIds: tickets.map((ticket) => String(ticket?.id || "").trim()).filter(Boolean),
    },
  });
}
