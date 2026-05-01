/**
 * THKD POS SYSTEM - STAFF (pos.js)
 * - Staff only: tickets, status flow, rating, print/share, profile
 * - Secret open chairman: double click or long press logo => chutich.html
 *
 * UPDATE:
 * ✅ Completed list: collapse + filter NHÂN VIÊN (trái) + filter NGÀY (phải)
 * ✅ Dropdown menu position:fixed (không bị che bởi vùng scroll)
 * ✅ List hoàn tất trống vẫn hiện bar/filter đúng
 * ✅ Tạo phiếu mới xong: tự mở XEM TRƯỚC BẢN IN (fit full, không cần cuộn)
 * ✅ Đóng preview/X/ESC/backdrop: đóng preview + về danh sách phiếu
 * ✅ Status modal: đóng bằng X + click backdrop; né bàn phím (VisualViewport) để input không bị che
 */

import { ensureInternalClientAccess } from "./internal-access.js";

ensureInternalClientAccess({ allowHash: true, allowSession: true });

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, collection, query, limit, onSnapshot, orderBy,
  doc, addDoc, serverTimestamp, setDoc, updateDoc, arrayUnion, getDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// --- CONFIG ---
const CONFIG = {
  FIREBASE: {
    apiKey: "AIzaSyD859GY8qg0O7bQMmnPuRt1eRjV9n4GHZg",
    authDomain: "trungkimstar.firebaseapp.com",
    projectId: "trungkimstar",
    storageBucket: "trungkimstar.firebasestorage.app",
    messagingSenderId: "627215857693",
    appId: "1:627215857693:web:898245f32eba2ea554eef4"
  }
};

const app = initializeApp(CONFIG.FIREBASE);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (id) => document.getElementById(id);
const ADMIN_EMAIL = "trunghaukimdunggroup@gmail.com";
const StatusModalScrollLock = {
  active: false,
  bodyOverflow: "",
  bodyTouchAction: "",
  htmlOverflow: "",
  htmlTouchAction: "",
  lock: () => {
    if (StatusModalScrollLock.active) return;
    const body = document.body;
    const html = document.documentElement;
    if (!body || !html) return;
    StatusModalScrollLock.active = true;
    StatusModalScrollLock.bodyOverflow = body.style.overflow || "";
    StatusModalScrollLock.bodyTouchAction = body.style.touchAction || "";
    StatusModalScrollLock.htmlOverflow = html.style.overflow || "";
    StatusModalScrollLock.htmlTouchAction = html.style.touchAction || "";
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    html.style.overflow = "hidden";
    html.style.touchAction = "none";
  },
  unlock: () => {
    if (!StatusModalScrollLock.active) return;
    const body = document.body;
    const html = document.documentElement;
    if (!body || !html) return;
    body.style.overflow = StatusModalScrollLock.bodyOverflow;
    body.style.touchAction = StatusModalScrollLock.bodyTouchAction;
    html.style.overflow = StatusModalScrollLock.htmlOverflow;
    html.style.touchAction = StatusModalScrollLock.htmlTouchAction;
    StatusModalScrollLock.active = false;
  }
};

// --- STATUS FLOW (ERP) ---
const STATUS_FLOW = [
  { key: "received",       label: "Tiếp nhận",      percent: 10,  danger: 30  },
  { key: "diagnosing",     label: "Kiểm tra",       percent: 30,  danger: 120 },
  { key: "repairing",      label: "Đang sửa",       percent: 60,  danger: 1440 },
  { key: "fixed",          label: "Đã xong",        percent: 85,  danger: 999999 },
  { key: "waiting_pickup", label: "Chờ trả",        percent: 95,  danger: 4320 },
  { key: "delivered",      label: "Hoàn tất",       percent: 100, danger: 999999 }
];
const STATUS_INDEX = Object.fromEntries(STATUS_FLOW.map((s, i) => [s.key, i]));

