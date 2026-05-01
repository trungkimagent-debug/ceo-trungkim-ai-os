// khachhang.js - Customer rating page
// - Reads staffId + sessionId from URL
// - Generates/stores deviceId in localStorage
// - Submits rating via backend API, backend sẽ ghi ratings + mutate star_wallets
// - After success: marks qr_sessions/{sessionId}.status = "done"
// - Không gọi ratingNotify nữa, Cloud Function ratingOnCreateBridge sẽ tự xử lý

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { THKD_FIREBASE_CONFIG } from "./firebase-config.js";

const app = initializeApp(THKD_FIREBASE_CONFIG);
const db = getFirestore(app);
const STAR_PUBLIC_API_BASE = "/api/star";

// DOM
const staffNameEl = document.getElementById("staffName");
const staffHintEl = document.getElementById("staffHint");
const starInputs = Array.from(document.querySelectorAll('input[name="stars"]'));
const customerNameInput = document.getElementById("customerName");
const customerPhoneInput = document.getElementById("customerPhone");
const commentInput = document.getElementById("comment");
const btnSubmit = document.getElementById("btnSubmit");
const errBox = document.getElementById("errBox");
const doneBox = document.getElementById("doneBox");
const formBox = document.getElementById("formBox");

// Helpers
function normalizePhone(p) {
  return String(p || "").replace(/[^\d]/g, "");
}

function showErr(msg) {
  if (!errBox) return;
  if (!msg) {
    errBox.style.display = "none";
    errBox.textContent = "";
  } else {
    errBox.style.display = "block";
    errBox.textContent = msg;
  }
}

function getStars() {
  const checked = starInputs.find((x) => x.checked);
  return checked ? Number(checked.value || 0) : 0;
}