// --- UTILS ---
const Utils = {
  safeLower: (s) => String(s || "").toLowerCase(),
  removeVietnameseTones: (str) => {
    str = String(str || "");
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
  },
  onlyDigits: (s) => String(s || "").replace(/[^\d]/g, ""),
  formatMoney: (vnd) => {
    const n = Number(vnd);
    return !isNaN(n) && n > 0 ? n.toLocaleString("vi-VN") : "0";
  },
  fmtVNDFromDigits: (d) => {
    const n = Number(d);
    return !isNaN(n) && n > 0 ? n.toLocaleString("vi-VN") : "";
  },
  normalizePhone: (raw) => {
    let s = Utils.onlyDigits(raw);
    if (!s) return "";
    if (s.startsWith("84")) return "0" + s.slice(2);
    if (!s.startsWith("0")) return "0" + s;
    return s;
  },
  phoneToEmail: (input) => (String(input || "").includes("@") ? input : `${Utils.onlyDigits(input)}@mp4pos.com`),
  shortImei: (imei) => {
    const s = String(imei || "").trim().replace(/\s+/g, "");
    return s.length <= 10 ? s : s.slice(-10);
  },
  statusText: (s) => {
    const map = {
      received: "Tiếp nhận", diagnosing: "Kiểm tra", repairing: "Đang sửa",
      fixed: "Đã xong", waiting_pickup: "Chờ trả", delivered: "Hoàn tất"
    };
    return map[s] || "Tiếp nhận";
  },
  pad2: (n) => String(n).padStart(2, "0"),
  getMillisSafe: (timestamp) => {
    if (!timestamp) return Date.now();
    if (typeof timestamp === "number") return timestamp;
    if (timestamp instanceof Date) return timestamp.getTime();
    return timestamp.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime();
  },
  formatDurationDigital: (minutes) => {
    if (minutes == null || minutes < 0) return "00:00";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  },
  buildSearchBlob: (r) => {
    const blob = [
      r.id, r.customerName, r.customerPhone, r.model, r.brand, r.imei,
      r.symptom, r.workNote, r.techName, r.creatorName, r.lastStatusByName, r.status, r.type
    ].filter(Boolean).join(" ");
    return Utils.removeVietnameseTones(Utils.safeLower(blob));
  },
  statusIndex: (s) => (STATUS_INDEX[String(s || "received")] ?? 0),
  statusPercent: (s) => STATUS_FLOW[Utils.statusIndex(s)]?.percent ?? 0,
  statusLabel: (s) => STATUS_FLOW[Utils.statusIndex(s)]?.label ?? "Tiếp nhận",
  kpiDangerMinutes: (s) => STATUS_FLOW[Utils.statusIndex(s)]?.danger ?? 999999,

  // --- NOTIFY ---
  notify: (msg, icon = "fa-bell") => {
    const h = document.getElementById("toastHost");
    if (!h) return;
    const isError = msg.toLowerCase().includes("lỗi") || msg.toLowerCase().includes("thất bại") || icon.includes("triangle-exclamation");
    const isSuccess = msg.toLowerCase().includes("thành công") || msg.toLowerCase().includes("đã") || icon.includes("check");
    const typeClass = isError ? "error" : (isSuccess ? "success" : "");
    const iconHtml = isError ? "fa-circle-exclamation" : (isSuccess ? "fa-circle-check" : icon);

    const d = document.createElement("div");
    d.className = `toast ${typeClass}`;
    d.innerHTML = `<i class="fa-solid ${iconHtml}"></i> <span>${msg}</span>`;
    h.prepend(d);
    setTimeout(() => {
      d.style.animation = "toastFadeOut 0.3s forwards";
      setTimeout(() => d.remove(), 300);
    }, 3000);
  },

  setLoading: (btnId, isLoading, loadingText = "Đang xử lý...") => {
    const btn = $(btnId);
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${loadingText}`;
      btn.style.opacity = "0.75";
    } else {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalText || "Xác nhận";
      btn.style.opacity = "1";
    }
  },

  debounce: (func, wait) => {
    let timeout;
    return function () {
      const context = this, args = arguments;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), wait);
    };
  },

  copyText: async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch (_) { return false; }
  }
};

const SmartImage = {
  MIN_OPTIMIZE_SIZE: 250 * 1024,
  MAX_DIMENSION: 1600,
  UPLOAD_QUALITY: 0.84,
  _styleInjected: false,
  _observer: null,

  formatBytes: (bytes = 0) => {
    const n = Number(bytes || 0);
    if (!Number.isFinite(n) || n <= 0) return "0KB";
    if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
    return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  },

  optimizeForUpload: async (file) => {
    if (!(file instanceof Blob)) return file;
    if (!String(file.type || "").startsWith("image/")) return file;
    if (Number(file.size || 0) < SmartImage.MIN_OPTIMIZE_SIZE) return file;

    let bitmap = null;
    try {
      if (typeof createImageBitmap === "function") {
        try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
        catch (_) { bitmap = await createImageBitmap(file); }
      }
    } catch (_) {}

    if (!bitmap) {
      const url = URL.createObjectURL(file);
      try {
        bitmap = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      } finally {
        try { URL.revokeObjectURL(url); } catch (_) {}
      }
    }

    const srcWidth = Number(bitmap?.width || 0);
    const srcHeight = Number(bitmap?.height || 0);
    if (!srcWidth || !srcHeight) return file;

    const ratio = Math.min(1, SmartImage.MAX_DIMENSION / Math.max(srcWidth, srcHeight));
    const targetWidth = Math.max(1, Math.round(srcWidth * ratio));
    const targetHeight = Math.max(1, Math.round(srcHeight * ratio));
    if (ratio >= 0.999 && Number(file.size || 0) <= 500 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    const outBlob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", SmartImage.UPLOAD_QUALITY);
    });
    if (!outBlob || outBlob.size >= file.size) return file;

    const originalName = String(file.name || `bill_${Date.now()}`);
    const baseName = originalName.replace(/\.[^/.]+$/, "");
    return new File([outBlob], `${baseName || "bill"}.jpg`, { type: "image/jpeg" });
  },

  applyToImage: (img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.tkSmartInit === "1") return;
    img.dataset.tkSmartInit = "1";
    if (!img.loading) img.loading = "lazy";
    if (!img.decoding) img.decoding = "async";
    if ("fetchPriority" in img && !img.getAttribute("fetchpriority")) img.fetchPriority = "low";

    if (!img.complete || !img.naturalWidth) {
      img.classList.add("tk-img-blur");
      const done = () => {
        img.classList.add("tk-img-ready");
        img.classList.remove("tk-img-blur");
      };
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    }
  },

  hydrateLazyImages: (root = document) => {
    const scope = root && typeof root.querySelectorAll === "function" ? root : document;
    scope.querySelectorAll("img").forEach(SmartImage.applyToImage);
  },

  ensureStyle: () => {
    if (SmartImage._styleInjected) return;
    const style = document.createElement("style");
    style.id = "tk-smart-image-style";
    style.textContent = `
      img.tk-img-blur{filter:blur(10px);transform:scale(1.015);opacity:.78;transition:filter .25s ease,opacity .25s ease,transform .25s ease}
      img.tk-img-ready{filter:none;transform:none;opacity:1}
    `;
    document.head.appendChild(style);
    SmartImage._styleInjected = true;
  },

  installLazyRuntime: () => {
    SmartImage.ensureStyle();
    SmartImage.hydrateLazyImages(document);
    if (SmartImage._observer) return;
    SmartImage._observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.tagName === "IMG") SmartImage.applyToImage(node);
          SmartImage.hydrateLazyImages(node);
        });
      }
    });
    SmartImage._observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
  }
};

/* =========================
   Completed UI (ĐÃ HOÀN TẤT)
   - Collapse
   - Filter NHÂN VIÊN (trái)
   - Filter NGÀY (phải)
   - Dropdown fixed (không bị che bởi scroll container)
   - List trống vẫn hiện bar/filter đúng
   ========================= */
const CompletedUI = (() => {
  const STORAGE_OPEN = "thkd_completed_open_v1";
  const STORAGE_FILTER = "thkd_completed_filter_v1";
  const STORAGE_STAFF = "thkd_completed_staff_v1"; // lọc nhân viên

  const toStartOfDay = (ms) => { const d = new Date(ms); d.setHours(0,0,0,0); return d.getTime(); };
  const toEndOfDay   = (ms) => { const d = new Date(ms); d.setHours(23,59,59,999); return d.getTime(); };
  const fmtDateVN = (ms) => {
    if (!ms) return "";
    const d = new Date(ms);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    return `${dd}/${mm}/${yy}`;
  };
  const mondayStart = (ms) => {
    const d = new Date(ms);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d.getTime();
  };
  const monthStart = (ms) => {
    const d = new Date(ms);
    d.setDate(1);
    d.setHours(0,0,0,0);
    return d.getTime();
  };
  const prevMonthRange = (ms) => {
    const d = new Date(ms);
    d.setDate(1);
    d.setHours(0,0,0,0);
    d.setMonth(d.getMonth() - 1);
    const start = d.getTime();
    const e = new Date(start);
    e.setMonth(e.getMonth() + 1);
    e.setDate(0);
    e.setHours(23,59,59,999);
    return { start, end: e.getTime() };
  };

  const getRange = (mode, custom) => {
    const now = Date.now();
    const todayS = toStartOfDay(now);
    const todayE = toEndOfDay(now);
    if (mode === "today") return { start: todayS, end: todayE, label: "Hôm nay" };
    if (mode === "yesterday") {
      const y = todayS - 86400000;
      return { start: toStartOfDay(y), end: toEndOfDay(y), label: "Hôm qua" };
    }
    if (mode === "7days") {
      return { start: todayS - 7 * 86400000, end: todayE, label: "7 ngày qua" };
    }
    if (mode === "this_week") {
      const s = mondayStart(now);
      return { start: s, end: todayE, label: "Tuần này" };
    }
    if (mode === "this_month") {
      const s = monthStart(now);
      return { start: s, end: todayE, label: "Tháng này" };
    }
    if (mode === "last_month") {
      const r = prevMonthRange(now);
      return { ...r, label: "Tháng trước" };
    }
    if (mode === "this_quarter") {
      const d = new Date(now);
      const qm = Math.floor(d.getMonth() / 3) * 3;
      const s = new Date(d.getFullYear(), qm, 1).getTime();
      return { start: s, end: todayE, label: "Quý này" };
    }
    if (mode === "this_year") {
      const d = new Date(now);
      const s = new Date(d.getFullYear(), 0, 1).getTime();
      return { start: s, end: todayE, label: "Năm nay" };
    }
    if (mode === "custom" && custom?.start && custom?.end) {
      return { start: custom.start, end: custom.end, label: `${fmtDateVN(custom.start)}–${fmtDateVN(custom.end)}` };
    }
    return { start: todayS, end: todayE, label: "Hôm nay" };
  };

  const loadFilter = () => {
    try {
      const raw = localStorage.getItem(STORAGE_FILTER);
      if (!raw) return { mode: "today", custom: null };
      const j = JSON.parse(raw);
      return { mode: j?.mode || "today", custom: j?.custom || null };
    } catch {
      return { mode: "today", custom: null };
    }
  };
  const saveFilter = (st) => {
    try { localStorage.setItem(STORAGE_FILTER, JSON.stringify(st || { mode: "today", custom: null })); } catch {}
  };

  const loadStaff = () => {
    try {
      const raw = localStorage.getItem(STORAGE_STAFF);
      return raw ? String(raw) : "all";
    } catch { return "all"; }
  };
  const saveStaff = (v) => {
    try { localStorage.setItem(STORAGE_STAFF, String(v || "all")); } catch {}
  };

  const ensureDateModal = () => {
    // Modal đã có sẵn trong pos.html, không cần tạo
    const modal = document.getElementById("thkdDateModal");
    if (!modal) return;
    // Init quick buttons
    modal.querySelectorAll('.thkd-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const days = Number(btn.dataset.qdays);
        const now = new Date();
        const from = document.getElementById('thkdFromDate');
        const to = document.getElementById('thkdToDate');
        if(to) to.value = now.toISOString().split('T')[0];
        if(from) from.value = new Date(now.getTime() - days*86400000).toISOString().split('T')[0];
        modal.querySelectorAll('.thkd-quick-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  };

  const openDateModal = (onApply) => {
    ensureDateModal();
    const modal = document.getElementById("thkdDateModal");
    const from = document.getElementById("thkdFromDate");
    const to = document.getElementById("thkdToDate");
    const cancel = document.getElementById("thkdCancelDate");
    const apply = document.getElementById("thkdApplyDate");
    if (!modal || !from || !to || !cancel || !apply) return;

    const st = loadFilter();
    if (st.mode === "custom" && st.custom?.start && st.custom?.end) {
      from.valueAsDate = new Date(st.custom.start);
      to.valueAsDate = new Date(st.custom.end);
    }

    modal.classList.add("show");
    const close = () => modal.classList.remove("show");

    cancel.onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    apply.onclick = () => {
      const fd = from.value ? new Date(from.value) : null;
      const td = to.value ? new Date(to.value) : null;
      if (!fd || !td) return;
      const start = toStartOfDay(fd.getTime());
      const end = toEndOfDay(td.getTime());
      if (end < start) return;
      close();
      onApply?.({ start, end });
    };
  };

  const pickDeliveredMs = (t) => Utils.getMillisSafe(
    t?.closedAt || t?.deliveredAt || t?.updatedAt || t?.sortAt || t?.createdAt || Date.now()
  );

  const addDeliveredBadge = (cardEl, ms) => {
    try {
      if (!cardEl) return;
      if (cardEl.querySelector(".thkd-delivered-date")) return;
      cardEl.classList.add("thkd-card");
      const b = document.createElement("div");
      b.className = "thkd-delivered-date";
      b.textContent = fmtDateVN(ms);
      cardEl.prepend(b);
    } catch {}
  };

  const ensureIdDataset = (container) => {
    const items = Array.from(container.querySelectorAll(".ticket-item"));
    for (const el of items) {
      if (el.dataset?.id) continue;
      const onclick = el.getAttribute("onclick") || "";
      const m = onclick.match(/handleItemClick\('([^']+)'\)/);
      if (m?.[1]) el.dataset.id = m[1];
    }
  };

  const ensureEmptyPlaceholder = (wrap) => {
    if (!wrap) return null;
    let empty = wrap.querySelector(".thkd-empty");
    if (!empty) {
      empty = document.createElement("div");
      empty.className = "thkd-empty";
      empty.style.cssText = "text-align:center;padding:10px;color:#9ca3af;font-size:12px";
      empty.textContent = "Trống";
      wrap.appendChild(empty);
    }
    return empty;
  };

  const wrapCompletedBlock = (colBuy, barEl) => {
    const existing = colBuy.querySelector(".thkd-completed-wrap");
    if (existing) return existing;

    const wrap = document.createElement("div");
    wrap.className = "thkd-completed-wrap";

    let cur = barEl.nextElementSibling;
    const move = [];
    while (cur) {
      if (cur.classList && cur.classList.contains("section-label")) break;
      if (cur.classList && cur.classList.contains("thkd-completed-wrap")) break;
      const next = cur.nextElementSibling;
      move.push(cur);
      cur = next;
    }
    move.forEach(n => wrap.appendChild(n));
    colBuy.appendChild(wrap);
    return wrap;
  };

  const ensureOpenState = (wrap) => {
    const saved = localStorage.getItem(STORAGE_OPEN);
    const open = saved === "1";
    if (open) document.body.classList.add("thkd-completed-open");
    else document.body.classList.remove("thkd-completed-open");

    if (!open) {
      wrap.classList.add("thkd-hidden");
      wrap.style.maxHeight = "0px";
    } else {
      wrap.classList.remove("thkd-hidden");
      wrap.style.maxHeight = "none";
    }
  };

  const applyFilterToWrap = (wrap, ticketsById) => {
    const st = loadFilter();
    const r = getRange(st.mode, st.custom);
    const staffSel = loadStaff();

    const items = Array.from(wrap.querySelectorAll(".ticket-item"));
    const empty = ensureEmptyPlaceholder(wrap);

    let shown = 0;

    if (items.length === 0) {
      if (empty) empty.style.display = "";
      const countEl = document.getElementById("thkdCompletedCount");
      if (countEl) countEl.textContent = "0";
      return 0;
    }

    for (const el of items) {
      const id = (el.dataset?.id || "");
      const t = ticketsById.get(id);

      const ms = t ? pickDeliveredMs(t) : 0;

      const staffName = String(t?.lastStatusByName || t?.creatorName || "").trim();
      const staffOk = (staffSel === "all") ? true : (staffName === staffSel);
      const dateOk = ms && ms >= r.start && ms <= r.end;

      const ok = staffOk && dateOk;

      el.style.display = ok ? "" : "none";
      if (ok) {
        shown += 1;
        addDeliveredBadge(el, ms);
      }
    }

    if (empty) empty.style.display = (shown === 0) ? "" : "none";

    const countEl = document.getElementById("thkdCompletedCount");
    if (countEl) countEl.textContent = String(shown);

    if (document.body.classList.contains("thkd-completed-open")) {
      wrap.style.maxHeight = "none";
    }

    return shown;
  };

  const decorateDeliveredBadgeInSearch = (container, ticketsById, searchTerm) => {
    const term = String(searchTerm || "").trim();
    if (!term) return;

    ensureIdDataset(container);

    const items = Array.from(container.querySelectorAll(".ticket-item"));
    for (const el of items) {
      const id = el.dataset?.id || "";
      const t = ticketsById.get(id);
      if (!t) continue;
      if (String(t.status || "") !== "delivered") continue;
      addDeliveredBadge(el, pickDeliveredMs(t));
    }
  };

  // bar + 2 filter (NV trái, Ngày phải) + menu fixed
  const buildCompletedHeaderBar = (labelEl, historyTickets) => {
    const count = Array.isArray(historyTickets) ? historyTickets.length : 0;

    const staffSet = new Set();
    (historyTickets || []).forEach(t => {
      const name = String(t?.lastStatusByName || t?.creatorName || "").trim();
      if (name) staffSet.add(name);
    });
    const staffList = Array.from(staffSet).sort((a,b)=>a.localeCompare(b,"vi"));

    const bar = document.createElement("div");
    bar.className = "thkd-completed-bar";
    bar.style.marginTop = "4px";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "thkd-completed-toggle";
    toggle.innerHTML = `
      <div class="left">
        <span class="title"> >>> </span>
        <span class="count" id="thkdCompletedCount">${count}</span>
      </div>
      <span class="chev">▾</span>
    `;

    const filterWrap = document.createElement("div");
    filterWrap.className = "thkd-completed-filter";

    // Staff filter (left)
    const currentStaff = loadStaff();
    const staffLabelText = (currentStaff === "all") ? "Tất cả NV" : currentStaff;

    const staffWrap = document.createElement("div");
    staffWrap.className = "thkd-staff-filter";
    staffWrap.innerHTML = `
      <button class="thkd-staff-btn" type="button" id="thkdStaffBtn">
        <span id="thkdStaffLabel">${staffLabelText}</span>
        <span class="chev">▾</span>
      </button>
      <div class="thkd-staff-menu" id="thkdStaffMenu">
        <button class="thkd-staff-item" data-staff="all" type="button">Tất cả <span class="hint">mặc định</span></button>
        ${staffList.map(n => `<button class="thkd-staff-item" data-staff="${n.replace(/"/g,'&quot;')}" type="button">${n}</button>`).join("")}
      </div>
    `;

    // Date filter (right)
    const st = loadFilter();
    const rr = getRange(st.mode, st.custom);

    const dateWrap = document.createElement("div");
    dateWrap.className = "thkd-date-filter";
    dateWrap.innerHTML = `
      <button class="thkd-filter-btn" type="button" id="thkdFilterBtn">
        <span id="thkdFilterLabel">${rr.label}</span>
        <span class="chev">▾</span>
      </button>
      <div class="thkd-filter-menu" id="thkdFilterMenu">
        <button class="thkd-filter-item" data-mode="today" type="button">Hôm nay <span class="hint">mặc định</span></button>
        <button class="thkd-filter-item" data-mode="yesterday" type="button">Hôm qua</button>
        <button class="thkd-filter-item" data-mode="7days" type="button">7 ngày qua</button>
        <button class="thkd-filter-item" data-mode="this_week" type="button">Tuần này</button>
        <button class="thkd-filter-item" data-mode="this_month" type="button">Tháng này</button>
        <button class="thkd-filter-item" data-mode="last_month" type="button">Tháng trước</button>
        <button class="thkd-filter-item" data-mode="this_quarter" type="button">Quý này</button>
        <button class="thkd-filter-item" data-mode="this_year" type="button">Năm nay</button>
        <button class="thkd-filter-item" data-mode="custom" type="button">📅 Chọn thời gian <span class="hint">từ–đến</span></button>
      </div>
    `;

    filterWrap.appendChild(staffWrap);
    filterWrap.appendChild(dateWrap);

    bar.appendChild(toggle);
    bar.appendChild(filterWrap);

    labelEl.replaceWith(bar);

    const scroller = document.getElementById("marketList");

    const placeMenu = (btnEl, menuEl) => {
      if (!btnEl || !menuEl) return;

      const rectBtn = btnEl.getBoundingClientRect();
      const menuH = Math.min(menuEl.scrollHeight || 260, 360);

      const right = Math.max(8, window.innerWidth - rectBtn.right);
      let top = rectBtn.bottom + 8;

      if (top + menuH > window.innerHeight - 8) {
        top = Math.max(8, rectBtn.top - 8 - menuH);
      }

      menuEl.style.right = `${right}px`;
      menuEl.style.left = "auto";
      menuEl.style.top = `${top}px`;
    };

    // STAFF MENU
    const staffBtn = staffWrap.querySelector("#thkdStaffBtn");
    const staffMenu = staffWrap.querySelector("#thkdStaffMenu");
    const staffLabel = staffWrap.querySelector("#thkdStaffLabel");

    const closeStaffMenu = () => {
      staffWrap.classList.remove("thkd-staff-open");
      window.removeEventListener("resize", onStaffResize);
      scroller?.removeEventListener("scroll", closeStaffMenu);
    };
    const onStaffResize = () => placeMenu(staffBtn, staffMenu);

    const openStaffMenu = () => {
      staffWrap.classList.add("thkd-staff-open");
      requestAnimationFrame(() => {
        placeMenu(staffBtn, staffMenu);
        window.addEventListener("resize", onStaffResize);
        scroller?.addEventListener("scroll", closeStaffMenu, { passive: true });
      });
    };

    staffBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      dateWrap.classList.remove("thkd-filter-open");
      if (staffWrap.classList.contains("thkd-staff-open")) closeStaffMenu();
      else openStaffMenu();
    });

    staffMenu?.addEventListener("click", (e) => {
      const it = e.target.closest(".thkd-staff-item");
      if (!it) return;
      const staff = it.getAttribute("data-staff") || "all";
      saveStaff(staff);
      staffLabel.textContent = (staff === "all") ? "Tất cả NV" : staff;
      closeStaffMenu();
      Controllers.List.render($("search")?.value || "");
    });

    // DATE MENU
    const dateBtn = dateWrap.querySelector("#thkdFilterBtn");
    const dateMenu = dateWrap.querySelector("#thkdFilterMenu");
    const dateLabel = dateWrap.querySelector("#thkdFilterLabel");

    const closeDateMenu = () => {
      dateWrap.classList.remove("thkd-filter-open");
      window.removeEventListener("resize", onDateResize);
      scroller?.removeEventListener("scroll", closeDateMenu);
    };
    const onDateResize = () => placeMenu(dateBtn, dateMenu);

    const openDateMenuFixed = () => {
      dateWrap.classList.add("thkd-filter-open");
      requestAnimationFrame(() => {
        placeMenu(dateBtn, dateMenu);
        window.addEventListener("resize", onDateResize);
        scroller?.addEventListener("scroll", closeDateMenu, { passive: true });
      });
    };

    dateBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      staffWrap.classList.remove("thkd-staff-open");
      if (dateWrap.classList.contains("thkd-filter-open")) closeDateMenu();
      else openDateMenuFixed();
    });

    dateMenu?.addEventListener("click", (e) => {
      const it = e.target.closest(".thkd-filter-item");
      if (!it) return;
      const mode = it.getAttribute("data-mode");
      closeDateMenu();

      if (mode === "custom") {
        openDateModal((range) => {
          const st2 = { mode: "custom", custom: range };
          saveFilter(st2);
          dateLabel.textContent = getRange(st2.mode, st2.custom).label;
          Controllers.List.render($("search")?.value || "");
        });
        return;
      }

      const st2 = { mode, custom: null };
      saveFilter(st2);
      dateLabel.textContent = getRange(st2.mode, st2.custom).label;
      Controllers.List.render($("search")?.value || "");
    });

    // click outside => close
    document.addEventListener("click", () => {
      closeStaffMenu();
      closeDateMenu();
    });

    // Filter chỉ hiện khi list hoàn tất đang mở
    const setFilterVisible = (isOpen) => {
      closeStaffMenu();
      closeDateMenu();
      filterWrap.style.display = isOpen ? "" : "none";
    };

    const openSaved = localStorage.getItem(STORAGE_OPEN) === "1";
    setFilterVisible(openSaved);

    // collapse behavior
    toggle?.addEventListener("click", () => {
      const wrap = document.querySelector(".thkd-completed-wrap");
      if (!wrap) return;

      const open = document.body.classList.contains("thkd-completed-open");
      const next = !open;

      if (next) document.body.classList.add("thkd-completed-open");
      else document.body.classList.remove("thkd-completed-open");

      try { localStorage.setItem(STORAGE_OPEN, next ? "1" : "0"); } catch {}

      setFilterVisible(next);

      if (!next) {
        const h = Math.max(1, wrap.scrollHeight);
        wrap.style.maxHeight = h + "px";
        wrap.getBoundingClientRect();
        wrap.classList.add("thkd-hidden");
        wrap.style.maxHeight = "0px";
      } else {
        wrap.classList.remove("thkd-hidden");
        const h = Math.max(1, wrap.scrollHeight);
        wrap.style.maxHeight = h + "px";
        setTimeout(() => { wrap.style.maxHeight = "none"; }, 260);
      }
    });

    return bar;
  };

  const decorate = (searchTerm, historyTickets) => {
    const colBuy = $("colBuy");
    if (!colBuy) return;

    const existingBar = colBuy.querySelector(".thkd-completed-bar");
    if (existingBar) {
      const wrap = colBuy.querySelector(".thkd-completed-wrap");
      if (wrap) {
        const map = new Map((historyTickets || []).map(t => [t.id, t]));
        ensureIdDataset(wrap);
        applyFilterToWrap(wrap, map);
      }
      decorateDeliveredBadgeInSearch(
        document.getElementById("marketList") || document.body,
        new Map(AppState.tickets.map(t => [t.id, t])),
        searchTerm
      );
      return;
    }

    const label = colBuy.querySelector(".section-label");
    if (!label) return;

    const labelText = (label.innerText || "").toUpperCase();
    if (!labelText.includes("ĐÃ HOÀN TẤT")) return;

    const bar = buildCompletedHeaderBar(label, historyTickets || []);
    const wrap = wrapCompletedBlock(colBuy, bar);

    ensureOpenState(wrap);

    const map = new Map((historyTickets || []).map(t => [t.id, t]));
    ensureIdDataset(wrap);
    applyFilterToWrap(wrap, map);

    decorateDeliveredBadgeInSearch(
      document.getElementById("marketList") || document.body,
      new Map(AppState.tickets.map(t => [t.id, t])),
      searchTerm
    );
  };
  const filterHistoryTickets = (historyTickets = []) => {
    const st = loadFilter();
    const r = getRange(st.mode, st.custom);
    return (Array.isArray(historyTickets) ? historyTickets : []).filter((t) => {
      const ms = pickDeliveredMs(t);
      return ms >= r.start && ms <= r.end;
    });
  };

  const updateTopDateButton = () => {
    const btn = document.getElementById("completedDateBtn");
    if (!btn) return;
    const st = loadFilter();
    const label = getRange(st.mode, st.custom).label;
    btn.title = `Lọc ngày: ${label}`;
    btn.setAttribute("aria-label", `Lọc ngày hoàn tất: ${label}`);
    btn.classList.toggle("active", st.mode !== "today");
  };

  const setTopDateVisible = (visible) => {
    const btn = document.getElementById("completedDateBtn");
    const menu = document.getElementById("completedDateMenu");
    if (btn) btn.classList.toggle("show", !!visible);
    if (!visible && menu) menu.style.display = "none";
    if (visible) updateTopDateButton();
  };

  const decorateDeliveredBadges = (historyTickets = []) => {
    const colBuy = $("colBuy");
    if (!colBuy) return;
    const map = new Map((historyTickets || []).map((t) => [t.id, t]));
    ensureIdDataset(colBuy);
    const items = Array.from(colBuy.querySelectorAll(".ticket-item"));
    for (const el of items) {
      const id = el.dataset?.id || "";
      const t = map.get(id);
      if (!t) continue;
      addDeliveredBadge(el, pickDeliveredMs(t));
    }
  };

  let topDateBound = false;
  const bindTopDateFilter = () => {
    if (topDateBound) return;
    topDateBound = true;
    const btn = document.getElementById("completedDateBtn");
    const menu = document.getElementById("completedDateMenu");
    const scroller = document.getElementById("marketList");
    if (!btn || !menu) return;

    const placeMenu = () => {
      const rectBtn = btn.getBoundingClientRect();
      const menuH = Math.min(menu.scrollHeight || 260, 360);
      const right = Math.max(8, window.innerWidth - rectBtn.right);
      let top = rectBtn.bottom + 8;
      if (top + menuH > window.innerHeight - 8) top = Math.max(8, rectBtn.top - 8 - menuH);
      menu.style.right = `${right}px`;
      menu.style.left = "auto";
      menu.style.top = `${top}px`;
    };
    const closeMenu = () => {
      menu.style.display = "none";
      window.removeEventListener("resize", placeMenu);
      scroller?.removeEventListener("scroll", closeMenu);
    };
    const openMenu = () => {
      menu.style.display = "block";
      requestAnimationFrame(() => {
        placeMenu();
        window.addEventListener("resize", placeMenu);
        scroller?.addEventListener("scroll", closeMenu, { passive: true });
      });
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menu.style.display === "block") closeMenu();
      else openMenu();
    });
    menu.addEventListener("click", (e) => {
      const it = e.target.closest(".thkd-filter-item");
      if (!it) return;
      const mode = it.getAttribute("data-mode");
      closeMenu();

      if (mode === "custom") {
        openDateModal((range) => {
          saveFilter({ mode: "custom", custom: range });
          updateTopDateButton();
          Controllers.List.render($("search")?.value || "");
        });
        return;
      }

      saveFilter({ mode, custom: null });
      updateTopDateButton();
      Controllers.List.render($("search")?.value || "");
    });
    document.addEventListener("click", () => closeMenu());
  };

  return { decorate, filterHistoryTickets, setTopDateVisible, updateTopDateButton, decorateDeliveredBadges, bindTopDateFilter };
})();

// --- RECEIPT PRINT + SHARE (FIT FULL, NO SCROLL) ---
const Receipt = {
  buildHTML: (ticket, mode = "receive") => {
    const nowMs = Date.now();
    const createdMs = Utils.getMillisSafe(ticket.createdAt || nowMs);
    const closedMs  = Utils.getMillisSafe(ticket.closedAt  || nowMs);
    const timeToPrint = mode === "return" ? closedMs : createdMs;
    const d = new Date(timeToPrint);
    const dateStr = `${Utils.pad2(d.getDate())}/${Utils.pad2(d.getMonth()+1)}/${d.getFullYear()} ${Utils.pad2(d.getHours())}:${Utils.pad2(d.getMinutes())}`;

    const displayId = ticket.code ? String(ticket.code).toUpperCase() : (ticket.id || "").slice(-6).toUpperCase();
    const storeName = "TRUNG HẬU KIM DUNG";
    const title = mode === "return" ? "PHIẾU TRẢ MÁY" : "PHIẾU NHẬN MÁY";
    const typeLabel = ticket.type === "warranty" ? "BẢO HÀNH" : "SỬA CHỮA";
    const staffLabel = mode === "return" ? "Nhân viên trả" : "Nhân viên nhận";
    const staffName = mode === "return"
      ? (ticket.lastStatusByName || ticket.creatorName || "NV")
      : (ticket.creatorName || "NV");

    const thu = Number(ticket.estimateCost || 0);
    const moneyBlock = mode === "return"
      ? `<div class="row total"><span>THANH TOÁN</span><b>${Utils.formatMoney(thu)} đ</b></div>`
      : ``;

    const safeText = (s) => String(s || "").replace(/[<>]/g, "");
    const cName = safeText(ticket.customerName || "Khách");
    const cPhone = ticket.customerPhone ? Utils.normalizePhone(ticket.customerPhone) : "";
    const model = safeText(ticket.model || "Máy");
    const imei = safeText(ticket.imei || "No");
    const pass = safeText(ticket.devicePass || "No");
    const symptom = safeText(ticket.symptom || "...");
    const note = safeText(ticket.lastStatusNote || "");

    return `<!doctype html><html lang="vi"><head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
      <title>${title} • ${displayId}</title>
      <style>
        :root{--mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace}
        *{box-sizing:border-box}
        html,body{height:100%; margin:0; background:#fff; overflow:hidden}
        body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;padding:10px}
        #sheet{width:380px;max-width:92vw;border:1px solid #e5e7eb;border-radius:16px;padding:12px;background:#fff}
        .center{text-align:center}
        .store{font-weight:900;font-size:18px;text-transform:uppercase;color:#000;line-height:1.15}
        .muted{color:#6b7280;font-size:11px}
        .title{font-weight:900;font-size:15px;margin-top:8px;text-transform:uppercase;color:#000}
        .mono{font-family:var(--mono)}
        .ticket-code{font-size:24px;font-weight:900;color:#000;margin:2px 0;letter-spacing:1px}
        .info-group{border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;margin-top:10px;overflow:hidden}
        .info-row{padding:10px;border-bottom:1px dashed #e5e7eb}
        .info-row:last-child{border-bottom:none}
        .k{font-size:10px;font-weight:900;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
        .v{font-size:13px;font-weight:900;color:#111827;line-height:1.25}
        .subline{margin-top:2px;color:#6b7280;font-size:11px}
        .mono-line{font-family:var(--mono);font-size:11px;color:#4b5563}
        .clamp1{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
        .clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .sep{margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:8px}
        .row{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin:6px 0;line-height:1.2}
        .row b{font-family:var(--mono);font-size:12px;font-weight:800}
        .total{border-top:2px dashed #000;padding-top:8px;margin-top:8px;font-weight:900;font-size:15px;color:#000}
        .foot{margin-top:10px;text-align:center;font-size:11px;color:#6b7280}
        @media (max-height: 620px){
          #sheet{padding:10px}
          .store{font-size:16px}
          .ticket-code{font-size:22px}
          .info-row{padding:9px}
        }
      </style>
    </head><body>
      <div id="sheet">
        <div class="center">
          <div class="store">${storeName}</div>
          <div class="muted">POS System</div>
          <div class="title">${title}</div>
          <div class="ticket-code mono">${displayId}</div>
          <div class="muted" style="text-transform:uppercase">${typeLabel}</div>
          <div class="muted">${dateStr}</div>
        </div>

        <div class="info-group">
          <div class="info-row">
            <div class="k">KHÁCH HÀNG</div>
            <div class="v clamp1">${cName}${cPhone ? ` • ${cPhone}` : ""}</div>
          </div>
          <div class="info-row">
            <div class="k">THIẾT BỊ</div>
            <div class="v clamp1">${model}</div>
            <div class="mono-line clamp1">IMEI: ${imei}</div>
            <div class="mono-line clamp1">Pass: ${pass}</div>
          </div>
          <div class="info-row">
            <div class="k">TÌNH TRẠNG MÁY</div>
            <div class="v clamp2">${symptom}</div>
            ${note ? `<div class="subline clamp2" style="font-style:italic">"${note}"</div>` : ``}
          </div>
        </div>

        <div class="sep">
          <div class="row"><span>${staffLabel}:</span><b>${safeText(staffName)}</b></div>
          ${moneyBlock}
        </div>

        <div class="foot">Cảm ơn quý khách!</div>
      </div>

      <script>
        (function(){
          function fit(){
            const sheet = document.getElementById('sheet');
            if(!sheet) return;
            sheet.style.transform = 'none';
            const vw = Math.max(1, window.innerWidth);
            const vh = Math.max(1, window.innerHeight);
            const rect = sheet.getBoundingClientRect();
            const s = Math.min((vw - 20) / rect.width, (vh - 20) / rect.height, 1);
            sheet.style.transformOrigin = 'top left';
            sheet.style.transform = 'scale(' + s + ')';
          }
          window.addEventListener('load', ()=>setTimeout(fit, 50));
          window.addEventListener('resize', ()=>setTimeout(fit, 50));
        })();
      </script>
    </body></html>`;
  },

  buildText: (ticket, mode) => {
    const code = ticket.code || (ticket.id || "").slice(-6);
    return `THKD POS\n${mode==="return"?"PHIẾU TRẢ":"PHIẾU NHẬN"} ${code}\nKhách: ${ticket.customerName}\nMáy: ${ticket.model}\nLỗi: ${ticket.symptom || "..."}\n\nXem chi tiết tại cửa hàng.`;
  },

  print: (ticket, mode) => {
    const html = Receipt.buildHTML(ticket, mode);
    const modal = $("printPreviewModal");

    const closeNow = () => {
      try { if (modal) modal.style.display = "none"; } catch {}
      try { Controllers?.Modals?.close?.($("postModal")); } catch {}
      try { Controllers?.Modals?.close?.($("statusModal")); } catch {}
      try { const rm = $("ratingModal"); if (rm) rm.style.display = "none"; } catch {}
      try { document.onkeydown = null; } catch {}
    };

    if (modal) {
      modal.style.display = "flex";
      modal.onclick = (e) => { if (e.target === modal) closeNow(); };

      const iframe = $("printIframe");
      if (iframe) {
        const doc = iframe.contentWindow.document;
        doc.open(); doc.write(html); doc.close();
      }

      const btnReal = $("btnRealPrint");
      if (btnReal && iframe) {
        btnReal.onclick = () => { iframe.contentWindow.focus(); iframe.contentWindow.print(); };
      }

      $("btnClosePrintPreview")?.addEventListener("click", closeNow);
      $("btnClosePrintPreview2")?.addEventListener("click", closeNow);

      document.onkeydown = (e) => { if (e.key === "Escape") closeNow(); };
    } else {
      const w = window.open("", "_blank", "width=800,height=900");
      if (w) { w.document.write(html); w.document.close(); }
    }
  },

  shareZalo: async (ticket, mode) => {
    const text = Receipt.buildText(ticket, mode);
    if (navigator.share) { try { await navigator.share({ title: "Phiếu", text }); return; } catch (_) {} }
    const ok = await Utils.copyText(text);
    if (ok) { Utils.notify("Đã copy nội dung. Mở Zalo dán ngay!", "fa-copy"); window.open("https://zalo.me", "_blank"); }
  }
};

// --- STATE ---
const AppState = window.__TK_POS_APPSTATE__ || {
  user: null, uid: null, wallet: null, isAdmin: false,
  tickets: [], techs: [], editingPostId: null, postType: "repair",
  currentStatusTicket: null, searchIndex: new Map(), unsubs: [],
  billUpload: { file: null, url: "", path: "", name: "" }
};
window.__TK_POS_APPSTATE__ = AppState;

function normalizeCustomerDisplayName(value = "") {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  if (!compact) return "";
  return compact
    .toLocaleLowerCase("vi-VN")
    .replace(/(^|[\s.-]+)(\p{L})/gu, (match, prefix, char) => `${prefix}${char.toLocaleUpperCase("vi-VN")}`);
}

// --- UI COMPONENTS ---
const Components = {
  ticketCard: (r) => {
    const revenue = Number(r.estimateCost ?? r.price ?? 0);
    const priceText = revenue > 0 ? Utils.formatMoney(revenue) : "0";

    const model = r.model || r.brand || "Máy";

    const imei = r.imei ? `IMEI ${Utils.shortImei(r.imei)}` : "";
    const cName = normalizeCustomerDisplayName(r.customerName || "Khách lẻ") || "Khách lẻ";
    const cPhone = r.customerPhone ? Utils.normalizePhone(r.customerPhone) : "";

    let icon = '<i class="fa-solid fa-mobile-screen"></i>';
    const s = (String(r.model || "") + String(r.brand || "")).toLowerCase();
    if (s.includes("iphone") || s.includes("apple")) icon = '<i class="fa-brands fa-apple"></i>';
    else if (s.includes("samsung") || s.includes("android")) icon = '<i class="fa-brands fa-android"></i>';
    else if (s.includes("laptop")) icon = '<i class="fa-solid fa-laptop"></i>';

    const safeCreated = Utils.getMillisSafe(r.createdAt);
    const now = Date.now();
    const totalMins = Math.floor((now - safeCreated) / 60000);

    let totalAgeStr = "Vừa xong";
    if (totalMins > 0) {
      const days = Math.floor(totalMins / 1440);
      const hours = Math.floor((totalMins % 1440) / 60);
      const mins = totalMins % 60;
      totalAgeStr = days > 0 ? `${days} ngày` : `${String(hours).padStart(2,"0")}:${String(mins).padStart(2,"0")}`;
    }

    const st = r.status || "received";
    const statusLabel = Utils.statusText(st);

    let badgeClass = "st-wait";
    if (["diagnosing","repairing"].includes(st)) badgeClass = "st-bad";
    else if (["fixed","delivered"].includes(st)) badgeClass = "st-ok";

    const timeRef = Utils.getMillisSafe(r.statusUpdatedAt || r.updatedAt || r.createdAt);
    const diffMinutes = Math.floor((now - timeRef) / 60000);
    const statusTimeStr = Utils.formatDurationDigital(diffMinutes);

    const danger = Utils.kpiDangerMinutes(st);
    let timeStyleClass = "";
    if (diffMinutes > danger && !["fixed","delivered"].includes(st)) timeStyleClass = "time-blink-urgent";

    const staffName = r.lastStatusByName || r.creatorName || "NV";
    const techName = r.techName ? r.techName : "";
    const techDisplayName = techName || "Chưa gán";
    const descText = (r.symptom || "") + (r.workNote ? " | " + r.workNote : "");
    const noteText = descText || "Chưa có mô tả tình trạng";
    const descClass = timeStyleClass ? "running-text" : "static-text";

    const isWarranty = r.type === "warranty";
    const typeLabel = isWarranty ? "Bảo hành" : "Sửa chữa";

    const percent = Utils.statusPercent(st);
    const barColor = (st === "delivered") ? "#10b981" : (timeStyleClass ? "#ef4444" : "#f59e0b");

    return `
    <div class="ticket-item pos-ticket-card" onclick="window.Actions.handleItemClick('${r.id}')">
      <div class="pos-ticket-card-top">
        <div class="pos-ticket-card-main">
          <div class="pos-ticket-card-title-row">
            <div class="pos-ticket-card-title">
              <span class="pos-ticket-customer">${cName}</span>
              ${cPhone ? `<span class="pos-ticket-title-sep">•</span><span class="pos-ticket-phone">${cPhone}</span>` : ""}
            </div>
            <div class="status-badge-base ${badgeClass} pos-ticket-top-badge" style="min-width:0; max-width:100%">
              <span class="pos-ticket-top-type">${typeLabel}</span>
              <span class="pos-ticket-top-divider"></span>
              <span class="pos-ticket-top-staff">${staffName}</span>
              <span class="pos-ticket-top-divider"></span>
              <span>${statusLabel}</span>
            </div>
          </div>

          <div class="pos-ticket-card-meta">
            <div class="pos-ticket-card-meta-left">
              <span class="pos-ticket-meta-chip pos-ticket-meta-device">${icon}<span>${model}</span></span>
              ${imei ? `<span class="pos-ticket-meta-chip">${imei}</span>` : ""}
            </div>
            <div class="pos-ticket-card-meta-right">
              <div class="pos-ticket-assignee-box pos-ticket-assignee-inline-box">
                <div class="pos-ticket-assignee-line">
                  <i class="fa-solid fa-screwdriver-wrench"></i>
                  <span class="pos-ticket-assignee-name">${techDisplayName}</span>
                  <span class="pos-ticket-assignee-amount">${priceText}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="pos-ticket-card-note">
            <div class="pos-ticket-card-note-box">
              <div class="marquee-box pos-ticket-card-note-text">
                <span class="${descClass}">${noteText}</span>
              </div>
              <div class="pos-ticket-note-meta">
                <span class="pos-ticket-age">${statusTimeStr}</span>
                <span class="pos-ticket-age">${totalAgeStr}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="progress-track pos-ticket-progress" style="margin-top:4px">
        <div class="progress-fill" style="width:${percent}%; background:${barColor}"></div>
      </div>
    </div>`;
  }
};

// --- SERVICES ---
const LOGIN_STAFF_COLLECTIONS = ['staffs'];
const INTERNAL_POS_API_BASE = "https://api-ldnzetqooq-uc.a.run.app";
const NATIVE_APP_MODE = (() => {
  try {
    return window.__THKD_POS_NATIVE_EMBED__ === true || !!document.querySelector('[data-pos-native-runtime="1"]');
  } catch {
    return false;
  }
})();
const EMBED_MODE = (() => {
  if (NATIVE_APP_MODE) return true;
  try {
    return new URLSearchParams(window.location.search || "").get("embed") === "1";
  } catch {
    return false;
  }
})();
const LS_KEY_POS_LOGGED_IN = "pos_logged_in";
const LS_KEY_POS_STAFF_ID = "pos_staff_id";
const LS_KEY_POS_STAFF_NAME = "pos_staff_name";
const LS_KEY_POS_PHONE_RAW = "mp4_phone_raw";
const LS_KEY_POS_AUTH_SNAPSHOT = "thkd_pos_auth_snapshot_v1";
const LS_KEY_RANK_SESSION = "thkd_rank_session_v1";
const LS_KEY_SHARED_AUTH_SESSION = "thkd_shared_auth_session_v1";
const LS_KEY_INTERNAL_POS_SESSION_TOKEN = "thkd_pos_session_token";
const LS_KEY_INTERNAL_ACTOR_SESSION = "thkd_internal_actor_session_v1";
const LS_KEY_POS_LIST_MODE = "thkd_pos_list_mode_v1";
const LS_KEY_POS_STAFF_FILTER = "thkd_pos_staff_filter_v1";
const CROSS_TAB_AUTH_SYNC_KEYS = new Set([
  LS_KEY_POS_LOGGED_IN,
  LS_KEY_POS_STAFF_ID,
  LS_KEY_POS_STAFF_NAME,
  LS_KEY_POS_PHONE_RAW,
  LS_KEY_POS_AUTH_SNAPSHOT,
  LS_KEY_RANK_SESSION,
  LS_KEY_SHARED_AUTH_SESSION,
  LS_KEY_INTERNAL_POS_SESSION_TOKEN,
  LS_KEY_INTERNAL_ACTOR_SESSION
]);
let crossTabAuthSyncBound = false;
let authWatchSeq = 0;
let realtimeRetryTimer = null;
let firebaseAuthObserverBound = false;
const scheduleRealtimeRetry = (delayMs = 1200) => {
  if (realtimeRetryTimer) return;
  realtimeRetryTimer = setTimeout(() => {
    realtimeRetryTimer = null;
    const loggedIn = localStorage.getItem(LS_KEY_POS_LOGGED_IN);
    if (loggedIn !== "1") return;
    Services.clearRealtimeWatches();
    Services.ensureRealtimeWatches();
  }, Math.max(300, Number(delayMs) || 1200));
};
const bindFirebaseAuthObserver = () => {
  if (firebaseAuthObserverBound) return;
  firebaseAuthObserverBound = true;
  onAuthStateChanged(auth, () => {
    Services.watchAuth();
  });
};
const bindCrossTabAuthSync = () => {
  if (crossTabAuthSyncBound) return;
  crossTabAuthSyncBound = true;
  window.addEventListener("storage", (ev) => {
    const key = String(ev?.key || "").trim();
    if (key && !CROSS_TAB_AUTH_SYNC_KEYS.has(key)) return;
    setTimeout(() => {
      Services.watchAuth();
    }, 0);
  });
};
const safeParseJson = (raw, fallback = {}) => {
  try {
    const parsed = JSON.parse(String(raw || ""));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};
const pickFirstNonEmpty = (...values) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
};
const loadInternalActorSession = () => safeParseJson(localStorage.getItem(LS_KEY_INTERNAL_ACTOR_SESSION), {});
const clearSharedRankSession = () => {
  try { localStorage.removeItem(LS_KEY_RANK_SESSION); } catch {}
};
const clearInternalActorSession = () => {
  try { localStorage.removeItem(LS_KEY_INTERNAL_ACTOR_SESSION); } catch {}
};
const clearLocalPosSessionState = ({ clearInternalToken = false } = {}) => {
  try { localStorage.removeItem(LS_KEY_POS_LOGGED_IN); } catch {}
  try { localStorage.removeItem(LS_KEY_POS_STAFF_ID); } catch {}
  try { localStorage.removeItem(LS_KEY_POS_STAFF_NAME); } catch {}
  try { localStorage.removeItem(LS_KEY_POS_PHONE_RAW); } catch {}
  clearSharedRankSession();
  clearSharedAuthSession();
  clearPosAuthSnapshot();
  clearInternalActorSession();
  if (clearInternalToken) {
    try { localStorage.removeItem(LS_KEY_INTERNAL_POS_SESSION_TOKEN); } catch {}
  }
};
const derivePosIdentityFromInternalActor = (actor = {}) => {
  const safeActor = actor && typeof actor === "object" ? actor : {};
  const name = pickFirstNonEmpty(safeActor.name, safeActor.displayName, safeActor.staffName, "Nhân viên");
  const phone = pickFirstNonEmpty(safeActor.phone);
  const staffId = pickFirstNonEmpty(
    phone,
    safeActor.staffCode,
    safeActor.userId,
    safeActor.starStaffId,
    safeActor.keyId,
    name.toLowerCase().replace(/\s+/g, "_")
  );
  const email = pickFirstNonEmpty(
    safeActor.email,
    safeActor.userEmail,
    safeActor.staffEmail,
    staffId ? `${staffId}@mp4pos.com` : ""
  );
  return {
    staffId,
    name,
    phone: phone || staffId,
    email,
    role: pickFirstNonEmpty(safeActor.role, "staff")
  };
};
const buildInternalPosAuthSnapshot = (actor = {}, sessionToken = "") => {
  const safeActor = actor && typeof actor === "object" ? actor : null;
  if (!safeActor) return null;
  const identity = derivePosIdentityFromInternalActor(safeActor);
  if (!identity.staffId) return null;
  return {
    mode: "internal-pos-session",
    docId: identity.staffId,
    name: identity.name,
    phone: identity.phone,
    input: identity.phone || identity.staffId,
    email: identity.email,
    role: identity.role,
    actor: safeActor,
    sessionToken: String(sessionToken || "").trim(),
    savedAt: Date.now()
  };
};
const isInternalPosAuthSnapshot = (snapshot = {}) => (
  String(snapshot?.mode || "").trim() === "internal-pos-session"
  && snapshot?.actor
  && typeof snapshot.actor === "object"
);
const applyInternalActorToPosState = (actor = {}, sessionToken = "") => {
  const snapshot = buildInternalPosAuthSnapshot(actor, sessionToken);
  if (!snapshot) return null;

  localStorage.setItem(LS_KEY_POS_STAFF_ID, snapshot.docId);
  localStorage.setItem(LS_KEY_POS_STAFF_NAME, snapshot.name);
  localStorage.setItem(LS_KEY_POS_PHONE_RAW, snapshot.phone || snapshot.docId);
  localStorage.setItem(LS_KEY_POS_LOGGED_IN, "1");
  try { localStorage.setItem(LS_KEY_POS_AUTH_SNAPSHOT, JSON.stringify(snapshot)); } catch {}
  try {
    localStorage.setItem(LS_KEY_INTERNAL_ACTOR_SESSION, JSON.stringify({
      loggedIn: true,
      sessionToken: String(sessionToken || localStorage.getItem(LS_KEY_INTERNAL_POS_SESSION_TOKEN) || "").trim(),
      actor: snapshot.actor,
      updatedAt: Date.now(),
      source: "pos-goc"
    }));
  } catch {}

  const roleText = String(snapshot.role || "").trim().toLowerCase();
  AppState.user = { uid: snapshot.docId, email: snapshot.email || `${snapshot.docId}@mp4pos.com`, displayName: snapshot.name };
  AppState.isAdmin = ["chairman", "ceo", "admin", "manager"].includes(roleText)
    || snapshot.docId === "0961352352"
    || String(snapshot.phone || "").includes(ADMIN_EMAIL);
  AppState.uid = snapshot.docId;
  AppState.wallet = {
    ...(AppState.wallet || {}),
    ...(snapshot.actor || {}),
    name: snapshot.name,
    phone: snapshot.phone || snapshot.docId,
    email: snapshot.email || `${snapshot.docId}@mp4pos.com`,
    role: roleText || String(snapshot.actor?.role || "staff").trim().toLowerCase() || "staff"
  };
  Controllers.Auth.setProfile(snapshot.name, snapshot.name[0] || "N");
  syncEmbeddedProfileShell();
  return snapshot;
};
const loadPosListModeFilter = () => {
  // Khi vào POS luôn ưu tiên tab "đang xử lý".
  return "processing";
};
const savePosListModeFilter = (value) => {
  try {
    const next = String(value || "").trim() === "completed" ? "completed" : "processing";
    localStorage.setItem(LS_KEY_POS_LIST_MODE, next);
  } catch {}
};
const loadPosStaffFilter = () => {
  try {
    const raw = String(localStorage.getItem(LS_KEY_POS_STAFF_FILTER) || "").trim();
    return raw || "all";
  } catch {
    return "all";
  }
};
const savePosStaffFilter = (value) => {
  try {
    const next = String(value || "").trim() || "all";
    localStorage.setItem(LS_KEY_POS_STAFF_FILTER, next);
  } catch {}
};
const swapListModeFilterLabels = (selectEl) => {
  if (!selectEl?.options?.length) return;
  Array.from(selectEl.options).forEach((opt) => {
    const label = String(opt?.textContent || "").trim();
    if (label === "Đã đóng" || label === "Giao tiền") opt.textContent = "Đã đóng tiền";
  });
};
const POS_LIST_MODE_LABELS = {
  processing: "Đang xử lý",
  completed: "Đã hoàn tất"
};
const normalizePosListMode = (value) => String(value || "").trim() === "completed" ? "completed" : "processing";
const shouldUseDirectTouchListModeToggle = () => {
  try {
    if (window.matchMedia?.("(pointer: coarse)")?.matches) return true;
    if (Number(navigator.maxTouchPoints || 0) > 0) return true;
  } catch (_) {}
  return false;
};
const setPosListModeExpanded = (expanded) => {
  const wrap = $("listModeTabs");
  if (!wrap) return false;
  const next = expanded === true;
  wrap.classList.toggle("expanded", next);
  const currentBtn = $("listModeCurrentBtn");
  if (currentBtn) currentBtn.setAttribute("aria-expanded", next ? "true" : "false");
  return next;
};
const syncPosListModeTabs = (value) => {
  const normalized = normalizePosListMode(value);
  const wrap = $("listModeTabs");
  if (!wrap) return normalized;
  const currentBtn = $("listModeCurrentBtn");
  const currentLabel = $("listModeCurrentLabel");
  const altBtn = $("listModeAltBtn");
  const altMode = normalized === "completed" ? "processing" : "completed";
  const altLabel = POS_LIST_MODE_LABELS[altMode] || POS_LIST_MODE_LABELS.processing;
  wrap.dataset.mode = normalized;
  wrap.dataset.altMode = altMode;
  if (currentBtn) {
    currentBtn.dataset.value = normalized;
    currentBtn.dataset.nextValue = altMode;
    currentBtn.title = shouldUseDirectTouchListModeToggle()
      ? `Chạm để chuyển sang ${altLabel}`
      : "Chạm để mở tab còn lại";
  }
  if (currentLabel) currentLabel.textContent = POS_LIST_MODE_LABELS[normalized] || POS_LIST_MODE_LABELS.processing;
  if (altBtn) {
    altBtn.dataset.value = altMode;
    altBtn.textContent = altLabel;
    altBtn.title = `Chuyển sang ${altLabel}`;
  }
  return normalized;
};
const setPosListMode = (value, options = {}) => {
  const normalized = normalizePosListMode(value);
  const { render = false } = options || {};
  const selectEl = $("listModeFilter");
  if (selectEl) selectEl.value = normalized;
  syncPosListModeTabs(normalized);
  setPosListModeExpanded(false);
  savePosListModeFilter(normalized);
  if (render) Controllers.List.render($("search")?.value || "");
  return normalized;
};
const bindPosListModeTouchTabs = () => {
  const wrap = $("listModeTabs");
  if (!wrap || wrap.dataset.bound === "1") return;
  wrap.dataset.bound = "1";

  const currentBtn = $("listModeCurrentBtn");
  const altBtn = $("listModeAltBtn");
  const activate = (value) => setPosListMode(value, { render: true });
  const toggle = () => {
    const current = normalizePosListMode($("listModeFilter")?.value || "processing");
    activate(current === "completed" ? "processing" : "completed");
  };
  const close = () => setPosListModeExpanded(false);

  currentBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (shouldUseDirectTouchListModeToggle()) {
      toggle();
      return;
    }
    setPosListModeExpanded(!wrap.classList.contains("expanded"));
  });

  altBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    activate(altBtn.dataset.value || "completed");
  });

  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    toggle();
  });

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) close();
  });
};
const bindPosListSwipeTabs = () => {
  const scroller = $("marketList");
  if (!scroller || scroller.dataset.listSwipeBound === "1") return;
  scroller.dataset.listSwipeBound = "1";

  let startX = 0;
  let startY = 0;
  let tracking = false;

  scroller.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const target = e.target;
    if (target?.closest?.("input, select, textarea, button, .modal-content, .thkd-filter-menu, .thkd-staff-menu")) {
      tracking = false;
      return;
    }
    const touch = e.touches[0];
    startX = Number(touch.clientX || 0);
    startY = Number(touch.clientY || 0);
    tracking = true;
  }, { passive: true });

  scroller.addEventListener("touchend", (e) => {
    if (!tracking || !e.changedTouches || e.changedTouches.length !== 1) {
      tracking = false;
      return;
    }
    tracking = false;
    const touch = e.changedTouches[0];
    const deltaX = Number(touch.clientX || 0) - startX;
    const deltaY = Number(touch.clientY || 0) - startY;
    if (Math.abs(deltaX) < 64) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.35) return;
    const current = String($("listModeFilter")?.value || "processing").trim() === "completed" ? "completed" : "processing";
    if (deltaX < 0 && current !== "completed") setPosListMode("completed", { render: true });
    if (deltaX > 0 && current !== "processing") setPosListMode("processing", { render: true });
  }, { passive: true });
};
const randomSessionId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
const buildPosAuthSnapshot = (docId, data = {}, rawInput = "") => {
  const safeDocId = String(docId || "").trim();
  if (!safeDocId) return null;
  const safeName = String(data?.name || safeDocId).trim() || safeDocId;
  const safePhone = String(data?.phone || rawInput || safeDocId).trim() || safeDocId;
  return {
    docId: safeDocId,
    name: safeName,
    phone: safePhone,
    input: String(rawInput || safePhone || safeDocId).trim(),
    email: `${safeDocId}@mp4pos.com`,
    savedAt: Date.now()
  };
};
const buildSharedAuthSession = (docId, data = {}, rawInput = "") => {
  const safeDocId = String(docId || "").trim();
  if (!safeDocId) return null;
  const safeName = String(data?.name || safeDocId).trim() || safeDocId;
  const safePhone = String(data?.phone || rawInput || safeDocId).trim() || safeDocId;
  return {
    staffId: safeDocId,
    name: safeName,
    phone: safePhone,
    email: String(data?.email || `${safeDocId}@mp4pos.com`),
    loggedIn: true,
    updatedAt: Date.now()
  };
};
const persistSharedAuthSession = (docId, data = {}, rawInput = "") => {
  const session = buildSharedAuthSession(docId, data, rawInput);
  if (!session) return null;
  try { localStorage.setItem(LS_KEY_SHARED_AUTH_SESSION, JSON.stringify(session)); } catch {}
  return session;
};
const loadSharedAuthSession = () => safeParseJson(localStorage.getItem(LS_KEY_SHARED_AUTH_SESSION), {});
const clearSharedAuthSession = () => {
  try { localStorage.removeItem(LS_KEY_SHARED_AUTH_SESSION); } catch {}
};
const hydratePosSessionFromSharedSession = async () => {
  const loggedIn = localStorage.getItem(LS_KEY_POS_LOGGED_IN);
  if (loggedIn === "1") return null;
  const sharedSession = loadSharedAuthSession();
  const loginKey = String(sharedSession?.staffId || sharedSession?.phone || "").trim();
  if (!loginKey || sharedSession?.loggedIn === false) return null;
  const staffResolved = await resolveStaffDocForLogin(loginKey, { preferredDocId: sharedSession?.staffId || "" });
  if (!staffResolved) return null;
  const { data, docId } = staffResolved;
  if (data.active === false) return null;
  localStorage.setItem(LS_KEY_POS_PHONE_RAW, String(sharedSession?.phone || data.phone || loginKey || docId));
  localStorage.setItem(LS_KEY_POS_STAFF_ID, docId);
  localStorage.setItem(LS_KEY_POS_STAFF_NAME, data.name || docId);
  localStorage.setItem(LS_KEY_POS_LOGGED_IN, "1");
  persistPosAuthSnapshot(docId, data, sharedSession?.phone || loginKey || docId);
  return { ...staffResolved, hydrated: true, fromSharedSession: true };
};
const hydratePosSessionFromInternalApp = async () => {
  const sessionToken = String(localStorage.getItem(LS_KEY_INTERNAL_POS_SESSION_TOKEN) || "").trim();
  const bridge = loadInternalActorSession();
  const bridgeActor = bridge?.actor && typeof bridge.actor === "object" ? bridge.actor : null;

  if (!sessionToken) {
    if (isInternalPosAuthSnapshot(loadPosAuthSnapshot())) {
      clearLocalPosSessionState();
    }
    return null;
  }

  if (bridgeActor) {
    const snapshot = applyInternalActorToPosState(bridgeActor, bridge?.sessionToken || sessionToken);
    if (snapshot) return { hydrated: true, internalActor: true, actor: bridgeActor, snapshot };
  }

  try {
    const response = await fetch(`${INTERNAL_POS_API_BASE}/internal/pos/session`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "x-pos-session-token": sessionToken
      }
    });
    const text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch {}
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearLocalPosSessionState({ clearInternalToken: true });
      }
      return null;
    }
    const actor = data?.actor && typeof data.actor === "object" ? data.actor : null;
    if (!actor) return null;
    const snapshot = applyInternalActorToPosState(actor, sessionToken);
    if (!snapshot) return null;
    return { hydrated: true, internalActor: true, actor, snapshot };
  } catch {
    return null;
  }
};
const persistPosAuthSnapshot = (docId, data = {}, rawInput = "") => {
  const snapshot = buildPosAuthSnapshot(docId, data, rawInput);
  if (!snapshot) return null;
  try { localStorage.setItem(LS_KEY_POS_AUTH_SNAPSHOT, JSON.stringify(snapshot)); } catch {}
  return snapshot;
};
const loadPosAuthSnapshot = () => safeParseJson(localStorage.getItem(LS_KEY_POS_AUTH_SNAPSHOT), {});
const clearPosAuthSnapshot = () => {
  try { localStorage.removeItem(LS_KEY_POS_AUTH_SNAPSHOT); } catch {}
};
const applyPosAuthSnapshot = (snapshot = {}) => {
  if (isInternalPosAuthSnapshot(snapshot)) {
    return Boolean(applyInternalActorToPosState(snapshot.actor, snapshot.sessionToken || localStorage.getItem(LS_KEY_INTERNAL_POS_SESSION_TOKEN) || ""));
  }
  const docId = String(snapshot?.docId || "").trim();
  if (!docId) return false;
  const profileName = String(snapshot?.name || docId).trim() || docId;
  const phoneRaw = String(snapshot?.phone || snapshot?.input || docId).trim() || docId;

  localStorage.setItem(LS_KEY_POS_STAFF_ID, docId);
  localStorage.setItem(LS_KEY_POS_STAFF_NAME, profileName);
  localStorage.setItem(LS_KEY_POS_PHONE_RAW, phoneRaw);
  localStorage.setItem(LS_KEY_POS_LOGGED_IN, "1");

  AppState.user = { uid: docId, email: `${docId}@mp4pos.com`, displayName: profileName };
  AppState.isAdmin = (docId === "0961352352" || String(phoneRaw).includes(ADMIN_EMAIL));
  AppState.uid = docId;
  AppState.wallet = {
    ...(AppState.wallet || {}),
    name: profileName,
    phone: phoneRaw,
    email: String(snapshot?.email || `${docId}@mp4pos.com`)
  };
  Controllers.Auth.setProfile(profileName, profileName[0] || "N");
  syncEmbeddedProfileShell();
  return true;
};
const persistSharedRankSession = (docId, data = {}) => {
  const safeDocId = String(docId || "").trim();
  if (!safeDocId) return null;
  const existing = safeParseJson(localStorage.getItem(LS_KEY_RANK_SESSION), {});
  const roleRaw = String(data.role || data.position || data.title || data.chucVu || data.chucvu || existing.role || "").trim();
  const roleText = roleRaw.toLowerCase();
  const isManager = data.isManager === true || roleText.includes("quản lý") || roleText.includes("quan ly") || roleText.includes("manager");
  const next = {
    ...existing,
    staffId: safeDocId,
    name: String(data.name || existing.name || safeDocId),
    phone: String(data.phone || existing.phone || safeDocId),
    email: String(data.email || existing.email || ""),
    sessionId: String(existing.sessionId || randomSessionId()),
    isPresident: safeDocId.toLowerCase() === ADMIN_EMAIL,
    isManager: Boolean(existing.isManager === true || isManager),
    role: roleRaw || (isManager ? "manager" : (existing.role || "staff"))
  };
  localStorage.setItem(LS_KEY_RANK_SESSION, JSON.stringify(next));
  persistSharedAuthSession(safeDocId, data, next.phone || safeDocId);
  return next;
};
const hydratePosSessionFromRankSession = async () => {
  const loggedIn = localStorage.getItem(LS_KEY_POS_LOGGED_IN);
  if (loggedIn === "1") return null;
  const rankSession = safeParseJson(localStorage.getItem(LS_KEY_RANK_SESSION), {});
  const loginKey = String(rankSession?.staffId || rankSession?.phone || "").trim();
  if (!loginKey) return null;
  const staffResolved = await resolveStaffDocForLogin(loginKey, { preferredDocId: rankSession?.staffId || "" });
  if (!staffResolved) return null;
  const { data, docId } = staffResolved;
  if (data.active === false) return null;
  localStorage.setItem(LS_KEY_POS_PHONE_RAW, String(rankSession?.phone || data.phone || loginKey || docId));
  localStorage.setItem(LS_KEY_POS_STAFF_ID, docId);
  localStorage.setItem(LS_KEY_POS_STAFF_NAME, data.name || docId);
  localStorage.setItem(LS_KEY_POS_LOGGED_IN, "1");
  persistPosAuthSnapshot(docId, data, rankSession?.phone || loginKey || docId);
  return { ...staffResolved, hydrated: true };
};
const buildStaffLookupIds = (rawInput, preferredDocId = '') => {
  const out = [];
  const add = (v) => {
    const key = String(v || '').trim();
    if (!key || out.includes(key)) return;
    out.push(key);
  };
  add(preferredDocId);
  add(rawInput);
  const digits = Utils.onlyDigits(rawInput);
  add(digits);
  return out;
};
const resolveStaffDocForLogin = async (rawInput, opts = {}) => {
  const ids = buildStaffLookupIds(rawInput, opts.preferredDocId || '');
  for (const col of LOGIN_STAFF_COLLECTIONS) {
    for (const id of ids) {
      const snap = await getDoc(doc(db, col, id)).catch(() => null);
      if (snap && snap.exists()) return { collection: col, docId: id, data: snap.data() || {} };
    }
  }
  return null;
};
const deriveStaffIdFromFirebaseUser = (user) => {
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) return "";
  const localPart = email.split("@")[0] || "";
  const digits = Utils.onlyDigits(localPart);
  return digits || localPart;
};
const hydratePosSessionFromFirebase = async () => {
  const loggedIn = localStorage.getItem(LS_KEY_POS_LOGGED_IN);
  if (loggedIn === "1") return null;
  const firebaseStaffId = deriveStaffIdFromFirebaseUser(auth.currentUser);
  if (!firebaseStaffId) return null;

  const staffResolved = await resolveStaffDocForLogin(firebaseStaffId, { preferredDocId: firebaseStaffId });
  if (!staffResolved) return null;
  const { data, docId } = staffResolved;
  if (data.active === false) return null;

  localStorage.setItem(LS_KEY_POS_PHONE_RAW, String(data.phone || firebaseStaffId || docId));
  localStorage.setItem(LS_KEY_POS_STAFF_ID, docId);
  localStorage.setItem(LS_KEY_POS_STAFF_NAME, data.name || docId);
  localStorage.setItem(LS_KEY_POS_LOGGED_IN, "1");
  persistPosAuthSnapshot(docId, data, data.phone || firebaseStaffId || docId);
  return { ...staffResolved, hydrated: true, fromFirebase: true };
};
const ensureFirebaseCredentialSession = async (docId, pin, rawInput) => {
  const pass = String(pin || "").trim();
  if (!docId || !pass) return false;

  const candidates = [];
  const addEmail = (value) => {
    const email = String(value || "").trim().toLowerCase();
    if (!email || candidates.includes(email)) return;
    candidates.push(email);
  };

  addEmail(`${docId}@mp4pos.com`);
  if (String(rawInput || "").includes("@")) addEmail(rawInput);
  const rawDigits = Utils.onlyDigits(rawInput);
  if (rawDigits) addEmail(`${rawDigits}@mp4pos.com`);

  for (const email of candidates) {
    try {
      if (auth.currentUser?.email && String(auth.currentUser.email).toLowerCase() === email) {
        return true;
      }
      await signInWithEmailAndPassword(auth, email, pass);
      return true;
    } catch (_) {}
  }
  return false;
};

const Services = {
  clearRealtimeWatches: () => {
    (AppState.unsubs || []).forEach((fn) => {
      try { if (typeof fn === "function") fn(); } catch (_) {}
    });
    AppState.unsubs = [];
  },
  ensureRealtimeWatches: () => {
    if ((AppState.unsubs || []).length > 0) return;
    Services.watchTechs();
    Services.watchTickets();
  },
  setAuthView: (mode) => {
    const mainApp = $("mainApp");
    const authBackdrop = $("authBackdrop");
    if (!mainApp || !authBackdrop) return;

    if (NATIVE_APP_MODE) {
      mainApp.style.display = "flex";
      authBackdrop.style.display = "none";
      return;
    }

    if (mode === "authed") {
      mainApp.style.display = "flex";
      authBackdrop.style.display = "none";
      return;
    }
    if (mode === "auth") {
      mainApp.style.display = "none";
      authBackdrop.style.display = "flex";
      return;
    }
    mainApp.style.display = "none";
    authBackdrop.style.display = "none";
  },

  watchAuth: () => {
    (async () => {
      const watchId = ++authWatchSeq;
      const internalSessionToken = String(localStorage.getItem(LS_KEY_INTERNAL_POS_SESSION_TOKEN) || "").trim();
      const loggedInBeforeHydrate = localStorage.getItem(LS_KEY_POS_LOGGED_IN);
      const cachedSnapshot = loadPosAuthSnapshot();
      const hasInternalSnapshot = isInternalPosAuthSnapshot(cachedSnapshot);
      if (hasInternalSnapshot && !internalSessionToken) {
        clearLocalPosSessionState();
      }
      const canUseCachedSession = !(hasInternalSnapshot && !internalSessionToken)
        && loggedInBeforeHydrate === "1"
        && !!String(cachedSnapshot?.docId || "").trim();
      if (canUseCachedSession) {
        applyPosAuthSnapshot(cachedSnapshot);
        Services.setAuthView("authed");
        Services.ensureRealtimeWatches();
      }
      const rankSession = safeParseJson(localStorage.getItem(LS_KEY_RANK_SESSION), {});
      const hasRankSession = Boolean(String(rankSession?.staffId || rankSession?.phone || "").trim());
      if (!loggedInBeforeHydrate && (hasRankSession || internalSessionToken)) {
        // Auto-hydrate from rank session can take network time; hide login popup to prevent flashing.
        Services.setAuthView("pending");
      }

      let hydratedInternalSession = await hydratePosSessionFromInternalApp().catch(() => null);
      let hydratedStaff = null;
      if (!hydratedInternalSession) {
        hydratedStaff = await hydratePosSessionFromRankSession().catch(() => null);
      }
      if (!hydratedInternalSession && !hydratedStaff) {
        hydratedStaff = await hydratePosSessionFromSharedSession().catch(() => null);
      }
      if (!hydratedInternalSession && !hydratedStaff) {
        hydratedStaff = await hydratePosSessionFromFirebase().catch(() => null);
      }
      if (watchId !== authWatchSeq) return;

      // Check localStorage thay vì Firebase Auth
      const loggedIn = localStorage.getItem(LS_KEY_POS_LOGGED_IN);
      const rawPhone = localStorage.getItem(LS_KEY_POS_PHONE_RAW) || "";
      const savedStaffId = String(localStorage.getItem(LS_KEY_POS_STAFF_ID) || "").trim();
      const firebaseStaffId = deriveStaffIdFromFirebaseUser(auth.currentUser);
      const loginKey = savedStaffId || rawPhone || firebaseStaffId;
      const latestSnapshot = loadPosAuthSnapshot();
      const latestInternalSnapshot = isInternalPosAuthSnapshot(latestSnapshot) ? latestSnapshot : null;

      if (!loggedIn || (!loginKey && !latestInternalSnapshot)) {
        AppState.user = null;
        AppState.wallet = null;
        Services.clearRealtimeWatches();
        Services.setAuthView("auth");
        return;
      }
      // Có phiên sẵn thì ẩn khung login ngay.
      Services.setAuthView("authed");
      Services.ensureRealtimeWatches();

      if (hydratedInternalSession || latestInternalSnapshot) {
        const applied = applyPosAuthSnapshot(latestInternalSnapshot || hydratedInternalSession?.snapshot || {});
        if (!applied) {
          clearLocalPosSessionState();
          AppState.user = null;
          AppState.wallet = null;
          Services.clearRealtimeWatches();
          Services.setAuthView("auth");
          return;
        }
        return;
      }

      // Đã đăng nhập trước đó - load lại thông tin
      const staffResolved = hydratedStaff || await resolveStaffDocForLogin(loginKey, { preferredDocId: savedStaffId });
      if (watchId !== authWatchSeq) return;
      if (!staffResolved) {
        if (canUseCachedSession) {
          scheduleRealtimeRetry(2000);
          Services.setAuthView("authed");
          return;
        }
        clearLocalPosSessionState();
        Services.clearRealtimeWatches();
        Services.setAuthView("auth");
        return;
      }
      const { data, docId } = staffResolved;
      if (data.active === false) {
        clearLocalPosSessionState();
        Services.clearRealtimeWatches();
        Services.setAuthView("auth");
        return;
      }

      localStorage.setItem(LS_KEY_POS_STAFF_ID, docId);
      persistSharedRankSession(docId, data);
      persistSharedAuthSession(docId, data, rawPhone || data.phone || docId);
      persistPosAuthSnapshot(docId, data, rawPhone || data.phone || docId);

      AppState.user = { uid: docId, email: docId + "@mp4pos.com", displayName: data.name || docId };
      AppState.isAdmin = (docId === "0961352352" || String(rawPhone).includes(ADMIN_EMAIL));
      AppState.uid = docId;
      AppState.wallet = data;

      Services.setAuthView("authed");
      Controllers.Auth.setProfile(data.name || "Nhân viên", (data.name || "N")[0]);
      syncEmbeddedProfileShell();
    })();
  },

  login: async (input, pin) => {
    // Đồng bộ với star/lichlamviec: hỗ trợ cả staffId và SĐT
    const loginKey = String(input || '').trim();
    if (!loginKey) throw new Error('Vui lòng nhập tài khoản hoặc SĐT.');
    if (!pin) throw new Error('Vui lòng nhập mật khẩu.');

    const staffResolved = await resolveStaffDocForLogin(loginKey);
    if (!staffResolved) throw new Error('Không tìm thấy nhân viên.');

    const { data, docId } = staffResolved;
    const realPass = String(data.loginPassword || '').trim();
    if (!realPass || realPass !== String(pin).trim()) throw new Error('Mật khẩu không đúng.');
    if (data.active === false) throw new Error('Tài khoản đã bị KHÓA. Liên hệ Admin.');
    await ensureFirebaseCredentialSession(docId, pin, loginKey);

    // Lưu thông tin đăng nhập vào localStorage
    localStorage.setItem(LS_KEY_POS_PHONE_RAW, input);
    localStorage.setItem(LS_KEY_POS_STAFF_ID, docId);
    localStorage.setItem(LS_KEY_POS_STAFF_NAME, data.name || docId);
    localStorage.setItem(LS_KEY_POS_LOGGED_IN, '1');
    persistSharedRankSession(docId, data);
    persistSharedAuthSession(docId, data, input);
    persistPosAuthSnapshot(docId, data, input);

    // Fake Firebase Auth user cho các phần khác của POS
    AppState.user = { uid: docId, email: docId + '@mp4pos.com', displayName: data.name || docId };
    AppState.isAdmin = (docId === '0961352352' || String(input).includes(ADMIN_EMAIL));
    AppState.uid = docId;
    AppState.wallet = data;

    $('mainApp').style.display = 'flex';
    $('authBackdrop').style.display = 'none';
    Controllers.Auth.setProfile(data.name || 'Nhân viên', (data.name || 'N')[0]);
    syncEmbeddedProfileShell();

    Services.ensureRealtimeWatches();
  },

  logout: async () => {
    const sessionToken = String(localStorage.getItem(LS_KEY_INTERNAL_POS_SESSION_TOKEN) || "").trim();
    if (sessionToken) {
      fetch(`${INTERNAL_POS_API_BASE}/internal/pos/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pos-session-token": sessionToken
        }
      }).catch(() => {});
    }
    clearLocalPosSessionState({ clearInternalToken: true });
    try { await signOut(auth); } catch (_) {}
    AppState.user = null;
    AppState.wallet = null;
    syncEmbeddedProfileShell();
    Services.clearRealtimeWatches();
    $('mainApp').style.display = 'none';
    $('authBackdrop').style.display = 'flex';
  },

  watchTickets: () => {
    // Luôn ưu tiên phiếu mới nhất để tránh trường hợp phiếu vừa tạo không lọt vào limit(400).
    const q = query(collection(db, "mp4_posts"), orderBy("createdAt", "desc"), limit(400));
    const unsub = onSnapshot(q, (snap) => {
      const arr = [];
      const idx = new Map();

      snap.forEach(d => {
        const row = { id: d.id, ...d.data() };
        arr.push(row);
        idx.set(d.id, Utils.buildSearchBlob(row));
      });

      arr.sort(
        (a, b) =>
          Utils.getMillisSafe(b.sortAt || b.createdAt) - Utils.getMillisSafe(a.sortAt || a.createdAt)
      );

      AppState.tickets = arr;
      AppState.searchIndex = idx;
      Controllers.List.syncStaffFilterOptions();
      syncEmbeddedProfileShell();

      Controllers.List.render($("search")?.value || "");
    }, (err) => {
      console.error("watchTickets error:", err);
      Utils.notify("Không tải được danh sách phiếu. Kiểm tra mạng/Firebase.", "fa-triangle-exclamation");
      scheduleRealtimeRetry(1400);
    });

    AppState.unsubs.push(unsub);
  },

  watchTechs: () => {
    let techRows = [];
    let staffRows = [];

    const normalizeTechRows = (rows = [], source = "") => rows
      .map((row) => {
        const id = String(row?.id || row?.staffId || row?.uid || row?.phone || "").trim();
        const name = String(row?.name || row?.fullName || row?.displayName || row?.phone || id).trim();
        const roleText = [row?.role, row?.position, row?.title, row?.chucVu, row?.chucvu, row?.jobTitle, row?.department]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const isTech = source === "tech"
          || row?.isTech === true
          || row?.technician === true
          || row?.kyThuat === true
          || row?.kthuat === true
          || /kỹ thuật|ky thuat|kĩ thuật|technician|repair|sửa|ktv/.test(roleText);
        if (!id || !name) return null;
        return { id, name, isTech };
      })
      .filter(Boolean);

    const syncTechOptions = () => {
      const merged = [...normalizeTechRows(techRows, "tech"), ...normalizeTechRows(staffRows, "staff")];
      const seen = new Set();
      const uniq = merged.filter((row) => {
        if (!row?.id || seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });
      const techOnly = uniq.filter((row) => row.isTech);
      AppState.techs = (techOnly.length ? techOnly : uniq).sort((a, b) => a.name.localeCompare(b.name, "vi"));
      Controllers.StatusModal.fillTechSelect();
    };

    const techUnsub = onSnapshot(query(collection(db, "techs"), limit(200)), (snap) => {
      const arr = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        if (data.active === false) return;
        arr.push({ id: d.id, ...data });
      });
      techRows = arr;
      syncTechOptions();
    }, () => {
      techRows = [];
      syncTechOptions();
    });

    const staffUnsub = onSnapshot(query(collection(db, "staffs"), limit(500)), (snap) => {
      const arr = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        if (data.active === false) return;
        arr.push({ id: d.id, ...data });
      });
      staffRows = arr;
      syncTechOptions();
    }, () => {
      staffRows = [];
      syncTechOptions();
    });

    AppState.unsubs.push(techUnsub, staffUnsub);
  },

  addTicket: async (data) => {
    data.createdAt = serverTimestamp();
    data.sortAt = serverTimestamp();
    data.isCashierSettled = false;
    data.isTechSettled = false;
    data.active = true;

    try {
      const lastQ = query(collection(db, "mp4_posts"), orderBy("createdAt", "desc"), limit(1));
      const snapshot = await getDocs(lastQ);

      let nextNum = 1;
      if (!snapshot.empty) {
        const lastData = snapshot.docs[0].data();
        const lastCode = lastData.code || "";
        const match = lastCode.match(/^PM(\d+)$/);
        if (match) nextNum = parseInt(match[1], 10) + 1;
      }

      data.code = `PM${nextNum < 10 ? "0" + nextNum : nextNum}`;
    } catch (e) {
      console.error("Lỗi tạo mã, dùng mã dự phòng", e);
      data.code = "PM" + Date.now().toString().slice(-4);
    }

    return await addDoc(collection(db, "mp4_posts"), data);
  },

  updateTicket: async (id, data) => setDoc(doc(db, "mp4_posts", id), data, { merge: true }),
  updateTicketStatus: async (id, payload) => updateDoc(doc(db, "mp4_posts", id), payload),
  submitRating: async (id, ratingData) => updateDoc(doc(db, "mp4_posts", id), { rating: ratingData })
};

// --- CONTROLLERS ---
const Controllers = {
  Auth: {
    setProfile: (name, char) => {
      if ($("headerName")) $("headerName").textContent = name;
      if ($("headerAvatar")) $("headerAvatar").textContent = String(char || "U").toUpperCase();
      if ($("topModuleName")) $("topModuleName").textContent = name;
      if ($("topModuleAvatar")) $("topModuleAvatar").textContent = String(char || "U").toUpperCase();
      if ($("pfName")) $("pfName").textContent = name;
      if ($("pfAvatar")) $("pfAvatar").textContent = String(char || "U").toUpperCase();
    }
  },

  Modals: {
    _getBottomNavLiftPx: () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--thkd-bottom-nav-offset");
      const navOffset = Number.parseFloat(String(raw || "").trim());
      return Number.isFinite(navOffset) && navOffset > 0 ? Math.max(12, navOffset + 8) : 12;
    },
    _setPostModalMode: (mode = "") => {
      const modal = $("postModal");
      if (!modal) return;
      const next = String(mode || "").trim().toLowerCase();
      if (next) modal.dataset.mode = next;
      else modal.removeAttribute("data-mode");
    },
    _syncShellChrome: () => {
      const postOpen = $("postModal")?.style.display === "flex";
      const statusOpen = $("statusModal")?.style.display === "flex";
      $("mainApp")?.classList.toggle("post-modal-open", postOpen);
      $("mainApp")?.classList.toggle("status-modal-open", statusOpen);
      document.body.classList.remove("pos-post-modal-open", "pos-status-modal-open");
      document.documentElement.classList.remove("thkd-hide-bottom-nav");
      if (!postOpen) Controllers.Modals._setPostModalMode("");
    },
    _applyPostModalLift: (el) => {
      if (!el || !["postModal", "profileModal", "ratingModal"].includes(el.id)) return;
      const sheet = el.querySelector(".modal-content");
      if (!sheet) return;
      const baseLift = Controllers.Modals._getBottomNavLiftPx();
      const lift = el.id === "postModal" ? baseLift : (baseLift + 24);
      sheet.style.marginBottom = `${lift}px`;
      sheet.style.maxHeight = `calc(95dvh - ${Math.min(lift, 240)}px)`;
      sheet.style.height = "";
    },
    _resetPostModalLift: (el) => {
      if (!el || !["postModal", "profileModal", "ratingModal"].includes(el.id)) return;
      const sheet = el.querySelector(".modal-content");
      if (!sheet) return;
      sheet.style.marginBottom = "";
      sheet.style.maxHeight = "";
      sheet.style.height = "";
    },
    open: (el) => {
      if (!el) return;
      el.style.display = "flex";
      Controllers.Modals._syncShellChrome();
      Controllers.Modals._applyPostModalLift(el);
      if (el.id === "statusModal") StatusModalScrollLock.lock();
    },
    close: (el) => {
      if (!el) return;
      el.style.display = "none";
      Controllers.Modals._resetPostModalLift(el);
      try { if (typeof el.__thkdClearFocusFrame === "function") el.__thkdClearFocusFrame(); } catch {}
      try { if (typeof el.__thkdResetKeyboard === "function") el.__thkdResetKeyboard(); } catch {}
      Controllers.Modals._syncShellChrome();
      if (el.id === "statusModal") StatusModalScrollLock.unlock();
    }
  },

  Profile: {
    computeOverviewStats: () => {
      const myName = AppState.wallet?.name || AppState.user?.displayName || "Tôi";
      const myTickets = AppState.tickets.filter((t) => t.creatorName === myName || t.lastStatusByName === myName);
      const pending = myTickets.filter((t) => t.status !== "delivered").length;
      const delivered = myTickets.filter((t) => t.status === "delivered");
      const deliveredCount = delivered.length;
      const repairingCount = myTickets.filter((t) => ["diagnosing", "repairing"].includes(String(t?.status || "").trim())).length;
      const cashHolding = myTickets
        .filter((t) => t.status === "delivered" && !t.isCashierSettled && t.lastStatusByName === myName)
        .reduce((sum, t) => sum + (Number(t.estimateCost) || 0), 0);
      return {
        pending,
        cashHolding,
        deliveredCount,
        repairingCount
      };
    },
    ensureTopOverviewCard: () => {
      const card = $("topPersonalOverview");
      if (NATIVE_APP_MODE) return card;
      if (card && card.parentNode) card.parentNode.removeChild(card);
      return null;
    },
    syncOverviewUi: (stats = {}) => {
      const pending = Number(stats.pending || 0);
      const cashHolding = Number(stats.cashHolding || 0);
      const deliveredCount = Number(stats.deliveredCount || 0);
      const repairingCount = Number(stats.repairingCount || 0);

      if ($("psPending")) $("psPending").textContent = pending;
      if ($("psCash")) $("psCash").textContent = Utils.formatMoney(cashHolding);
      if ($("topPsPending")) $("topPsPending").textContent = pending;
      if ($("topPsCash")) $("topPsCash").textContent = Utils.formatMoney(cashHolding);
      if ($("topPsDone")) $("topPsDone").textContent = deliveredCount;
      if ($("topPsRepairing")) $("topPsRepairing").textContent = repairingCount;
    },
    renderTopOverviewCard: () => {
      const card = Controllers.Profile.ensureTopOverviewCard();
      if (!card) return;
      const stats = Controllers.Profile.computeOverviewStats();
      Controllers.Profile.syncOverviewUi(stats);
      card.style.display = "block";
    },
    open: () => {
      if (EMBED_MODE) return;
      const stats = Controllers.Profile.computeOverviewStats();
      Controllers.Profile.syncOverviewUi(stats);
      Controllers.Modals.open($("profileModal"));
    }
  },

  List: {
    syncStaffFilterOptions: () => {
      const select = $("staffFilter");
      if (!select) return;

      const selected = String(select.value || "all");
      const savedSelected = loadPosStaffFilter();
      const preferredSelected =
        selected && selected !== "all"
          ? selected
          : savedSelected;
      const names = new Set();

      (AppState.tickets || []).forEach((t) => {
        const creator = String(t?.creatorName || "").trim();
        const lastStatusBy = String(t?.lastStatusByName || "").trim();
        if (creator) names.add(creator);
        if (lastStatusBy) names.add(lastStatusBy);
      });

      select.innerHTML = "";
      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "Tất cả";
      select.appendChild(allOption);

      Array.from(names)
        .sort((a, b) => a.localeCompare(b, "vi"))
        .forEach((name) => {
          const opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          select.appendChild(opt);
        });

      const hasSelected = Array.from(select.options).some((o) => o.value === preferredSelected);
      select.value = hasSelected ? preferredSelected : "all";
      savePosStaffFilter(select.value);
    },

    render: (searchTerm = "") => {
      const colSell = $("colSell");
      const colBuy = $("colBuy");
      if (!colSell || !colBuy) return;
      Controllers.Profile.renderTopOverviewCard();

      const selectedListMode = String($("listModeFilter")?.value || "processing").trim();
      const selectedStaff = String($("staffFilter")?.value || "all").trim();
      savePosListModeFilter(selectedListMode);
      savePosStaffFilter(selectedStaff);
      const term = Utils.removeVietnameseTones(Utils.safeLower(searchTerm)).trim();
      const filteredByStaff = (selectedStaff === "all")
        ? AppState.tickets
        : AppState.tickets.filter((x) => {
            const creator = String(x?.creatorName || "").trim();
            const lastStatusBy = String(x?.lastStatusByName || "").trim();
            return creator === selectedStaff || lastStatusBy === selectedStaff;
          });

      const filtered = !term ? filteredByStaff : filteredByStaff.filter(x => {
        const blob = AppState.searchIndex?.get(x.id) || Utils.buildSearchBlob(x);
        return blob.includes(term);
      });

      const sorted = [...filtered].sort(
        (a, b) => Utils.getMillisSafe(b.sortAt || b.createdAt) - Utils.getMillisSafe(a.sortAt || a.createdAt)
      );

      const activeTickets = sorted.filter(x => x.status !== "delivered");
      const historyTickets = sorted.filter(x => x.status === "delivered");

      const renderList = (arr) =>
        arr.length ? arr.map(item => Components.ticketCard(item)).join("") :
        `<div style="text-align:center;padding:10px;color:#9ca3af;font-size:12px">Trống</div>`;

      if (selectedListMode === "completed") {
        colSell.style.display = "none";
        colBuy.style.display = "";
        colBuy.style.marginTop = "0";
        const filteredHistoryTickets = CompletedUI.filterHistoryTickets(historyTickets);
        colBuy.innerHTML = renderList(filteredHistoryTickets);
        try { CompletedUI.setTopDateVisible(true); } catch (_) {}
        try { CompletedUI.updateTopDateButton(); } catch (_) {}
        try { CompletedUI.decorateDeliveredBadges(filteredHistoryTickets); } catch (_) {}
      } else {
        colBuy.style.display = "none";
        colSell.style.display = "";
        colSell.innerHTML = renderList(activeTickets);
        try { CompletedUI.setTopDateVisible(false); } catch (_) {}
      }
    }
  },

  TicketModal: {
    openCreate: () => {
      AppState.postType = "repair";
      AppState.editingPostId = null;

      $("postModalTitle").textContent = "Tạo phiếu mới";
      Controllers.Modals._setPostModalMode("edit");
      $("viewModeContainer").style.display = "none";
      $("editModeContainer").style.display = "block";

      [
        "tkCustomerName","tkCustomerPhone","tkModel","tkIMEI","tkDevicePass",
        "tkSymptom","tkWorkNote","tkCloudId","tkCloudPass"
      ].forEach(id => { if ($(id)) $(id).value = ""; });

      $("tkEstimate").value = "";
      $("tkDeposit").value = "";
      BillUpload.reset();

      Controllers.Modals.open($("postModal"));
      setTimeout(() => { $("postModal")?.__thkdApplyKeyboard?.(); }, 60);
    },

    openEdit: (r) => {
      AppState.editingPostId = r.id;
      AppState.currentStatusTicket = r;
      AppState.postType = r.type || "repair";

      Controllers.Modals._setPostModalMode("view");
      Controllers.Modals.open($("postModal"));
      setTimeout(() => { $("postModal")?.__thkdApplyKeyboard?.(); }, 60);
      $("postModalTitle").textContent = "Chi tiết phiếu";

      $("vModel").textContent = (r.code ? `[${r.code}] ` : "") + (r.model || "Unknown");
      $("vCustomer").textContent = normalizeCustomerDisplayName(r.customerName || "Khách lẻ") || "Khách lẻ";
      $("vPhone").textContent = Utils.normalizePhone(r.customerPhone || "");

      const btnCall = $("btnCallCustomer");
      if (btnCall) {
        if (r.customerPhone) {
          btnCall.style.display = "flex";
          btnCall.onclick = () => window.location.href = `tel:${r.customerPhone}`;
        } else btnCall.style.display = "none";
      }

      $("vImei").textContent = r.imei || "...";
      $("vPass").textContent = r.devicePass || "...";
      $("vCloud").textContent = (r.cloudId || r.cloudPass) ? `${r.cloudId || ""} / ${r.cloudPass || ""}` : "...";
      $("vSymptom").textContent = r.symptom || "Chưa ghi nhận lỗi";

      $("vEstDisplay").textContent = Utils.formatMoney(Number(r.estimateCost || 0));
      $("vDepDisplay").textContent = Utils.formatMoney(Number(r.deposit || 0));
      const profit = (Number(r.estimateCost || 0) - Number(r.deposit || 0));
      $("vMustPay").textContent = Utils.formatMoney(profit > 0 ? profit : 0);

      Controllers.TicketModal.renderTimeline(r);

      $("viewModeContainer").style.display = "flex";
      $("editModeContainer").style.display = "none";

      const btnQuickStatus = $("btnQuickStatus");
      const btnSwitchEdit = $("btnSwitchToEdit");

      if (r.isCashierSettled || r.isTechSettled) {
        if (btnQuickStatus) btnQuickStatus.style.display = "none";
        if (btnSwitchEdit) {
          btnSwitchEdit.innerHTML = `<i class="fa-solid fa-lock"></i> Đã quyết toán (Chỉ xem)`;
          btnSwitchEdit.onclick = () => Utils.notify("Phiếu đã quyết toán. Chỉ được xem.", "fa-lock");
        }
      } else {
        if (btnQuickStatus) {
          btnQuickStatus.style.display = "flex";
          btnQuickStatus.onclick = () => Controllers.StatusModal.open(r);
        }
        if (btnSwitchEdit) {
          btnSwitchEdit.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa phiếu`;
          btnSwitchEdit.onclick = () => {
            $("tkCustomerName").value = normalizeCustomerDisplayName(r.customerName || "");
            $("tkCustomerPhone").value = r.customerPhone || "";
            $("tkModel").value = r.model || "";
            $("tkIMEI").value = r.imei || "";
            $("tkDevicePass").value = r.devicePass || "";
            $("tkCloudId").value = r.cloudId || "";
            $("tkCloudPass").value = r.cloudPass || "";
            $("tkSymptom").value = r.symptom || "";
            $("tkWorkNote").value = r.workNote || "";
            $("tkEstimate").value = Utils.fmtVNDFromDigits(r.estimateCost);
            $("tkDeposit").value = Utils.fmtVNDFromDigits(r.deposit);
            BillUpload.bindExisting(r);

            Controllers.Modals._setPostModalMode("edit");
            $("viewModeContainer").style.display = "none";
            $("editModeContainer").style.display = "block";
          };
        }
      }

      $("btnPrintReceive").onclick = () => Receipt.print(r, "receive");
      $("btnPrintReturn").onclick = () => Receipt.print(r, "return");
      $("btnShareZalo").onclick = () => Receipt.shareZalo(r, (r.status === "delivered" ? "return" : "receive"));
    },

    renderTimeline: (r) => {
      const el = $("vTimeline"); if (!el) return;
      let historyItems = [];

      historyItems.push({
        at: r.createdAt,
        user: r.creatorName || "NV",
        statusLabel: "Tiếp nhận máy",
        color: "#d97706",
        note: null
      });

      if (r.statusHistory?.length) {
        r.statusHistory.forEach(h => {
          const color = h.to === "fixed" ? "#059669" : (h.to === "delivered" ? "#2563eb" : (h.to === "repairing" ? "#d97706" : "#374151"));
          historyItems.push({
            at: h.atMillis || h.at,
            user: h.user || "...",
            statusLabel: h.toLabel || Utils.statusText(h.to),
            color,
            note: h.note
          });
        });
      }

      historyItems.sort((a, b) => Utils.getMillisSafe(b.at) - Utils.getMillisSafe(a.at));

      let html = "";
      historyItems.forEach((item) => {
        const timeStr = new Date(Utils.getMillisSafe(item.at)).toLocaleString("vi-VN", { hour: "2-digit", minute:"2-digit", day:"2-digit", month:"2-digit" });
        html += `
          <div class="tl-m-item">
            <div class="tl-m-dot"></div>
            <div class="tl-m-time">${timeStr}</div>
            <div class="tl-m-card">
              <div class="tl-m-status" style="color:${item.color}">${item.statusLabel}</div>
              <div class="tl-m-user">Bởi: ${item.user}</div>
              ${item.note ? `<div class="tl-m-note">${item.note}</div>` : ""}
            </div>
          </div>`;
      });

      el.innerHTML = html;
    },

    savePost: async (type) => {
      const valName = normalizeCustomerDisplayName($("tkCustomerName").value || "");
      const valModel = $("tkModel").value.trim();
      const valSymptom = $("tkSymptom").value.trim();

      if ($("tkCustomerName")) $("tkCustomerName").value = valName;
      if (!valName) { Utils.notify("Chưa nhập tên khách hàng!", "fa-triangle-exclamation"); $("tkCustomerName").focus(); return; }
      if (!valModel){ Utils.notify("Chưa nhập tên dòng máy!", "fa-triangle-exclamation"); $("tkModel").focus(); return; }
      if (!valSymptom){ Utils.notify("Chưa nhập mô tả lỗi!", "fa-triangle-exclamation"); $("tkSymptom").focus(); return; }

      const isEdit = !!AppState.editingPostId;
      const btnId = type === "warranty" ? "btnSaveWarranty" : "btnSaveRepair";
      Utils.setLoading(btnId, true);

      try {
        const payload = {
          type,
          customerName: valName,
          customerPhone: Utils.normalizePhone($("tkCustomerPhone").value),
          model: valModel,
          imei: $("tkIMEI").value.trim(),
          devicePass: $("tkDevicePass").value.trim(),
          cloudId: $("tkCloudId").value.trim(),
          cloudPass: $("tkCloudPass").value.trim(),
          estimateCost: Number(Utils.onlyDigits($("tkEstimate").value)),
          deposit: Number(Utils.onlyDigits($("tkDeposit").value)),
          symptom: valSymptom,
          workNote: $("tkWorkNote").value.trim(),
          updatedAt: serverTimestamp(),
        };
        if (AppState.billUpload.url) {
          payload.billReceiptUrl = AppState.billUpload.url;
          payload.billReceiptPath = AppState.billUpload.path || "";
          payload.billReceiptName = AppState.billUpload.name || "";
          payload.billReceiptUpdatedAt = serverTimestamp();
        }

        if (isEdit) {
          await Services.updateTicket(AppState.editingPostId, payload);
          Utils.notify("Đã cập nhật!", "fa-check");
          Controllers.Modals.close($("postModal"));
          return;
        }

        payload.status = "received";
        payload.creatorName = AppState.wallet?.name || AppState.user?.displayName || "NV";
        payload.creatorId = AppState.user?.uid;

        const ref = await Services.addTicket(payload);

        const localCreatedAt = Date.now();
        const localTicket = {
          ...payload,
          id: ref?.id,
          createdAt: localCreatedAt,
          sortAt: localCreatedAt,
          updatedAt: localCreatedAt
        };

        if (localTicket.id) {
          const existingIndex = AppState.tickets.findIndex((x) => x.id === localTicket.id);
          if (existingIndex >= 0) AppState.tickets[existingIndex] = localTicket;
          else AppState.tickets.unshift(localTicket);
          AppState.searchIndex.set(localTicket.id, Utils.buildSearchBlob(localTicket));
          Controllers.List.syncStaffFilterOptions();
          Controllers.List.render($("search")?.value || "");
        }

        Utils.notify("Đã tạo phiếu! Đang mở xem trước bản in…", "fa-print");
        Controllers.Modals.close($("postModal"));

        const ticketForPrint = {
          ...localTicket,
        };

        Receipt.print(ticketForPrint, "receive");
      } catch (e) {
        Utils.notify("Lỗi: " + (e?.message || e), "fa-triangle-exclamation");
      } finally {
        Utils.setLoading(btnId, false, type === "warranty" ? "BẢO HÀNH" : "SỬA CHỮA");
      }
    }
  },

  StatusModal: {
    fillTechSelect: () => {
      const sel = $("stTechId"); if (!sel) return;
      const currentVal = sel.value;
      sel.innerHTML = `<option value="">-- Chọn kỹ thuật --</option>` +
        AppState.techs.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
      if (currentVal) sel.value = currentVal;
    },

    open: (r) => {
      AppState.currentStatusTicket = r;

      Controllers.StatusModal.fillTechSelect();
      $("stTicketTitle").textContent = `${r.model} - ${normalizeCustomerDisplayName(r.customerName || "Khách lẻ")}`;
      $("stSubInfo").textContent = `${Utils.normalizePhone(r.customerPhone)} • ${r.status === "delivered" ? "Đã xong" : "Đang xử lý"}`;

      $("stStatus").value = r.status || "received";
      $("stTechId").value = r.techId || "";
      $("stPrice").value = Utils.fmtVNDFromDigits(r.estimateCost);
      $("stCost").value = Utils.fmtVNDFromDigits(r.deposit);
      $("stNote").value = "";

      Controllers.Modals.open($("statusModal"));
      setTimeout(() => { $("statusModal")?.__thkdApplyKeyboard?.(); }, 60);
    },

    save: async () => {
      const r = AppState.currentStatusTicket;
      if (!r) return;

      if (r.isCashierSettled || r.isTechSettled) {
        Utils.notify("⛔️ Phiếu đã quyết toán.", "fa-lock");
        Controllers.Modals.close($("statusModal"));
        return;
      }

      const newStatus = $("stStatus")?.value || "received";
      const note = String($("stNote")?.value || "").trim();
      const rawPrice = Utils.onlyDigits($("stPrice")?.value || "");
      const rawCost  = Utils.onlyDigits($("stCost")?.value || "");
      const techId = String($("stTechId")?.value || "").trim();

      if (newStatus === "delivered" && (rawPrice === "" || rawCost === "")) {
        Utils.notify("⚠️ Nhập Báo khách & Giá Thu Mua trước khi Trả máy!", "fa-triangle-exclamation");
        return;
      }

      if (newStatus === "delivered" && Number(rawCost) > 0 && !techId) {
        Utils.notify("⚠️ Có Giá Thu Mua. Bắt buộc chọn KTV thực hiện!", "fa-user-gear");
        $("stTechId").focus();
        return;
      }

      const tech = AppState.techs.find(x => x.id === techId) || {};
      Utils.setLoading("btnSaveStatus", true);

      const payload = {
        status: newStatus,
        techId: techId || null,
        techName: tech.name || null,

        estimateCost: Number(rawPrice),
        price: Number(rawPrice),
        deposit: Number(rawCost),

        lastStatusNote: note,
        lastStatusByName: AppState.wallet?.name || AppState.user?.displayName || "NV",
        updatedAt: serverTimestamp(),
        statusUpdatedAt: serverTimestamp(),
        sortAt: serverTimestamp(),
        statusHistory: arrayUnion({
          from: r.status,
          to: newStatus,
          toLabel: Utils.statusLabel(newStatus),
          note,
          at: new Date(),
          atMillis: Date.now(),
          user: AppState.wallet?.name || AppState.user?.displayName || "NV"
        })
      };

      if (newStatus === "delivered") {
        payload.active = false;
        payload.closedAt = serverTimestamp();
      } else {
        payload.active = true;
      }

      try {
        await Services.updateTicketStatus(r.id, payload);
        Utils.notify("Đã cập nhật!", "fa-check");
        Controllers.Modals.close($("statusModal"));

        if (newStatus === "delivered") {
          Controllers.Rating.open({ ...r, ...payload, id: r.id });
        }
      } catch (e) {
        Utils.notify("Lỗi: " + (e?.message || e), "fa-triangle-exclamation");
      } finally {
        Utils.setLoading("btnSaveStatus", false);
      }
    }
  },

  Rating: {
    currentTicket: null,
    stars: 5,
    selectedTags: new Set(),

    open: (ticket) => {
      Controllers.Rating.currentTicket = ticket;
      Controllers.Rating.stars = 5;
      Controllers.Rating.selectedTags.clear();

      Controllers.Modals.open($("ratingModal"));
      setTimeout(() => { $("ratingModal")?.__thkdApplyKeyboard?.(); }, 60);
      Controllers.Rating.renderStars();
      document.querySelectorAll(".rate-tag").forEach(t => t.classList.remove("selected"));
      $("ratingComment").value = "";
    },

    renderStars: () => {
      document.querySelectorAll("#starGroup i").forEach(star => {
        const val = parseInt(star.getAttribute("data-val"));
        if (val <= Controllers.Rating.stars) star.classList.add("active");
        else star.classList.remove("active");
        star.onclick = () => {
          Controllers.Rating.stars = val;
          Controllers.Rating.renderStars();
        };
      });
    },

    submit: async () => {
      const t = Controllers.Rating.currentTicket;
      if (!t?.id) return;

      const comment = $("ratingComment").value.trim();
      const tags = Array.from(Controllers.Rating.selectedTags);

      Utils.setLoading("btnSubmitRating", true);
      try {
        const ratingData = { stars: Controllers.Rating.stars, comment, tags, at: Date.now() };
        await Services.submitRating(t.id, ratingData);
        Utils.notify("Cảm ơn quý khách!", "fa-star");

        Controllers.Modals.close($("ratingModal"));
        Receipt.print({ ...t, rating: ratingData }, "return");
      } catch (e) {
        Utils.notify("Lỗi: " + (e?.message || e), "fa-triangle-exclamation");
      } finally {
        Utils.setLoading("btnSubmitRating", false);
      }
    },

    skip: () => {
      const t = Controllers.Rating.currentTicket;
      Controllers.Modals.close($("ratingModal"));
      if (t) Receipt.print({ ...t, rating: null }, "return");
      Utils.notify("Đã bỏ qua đánh giá. Đang in bill…", "fa-print");
    }
  }
};

const syncEmbeddedProfileShell = () => {
  if (!EMBED_MODE) return;
  try {
    const targetWindow = NATIVE_APP_MODE ? window : window.parent;
    if (!targetWindow || (!NATIVE_APP_MODE && targetWindow === window)) return;
    const stats = Controllers.Profile.computeOverviewStats();
    const actor = AppState.wallet || AppState.user || {};
    const detail = {
      actor,
      moduleEyebrow: "POS",
      moduleDivision: "Sửa máy",
      metric1Label: "Đơn đang xử lý",
      metric1Display: String(Number(stats.pending || 0)),
      metric1Note: `${Number(stats.pending || 0)} đơn`,
      metric2Label: "Tiền cần nộp quản lý",
      metric2Display: Utils.formatMoney(Number(stats.cashHolding || 0)),
      metric2Note: "Chờ giao quản lý",
      extraMetrics: [
        {
          label: "Đã hoàn thành",
          display: String(Number(stats.deliveredCount || 0)),
          note: "Phiếu đã trả máy"
        },
        {
          label: "Đang sửa",
          display: String(Number(stats.repairingCount || 0)),
          note: "Kiểm tra và sửa chữa"
        }
      ],
      canFilterStaff: false,
      updatedAt: Date.now()
    };
    targetWindow.__THKD_POS_GOC_HEADER_SUMMARY__ = detail;
    targetWindow.dispatchEvent(new targetWindow.CustomEvent("thkd:posgoc-header-summary", { detail }));
  } catch {}
};

// --- MONEY INPUT FORMAT ---
const setupMoneyInput = (id) => {
  const el = $(id); if (!el) return;
  el.addEventListener("input", (e) => {
    const raw = Utils.onlyDigits(e.target.value);
    e.target.value = raw ? Number(raw).toLocaleString("vi-VN") : "";
  });
};

const BillUpload = {
  MAX_SIZE: 10 * 1024 * 1024,

  setButtonLabel: (text) => {
    const label = $("tkBillBtnLabel");
    if (label) label.textContent = text;
  },

  setHint: (text, isLinked = false) => {
    const hint = $("tkBillHint");
    if (!hint) return;
    hint.textContent = text;
    hint.style.color = isLinked ? "#059669" : "#6b7280";
  },

  reset: () => {
    AppState.billUpload = { file: null, url: "", path: "", name: "" };
    const input = $("tkBillInput");
    if (input) input.value = "";
    BillUpload.setButtonLabel("UP Bill");
    BillUpload.setHint("Chưa tải biên nhận");
  },

  bindExisting: (ticket) => {
    AppState.billUpload = {
      file: null,
      url: String(ticket?.billReceiptUrl || ""),
      path: String(ticket?.billReceiptPath || ""),
      name: String(ticket?.billReceiptName || "")
    };
    const hasReceipt = !!AppState.billUpload.url;
    BillUpload.setButtonLabel(hasReceipt ? "UP Bill mới" : "UP Bill");
    BillUpload.setHint(
      hasReceipt ? `Đã có bill: ${AppState.billUpload.name || "Ảnh biên nhận"}` : "Chưa tải biên nhận",
      hasReceipt
    );
  },

  selectFile: () => {
    const input = $("tkBillInput");
    if (input) input.click();
  },

  onFileChange: async (ev) => {
    const file = ev?.target?.files?.[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      Utils.notify("Chỉ nhận file ảnh bill!", "fa-triangle-exclamation");
      ev.target.value = "";
      return;
    }
    if (file.size > BillUpload.MAX_SIZE) {
      Utils.notify("Ảnh bill vượt 10MB, vui lòng nén lại.", "fa-triangle-exclamation");
      ev.target.value = "";
      return;
    }
    const uploadFile = await SmartImage.optimizeForUpload(file);
    AppState.billUpload.file = uploadFile;
    AppState.billUpload.name = file.name;
    BillUpload.setButtonLabel("Xác nhận UP Bill");
    const before = SmartImage.formatBytes(file.size || 0);
    const after = SmartImage.formatBytes(uploadFile.size || file.size || 0);
    const compressed = uploadFile.size < file.size;
    BillUpload.setHint(compressed ? `Đã chọn: ${file.name} (${before} → ${after})` : `Đã chọn: ${file.name} (${after})`);
  },

  upload: async () => {
    const selected = AppState.billUpload.file;
    if (!selected) {
      BillUpload.selectFile();
      return;
    }

    const ext = (selected.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const owner = AppState.user?.uid || "guest";
    const targetId = AppState.editingPostId || `draft_${owner}_${Date.now()}`;
    const path = `mp4_bills/${targetId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    Utils.setLoading("btnUploadBill", true, "Đang UP Bill...");
    try {
      const uploaded = await uploadBytes(storageRef(storage, path), selected, { contentType: selected.type || "image/jpeg" });
      const url = await getDownloadURL(uploaded.ref);

      AppState.billUpload = {
        file: null,
        url,
        path,
        name: selected.name
      };
      const input = $("tkBillInput");
      if (input) input.value = "";
      BillUpload.setButtonLabel("UP Bill mới");
      BillUpload.setHint(`Đã UP: ${selected.name}`, true);

      if (AppState.editingPostId) {
        await Services.updateTicket(AppState.editingPostId, {
          billReceiptUrl: url,
          billReceiptPath: path,
          billReceiptName: selected.name,
          billReceiptUpdatedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      Utils.notify("Upload bill thành công!", "fa-check");
    } catch (e) {
      Utils.notify("Upload bill lỗi: " + (e?.message || e), "fa-triangle-exclamation");
    } finally {
      Utils.setLoading("btnUploadBill", false, "Đang UP Bill...");
      BillUpload.setButtonLabel(AppState.billUpload.url ? "UP Bill mới" : "UP Bill");
    }
  }
};

// --- ACTIONS ---
window.Actions = {
  handleItemClick: (id) => {
    const r = AppState.tickets.find(x => x.id === id);
    if (!r) return;
    if (r.status === "delivered") Controllers.TicketModal.openEdit(r);
    else Controllers.StatusModal.open(r);
  },

  openFullDetails: () => {
    Controllers.Modals.close($("statusModal"));
    if (AppState.currentStatusTicket) Controllers.TicketModal.openEdit(AppState.currentStatusTicket);
  },

  toggleTag: (el) => {
    const tag = el.innerText;
    if (el.classList.contains("selected")) {
      el.classList.remove("selected");
      Controllers.Rating.selectedTags.delete(tag);
    } else {
      el.classList.add("selected");
      Controllers.Rating.selectedTags.add(tag);
    }
  }
};

// --- SECRET OPEN CHAIRMAN PAGE ---
const bindSecretOpenChairman = () => {
  const logo = $("appLogo");
  if (!logo) return;

  logo.addEventListener("dblclick", () => {
    Utils.notify("Mở chế độ Chủ tịch…", "fa-crown");
    window.location.href = "./chutich.html";
  });

  let pressTimer = null;
  const start = () => {
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      Utils.notify("Mở chế độ Chủ tịch…", "fa-crown");
      window.location.href = "./chutich.html";
    }, 800);
  };
  const cancel = () => { clearTimeout(pressTimer); pressTimer = null; };

  logo.addEventListener("mousedown", start);
  logo.addEventListener("mouseup", cancel);
  logo.addEventListener("mouseleave", cancel);

  logo.addEventListener("touchstart", start, { passive: true });
  logo.addEventListener("touchend", cancel);
  logo.addEventListener("touchcancel", cancel);
};

// --- INIT ---
function bootPosGocApp() {
  if (window.__THKD_POS_GOC_BOOTED__) return;
  window.__THKD_POS_GOC_BOOTED__ = true;
  SmartImage.installLazyRuntime();
  setupMoneyInput("tkEstimate");
  setupMoneyInput("tkDeposit");
  setupMoneyInput("stPrice");
  setupMoneyInput("stCost");

  $("btnQuickPrintReceive")?.addEventListener("click", () => AppState.currentStatusTicket && Receipt.print(AppState.currentStatusTicket, "receive"));
  $("btnQuickPrintReturn")?.addEventListener("click", () => AppState.currentStatusTicket && Receipt.print(AppState.currentStatusTicket, "return"));

  $("btnProfileNav")?.addEventListener("click", Controllers.Profile.open);

  $("btnLogin")?.addEventListener("click", async () => {
    Utils.setLoading("btnLogin", true, "Đang vào...");
    try {
      await Services.login($("loginPhone").value, $("loginPass").value);
      Utils.notify("Xin chào!", "fa-hand");
    } catch (e) {
      Utils.notify("Lỗi: " + (e?.message || e), "fa-triangle-exclamation");
    } finally {
      Utils.setLoading("btnLogin", false);
    }
  });

  $("btnLogout")?.addEventListener("click", async () => {
    await Services.logout();
    Controllers.Modals.close($("profileModal"));
  });
  $("btnCloseProfile")?.addEventListener("click", () => Controllers.Modals.close($("profileModal")));

  const btnOpenPost = $("btnOpenPost");
  if (btnOpenPost) btnOpenPost.innerHTML = '<i class="fa-solid fa-plus"></i>';
  btnOpenPost?.addEventListener("click", Controllers.TicketModal.openCreate);
  $("btnClosePost")?.addEventListener("click", () => Controllers.Modals.close($("postModal")));
  $("tkBillInput")?.addEventListener("change", BillUpload.onFileChange);
  $("btnUploadBill")?.addEventListener("click", BillUpload.upload);
  $("btnSaveRepair")?.addEventListener("click", () => Controllers.TicketModal.savePost("repair"));
  $("btnSaveWarranty")?.addEventListener("click", () => Controllers.TicketModal.savePost("warranty"));

  $("btnQuickStatus")?.addEventListener("click", () => AppState.currentStatusTicket && Controllers.StatusModal.open(AppState.currentStatusTicket));
  $("btnSaveStatus")?.addEventListener("click", Controllers.StatusModal.save);

  const customerNameInput = $("tkCustomerName");
  customerNameInput?.addEventListener("blur", () => {
    customerNameInput.value = normalizeCustomerDisplayName(customerNameInput.value || "");
  });

  $("btnSubmitRating")?.addEventListener("click", Controllers.Rating.submit);
  $("btnSkipRating")?.addEventListener("click", Controllers.Rating.skip);
  $("btnCloseRating")?.addEventListener("click", () => Controllers.Modals.close($("ratingModal")));

  const debouncedSearch = Utils.debounce((e) => Controllers.List.render(e.target.value), 250);
  $("search")?.addEventListener("input", debouncedSearch);
  const listModeFilterEl = $("listModeFilter");
  if (listModeFilterEl) {
    swapListModeFilterLabels(listModeFilterEl);
    setPosListMode(loadPosListModeFilter());
    listModeFilterEl.addEventListener("change", () => {
      setPosListMode(listModeFilterEl.value, { render: true });
    });
  }
  bindPosListModeTouchTabs();
  bindPosListSwipeTabs();
  syncPosListModeTabs($("listModeFilter")?.value || loadPosListModeFilter());

  const staffFilterEl = $("staffFilter");
  if (staffFilterEl) {
    staffFilterEl.value = loadPosStaffFilter();
    staffFilterEl.addEventListener("change", () => {
      savePosStaffFilter(staffFilterEl.value);
      Controllers.List.render($("search")?.value || "");
    });
  }
  Controllers.List.render($("search")?.value || "");
  CompletedUI.bindTopDateFilter();

  bindSecretOpenChairman();
  bindCrossTabAuthSync();
  bindFirebaseAuthObserver();
  Services.watchAuth();

  // =========================
  // ✅ STATUS MODAL UX PATCH
  // - Đóng bằng nút X
  // - Bấm ra ngoài backdrop để đóng
  // - Né bàn phím (VisualViewport): đẩy modal lên không bị che input
  // =========================
  const statusModalEl = $("statusModal");
  const statusSheet = statusModalEl?.querySelector(".modal-content");

  const closeStatusModal = () => {
    Controllers.Modals.close(statusModalEl);
    if (statusSheet) {
      statusSheet.style.marginBottom = "";
      statusSheet.style.maxHeight = "";
      statusSheet.style.height = "";
    }
  };

  $("btnCloseStatusX")?.addEventListener("click", closeStatusModal);

  statusModalEl?.addEventListener("click", (e) => {
    if (e.target === statusModalEl) closeStatusModal();
  });

  const createScopedKeyboardAvoid = ({ modalEl, sheetEl, fullHeightWhenKeyboard = false, baseClosedMaxHeight = "", baseClosedGap = null }) => {
    if (!modalEl || !sheetEl) return;
    const vv = window.visualViewport || null;
    let activeFrame = null;
    let initialViewportHeight = Number(vv?.height || 0);
    modalEl.dataset.thkdFullheight = fullHeightWhenKeyboard ? "1" : "0";

    const clearActiveFrame = () => {
      if (activeFrame) activeFrame.classList.remove("thkd-modal-focus-frame");
      activeFrame = null;
    };

    const resolveFocusFrame = (activeEl) => {
      if (!(activeEl instanceof HTMLElement)) return null;
      return activeEl.closest(".auth-field, .group-box, .row-1, .row-2 > div, .finance-compact, .modal-content > div, .modal-content > textarea")
        || activeEl.parentElement
        || activeEl;
    };

    const syncActiveFrame = (activeEl) => {
      const nextFrame = resolveFocusFrame(activeEl);
      if (activeFrame === nextFrame) return;
      clearActiveFrame();
      activeFrame = nextFrame instanceof HTMLElement ? nextFrame : null;
      if (activeFrame) activeFrame.classList.add("thkd-modal-focus-frame");
    };

    const ensureActiveFieldVisible = (activeEl) => {
      if (!(activeEl instanceof HTMLElement) || !sheetEl.contains(activeEl)) return;
      const hostRect = sheetEl.getBoundingClientRect();
      const fieldRect = activeEl.getBoundingClientRect();
      const upperSafe = hostRect.top + 74;
      const lowerSafe = hostRect.bottom - 110;
      if (fieldRect.top < upperSafe || fieldRect.bottom > lowerSafe) {
        try {
          activeEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        } catch {
          activeEl.scrollIntoView({ block: "center", inline: "nearest" });
        }
      }
    };

    const getBottomNavOffset = () => {
      const scopeEl = modalEl.closest("#screen-posgoc") || document.documentElement;
      const raw = getComputedStyle(scopeEl).getPropertyValue("--thkd-bottom-nav-offset")
        || getComputedStyle(document.documentElement).getPropertyValue("--thkd-bottom-nav-offset");
      const n = Number.parseFloat(String(raw || "").trim());
      return Number.isFinite(n) && n > 0 ? n : 0;
    };

    const resetViewportStyles = () => {
      modalEl.classList.remove("thkd-keyboard-open");
      document.body.classList.remove("keyboard-open");
      modalEl.style.removeProperty("--thkd-vv-height");
      modalEl.style.removeProperty("--thkd-vv-offset-top");
      modalEl.style.removeProperty("--thkd-vv-bottom-gap");
      modalEl.style.removeProperty("--thkd-vv-top-reveal");
      modalEl.style.top = "";
      modalEl.style.bottom = "";
      modalEl.style.height = "";
      modalEl.style.maxHeight = "";
      modalEl.style.paddingBottom = "";
      modalEl.style.alignItems = "";
      modalEl.style.justifyContent = "";
      modalEl.style.background = "";
      sheetEl.style.marginBottom = "";
      sheetEl.style.height = "";
      sheetEl.style.maxHeight = baseClosedMaxHeight || "";
      sheetEl.style.minHeight = "";
      sheetEl.style.position = "";
      sheetEl.style.left = "";
      sheetEl.style.right = "";
      sheetEl.style.bottom = "";
    };

    const apply = () => {
      if (modalEl.style.display !== "flex") return;

      const activeEl = document.activeElement;
      const hasEditableFocus = activeEl instanceof HTMLElement
        && modalEl.contains(activeEl)
        && (activeEl.isContentEditable || activeEl.matches("input, textarea, select"));

      if (hasEditableFocus) syncActiveFrame(activeEl);
      else clearActiveFrame();

      const currentViewportHeight = Math.max(260, Math.round(Number(vv?.height || document.documentElement.clientHeight || 0)));
      const viewportOffsetTop = Math.max(0, Math.round(Number(vv?.offsetTop || 0)));
      if (!initialViewportHeight || !hasEditableFocus || currentViewportHeight > initialViewportHeight) {
        initialViewportHeight = currentViewportHeight;
      }

      const keyboardByHeight = currentViewportHeight < (initialViewportHeight - 100);
      const keyboardByOffset = viewportOffsetTop > 20;
      const keyboardActive = hasEditableFocus && (keyboardByHeight || keyboardByOffset);
      const shouldBindViewportLayout = fullHeightWhenKeyboard && hasEditableFocus;
      const navOffset = (keyboardActive || shouldBindViewportLayout) ? 0 : getBottomNavOffset();
      const closedGap = baseClosedGap !== null
        ? Math.max(0, Number(baseClosedGap) || 0)
        : (navOffset > 0 ? Math.max(12, navOffset + 8) : 12);
      const keyboardGap = 8;

      if (keyboardActive || shouldBindViewportLayout) {
        const safeViewportHeight = currentViewportHeight;
        const topOffset = viewportOffsetTop;
        const bottomGap = fullHeightWhenKeyboard ? 0 : keyboardGap;
        const topRevealPx = fullHeightWhenKeyboard
          ? Math.max(48, Math.min(88, Math.round(safeViewportHeight * 0.12)))
          : 0;
        const targetHeightPx = Math.max(
          240,
          safeViewportHeight - bottomGap - (fullHeightWhenKeyboard ? topRevealPx : 28)
        );

        modalEl.style.setProperty("--thkd-vv-height", `${safeViewportHeight}px`);
        modalEl.style.setProperty("--thkd-vv-offset-top", `${topOffset}px`);
        modalEl.style.setProperty("--thkd-vv-bottom-gap", `${bottomGap}px`);
        modalEl.style.setProperty("--thkd-vv-top-reveal", `${topRevealPx}px`);
        modalEl.classList.add("thkd-keyboard-open");
        document.body.classList.add("keyboard-open");
        modalEl.style.top = `${topOffset}px`;
        modalEl.style.bottom = "auto";
        modalEl.style.height = `${safeViewportHeight}px`;
        modalEl.style.maxHeight = `${safeViewportHeight}px`;
        modalEl.style.paddingBottom = `${bottomGap}px`;
        modalEl.style.alignItems = fullHeightWhenKeyboard ? "stretch" : "flex-end";
        modalEl.style.justifyContent = "center";
        modalEl.style.background = "rgba(0,0,0,.28)";
        sheetEl.style.marginBottom = "0px";
        if (fullHeightWhenKeyboard) {
          sheetEl.style.position = "absolute";
          sheetEl.style.left = "0";
          sheetEl.style.right = "0";
          sheetEl.style.bottom = `${bottomGap}px`;
        }
        sheetEl.style.height = `${targetHeightPx}px`;
        sheetEl.style.maxHeight = `${targetHeightPx}px`;
        sheetEl.style.minHeight = fullHeightWhenKeyboard ? `${Math.max(240, Math.min(targetHeightPx, 420))}px` : "";
        setTimeout(() => ensureActiveFieldVisible(activeEl), 70);
        return;
      }

      resetViewportStyles();
      sheetEl.style.marginBottom = `${closedGap}px`;
    };

    modalEl.__thkdApplyKeyboard = apply;
    modalEl.__thkdClearFocusFrame = clearActiveFrame;
    modalEl.__thkdResetKeyboard = resetViewportStyles;

    if (vv) {
      vv.addEventListener("resize", () => setTimeout(apply, 20));
      vv.addEventListener("scroll", () => setTimeout(apply, 20));
    }
    window.addEventListener("resize", () => setTimeout(apply, 20));
    modalEl.addEventListener("focusin", () => setTimeout(apply, 50));
    modalEl.addEventListener("focusout", () => setTimeout(apply, 50));
  };

  const postModalEl = $("postModal");
  const postSheet = postModalEl?.querySelector(".modal-content");
  createScopedKeyboardAvoid({
    modalEl: postModalEl,
    sheetEl: postSheet,
    fullHeightWhenKeyboard: true,
    baseClosedMaxHeight: "calc(95dvh - 12px)"
  });

  createScopedKeyboardAvoid({
    modalEl: statusModalEl,
    sheetEl: statusSheet,
    fullHeightWhenKeyboard: true,
    baseClosedMaxHeight: "calc(95dvh - 12px)"
  });

  const ratingModalEl = $("ratingModal");
  const ratingSheet = ratingModalEl?.querySelector(".modal-content");
  createScopedKeyboardAvoid({
    modalEl: ratingModalEl,
    sheetEl: ratingSheet,
    fullHeightWhenKeyboard: false,
    baseClosedMaxHeight: "calc(90dvh - 12px)"
  });

  const profileModalEl = $("profileModal");
  profileModalEl?.addEventListener("click", (e) => {
    if (e.target === profileModalEl) Controllers.Modals.close(profileModalEl);
  });
  ratingModalEl?.addEventListener("click", (e) => {
    if (e.target === ratingModalEl) Controllers.Modals.close(ratingModalEl);
  });

  setInterval(() => {
    if (AppState.tickets.length > 0) {
      Controllers.List.render($("search")?.value || "");
    }
  }, 60000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootPosGocApp, { once: true });
} else {
  bootPosGocApp();
}

// Realtime runtime hooks: soft update without full-page reload.
window.__TK_SOFT_IMPORT_SAFE__ = true;
window.__TK_BEFORE_SOFT_IMPORT__ = async (meta) => {
  if (!meta || meta.pageId !== "pos-goc") return;
  try { window.__TK_POS_APPSTATE__ = AppState; } catch (_) {}
  try {
    (AppState.unsubs || []).forEach((fn) => {
      try { if (typeof fn === "function") fn(); } catch (_) {}
    });
    AppState.unsubs = [];
  } catch (_) {}
};
window.__TK_PAGE_REFRESH__ = async (meta) => {
  if (meta && meta.pageId && meta.pageId !== "pos-goc") return;
  try {
    Controllers.List.render($("search")?.value || "");
  } catch (_) {}
};
if (window.TKRealtimeRuntime && typeof window.TKRealtimeRuntime.registerStateHooks === "function") {
  window.TKRealtimeRuntime.registerStateHooks("pos-goc", {
    exportState: () => ({
      search: $("search")?.value || "",
      editingPostId: AppState.editingPostId || "",
      postType: AppState.postType || "repair"
    }),
    importState: (state) => {
      if (!state) return;
      if ($("search") && typeof state.search === "string") $("search").value = state.search;
    }
  });
}