async function callStarPublicApi(path, options = {}) {
  const response = await fetch(`${STAR_PUBLIC_API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "omit",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `Lỗi API (${response.status})`);
  }
  return payload;
}

// Device fingerprint (soft)
function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem("thkd_star_device_id");
    if (!id) {
      if (crypto?.randomUUID) id = crypto.randomUUID();
      else
        id =
          "DEV-" +
          Date.now() +
          "-" +
          Math.random().toString(36).slice(2, 10);
      localStorage.setItem("thkd_star_device_id", id);
    }
    return id;
  } catch {
    return "DEV-FALLBACK-" + Math.random().toString(36).slice(2, 10);
  }
}
const DEVICE_ID = getOrCreateDeviceId();

// URL params
const url = new URL(window.location.href);
const staffId = String(url.searchParams.get("staff") || "").trim();
const sessionId = String(url.searchParams.get("session") || "").trim();
let resolvedStaffId = "";

const QR_EXPIRED_MSG = "QR Hết hiệu lực vui lòng tạo mã mới !";

if (!staffId) {
  if (staffNameEl) staffNameEl.textContent = "Nhân viên";
  if (staffHintEl) { staffHintEl.textContent = "Vui lòng quét lại QR"; staffHintEl.style.color = "#f97316"; }
  if (btnSubmit) btnSubmit.disabled = true;
}

// Load staff info (optional)
async function loadStaff() {
  try {
    if (!staffId) return;
    const sref = doc(db, "staffs", staffId);
    const snap = await getDoc(sref);
    if (!snap.exists()) {
      if (staffNameEl) staffNameEl.textContent = "Nhân viên";
      if (staffHintEl) {
        staffHintEl.textContent = "Link đánh giá không hợp lệ";
        staffHintEl.style.color = "#f97316";
      }
      if (btnSubmit) btnSubmit.disabled = true;
      showErr("QR/Link không hợp lệ. Vui lòng quét lại mã tại quầy.");
      return;
    }
    resolvedStaffId = staffId;
    const data = snap.data() || {};
    if (staffNameEl)
      staffNameEl.textContent = String(data.name || "Nhân viên");
    if (staffHintEl) staffHintEl.textContent = `Mã nhân viên: ${staffId}`;
  } catch {
    // ignore
  }
}
loadStaff();

function showBlockedState(msg) {
  try {
    // Disable all inputs
    starInputs.forEach((x) => {
      try {
        x.disabled = true;
      } catch {}
    });
    if (customerNameInput) customerNameInput.disabled = true;
    if (customerPhoneInput) customerPhoneInput.disabled = true;
    if (commentInput) commentInput.disabled = true;
    if (btnSubmit) btnSubmit.disabled = true;
  } catch {
    // ignore
  }

  // Hide the form content but keep errBox visible
  if (formBox) {
    try {
      Array.from(formBox.children).forEach((child) => {
        if (child && child.id === "errBox") child.style.display = "block";
        else if (child && child.style) child.style.display = "none";
      });
      formBox.style.display = "block";
    } catch {
      // ignore
    }
  }

  if (doneBox) doneBox.style.display = "none";
  showErr(msg);
}

async function readQrSession() {
  if (!sessionId) return null;
  try {
    const sref = doc(db, "qr_sessions", sessionId);
    const snap = await getDoc(sref);
    if (!snap.exists()) return { exists: false, data: null };
    return { exists: true, data: snap.data() || {} };
  } catch {
    return null;
  }
}

async function ensureQrSessionValidOrBlock() {
  // QR tĩnh — không cần check session
  return true;
}

async function markSessionDone(ratingId) {
  if (!sessionId) return;
  try {
    const sref = doc(db, "qr_sessions", sessionId);
    await updateDoc(sref, {
      status: "done",
      doneAt: serverTimestamp(),
      ratingId: String(ratingId || ""),
      deviceId: DEVICE_ID,
    });
  } catch {
    // ignore
  }
}

async function markSessionScanned() {
  if (!sessionId) return;
  try {
    const sref = doc(db, "qr_sessions", sessionId);
    const snap = await getDoc(sref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    const status = String(data.status || "");
    const now = Date.now();
    if (status === "done") return;
    if (status === "expired") return;
    // QR vĩnh viễn — không check expiresAtMs

    await updateDoc(sref, {
      status: "scanned",
      scannedAt: serverTimestamp(),
      deviceId: DEVICE_ID,
    });
  } catch {
    // ignore
  }
}

function showDone() {
  if (formBox) formBox.style.display = "none";
  if (doneBox) doneBox.style.display = "block";
  showErr("");
}

// QR tĩnh — không cần guard session
// initQrGuard();

// Submit handler
btnSubmit?.addEventListener("click", async () => {
  showErr("");

  if (!staffId || !resolvedStaffId) {
    showErr("QR/Link không hợp lệ. Vui lòng quét lại mã tại quầy.");
    return;
  }

  // Re-check QR validity at submit time (customer may wait past 60s).
  const ok = await ensureQrSessionValidOrBlock();
  if (!ok) return;

  const stars = getStars();
  const customerName = String(customerNameInput?.value || "").trim();
  const customerPhoneRaw = String(customerPhoneInput?.value || "").trim();
  const customerPhoneNorm = normalizePhone(customerPhoneRaw);
  const comment = String(commentInput?.value || "").trim();

  if (!stars || stars < 1 || stars > 5) {
    showErr("Vui lòng chọn số sao (1–5).");
    return;
  }
  if (!customerName) {
    showErr("Vui lòng nhập tên khách hàng.");
    return;
  }

  // Validate SĐT Việt Nam: bắt đầu bằng 0, 10 hoặc 11 số
  if (customerPhoneRaw) {
    const ok = /^0\d{9,10}$/.test(customerPhoneNorm);
    if (!ok) {
      showErr("Số điện thoại phải bắt đầu bằng 0 và có 10–11 số.");
      return;
    }
  }

  btnSubmit.disabled = true;
  btnSubmit.innerHTML =
    `<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi...`;

  try {
    const payload = await callStarPublicApi("/customer-ratings", {
      method: "POST",
      body: {
        staffId: resolvedStaffId,
        stars,
        customerName,
        customerPhone: customerPhoneRaw,
        comment,
        deviceId: DEVICE_ID,
        userAgent: navigator.userAgent || "",
        sessionId: sessionId || "",
      },
    });

    await markSessionDone(payload?.ratingId || "");

    // Không cần notify thủ công nữa.
    // ratingOnCreateBridge sẽ nghe ratings.onCreate và đẩy sang Apps Script.

    // QR tĩnh — không cần mark session
    showDone();
  } catch (e) {
    console.error(e);
    showErr("Gửi đánh giá thất bại. Vui lòng thử lại.");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML =
      `<i class="fa-solid fa-paper-plane"></i> Gửi đánh giá`;
  }
});

// Realtime runtime hooks: keep user form state on soft updates.
window.__TK_SOFT_IMPORT_SAFE__ = false;
window.__TK_PAGE_REFRESH__ = async (meta) => {
  if (meta && meta.pageId && meta.pageId !== "khachhang") return;
};
if (window.TKRealtimeRuntime && typeof window.TKRealtimeRuntime.registerStateHooks === "function") {
  window.TKRealtimeRuntime.registerStateHooks("khachhang", {
    exportState: () => ({
      customerName: customerNameInput?.value || "",
      customerPhone: customerPhoneInput?.value || "",
      comment: commentInput?.value || "",
      stars: getStars()
    }),
    importState: (state) => {
      if (!state) return;
      if (customerNameInput && typeof state.customerName === "string") customerNameInput.value = state.customerName;
      if (customerPhoneInput && typeof state.customerPhone === "string") customerPhoneInput.value = state.customerPhone;
      if (commentInput && typeof state.comment === "string") commentInput.value = state.comment;
      if (state.stars && Number(state.stars) > 0) {
        const wanted = Number(state.stars);
        starInputs.forEach((x) => {
          try { x.checked = Number(x.value || 0) === wanted; } catch (_) {}
        });
      }
    }
  });
}
