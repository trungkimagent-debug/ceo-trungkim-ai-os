import { ensureInternalClientAccess } from "./internal-access.js";
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  debounce, newSessionId, getHcmTimeParts, todayKeyHCM, fmtTimeHCM,
  normalizePunchEvents,
  buildSessions, buildAttendanceWorkMs, fmtBalance, fmtMoney, toMs, classifyBreakLabel, fmtAgo
} from "./utils.js";
import { THKD_FIREBASE_CONFIG } from "./star-firebase-config.js";

ensureInternalClientAccess({ allowHash: false, allowSession: true });

const STAR_FIREBASE_APP_NAME = "thkd-star";
const app = getApps().some((item) => item.name === STAR_FIREBASE_APP_NAME)
  ? getApp(STAR_FIREBASE_APP_NAME)
  : initializeApp(THKD_FIREBASE_CONFIG, STAR_FIREBASE_APP_NAME);
const db = getFirestore(app);

const STAR_ROOT = window.__THKD_STAR_ROOT__ || document;
const STAR_IS_SCOPED = STAR_ROOT !== document;

function getEl(id, scope = STAR_ROOT) {
  if (scope && typeof scope.querySelector === "function") {
    const found = scope.querySelector(`#${id}`);
    if (found) return found;
  }
  return document.getElementById(id);
}

const STAR_STYLE_HOST = STAR_IS_SCOPED && typeof STAR_ROOT.appendChild === "function"
  ? STAR_ROOT
  : document.head;

const listEl = getEl("rankList");
const btnQr = getEl("btnQr");
const qrOverlay = getEl("qrOverlay");
const btnQrClose = getEl("btnQrClose");
const qrStaffSelect = getEl("qrStaffSelect");
const qrRowSelect = getEl("qrRowSelect");
const qrCodeEl = getEl("qrCode");
const qrLinkEl = getEl("qrLink");
const qrTitleEl = getEl("qrTitle");
const qrCountdownEl = getEl("qrCountdown");
const staffFilterOverlay = getEl("staffFilterOverlay");
const staffFilterListEl = getEl("staffFilterList");
const btnSfAll = getEl("btnSfAll");
const btnSfNone = getEl("btnSfNone");
const btnSfClose = getEl("btnSfClose");
const loginOverlay = getEl("loginOverlay");
const loginStaffIdEl = getEl("loginStaffId");
const loginPasswordEl = getEl("loginPassword");
const btnLogin = getEl("btnLogin");
const loginErr = getEl("loginErr");
const userNameEl = getEl("userName");
const btnLogout = getEl("btnLogout");
const btnReload = getEl("btnReload");

let lastRows = window.__TK_STAR_LAST_ROWS__ || null;
let pillMeasureEl = null;
let lastValuePadPx = 120;
let qrInstance = null;
let currentUser = window.__TK_STAR_CURRENT_USER__ || null;
let qrSessionUnsub = null;
let activeQrSessionId = null;
let qrExpireTimerId = null;
let qrCountdownTimerId = null;
let qrDeadlineMs = 0;
let staffDetailOverlayEl = null;
let staffDetailLoadingEl = null;
let staffDetailTitleEl = null;
let staffDetailStatsEl = null;
let staffDetailTimelineEl = null;
let presidentVisibleStaffIds = null;
let presidentDraftVisibleStaffIds = null;

const LS_KEY_SESSION = "thkd_rank_session_v1";
const LS_KEY_RANK_CACHE = "thkd_rank_rows_cache_v1";
const LS_KEY_PRESIDENT_VISIBLE_STAFF = "thkd_president_visible_staff_v1";
const INTERNAL_POS_API_BASE = "/api/internal/pos";
const SESSION_COLL = "staff_sessions";
let sessionHeartbeatId = null;
let sessionPresenceRef = null;
let staffSessionGeoUnsub = null;
let staffRuntimeControlUnsub = null;
let staffSessionGeoRows = [];
let geoCheckBusy = false;
let geoOutsideSinceMs = 0;
let lastGeoToastKey = "";
let lastGeoToastAtMs = 0;
let lastHandledForceLogoutAtMs = 0;
const QR_TTL_MS = 60_000;
const SHOP_LAT = 11.1258;
const SHOP_LNG = 106.6067;
// Bán kính cho phép (m).
const SHOP_RADIUS_M = 100;
const GEO_CHECK_MS = 60 * 1000;
const OUTSIDE_PAUSE_AFTER_MS = 15 * 60 * 1000;
const OUTSIDE_FORCE_LOGOUT_AFTER_MS = 60 * 60 * 1000;
const SESSION_GEO_STALE_MS = 3 * 60 * 1000;
let geoIntervalId = null;
let autoOutIntervalId = null;

const LOC_EXPIRE_MS = 60 * 60 * 1000; // 60 phút
const AUTO_REFRESH_MS = 30_000;
let autoRefreshId = null;
let liveStaffUnsub = null;
let liveWalletUnsub = null;
let livePunchUnsub = null;
let livePunchDayKey = "";
const SHIFT_START_HOUR = 6;
const SHIFT_START_MINUTE = 30;
const DAILY_AUTO_OUT_HOUR = 22; //
const DAILY_AUTO_OUT_MINUTE = 0;
const WORK_SCHEDULE_COLL = "tk_work_schedules";
const SCHEDULE_AUTO_OUT_CACHE_MS = 2 * 60 * 1000;
const SCHEDULE_SHIFT_DEFAULT_TIMES = Object.freeze({
  sang: { start: "07:00", end: "15:00" },
  trua: { start: "11:00", end: "19:00" },
  chieu: { start: "15:00", end: "22:00" },
  cangay: { start: "07:00", end: "22:00" }
});
const PAYROLL_DAYS_IN_MONTH = 30;
const PAYROLL_HOURS_PER_DAY = 10;
const XU_VALUE_VND = 1000;
const PRESIDENT_EMAIL = "trunghaukimdunggroup@gmail.com";
const PUNCH_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const MIN_VALID_SESSION_MS = 3 * 60 * 1000;
const MAX_SESSION_MS = 14 * 60 * 60 * 1000;
const UI_SNAPSHOT_COLL = "tk_client_snapshots";
const UI_SNAPSHOT_DOC_INDEX = "index_rank";
const UI_SNAPSHOT_MIN_INTERVAL_MS = 20_000;
const UI_RUNTIME_COLL = "tk_client_runtime";
const WORKTIME_STATE_COLL = "tk_worktime_states";
const STAFF_RUNTIME_COLL = "tk_staff_runtime";
let lastUiSnapshotSig = "";
let lastUiSnapshotAtMs = 0;
let activeDetailStaffId = "";
let scheduleAutoOutCache = {
  staffId: "",
  dayKey: "",
  expiresAt: 0,
  endMinute: DAILY_AUTO_OUT_HOUR * 60 + DAILY_AUTO_OUT_MINUTE,
  isOff: false,
  source: "fallback_daily_cutoff"
};

const SmartImageRuntime = {
  _styleInjected: false,
  _observer: null,

  ensureStyle: () => {
    if (SmartImageRuntime._styleInjected) return;
    const style = document.createElement("style");
    style.id = "tk-smart-image-style-star";
    style.textContent = `
      img.tk-img-blur{filter:blur(10px);transform:scale(1.015);opacity:.78;transition:filter .25s ease,opacity .25s ease,transform .25s ease}
      img.tk-img-ready{filter:none;transform:none;opacity:1}
    `;
    STAR_STYLE_HOST.appendChild(style);
    SmartImageRuntime._styleInjected = true;
  },

  inferSizes: (img) => {
    if (!(img instanceof HTMLImageElement)) return "";
    if (img.closest(".sd-day-card")) return "(max-width: 768px) 94vw, 520px";
    if (img.closest(".pp-row")) return "(max-width: 768px) 36vw, 140px";
    return "(max-width: 768px) 96vw, 280px";
  },

  applyToImage: (img) => {
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.tkSmartInit === "1") return;
    img.dataset.tkSmartInit = "1";
    if (!img.loading) img.loading = "lazy";
    if (!img.decoding) img.decoding = "async";
    if ("fetchPriority" in img && !img.getAttribute("fetchpriority")) img.fetchPriority = "low";
    if (!img.getAttribute("sizes")) img.setAttribute("sizes", SmartImageRuntime.inferSizes(img));

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

  hydrate: (root = document) => {
    const scope = root && typeof root.querySelectorAll === "function" ? root : STAR_ROOT;
    scope.querySelectorAll("img").forEach(SmartImageRuntime.applyToImage);
  },

  install: () => {
    SmartImageRuntime.ensureStyle();
    SmartImageRuntime.hydrate(STAR_ROOT);
    if (SmartImageRuntime._observer) return;
    SmartImageRuntime._observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.tagName === "IMG") SmartImageRuntime.applyToImage(node);
          SmartImageRuntime.hydrate(node);
        });
      }
    });
    SmartImageRuntime._observer.observe(STAR_IS_SCOPED ? STAR_ROOT : (document.body || document.documentElement), { childList: true, subtree: true });
  }
};

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getCurrentPosition(opts) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("TRÌNH DUYỆT KHÔNG HỖ TRỢ ĐỊNH VỊ"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, opts);
  });
}

async function checkInShop() {
  try {
    const pos = await getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 12_000
    });
    const lat = Number(pos?.coords?.latitude);
    const lng = Number(pos?.coords?.longitude);
    const acc = Number(pos?.coords?.accuracy || 0);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { ok: false, reason: "GPS_INVALID", distanceM: null, accuracyM: acc };
    }

    const d = haversineMeters(lat, lng, SHOP_LAT, SHOP_LNG);
    const ok = d <= SHOP_RADIUS_M;
    return { ok, reason: ok ? "OK" : "OUT_OF_SHOP", distanceM: d, accuracyM: acc, lat, lng };
  } catch (e) {
    const code = e?.code;
    if (code === 1) return { ok: false, reason: "GPS_DENIED", distanceM: null, accuracyM: null };
    if (code === 2) return { ok: false, reason: "GPS_UNAVAILABLE", distanceM: null, accuracyM: null };
    if (code === 3) return { ok: false, reason: "GPS_TIMEOUT", distanceM: null, accuracyM: null };
    return { ok: false, reason: "GPS_ERROR", distanceM: null, accuracyM: null };
  }
}

function fmtMeters(m) {
  if (!Number.isFinite(m)) return "";
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(2)}km`;
}

function getNowPartsHCM() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const get = (t) => Number(parts.find((p) => p.type === t)?.value || 0);
  return { hour: get("hour"), minute: get("minute") };
}

function isPresidentAccount(input) {
  return String(input || "").trim().toLowerCase() === PRESIDENT_EMAIL;
}
function isPresidentAccountWrapper(input) { return isPresidentAccount(input); }

function getShiftWindowStatusHCM() {
  const now = getNowPartsHCM();
  const currentMin = now.hour * 60 + now.minute;
  const startMin = SHIFT_START_HOUR * 60 + SHIFT_START_MINUTE;
  const endMin = DAILY_AUTO_OUT_HOUR * 60 + DAILY_AUTO_OUT_MINUTE;
  return {
    within: currentMin >= startMin && currentMin <= endMin,
    beforeStart: currentMin < startMin,
    afterEnd: currentMin > endMin || currentMin === endMin
  };
}

function isPastDailyCutoffHCM() {
  return getShiftWindowStatusHCM().afterEnd;
}

function getEffectiveDayEndMsHCM(day) {
  const cutoffMs = new Date(
    `${String(day)}T${String(DAILY_AUTO_OUT_HOUR).padStart(2, "0")}:${String(
      DAILY_AUTO_OUT_MINUTE
    ).padStart(2, "0")}:00+07:00`
  ).getTime();
  if (!Number.isFinite(cutoffMs)) return Date.now();
  if (String(day) === todayKeyHCM()) return Math.min(Date.now(), cutoffMs);
  return cutoffMs;
}

function showLoginError(msg) {
  if (!loginErr) return;
  if (!msg) {
    loginErr.textContent = "";
    loginErr.classList.remove("show");
  } else {
    loginErr.textContent = msg;
    loginErr.classList.add("show");
  }
}

function openLoginOverlay() {
  if (!loginOverlay) return;
  showLoginError("");
  loginOverlay.classList.add("open");
  loginOverlay.setAttribute("aria-hidden", "false");
  setTimeout(() => loginStaffIdEl?.focus?.(), 0);
}

function closeLoginOverlay() {
  if (!loginOverlay) return;
  loginOverlay.classList.remove("open");
  loginOverlay.setAttribute("aria-hidden", "true");
}

function saveSession() {
  try {
    if (!currentUser) {
      localStorage.removeItem(LS_KEY_SESSION);
      return;
    }
    localStorage.setItem(LS_KEY_SESSION, JSON.stringify(currentUser));
  } catch {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(LS_KEY_SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getInternalPosSessionToken() {
  return String(currentUser?.internalPosSessionToken || "").trim();
}

async function callInternalPosApi(path, options = {}) {
  const token = getInternalPosSessionToken();
  if (!token) throw new Error("Phiên Chủ tịch nội bộ đã hết hạn, hãy đăng nhập lại.");

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("x-pos-session-token", token);

  const response = await fetch(`${INTERNAL_POS_API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "omit",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || `Lỗi API (${response.status})`);
  }
  return payload;
}

function cloneIdSet(setVal) {
  if (!(setVal instanceof Set)) return null;
  return new Set(Array.from(setVal));
}

function savePresidentVisibleStaffSelection() {
  try {
    if (!(presidentVisibleStaffIds instanceof Set)) {
      localStorage.setItem(LS_KEY_PRESIDENT_VISIBLE_STAFF, JSON.stringify({ mode: "all", ids: [] }));
      return;
    }
    localStorage.setItem(
      LS_KEY_PRESIDENT_VISIBLE_STAFF,
      JSON.stringify({ mode: "custom", ids: Array.from(presidentVisibleStaffIds) })
    );
  } catch {}
}

function loadPresidentVisibleStaffSelection() {
  try {
    const raw = localStorage.getItem(LS_KEY_PRESIDENT_VISIBLE_STAFF);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.mode !== "custom" || !Array.isArray(parsed?.ids)) return null;
    const ids = parsed.ids.map((x) => String(x || "").trim()).filter(Boolean);
    return ids.length ? new Set(ids) : new Set();
  } catch {
    return null;
  }
}

function saveRankCache(rows) {
  try {
    const safeRows = Array.isArray(rows)
      ? rows.slice(0, 120).map((r) => ({
          id: String(r?.id || ""),
          name: String(r?.name || ""),
          balance: Number(r?.balance || 0),
          locState: String(r?.locState || "black"),
          locPulse: !!r?.locPulse,
          locTitle: String(r?.locTitle || ""),
          locCount: Number(r?.locCount || 0),
          locLastAtMs: Number(r?.locLastAtMs || 0),
          worktimeState: String(r?.worktimeState || "unknown")
        }))
      : [];
    localStorage.setItem(
      LS_KEY_RANK_CACHE,
      JSON.stringify({
        ts: Date.now(),
        rows: safeRows
      })
    );
  } catch {}
}

function loadRankCache() {
  try {
    const raw = localStorage.getItem(LS_KEY_RANK_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.rows) || parsed.rows.length === 0) return null;
    return parsed.rows;
  } catch {
    return null;
  }
}

function applyAuthUi() {
  const loggedIn = !!currentUser;
  if (!currentUser?.isPresident) closeStaffFilterOverlay();
  if (userNameEl) {
    userNameEl.textContent = loggedIn ? String(currentUser.name || currentUser.staffId || "") : "";
    userNameEl.classList.toggle("hidden", !loggedIn);
  }
  if (btnLogout) btnLogout.classList.toggle("hidden", !loggedIn);
  if (btnQr) btnQr.classList.toggle("hidden", !loggedIn);
  if (btnQr) {
    const icon = btnQr.querySelector("i");
    btnQr.title = "Mở QR khách đánh giá";
    icon?.classList.remove("fa-list-check");
    icon?.classList.add("fa-qrcode");
  }
  if (btnReload) btnReload.classList.toggle("hidden", !loggedIn);
}

function doLogout(reasonMsg) {
  const leavingStaffId = String(currentUser?.staffId || "").trim();
  const leavingSessionId = String(currentUser?.sessionId || "").trim();
  const leavingIsPresident = !!currentUser?.isPresident;
  const leavingInternalPosSessionToken = String(currentUser?.internalPosSessionToken || "").trim();
  if (sessionPresenceRef && leavingStaffId && leavingSessionId && !leavingIsPresident) {
    setDoc(sessionPresenceRef, {
      online: false,
      logoutAt: serverTimestamp(),
      logoutAtMs: Date.now()
    }, { merge: true }).catch(() => {});
  }
  publishClientRuntime({ online: false, logoutAtMs: Date.now() }).catch(() => {});
  if (leavingStaffId && !leavingIsPresident) {
    recordAutoShiftPunchOnLogout(leavingStaffId).catch(() => {});
  }
  if (leavingIsPresident && leavingInternalPosSessionToken) {
    fetch(`${INTERNAL_POS_API_BASE}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pos-session-token': leavingInternalPosSessionToken,
      },
      body: '{}',
      credentials: 'omit',
    }).catch(() => {});
  }
  currentUser = null;
  saveSession();
  applyAuthUi();
  if (listEl) listEl.innerHTML = "";
  closeStaffDetailModal();
  closeQrOverlay();
  closeStaffFilterOverlay();
  resetScheduleAutoOutCache();
  presidentVisibleStaffIds = null;
  presidentDraftVisibleStaffIds = null;

  if (qrSessionUnsub) {
    qrSessionUnsub();
    qrSessionUnsub = null;
  }
  activeQrSessionId = null;
  if (qrExpireTimerId) {
    clearTimeout(qrExpireTimerId);
    qrExpireTimerId = null;
  }
  if (qrCountdownTimerId) {
    clearInterval(qrCountdownTimerId);
    qrCountdownTimerId = null;
  }
  qrDeadlineMs = 0;
  if (qrCountdownEl) {
    qrCountdownEl.classList.add("hidden");
    qrCountdownEl.textContent = "01:00";
  }

  if (sessionHeartbeatId) {
    clearInterval(sessionHeartbeatId);
    sessionHeartbeatId = null;
  }
  if (staffSessionGeoUnsub) {
    staffSessionGeoUnsub();
    staffSessionGeoUnsub = null;
  }
  if (staffRuntimeControlUnsub) {
    staffRuntimeControlUnsub();
    staffRuntimeControlUnsub = null;
  }
  staffSessionGeoRows = [];
  geoOutsideSinceMs = 0;
  geoCheckBusy = false;
  lastGeoToastKey = "";
  lastGeoToastAtMs = 0;
  sessionPresenceRef = null;

  if (geoIntervalId) {
    clearInterval(geoIntervalId);
    geoIntervalId = null;
  }

  if (autoOutIntervalId) {
    clearInterval(autoOutIntervalId);
    autoOutIntervalId = null;
  }

  if (autoRefreshId) {
    clearInterval(autoRefreshId);
    autoRefreshId = null;
  }
  stopLiveDataSync();

  openLoginOverlay();
  if (reasonMsg) showLoginError(reasonMsg);
}

const debouncedLiveReload = debounce(() => {
  if (!currentUser) return;
  loadData();
}, 250);

function stopLiveDataSync() {
  if (liveStaffUnsub) {
    liveStaffUnsub();
    liveStaffUnsub = null;
  }
  if (liveWalletUnsub) {
    liveWalletUnsub();
    liveWalletUnsub = null;
  }
  if (livePunchUnsub) {
    livePunchUnsub();
    livePunchUnsub = null;
  }
  livePunchDayKey = "";
}

function startLiveDataSync() {
  if (!currentUser) return;
  if (!liveStaffUnsub) {
    liveStaffUnsub = onSnapshot(collection(db, "staffs"), () => {
      debouncedLiveReload();
    });
  }
  if (!liveWalletUnsub) {
    liveWalletUnsub = onSnapshot(collection(db, "star_wallets"), () => {
      debouncedLiveReload();
    });
  }
  const dayKey = todayKeyHCM();
  if (!livePunchUnsub || livePunchDayKey !== dayKey) {
    if (livePunchUnsub) livePunchUnsub();
    livePunchDayKey = dayKey;
    livePunchUnsub = onSnapshot(
      query(collection(db, "staff_punches"), where("day", "==", dayKey)),
      () => {
        debouncedLiveReload();
      }
    );
  }
}

function parseHmToMinute(value = "") {
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function minuteToHm(minute = 0) {
  const m = Number(minute || 0);
  if (!Number.isFinite(m) || m < 0) return "--:--";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function resetScheduleAutoOutCache() {
  scheduleAutoOutCache = {
    staffId: "",
    dayKey: "",
    expiresAt: 0,
    endMinute: DAILY_AUTO_OUT_HOUR * 60 + DAILY_AUTO_OUT_MINUTE,
    isOff: false,
    source: "fallback_daily_cutoff"
  };
}

async function resolveAutoOutSchedule(forceRefresh = false) {
  if (!currentUser?.staffId || currentUser?.isPresident) {
    return {
      endMinute: DAILY_AUTO_OUT_HOUR * 60 + DAILY_AUTO_OUT_MINUTE,
      isOff: false,
      source: "fallback_daily_cutoff"
    };
  }

  const staffId = String(currentUser.staffId || "").trim();
  const dayKey = todayKeyHCM();
  const now = Date.now();
  if (
    !forceRefresh
    && scheduleAutoOutCache.staffId === staffId
    && scheduleAutoOutCache.dayKey === dayKey
    && now < scheduleAutoOutCache.expiresAt
  ) {
    return scheduleAutoOutCache;
  }

  const fallback = {
    staffId,
    dayKey,
    expiresAt: now + SCHEDULE_AUTO_OUT_CACHE_MS,
    endMinute: DAILY_AUTO_OUT_HOUR * 60 + DAILY_AUTO_OUT_MINUTE,
    isOff: false,
    source: "fallback_daily_cutoff"
  };

  try {
    const snap = await getDocs(
      query(
        collection(db, WORK_SCHEDULE_COLL),
        where("day", "==", dayKey),
        where("staffId", "==", staffId)
      )
    );
    if (snap.empty) {
      scheduleAutoOutCache = fallback;
      return scheduleAutoOutCache;
    }

    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() || {}) }))
      .sort((a, b) => {
        const ams = Number(a.updatedAtMs || toMs(a.updatedAt) || toMs(a.createdAt) || 0);
        const bms = Number(b.updatedAtMs || toMs(b.updatedAt) || toMs(b.createdAt) || 0);
        return bms - ams;
      });
    const row = rows[0] || {};
    const isOff = row.isOff === true;
    if (isOff) {
      scheduleAutoOutCache = {
        ...fallback,
        isOff: true,
        endMinute: -1,
        source: "schedule_off_day"
      };
      return scheduleAutoOutCache;
    }

    const shifts = Array.isArray(row.shifts) ? row.shifts.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean) : [];
    const shiftTimes = row.shiftTimes && typeof row.shiftTimes === "object" ? row.shiftTimes : {};
    const endMinutes = shifts
      .map((shiftId) => {
        const customEnd = String(shiftTimes?.[shiftId]?.end || "").trim();
        const fallbackEnd = String(SCHEDULE_SHIFT_DEFAULT_TIMES?.[shiftId]?.end || "").trim();
        return parseHmToMinute(customEnd || fallbackEnd);
      })
      .filter((v) => Number.isFinite(v));
    if (!endMinutes.length) {
      scheduleAutoOutCache = {
        ...fallback,
        source: "schedule_missing_shift_end"
      };
      return scheduleAutoOutCache;
    }

    scheduleAutoOutCache = {
      ...fallback,
      endMinute: Math.max(...endMinutes),
      source: "schedule_registered_shift"
    };
    return scheduleAutoOutCache;
  } catch (e) {
    console.warn("resolveAutoOutSchedule failed:", e);
    scheduleAutoOutCache = {
      ...fallback,
      source: "schedule_query_failed"
    };
    return scheduleAutoOutCache;
  }
}

async function enforceGeoFence() {
  if (!currentUser) return;
  if (currentUser?.isPresident) return;
  if (geoCheckBusy) return;
  geoCheckBusy = true;
  try {
    const r = await checkInShop();
    await updateSessionGeoState(r);

    const nowMs = Date.now();
    const shared = resolveSharedOutsideState(nowMs);
    if (!r.ok) {
      const localOutsideSinceMs = Number(geoOutsideSinceMs || nowMs);
      if (!shared.anyOutside || localOutsideSinceMs < Number(shared.outsideSinceMs || nowMs)) {
        shared.anyOutside = true;
        shared.outsideSinceMs = localOutsideSinceMs;
      }
      if (!Number.isFinite(Number(shared.distanceM)) && Number.isFinite(Number(r.distanceM))) {
        shared.distanceM = Number(r.distanceM);
      }
    }
    if (!shared.anyOutside) {
      const resumed = await writeAutoShiftPunchIfNeeded(
        String(currentUser?.staffId || ""),
        "in",
        "index_geo_resume"
      );
      if (resumed) {
        throttleGeoToast("geo_resume", buildGeoNaturalNotice("back_in_resume"));
      }
      return;
    }

    const outsideMs = Math.max(0, nowMs - Number(shared.outsideSinceMs || nowMs));
    if (outsideMs >= OUTSIDE_FORCE_LOGOUT_AFTER_MS) {
      const reason = "Ra ngoài phạm vi shop quá 60 phút. Hệ thống tự OUT toàn bộ trình duyệt.";
      await triggerForceLogoutAllBrowsers(reason);
      throttleGeoToast("geo_force_logout", buildGeoNaturalNotice("force_logout_all"));
      doLogout(reason);
      return;
    }

    if (outsideMs >= OUTSIDE_PAUSE_AFTER_MS) {
      const paused = await writeAutoShiftPunchIfNeeded(
        String(currentUser?.staffId || ""),
        "out",
        "index_geo_pause"
      );
      if (paused) {
        throttleGeoToast("geo_pause", buildGeoNaturalNotice("outside_pause"));
      }
      return;
    }

    const remainPauseMs = OUTSIDE_PAUSE_AFTER_MS - outsideMs;
    throttleGeoToast(
      "geo_grace",
      buildGeoNaturalNotice("outside_grace", {
        minutes: remainPauseMs / 60000,
        distanceM: shared.distanceM
      })
    );
  } catch {
    // ignore geo transient errors
  } finally {
    geoCheckBusy = false;
  }
}

async function enforceDailyAutoOut() {
  if (!currentUser) return;
  if (currentUser?.isPresident) return;

  const now = getNowPartsHCM();
  const nowMinute = now.hour * 60 + now.minute;
  const scheduleGuard = await resolveAutoOutSchedule(false);
  if (scheduleGuard.isOff) {
    doLogout("Hôm nay đăng ký OFF trên lịch làm việc. Hệ thống tự OUT.");
    return;
  }
  if (Number.isFinite(scheduleGuard.endMinute) && scheduleGuard.endMinute >= 0 && nowMinute >= scheduleGuard.endMinute) {
    doLogout(`Đã hết ca đăng ký (${minuteToHm(scheduleGuard.endMinute)}). Hệ thống tự OUT theo lịch làm việc.`);
    return;
  }

  const shiftState = getShiftWindowStatusHCM();
  if (!shiftState.afterEnd) return;
  doLogout("Đã 22:00. Hệ thống tự OUT theo quy định ca làm.");
}

function startDailyAutoOutGuard() {
  if (autoOutIntervalId) clearInterval(autoOutIntervalId);
  enforceDailyAutoOut().catch(() => {});
  autoOutIntervalId = setInterval(() => {
    enforceDailyAutoOut().catch(() => {});
  }, 30_000);
}

async function startSessionPresence() {
  if (!currentUser?.staffId || !currentUser?.sessionId) return;

  const key = `${String(currentUser.staffId)}_${String(currentUser.sessionId)}`;
  const ref = doc(db, SESSION_COLL, key);
  sessionPresenceRef = ref;
  await setDoc(
    ref,
    {
      staffId: String(currentUser.staffId),
      staffName: String(currentUser.name || currentUser.staffId),
      sessionId: String(currentUser.sessionId),
      online: true,
      userAgent: navigator.userAgent || "",
      page: window.location.pathname || "",
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
      lastSeenAt: serverTimestamp(),
      lastSeenAtMs: Date.now(),
      geoInside: true,
      geoReason: "OK",
      geoDistanceM: 0,
      geoUpdatedAtMs: Date.now(),
      outsideSinceMs: 0,
    },
    { merge: true }
  );

  // Heartbeat presence for this browser session only.
  if (sessionHeartbeatId) clearInterval(sessionHeartbeatId);
  sessionHeartbeatId = setInterval(async () => {
    try {
      if (!currentUser?.staffId || !currentUser?.sessionId || !sessionPresenceRef) return;
      await setDoc(sessionPresenceRef, {
        online: true,
        lastSeenAt: serverTimestamp(),
        lastSeenAtMs: Date.now()
      }, { merge: true });
    } catch {
      // ignore
    }
  }, 60_000);
}

function throttleGeoToast(key, msg) {
  if (!msg) return;
  const nowMs = Date.now();
  if (key === lastGeoToastKey && nowMs - lastGeoToastAtMs < 90_000) return;
  lastGeoToastKey = key;
  lastGeoToastAtMs = nowMs;
  showToast(msg);
}

function buildGeoNaturalNotice(type, data = {}) {
  const mins = Math.max(0, Math.ceil(Number(data.minutes || 0)));
  const distance = Number.isFinite(Number(data.distanceM)) ? ` (cách shop ~${Math.round(Number(data.distanceM))}m)` : "";
  if (type === "outside_grace") {
    return `Em thấy mình đang ra ngoài phạm vi shop${distance}. Em vẫn giữ ca, sau ${mins} phút nữa nếu chưa quay lại mới tạm dừng tính giờ.`;
  }
  if (type === "outside_pause") {
    return "Em đã tự tạm dừng tính giờ vì ra ngoài shop quá 15 phút. Khi quay lại em sẽ tự tính giờ lại.";
  }
  if (type === "back_in_resume") {
    return "Em thấy đã quay lại gần shop, em tự mở lại tính giờ làm ngay.";
  }
  if (type === "force_logout_all") {
    return "Em đã tự OUT toàn bộ trình duyệt vì có phiên ra ngoài shop quá 60 phút.";
  }
  return "";
}

function isGeoOutsideFromSession(row = {}, nowMs = Date.now()) {
  const online = row?.online !== false;
  if (!online) return false;
  const lastSeenAtMs = Number(row?.lastSeenAtMs || row?.geoUpdatedAtMs || 0);
  if (!lastSeenAtMs || nowMs - lastSeenAtMs > SESSION_GEO_STALE_MS) return false;
  const inside = row?.geoInside === true;
  if (inside) return false;
  const reason = String(row?.geoReason || "").trim();
  if (row?.geoInside === false) return true;
  return !!reason && reason !== "OK";
}

function resolveSharedOutsideState(nowMs = Date.now()) {
  const rows = Array.isArray(staffSessionGeoRows) ? staffSessionGeoRows : [];
  const outsideRows = rows.filter((row) => isGeoOutsideFromSession(row, nowMs));
  if (!outsideRows.length) return { anyOutside: false, outsideSinceMs: 0, distanceM: null };
  let outsideSinceMs = nowMs;
  let distanceM = null;
  for (const row of outsideRows) {
    const rowStart = Number(row?.outsideSinceMs || row?.geoUpdatedAtMs || row?.lastSeenAtMs || nowMs);
    outsideSinceMs = Math.min(outsideSinceMs, rowStart > 0 ? rowStart : nowMs);
    const d = Number(row?.geoDistanceM);
    if (Number.isFinite(d)) distanceM = d;
  }
  return {
    anyOutside: true,
    outsideSinceMs,
    distanceM
  };
}

async function updateSessionGeoState(geo = null) {
  if (!sessionPresenceRef || !currentUser?.staffId || currentUser?.isPresident) return;
  const nowMs = Date.now();
  const outside = !geo?.ok;
  if (outside) {
    if (!geoOutsideSinceMs) geoOutsideSinceMs = nowMs;
  } else {
    geoOutsideSinceMs = 0;
  }
  await setDoc(sessionPresenceRef, {
    online: true,
    lastSeenAt: serverTimestamp(),
    lastSeenAtMs: nowMs,
    geoInside: !outside,
    geoReason: String(geo?.reason || (outside ? "GPS_ERROR" : "OK")),
    geoDistanceM: Number.isFinite(Number(geo?.distanceM)) ? Number(geo.distanceM) : null,
    geoUpdatedAtMs: nowMs,
    outsideSinceMs: outside ? geoOutsideSinceMs : 0,
  }, { merge: true });
}

function startStaffSessionGeoSync() {
  if (!currentUser?.staffId || currentUser?.isPresident) return;
  if (staffSessionGeoUnsub) {
    staffSessionGeoUnsub();
    staffSessionGeoUnsub = null;
  }
  staffSessionGeoUnsub = onSnapshot(
    query(collection(db, SESSION_COLL), where("staffId", "==", String(currentUser.staffId))),
    (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        rows.push({
          id: d.id,
          ...data,
        });
      });
      staffSessionGeoRows = rows;
    },
    () => {
      staffSessionGeoRows = [];
    }
  );
}

function startStaffRuntimeControlSync() {
  if (!currentUser?.staffId || currentUser?.isPresident) return;
  if (staffRuntimeControlUnsub) {
    staffRuntimeControlUnsub();
    staffRuntimeControlUnsub = null;
  }
  const ref = doc(db, STAFF_RUNTIME_COLL, String(currentUser.staffId));
  staffRuntimeControlUnsub = onSnapshot(ref, (snap) => {
    const data = snap.exists() ? (snap.data() || {}) : {};
    const forceAtMs = Number(data.forceLogoutAtMs || 0);
    if (!forceAtMs || forceAtMs <= lastHandledForceLogoutAtMs) return;
    const loginAtMs = Number(currentUser?.loginAtMs || 0);
    if (loginAtMs && forceAtMs < loginAtMs) return;
    lastHandledForceLogoutAtMs = forceAtMs;
    const reason = String(data.forceLogoutReason || "Hệ thống đã tự OUT phiên làm việc.");
    doLogout(reason);
  });
}

async function triggerForceLogoutAllBrowsers(reasonMsg = "") {
  if (!currentUser?.staffId || currentUser?.isPresident) return;
  const nowMs = Date.now();
  await setDoc(
    doc(db, STAFF_RUNTIME_COLL, String(currentUser.staffId)),
    {
      staffId: String(currentUser.staffId || ""),
      forceLogoutAtMs: nowMs,
      forceLogoutAt: serverTimestamp(),
      forceLogoutBySessionId: String(currentUser.sessionId || ""),
      forceLogoutReason: String(reasonMsg || ""),
      updatedAtMs: nowMs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

async function verifyLogin(staffId, pass) {
  const id = String(staffId || "").trim();
  const p = String(pass || "").trim();
  if (!id || !p) return { ok: false, error: "Vui lòng nhập đầy đủ SĐT/Mã nhân viên và mật khẩu." };

  // TEST-ONLY HOOK: enables deterministic auth smoke tests without hitting Firestore/Firebase runtime.
  // Production behavior remains unchanged unless window.__TK_AUTH_SMOKE__?.enabled === true.
  const smokeHook = window?.__TK_AUTH_SMOKE__;
  if (smokeHook?.enabled === true) {
    const byIdMap = smokeHook.staffById && typeof smokeHook.staffById === "object" ? smokeHook.staffById : {};
    const byPhoneMap = smokeHook.staffByPhone && typeof smokeHook.staffByPhone === "object" ? smokeHook.staffByPhone : {};

    let resolvedId = id;
    let fallbackUsed = false;
    let s = null;

    const byIdHit = byIdMap[id];
    if (byIdHit && typeof byIdHit === "object") {
      s = byIdHit;
    } else {
      const byPhoneHit = byPhoneMap[id];
      if (byPhoneHit && typeof byPhoneHit === "object") {
        fallbackUsed = true;
        if (byPhoneHit.data && typeof byPhoneHit.data === "object") {
          s = byPhoneHit.data;
          resolvedId = String(byPhoneHit.id || "").trim() || id;
        } else {
          s = byPhoneHit;
          resolvedId = String(byPhoneHit.id || "").trim() || id;
        }
      }
    }

    if (!s) {
      return {
        ok: false,
        error: "Không tìm thấy nhân viên. Vui lòng kiểm tra lại.",
        meta: { smoke: true, fallback_used: fallbackUsed },
      };
    }

    const realPass = String(s.loginPassword || "").trim();
    if (!realPass || realPass !== p) {
      return {
        ok: false,
        error: "Mật khẩu không đúng.",
        meta: { smoke: true, fallback_used: fallbackUsed, resolved_id: resolvedId },
      };
    }

    if (s.active === false) {
      return {
        ok: false,
        error: "Tài khoản đang tạm nghỉ/khóa.",
        meta: { smoke: true, fallback_used: fallbackUsed, resolved_id: resolvedId },
      };
    }

    return {
      ok: true,
      user: {
        staffId: resolvedId,
        name: s.name || resolvedId,
        phone: s.phone || id,
        sessionId: newSessionId(),
        loginAtMs: Date.now(),
      },
      meta: { smoke: true, fallback_used: fallbackUsed, resolved_id: resolvedId },
    };
  }

  // Keep old fast-path by doc id, then fallback by phone for valid staff using phone as login input.
  let resolvedId = id;
  let s = null;
  const byIdSnap = await getDoc(doc(db, "staffs", id));
  if (byIdSnap.exists()) {
    s = byIdSnap.data() || {};
  } else {
    const byPhoneSnap = await getDocs(query(collection(db, "staffs"), where("phone", "==", id)));
    if (!byPhoneSnap.empty) {
      const matchDoc = byPhoneSnap.docs[0];
      resolvedId = String(matchDoc.id || "").trim() || id;
      s = matchDoc.data() || {};
    }
  }
  if (!s) return { ok: false, error: "Không tìm thấy nhân viên. Vui lòng kiểm tra lại." };

  const realPass = String(s.loginPassword || "").trim();
  if (!realPass || realPass !== p) return { ok: false, error: "Mật khẩu không đúng." };

  if (s.active === false) return { ok: false, error: "Tài khoản đang tạm nghỉ/khóa." };

  return {
    ok: true,
    user: {
      staffId: resolvedId,
      name: s.name || resolvedId,
      phone: s.phone || id,
      sessionId: newSessionId(),
      loginAtMs: Date.now(),
    }
  };
}

async function verifyPresidentLogin(pass) { //
  const p = String(pass || "").trim();
  if (!p) return { ok: false, error: "Vui lòng nhập mật khẩu Chủ tịch." };
  try {
    const payload = await fetch(`${INTERNAL_POS_API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        loginId: PRESIDENT_EMAIL,
        password: p,
      }),
      credentials: "omit",
    }).then((r) => r.json().catch(() => ({})).then((body) => ({ ok: r.ok, body })));

    if (!payload.ok || payload.body?.success === false) {
      return { ok: false, error: payload.body?.error || "Sai mật khẩu Chủ tịch." };
    }

    return {
      ok: true,
      user: {
        staffId: PRESIDENT_EMAIL,
        name: String(payload.body?.actor?.name || "CHỦ TỊCH"),
        phone: PRESIDENT_EMAIL,
        sessionId: newSessionId(),
        loginAtMs: Date.now(),
        isPresident: true,
        internalPosSessionToken: String(payload.body?.sessionToken || ""),
      }
    };
  } catch {
    return { ok: false, error: "Sai mật khẩu Chủ tịch hoặc không kết nối được backend nội bộ." };
  }
}

function getMonthRangeHCM(ms = Date.now()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit" //
  });
  const parts = fmt
    .formatToParts(new Date(ms))
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const y = Number(parts.year);
  const m = Number(parts.month);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(y, m, 0));
  const end = fmt.format(endDate);
  return { start, end };
}

function normalizePunchEventsWrapper(events) {
  return normalizePunchEvents(events, PUNCH_DUPLICATE_WINDOW_MS);
}
function buildSessionsWrapper(events, endMs) {
  return buildSessions(events, endMs, MIN_VALID_SESSION_MS, MAX_SESSION_MS, PUNCH_DUPLICATE_WINDOW_MS);
}
function buildAttendanceWorkMsWrapper(events, endMs) {
  return buildAttendanceWorkMs(events, endMs, MIN_VALID_SESSION_MS, MAX_SESSION_MS, PUNCH_DUPLICATE_WINDOW_MS);
}

function ensureStaffDetailModal() {
  if (staffDetailOverlayEl) return;
  const style = document.createElement("style");
  style.textContent = `
    #staffDetailOverlay{position:fixed;inset:0;z-index:3500;display:none;background:#000;flex-direction:column;overflow:hidden}
    #staffDetailOverlay.open{display:flex}
    .sd-panel{display:flex;flex-direction:column;height:100%;overflow:hidden}
    .sd-header{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0}
    .sd-back{width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:#fff;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center}
    .sd-link-btn{width:36px;height:36px;border-radius:10px;border:1px solid rgba(251,191,36,0.45);background:rgba(251,191,36,0.12);color:#fbbf24;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center}
    .sd-link-btn:hover{background:rgba(251,191,36,0.22)}
    .sd-month-sel{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:8px;padding:4px 8px;font-size:12px;font-weight:700;outline:none;cursor:pointer}
    .sd-month-sel option{background:#111}
    .sd-hdr-title{font-size:15px;font-weight:900;color:#fff;flex:1;text-transform:uppercase;letter-spacing:.04em;text-align:left}
    .sd-stats-row{display:flex;gap:8px;padding:10px 16px;flex-shrink:0;flex-wrap:wrap}
    .sd-chip{display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);font-size:12px;font-weight:800;color:#fff;cursor:default;white-space:nowrap}
    .sd-chip.clickable{cursor:pointer;transition:background .15s}
    .sd-chip.clickable:hover{background:rgba(34,197,94,0.10)}
    .sd-chip i{font-size:13px}
    .sd-stars-row{display:flex;align-items:center;gap:6px;padding:4px 16px 8px;flex-shrink:0;flex-wrap:wrap}
    .sd-star-pill{display:flex;align-items:center;gap:3px;padding:4px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);font-size:11px;font-weight:700;color:rgba(255,255,255,0.7)}
    .sd-star-pill i{font-size:10px;color:#fbbf24}
    .sd-star-pill .cnt{color:#fff;font-weight:800}
    .sd-star-total-pill{border-color:rgba(251,191,36,0.3);background:rgba(251,191,36,0.08);color:#fbbf24;font-size:12px;font-weight:900}
    .sd-days{flex:1;overflow-y:auto;padding:8px 16px 24px}
    .sd-day-card{margin-bottom:8px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.03);overflow:hidden}
    .sd-day-head{display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:13px;font-weight:800;color:#fff;border-bottom:1px solid rgba(255,255,255,0.05)}
    .sd-day-head i{color:#60a5fa;font-size:12px}
    .sd-day-hours{margin-left:auto;font-size:12px;color:rgba(255,255,255,0.5);font-weight:700}
    .sd-session-row{display:flex;align-items:center;gap:6px;padding:7px 14px;font-size:12px;font-weight:600;color:rgba(255,255,255,0.7)}
    .sd-session-row i{font-size:10px;flex-shrink:0}
    .sd-session-row .tm{color:#fff;font-weight:700;font-variant-numeric:tabular-nums}
    .sd-session-row .arr{color:rgba(255,255,255,0.3);margin:0 2px}
    .sd-session-row.is-break{color:#f59e0b}
    .sd-session-row.is-break i{color:#f59e0b}
    .sd-empty{text-align:center;padding:40px 20px;color:rgba(255,255,255,0.35);font-size:13px}
    .sd-note-row{display:flex;align-items:center;gap:6px;padding:6px 14px 8px}
    .sd-note-input{flex:1;background:rgba(255,255,255,0.06);border:none;border-bottom:1px dashed rgba(255,255,255,0.15);color:#fff;font-size:12px;font-weight:600;padding:6px 8px;outline:none;font-family:inherit;border-radius:6px}
    .sd-note-input:focus{border-bottom-color:rgba(251,191,36,0.5);background:rgba(255,255,255,0.1)}
    .r-name{cursor:pointer}
    #userName{cursor:pointer}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("div");
  overlay.id = "staffDetailOverlay";
  overlay.innerHTML = `
    <div class="sd-panel">
      <div class="sd-header">
        <button class="sd-back" id="sdBack"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="sd-hdr-title" id="sdHdrTitle">Nhân viên</div>
        <button class="sd-link-btn" id="sdScheduleBtn" title="Mở lịch làm việc"><i class="fa-solid fa-calendar-days"></i></button>
        <select class="sd-month-sel" id="sdMonthSel"></select>
      </div>
      <div class="sd-stats-row" id="sdStatsRow"></div>
      <div class="sd-stars-row" id="sdStarsRow"></div>
      <div class="sd-days" id="sdDaysList"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  staffDetailOverlayEl = overlay;
  staffDetailLoadingEl = null;
  staffDetailTitleEl = overlay.querySelector("#sdHdrTitle");
  staffDetailStatsEl = overlay.querySelector("#sdStatsRow");
  staffDetailTimelineEl = overlay.querySelector("#sdDaysList");

  overlay.querySelector("#sdBack")?.addEventListener("click", closeStaffDetailModal);
  overlay.querySelector("#sdScheduleBtn")?.addEventListener("click", () => {
    window.open("./lichlamviec.html", "_blank", "noopener,noreferrer");
  });
}

function closeStaffDetailModal() {
  if (!staffDetailOverlayEl) return;
  staffDetailOverlayEl.classList.remove("open");
  activeDetailStaffId = "";
  publishClientRuntime({ activeDetailStaffId: "", detailOpen: false }).catch(() => {});
}

async function loadStaffDetail(staffId, monthKey = '') {
  const sid = String(staffId || "").trim();
  if (!sid) return null;
  const now = new Date();
  const defaultKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mKey = monthKey || defaultKey;
  let start, end;
  if (mKey.includes('~')) {
    // Custom range: YYYY-MM-DD~YYYY-MM-DD
    [start, end] = mKey.split('~');
  } else {
    const [y, m] = mKey.split('-').map(Number);
    start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastD = new Date(Date.UTC(y, m, 0)).getUTCDate();
    end = `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`;
  }
  const month = { start, end, key: mKey };
  const [staffDocSnap, walletDocSnap, punchesSnap, ratingsSnap, notesSnap] = await Promise.all([
    getDoc(doc(db, "staffs", sid)),
    getDoc(doc(db, "star_wallets", sid)),
    getDocs(
      query(
        collection(db, "staff_punches"),
        where("staffId", "==", sid)
      )
    ),
    getDocs(query(collection(db, "ratings"), where("staffId", "==", sid))),
    getDocs(query(collection(db, "staff_notes"), where("staffId", "==", sid)))
  ]);

  const notesMap = {};
  notesSnap.forEach(d => { const n = d.data(); notesMap[n.day] = n.note; });

  const staff = staffDocSnap.exists() ? staffDocSnap.data() || {} : {};
  const name = String(staff.name || sid);
  const walletXu = Number(walletDocSnap.data()?.balance || 0);
  const monthlyBase = Number(staff.salaryManual || 0);
  const hoursPerDay = Number(staff.hoursPerDay || PAYROLL_HOURS_PER_DAY);
  const hourlyRate = monthlyBase / PAYROLL_DAYS_IN_MONTH / hoursPerDay;

  const punchesByDay = {};
  punchesSnap.forEach((d) => {
    const p = d.data() || {};
    const day = String(p.day || "");
    if (!day) return;
    // Filter theo tháng hiện tại trong JS
    if (day < month.start || day > month.end) return;
    if (!punchesByDay[day]) punchesByDay[day] = [];
    punchesByDay[day].push({
      type: String(p.type || "in"),
      atMs: Number(p.atClient || toMs(p.createdAt) || 0),
      raw: p
    });
  });

  // Generate ALL days from month start to today (HCM)
  const todayHCM = todayKeyHCM();
  const allDays = [];
  {
    // Parse start as plain date parts to avoid timezone shift
    const [sy, sm, sd] = month.start.split('-').map(Number);
    let cur = new Date(Date.UTC(sy, sm - 1, sd));
    while (true) {
      const dk = cur.toISOString().slice(0, 10);
      if (dk > todayHCM) break;
      if (dk > month.end) break;
      allDays.push(dk);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  let totalWorkMs = 0;
  let totalPayableMs = 0;
  const dayPayableCapMs = (Number(staff.hoursPerDay) || PAYROLL_HOURS_PER_DAY) * 3600000;
  const dayBlocks = allDays.map((day) => {
    const hasPunch = !!punchesByDay[day];
    const events = hasPunch ? (punchesByDay[day] || []).sort((a, b) => a.atMs - b.atMs) : [];
    const endMs = getEffectiveDayEndMsHCM(day);
    const workMs = hasPunch ? buildAttendanceWorkMsWrapper(events, endMs) : 0;
    const payableMs = Math.min(dayPayableCapMs, workMs);
    totalWorkMs += workMs;
    totalPayableMs += payableMs;
    const sessions = hasPunch ? buildSessionsWrapper(events, endMs) : [];
    const note = notesMap[day] || '';
    const isOff = !hasPunch || sessions.length === 0;
    return { day, events, sessions, workMs, payableMs, note, isOff };
  }).reverse(); // newest first

  let starCount = 0;
  let ratingCount = 0;
  const starBreakdown = {1:0, 2:0, 3:0, 4:0, 5:0};
  const ratingsList = [];
  ratingsSnap.forEach((d) => {
    const r = d.data() || {};
    const createdMs = toMs(r.createdAt);
    if (!createdMs) return;
    const dk = todayKeyHCM(createdMs);
    if (dk < month.start || dk > month.end) return;
    const stars = Number(r.stars || 0);
    if (stars > 0 && stars <= 5) {
      starCount += stars;
      ratingCount += 1;
      starBreakdown[stars] = (starBreakdown[stars] || 0) + 1;
      ratingsList.push({
        stars,
        customerName: r.customerName || r.name || '',
        customerPhone: r.customerPhone || r.phone || '',
        comment: r.comment || r.review || r.feedback || '',
        createdAt: createdMs,
        day: dk,
        isFraud: !!r.isFraud,
        fraudCount: r.fraudCount || 0,
        deviceId: r.deviceId || ''
      });
    }
  });

  const workHours = totalWorkMs / 3600000;
  const payableHours = totalPayableMs / 3600000;
  const totalSalary = payableHours * hourlyRate + walletXu * XU_VALUE_VND;
  return {
    sid,
    name,
    walletXu,
    starCount,
    ratingCount,
    starBreakdown,
    ratingsList,
    monthlyBase,
    hoursPerDay,
    workHours,
    payableHours,
    totalSalary,
    dayBlocks
  };
}

function renderDayCards(dayBlocks = [], staffId = '', isPres = false) {
  if (!dayBlocks.length) {
    return `<div class="sd-empty">Chưa có dữ liệu tháng này.</div>`;
  }
  return dayBlocks.map((b) => {
    const parts = b.day.split('-');
    const dayFmt = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : b.day;

    if (b.isOff) {
      const noteVal = (b.note || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return `
        <div class="sd-day-card">
          <div class="sd-day-head">
            <i class="fa-solid fa-calendar-xmark" style="color:rgba(255,255,255,0.35)"></i> ${dayFmt}
            <span class="sd-day-hours" style="color:rgba(255,255,255,0.35)">OFF</span>
          </div>
          <div class="sd-note-row">
            <i class="fa-solid fa-pencil" style="color:rgba(255,255,255,0.3);font-size:10px"></i>
            <input class="sd-note-input" data-day="${b.day}" data-sid="${staffId}"
              value="${noteVal}" placeholder="Ghi chú..." />
          </div>
        </div>
      `;
    }

    const sessions = b.sessions || [];
    const dayTotal = `${(b.workMs / 3600000).toFixed(1)}h`;
    const rows = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const startT = fmtTimeHCM(s.start);
      const endT = fmtTimeHCM(s.end);
      const openTag = s.open ? ' <span style="color:#60a5fa;font-size:10px">● đang làm</span>' : '';
      rows.push(`<div class="sd-session-row"><i class="fa-solid fa-briefcase" style="color:#10b981"></i> <span class="tm">${startT}</span><span class="arr">↔</span><span class="tm">${endT}</span>${openTag}</div>`);
      if (i < sessions.length - 1) {
        const breakStart = s.end;
        const breakEnd = sessions[i + 1].start;
        const breakMs = breakEnd - breakStart;
        if (breakMs > 0) {
          const breakMin = Math.round(breakMs / 60000);
          const bLabel = breakMin >= 60 ? `${(breakMin/60).toFixed(1)}h` : `${breakMin} Phút`;
          rows.push(`<div class="sd-session-row is-break"><i class="fa-solid fa-person-walking"></i> Ra ngoài ${bLabel} <span class="tm">${fmtTimeHCM(breakStart)}</span><span class="arr">↔</span><span class="tm">${fmtTimeHCM(breakEnd)}</span></div>`);
        }
      }
    }
    return `
      <div class="sd-day-card">
        <div class="sd-day-head">
          <i class="fa-solid fa-calendar-day"></i> ${dayFmt}
          <span class="sd-day-hours">${dayTotal}</span>
        </div>
        ${rows.join('')}
      </div>
    `;
  }).join('');
}

let _sdCurrentStaffId = '';

async function openStaffDetailModal(staffId, fallbackName = "", monthKey = '') {
  if (!currentUser) return;
  // Nhân viên chỉ xem được của mình, chủ tịch xem được tất cả
  if (!currentUser.isPresident && String(staffId) !== String(currentUser.staffId)) return;
  activeDetailStaffId = String(staffId || "").trim();
  _sdCurrentStaffId = activeDetailStaffId;

  ensureStaffDetailModal();
  if (!staffDetailOverlayEl) return;
  staffDetailOverlayEl.classList.add("open");
  if (staffDetailTitleEl) {
    staffDetailTitleEl.textContent = fallbackName || 'Nhân viên';
  }

  // Populate month selector
  const mSel = staffDetailOverlayEl.querySelector('#sdMonthSel');
  if (mSel) {
    const now = new Date();
    mSel.innerHTML = '';
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    [
      {k: nowKey, t: 'Tháng này'},
      {k: prevKey, t: 'Tháng trước'},
      {k: 'custom', t: 'Tuỳ chọn'}
    ].forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.k;
      opt.textContent = o.t;
      if (monthKey && monthKey.includes('~')) {
        if (o.k === 'custom') opt.selected = true;
      } else {
        if (o.k === (monthKey || nowKey)) opt.selected = true;
      }
      mSel.appendChild(opt);
    });
    mSel.onchange = () => {
      if (mSel.value === 'custom') {
        openDateRangeModal(staffId, fallbackName);
      } else {
        openStaffDetailModal(staffId, fallbackName, mSel.value);
      }
    };
  }

  if (staffDetailStatsEl) staffDetailStatsEl.innerHTML = '<div class="sd-chip"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';
  const starsRow = staffDetailOverlayEl.querySelector('#sdStarsRow');
  if (starsRow) starsRow.innerHTML = '';
  if (staffDetailTimelineEl) staffDetailTimelineEl.innerHTML = '';

  try {
    const data = await loadStaffDetail(staffId, monthKey);
    if (!data) throw new Error('NOT_FOUND');
    if (staffDetailTitleEl) staffDetailTitleEl.textContent = data.name;

    // Stats chips
    if (staffDetailStatsEl) {
      const hpd = data.hoursPerDay || PAYROLL_HOURS_PER_DAY;
      const hourlyRate = data.monthlyBase / 30 / hpd;
      const netSalary = data.payableHours * hourlyRate + data.walletXu * XU_VALUE_VND;

      const isPres = currentUser?.isPresident;
      staffDetailStatsEl.innerHTML = `
        <div class="sd-chip ${isPres ? 'clickable' : ''}" id="sdSalaryChip" title="${isPres ? 'Bấm để sửa lương' : ''}">
          <i class="fa-solid fa-money-bill-wave" style="color:#22c55e"></i> ${fmtDot(data.monthlyBase)}đ
        </div>
        <div class="sd-chip">
          <i class="fa-solid fa-clock" style="color:#60a5fa"></i> ${data.workHours.toFixed(1)}h
        </div>
        <div class="sd-chip" style="background:rgba(251,191,36,0.1)">
          <i class="fa-solid fa-hand-holding-dollar" style="color:#fbbf24"></i> ${fmtDot(Math.round(netSalary))}đ
        </div>
        ${isPres ? `
          <div class="sd-chip clickable" id="sdSettleBtn" style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:8px 10px" title="Quyết toán lương">
            <i class="fa-solid fa-file-invoice-dollar"></i>
          </div>
        ` : ''}
      `;
      // Handlers
      if (isPres) {
        staffDetailStatsEl.querySelector('#sdSalaryChip')?.addEventListener('click', () => {
          openSalaryModal(_sdCurrentStaffId, data.monthlyBase, hpd);
        });
        staffDetailStatsEl.querySelector('#sdSettleBtn')?.addEventListener('click', () => {
          openSettleModal(data);
        });
      }
    }

    // Star breakdown row
    if (starsRow) {
      const bd = data.starBreakdown || {};
      starsRow.innerHTML = `
        <div class="sd-star-pill sd-star-total-pill" title="Tổng sao">
          <i class="fa-solid fa-star"></i> ${data.starCount} <span style="opacity:.6;font-size:10px">(${data.ratingCount})</span>
        </div>
        ${[5,4,3,2,1].map(s => `
          <div class="sd-star-pill clickable" data-star="${s}" style="cursor:pointer">${s}<i class="fa-solid fa-star"></i> <span class="cnt">${bd[s]||0}</span></div>
        `).join('')}
      `;
      // Click star pill → open ratings list modal
      starsRow.querySelectorAll('.sd-star-pill[data-star]').forEach(pill => {
        pill.addEventListener('click', () => {
          const starVal = Number(pill.dataset.star);
          const filtered = (data.ratingsList || []).filter(r => r.stars === starVal);
          openRatingsListModal(starVal, filtered);
        });
      });
    }

    // Day cards
    if (staffDetailTimelineEl) {
      const isPres = !!currentUser?.isPresident;
      staffDetailTimelineEl.innerHTML = renderDayCards(data.dayBlocks, data.sid, isPres);
      // Note blur → auto-save (cả nhân viên lẫn chủ tịch đều ghi được)
      staffDetailTimelineEl.querySelectorAll('.sd-note-input').forEach(inp => {
        inp.addEventListener('focus', function() {
          this.style.borderBottomColor = 'rgba(251,191,36,0.5)';
        });
        inp.addEventListener('blur', async function() {
          this.style.borderBottomColor = 'rgba(255,255,255,0.15)';
          const day = this.dataset.day;
          const sid = this.dataset.sid;
          const note = this.value.trim();
          if (!day || !sid) return;
          const noteDocId = `${sid}_${day}`;
          try {
            await setDoc(doc(db, 'staff_notes', noteDocId), {
              staffId: sid, day, note, updatedAt: serverTimestamp()
            }, { merge: true });
            showToast('✅ Đã lưu ghi chú');
          } catch(e3) {
            console.error('Note save error:', e3);
            showToast('❌ Lỗi lưu: ' + e3.message);
          }
        });
      });
    }
  } catch (e) {
    console.error('Staff detail error:', e);
    if (staffDetailStatsEl) staffDetailStatsEl.innerHTML = '';
    if (staffDetailTimelineEl) {
      staffDetailTimelineEl.innerHTML = `<div class="sd-empty">Không tải được dữ liệu chi tiết. ${e.message||''}</div>`;
    }
  }
}

// === Date Range Modal ===
let _drStaffId = '';
let _drFallbackName = '';

// === Ratings List Modal ===
function openRatingsListModal(starVal, ratings) {
  const overlay = getEl('ratingsListOverlay');
  const title = getEl('rlTitle');
  const body = getEl('rlBody');
  if (!overlay || !body) return;
  if (title) title.innerHTML = `<i class="fa-solid fa-star" style="color:#fbbf24"></i> ${starVal} sao (${ratings.length})`;
  if (!ratings.length) {
    body.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.4);font-size:13px">Không có đánh giá nào</div>';
  } else {
    body.innerHTML = ratings.sort((a,b) => b.createdAt - a.createdAt).map(r => {
      const dayParts = r.day.split('-');
      const dayFmt = dayParts.length === 3 ? `${dayParts[2]}-${dayParts[1]}-${dayParts[0]}` : r.day;
      const timeFmt = fmtTimeHCM(r.createdAt);
      const stars = '⭐'.repeat(r.stars);
      const phone = r.customerPhone ? `<span style="font-size:11px;color:rgba(255,255,255,0.4);margin-left:6px">${r.customerPhone}</span>` : '';
      const comment = r.comment ? `<span style="font-size:12px;color:rgba(255,255,255,0.6);font-style:italic">"​${r.comment}"</span>` : '';
      const fraud = r.isFraud ? `<span style="font-size:11px;color:#ef4444;font-weight:700;margin-left:auto">⚠️ Gian lận (lần ${r.fraudCount})</span>` : '';
      return `
        <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)${r.isFraud ? ';background:rgba(239,68,68,0.05)' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="display:flex;align-items:center;flex-wrap:wrap">
              <span style="font-size:13px;font-weight:800;color:#fff">${r.customerName || 'Khách hàng'}</span>
              ${phone}
            </div>
            <div style="text-align:right;white-space:nowrap">
              <div style="font-size:11px">${stars}</div>
              <div style="font-size:10px;color:rgba(255,255,255,0.3)">${dayFmt} ${timeFmt}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            ${comment}
            ${fraud}
          </div>
        </div>
      `;
    }).join('');
  }
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}
function closeRatingsListModal() {
  const overlay = getEl('ratingsListOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}
getEl('rlClose')?.addEventListener('click', closeRatingsListModal);
getEl('ratingsListOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'ratingsListOverlay') closeRatingsListModal();
});
function _fmtDateDMY(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}-${m}-${y}`;
}
function openDateRangeModal(staffId, fallbackName) {
  _drStaffId = staffId;
  _drFallbackName = fallbackName;
  const overlay = getEl('dateRangeOverlay');
  if (!overlay) return;
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const firstISO = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const fromInp = getEl('drFrom');
  const toInp = getEl('drTo');
  const fromReal = getEl('drFromReal');
  const toReal = getEl('drToReal');
  if (fromReal) fromReal.value = firstISO;
  if (toReal) toReal.value = todayISO;
  if (fromInp) { fromInp.value = _fmtDateDMY(firstISO); fromInp._iso = firstISO; }
  if (toInp) { toInp.value = _fmtDateDMY(todayISO); toInp._iso = todayISO; }
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}
function closeDateRangeModal() {
  const overlay = getEl('dateRangeOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}
getEl('drClose')?.addEventListener('click', closeDateRangeModal);
getEl('dateRangeOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'dateRangeOverlay') closeDateRangeModal();
});
// Tap text input → open hidden date picker
getEl('drFrom')?.addEventListener('click', () => {
  const real = getEl('drFromReal');
  if (real) { real.showPicker?.(); real.focus(); real.click(); }
});
getEl('drTo')?.addEventListener('click', () => {
  const real = getEl('drToReal');
  if (real) { real.showPicker?.(); real.focus(); real.click(); }
});
// Sync real → display
getEl('drFromReal')?.addEventListener('change', function() {
  const disp = getEl('drFrom');
  if (disp) { disp.value = _fmtDateDMY(this.value); disp._iso = this.value; }
});
getEl('drToReal')?.addEventListener('change', function() {
  const disp = getEl('drTo');
  if (disp) { disp.value = _fmtDateDMY(this.value); disp._iso = this.value; }
});
getEl('drSubmit')?.addEventListener('click', () => {
  const fromInp = getEl('drFrom');
  const toInp = getEl('drTo');
  const from = fromInp?._iso || '';
  const to = toInp?._iso || '';
  if (!from || !to) { showToast('Vui lòng chọn đủ ngày!'); return; }
  if (from > to) { showToast('Ngày bắt đầu phải trước ngày kết thúc!'); return; }
  closeDateRangeModal();
  openStaffDetailModal(_drStaffId, _drFallbackName, `${from}~${to}`);
});

// === Salary Modal ===
function fmtDot(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function parseDot(s) {
  return Number(String(s||'').replace(/\./g, '').replace(/[^0-9]/g, ''));
}

function openSalaryModal(staffId, currentSalary, currentHpd) {
  const overlay = getEl('salaryOverlay');
  if (!overlay) return;
  const inp = getEl('salInput');
  const hInp = getEl('salHoursInput');
  const err = getEl('salErr');
  const btn = getEl('salSubmit');
  if (inp) inp.value = currentSalary ? fmtDot(currentSalary) : '';
  if (hInp) hInp.value = currentHpd ? String(currentHpd) : '';
  if (err) { err.classList.remove('show'); err.textContent = ''; }
  if (btn) btn.disabled = false;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  overlay._staffId = staffId;
  setTimeout(() => inp?.focus(), 200);
}
function closeSalaryModal() {
  const overlay = getEl('salaryOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}
// Format dấu chấm khi gõ
getEl('salInput')?.addEventListener('input', function() {
  const raw = this.value.replace(/\./g, '').replace(/[^0-9]/g, '');
  this.value = raw ? fmtDot(Number(raw)) : '';
});
getEl('salClose')?.addEventListener('click', closeSalaryModal);
getEl('salaryOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'salaryOverlay') closeSalaryModal();
});
getEl('salSubmit')?.addEventListener('click', async () => {
  const overlay = getEl('salaryOverlay');
  const inp = getEl('salInput');
  const hInp = getEl('salHoursInput');
  const err = getEl('salErr');
  const btn = getEl('salSubmit');
  const staffId = overlay?._staffId;
  const val = parseDot(inp?.value);
  const hpd = Number(hInp?.value || 0);
  if (err) { err.classList.remove('show'); err.textContent = ''; }
  if (!staffId) return;
  if (isNaN(val) || val < 0) {
    if (err) { err.textContent = 'Vui lòng nhập lương hợp lệ'; err.classList.add('show'); }
    return;
  }
  if (isNaN(hpd) || hpd <= 0 || hpd > 24) {
    if (err) { err.textContent = 'Giờ làm/ngày phải từ 1-24'; err.classList.add('show'); }
    return;
  }
  if (btn) btn.disabled = true;
  try {
    await callInternalPosApi(`/staffs/${encodeURIComponent(staffId)}`, {
      method: 'PATCH',
      body: { salaryManual: val, hoursPerDay: hpd },
    });
    showToast('✅ Đã lưu cài đặt lương!');
    closeSalaryModal();
    if (_sdCurrentStaffId === staffId) openStaffDetailModal(staffId);
  } catch(e2) {
    if (err) { err.textContent = '❌ Lỗi: ' + e2.message; err.classList.add('show'); }
  } finally { if (btn) btn.disabled = false; }
});

// === Settle Modal ===
let _settleData = null;
function openSettleModal(data) {
  _settleData = data;
  const overlay = getEl('settleOverlay');
  const body = getEl('settleBody');
  if (!overlay || !body) return;
  const hpd = data.hoursPerDay || PAYROLL_HOURS_PER_DAY;
  const hourlyRate = data.monthlyBase / 30 / hpd;
  const netSalary = data.payableHours * hourlyRate;
  body.innerHTML = `
    <div class="settle-row"><span class="s-label">Nhân viên</span><span class="s-val">${data.name}</span></div>
    <div class="settle-row"><span class="s-label">Lương cơ bản</span><span class="s-val">${fmtDot(data.monthlyBase)}đ</span></div>
    <div class="settle-row"><span class="s-label">Giờ làm/ngày</span><span class="s-val">${hpd}h</span></div>
    <div class="settle-row"><span class="s-label">Lương/giờ</span><span class="s-val">${fmtDot(Math.round(hourlyRate))}đ</span></div>
    <div class="settle-row"><span class="s-label">Tổng giờ làm</span><span class="s-val">${data.workHours.toFixed(1)}h</span></div>
    <div class="settle-row"><span class="s-label">Giờ tính lương</span><span class="s-val">${data.payableHours.toFixed(1)}h</span></div>
    <div class="settle-row"><span class="s-label">Ví xu</span><span class="s-val">${fmtBalance(data.walletXu)} xu (${fmtDot(data.walletXu * XU_VALUE_VND)}đ)</span></div>
    <div class="settle-row total"><span class="s-label">LƯƠNG THỰC NHẬN</span><span class="s-val">${fmtDot(Math.round(netSalary + data.walletXu * XU_VALUE_VND))}đ</span></div>
  `;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
}
function closeSettleModal() {
  const overlay = getEl('settleOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  _settleData = null;
}
getEl('settleClose')?.addEventListener('click', closeSettleModal);
getEl('settleCancel')?.addEventListener('click', closeSettleModal);
getEl('settleOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'settleOverlay') closeSettleModal();
});
getEl('settleConfirm')?.addEventListener('click', async () => {
  if (!_settleData) return;
  const btn = getEl('settleConfirm');
  if (btn) btn.disabled = true;
  const data = _settleData;
  const hpd = data.hoursPerDay || PAYROLL_HOURS_PER_DAY;
  const hourlyRate = data.monthlyBase / 30 / hpd;
  try {
    const payload = await callInternalPosApi('/star/settlements', {
      method: 'POST',
      body: {
        staffId: data.sid,
        staffName: data.name,
        monthlyBase: data.monthlyBase,
        hoursPerDay: hpd,
        workHours: data.workHours,
        payableHours: data.payableHours,
        walletXu: data.walletXu,
        netSalary: Math.round(data.payableHours * hourlyRate + data.walletXu * XU_VALUE_VND),
      },
    });

    showToast(`✅ Quyết toán xong (${payload.deletedPunches || 0} công, ${payload.deletedRatings || 0} đánh giá).`);
    closeSettleModal();
    if (_sdCurrentStaffId === data.sid) openStaffDetailModal(data.sid);
  } catch(e) {
    console.error('Settle error:', e);
    showToast('❌ Lỗi quyết toán: ' + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
});

async function writeAutoShiftPunchIfNeeded(staffId, type, source = "") {
  const sid = String(staffId || "").trim();
  if (!sid) return;

  const day = todayKeyHCM();
  const nowMs = Date.now();
  const snap = await getDocs(
    query(
      collection(db, "staff_punches"),
      where("staffId", "==", sid),
      where("day", "==", day)
    )
  );
  const todayPunches = [];
  snap.forEach((d) => {
    const p = d.data() || {};
    todayPunches.push({
      type: String(p.type || "").toLowerCase(),
      atMs: Number(p.atClient || toMs(p.createdAt) || 0)
    });
  }); //
  const normalized = normalizePunchEvents(todayPunches);
  const last = normalized[normalized.length - 1] || null;
  const lastType = String(last?.type || "");
  const lastAtMs = Number(last?.atMs || 0);
  const targetType = String(type || "").toLowerCase();
  if (targetType !== "in" && targetType !== "out") return;

  if (targetType === "in" && lastType && lastType !== "out") return;
  if (targetType === "out" && lastType !== "in") return;
  if (lastAtMs && nowMs - lastAtMs < PUNCH_DUPLICATE_WINDOW_MS) return;

  await setDoc(doc(collection(db, "staff_punches")), {
    staffId: sid,
    day,
    type: targetType,
    atClient: nowMs,
    source: String(source || "index_auto"),
    sessionId: String(currentUser?.sessionId || ""),
    createdAt: serverTimestamp()
  });
}

async function recordAutoShiftPunchOnLogin(staffId) {
  const sid = String(staffId || "").trim();
  if (!sid) return;
  if (!getShiftWindowStatusHCM().within) return;
  await writeAutoShiftPunchIfNeeded(sid, "in", "index_login");
}

async function recordAutoShiftPunchOnLogout(staffId) {
  const sid = String(staffId || "").trim();
  if (!sid) return;
  await writeAutoShiftPunchIfNeeded(sid, "out", "index_logout");
}

function todayKeyHCMWrapper(ms = Date.now()) {
  return todayKeyHCM(ms);
}
function fmtTimeHCMWrapper(ms) {
  return fmtTimeHCM(ms);
}

function ensurePillMeasureEl() {
  if (pillMeasureEl) return pillMeasureEl;
  const el = document.createElement("span");
  el.className = "bar-xu";
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.top = "-9999px";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.innerHTML = `<span class="num"></span><span class="loc-signal is-black"><i class="fa-solid fa-star"></i></span>`;
  document.body.appendChild(el);
  pillMeasureEl = el;
  return el;
}

function measurePillWidth(text) {
  const el = ensurePillMeasureEl();
  const num = el.querySelector(".num");
  if (num) num.textContent = text;
  return el.getBoundingClientRect().width || el.offsetWidth || 0;
} //

function updateValuePadCssVar(rows) {
  const maxText = (rows || []).reduce((best, r) => {
    const t = fmtBalance(r?.balance || 0);
    return t.length > best.length ? t : best;
  }, "0");

  const w = measurePillWidth(maxText);
  // Reserve name area so it never collides with the pill on the right.
  const px = Math.max(80, w + 18);
  lastValuePadPx = Math.ceil(px);
  listEl.style.setProperty("--value-pad", `${lastValuePadPx}px`);
}

function calcMinPctFromLongestName(valuePadPx) {
  // Đo tên dài nhất trong DOM, tính % tối thiểu để bar phủ hết tên
  const listEl = getEl('rankList');
  if (!listEl) return 30;
  const names = Array.from(listEl.querySelectorAll('.r-name'));
  if (!names.length) return 30;
  const containerW = listEl.getBoundingClientRect().width || 300;
  let maxNamePx = 0;
  names.forEach(el => {
    const w = el.scrollWidth || el.offsetWidth || 0;
    if (w > maxNamePx) maxNamePx = w;
  });
  // Min bar width = name width + padding 30px + pill area
  const minPx = maxNamePx + 300 + (valuePadPx || 120);
  const pct = Math.min(50, Math.ceil((minPx / containerW) * 100));
  return Math.max(20, pct);
}

function render(data) {
  if (!listEl) return;
  if (!Array.isArray(data) || data.length === 0) {
    listEl.innerHTML = `
      <div style="height:100%;display:grid;place-items:center;padding:20px;text-align:center;color:rgba(255,255,255,.78)">
        <div>
          <div style="font-size:14px;font-weight:900;letter-spacing:.04em;text-transform:uppercase">Chưa có dữ liệu bảng vàng</div>
          <div style="margin-top:8px;font-size:12px;line-height:1.5;color:rgba(255,255,255,.58)">Kéo reload hoặc đăng nhập lại để tải danh sách nhân viên.</div>
        </div>
      </div>
    `;
    return;
  }

  // Sắp xếp giảm dần
  data.sort((a, b) => (b.balance || 0) - (a.balance || 0));
  
  const maxAbs = Math.max(1, ...data.map(x => Math.abs(x.balance || 0)));

  // Set reserve space before rendering names, so truncation is consistent.
  updateValuePadCssVar(data);

  listEl.innerHTML = data.map((x, idx) => {
    const bal = x.balance || 0;
    const abs = Math.abs(bal);
    const textBal = fmtBalance(bal);
    const locState = String(x.locState || "black");
    const locPulse = !!x.locPulse;
    const locTitle = String(x.locTitle || "");
    const locCls =
      locState === "green"
        ? "is-green"
        : locState === "red"
          ? "is-red"
          : "is-black";
    const wrapCls =
      idx === 0 ? "is-top1" : idx === 1 ? "is-top2" : idx === 2 ? "is-top3" : "";
    const pillHtml = `<span class="bar-xu is-hidden"><span class="num">${textBal}⭐</span><span class="loc-signal ${locCls} ${locPulse ? "is-pulse" : ""}" title="${locTitle}"><i class="fa-solid fa-star"></i></span></span>`;
    return `
      <div class="bar-wrap ${wrapCls}" data-abs="${abs}" data-neg="${bal < 0 ? "1" : "0"}">
        <div class="bar ${bal < 0 ? 'negative' : ''}" style="width:0%">${pillHtml}</div>
        <div class="bar-content">
          <span class="r-name" data-staff-id="${x.id || ""}" data-staff-name="${(x.name || "N/A").replace(/"/g, "&quot;")}">${x.name || 'N/A'}</span>
        </div>
      </div>
    `;
  }).join("");

  // Sau khi DOM đã có text name, đo tên dài nhất rồi scale width bar.
  requestAnimationFrame(() => {
    const minPct = calcMinPctFromLongestName(lastValuePadPx);
    const bars = Array.from(listEl.querySelectorAll(".bar-wrap"));
    for (const w of bars) {
      const abs = Number(w.getAttribute("data-abs") || 0);
      const pctExtra = (abs / maxAbs) * Math.max(0, 100 - minPct);
      const pct = Math.min(100, minPct + pctExtra);

      const bar = w.querySelector(".bar");
      if (bar) bar.style.width = `${pct}%`;

      const label = w.querySelector(".bar-xu");
      if (label) label.classList.toggle("is-hidden", pct < 10);
    }
  });
}

async function publishIndexUiSnapshot(rows = []) {
  try {
    if (!currentUser?.staffId) return;
    const normalizedRows = (rows || []).map((r, idx) => ({
      rank: idx + 1,
      staffId: String(r?.id || ""),
      name: String(r?.name || r?.id || ""),
      balance: Number(r?.balance || 0),
      locState: String(r?.locState || "black"),
      locTitle: String(r?.locTitle || ""),
      worktimeState: String(r?.worktimeState || "unknown"),
    }));
    const payload = {
      source: "index",
      dayKey: todayKeyHCM(),
      viewerStaffId: String(currentUser.staffId || ""),
      viewerName: String(currentUser.name || currentUser.staffId || ""),
      totalStaff: normalizedRows.length,
      rankRows: normalizedRows.slice(0, 80),
    };
    const sig = JSON.stringify(payload);
    const nowMs = Date.now();
    if (sig === lastUiSnapshotSig && nowMs - lastUiSnapshotAtMs < UI_SNAPSHOT_MIN_INTERVAL_MS) {
      return;
    }
    lastUiSnapshotSig = sig;
    lastUiSnapshotAtMs = nowMs;
    await setDoc(
      doc(db, UI_SNAPSHOT_COLL, UI_SNAPSHOT_DOC_INDEX),
      {
        ...payload,
        updatedAtMs: nowMs,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("publishIndexUiSnapshot failed:", e);
  }
}

async function publishClientRuntime(extra = {}) {
  try {
    if (!currentUser?.staffId) return;
    const nowMs = Date.now();
    const topRows = Array.isArray(lastRows)
      ? lastRows.slice(0, 12).map((r) => ({
          staffId: String(r?.id || ""),
          name: String(r?.name || ""),
          balance: Number(r?.balance || 0),
          locState: String(r?.locState || "black"),
          worktimeState: String(r?.worktimeState || "unknown"),
        }))
      : [];
    await setDoc(
      doc(db, UI_RUNTIME_COLL, String(currentUser.staffId)),
      {
        staffId: String(currentUser.staffId || ""),
        staffName: String(currentUser.name || currentUser.staffId || ""),
        sessionId: String(currentUser.sessionId || ""),
        page: "index",
        online: true,
        dayKey: todayKeyHCM(),
        activeDetailStaffId: String(activeDetailStaffId || ""),
        detailOpen: !!activeDetailStaffId,
        topRows,
        updatedAtMs: nowMs,
        updatedAt: serverTimestamp(),
        ...extra,
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("publishClientRuntime failed:", e);
  }
}

function buildCustomerRatingUrl(staffId) {
  const u = new URL("./khachhang.html", window.location.href);
  u.searchParams.set("staff", String(staffId || "").trim());
  // Bỏ session — QR tĩnh
  return u.toString();
}

function setQrTitle(staffName) {
  if (!qrTitleEl) return;
  const name = String(staffName || "").trim();
  qrTitleEl.textContent = name ? `Đánh giá cho nhân viên ${name} !` : `Đánh giá cho nhân viên`;
}

function escapeHtmlAttr(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getQrStaffOptionsFromChart() {
  const rows = Array.isArray(lastRows) ? lastRows : [];
  const options = [];
  const seen = new Set();
  for (const r of rows) {
    const sid = String(r?.id || "").trim();
    if (!sid || sid === PRESIDENT_EMAIL || seen.has(sid)) continue;
    seen.add(sid);
    options.push({
      id: sid,
      name: String(r?.name || sid).trim() || sid
    });
  }
  return options;
}

function getVisibleRowsForCurrentUser(rows = []) {
  if (!currentUser?.isPresident) return rows;
  if (presidentVisibleStaffIds === null) return rows;
  const out = [];
  for (const r of rows) {
    const sid = String(r?.id || "").trim();
    if (!sid) continue;
    if (presidentVisibleStaffIds.has(sid)) out.push(r);
  }
  return out;
}

function normalizePresidentSelection(setVal) {
  const allIds = getQrStaffOptionsFromChart().map((x) => x.id);
  if (!allIds.length) return null;
  if (!(setVal instanceof Set)) return null;
  const normalized = new Set();
  for (const id of setVal) {
    const sid = String(id || "").trim();
    if (!sid) continue;
    if (allIds.includes(sid)) normalized.add(sid);
  }
  if (normalized.size >= allIds.length) return null;
  return normalized;
}

function commitPresidentDraftSelection() {
  presidentVisibleStaffIds = normalizePresidentSelection(presidentDraftVisibleStaffIds);
  savePresidentVisibleStaffSelection();
  rerenderFromLastRows();
}

function renderStaffFilterOptions() {
  if (!staffFilterListEl) return;
  const options = getQrStaffOptionsFromChart();
  if (!options.length) {
    staffFilterListEl.innerHTML = `<div class="sf-empty">Chưa có nhân viên để chọn.</div>`;
    return;
  }
  const html = options
    .map((x) => {
      const checked =
        presidentDraftVisibleStaffIds === null || presidentDraftVisibleStaffIds.has(x.id);
      return `
        <label class="sf-row">
          <input type="checkbox" data-sid="${escapeHtmlAttr(x.id)}" ${checked ? "checked" : ""} />
          <span>${escapeHtmlAttr(x.name)}</span>
        </label>
      `;
    })
    .join("");
  staffFilterListEl.innerHTML = html;
}

function openStaffFilterOverlay() {
  if (!currentUser?.isPresident || !staffFilterOverlay) return;
  presidentDraftVisibleStaffIds = cloneIdSet(presidentVisibleStaffIds);
  renderStaffFilterOptions();
  staffFilterOverlay.classList.add("open");
  staffFilterOverlay.setAttribute("aria-hidden", "false");
}

function closeStaffFilterOverlay() {
  if (!staffFilterOverlay) return;
  staffFilterOverlay.classList.remove("open");
  staffFilterOverlay.setAttribute("aria-hidden", "true");
  presidentDraftVisibleStaffIds = null;
}

function rerenderFromLastRows() {
  if (!Array.isArray(lastRows)) return;
  const rows = getVisibleRowsForCurrentUser([...lastRows]);
  render(rows);
  publishIndexUiSnapshot(rows);
}

function renderQrForStaff(staffId) {
  if (!qrCodeEl || !qrLinkEl) return;
  const url = buildCustomerRatingUrl(staffId);

  qrCodeEl.innerHTML = "";
  qrInstance = null;

  // QRCode is global (qrcodejs)
  /* global QRCode */
  if (typeof QRCode === "function") {
    const vw = Math.max(320, window.innerWidth || 0);
    const vh = Math.max(480, window.innerHeight || 0);
    const size = Math.max(160, Math.min(240, Math.floor(Math.min(vw, vh) * 0.45)));

    qrInstance = new QRCode(qrCodeEl, {
      text: url,
      width: size,
      height: size,
      correctLevel: QRCode.CorrectLevel ? QRCode.CorrectLevel.M : undefined
    });
  } else {
    qrCodeEl.textContent = "Thiếu thư viện QRCode.";
  }

  qrLinkEl.textContent = url;
}

function fmtMMSS(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function startQrCountdown(deadlineMs) {
  qrDeadlineMs = Number(deadlineMs || 0) || 0;
  if (!qrCountdownEl || !qrDeadlineMs) return;

  qrCountdownEl.classList.remove("hidden");

  const tick = () => {
    const left = qrDeadlineMs - Date.now();
    qrCountdownEl.textContent = fmtMMSS(left);
  };

  tick();
  if (qrCountdownTimerId) clearInterval(qrCountdownTimerId);
  qrCountdownTimerId = setInterval(tick, 250);
}

async function startQrSessionForStaff(staffId, staffName) {
  const sid = newSessionId();
  activeQrSessionId = sid;

  // Create a QR session doc — vĩnh viễn (không expire)
  const ref = doc(db, "qr_sessions", sid);
  await setDoc(
    ref,
    {
      staffId: String(staffId || ""),
      staffName: String(staffName || ""),
      status: "open",
      expiresAtMs: 0,
      createdAt: serverTimestamp(),
      createdByStaffId: String(currentUser?.staffId || ""),
      createdBySessionId: String(currentUser?.sessionId || "")
    },
    { merge: true }
  );

  // Close QR overlay automatically when customer completes rating.
  if (qrSessionUnsub) {
    qrSessionUnsub();
    qrSessionUnsub = null;
  }
  if (qrExpireTimerId) {
    clearTimeout(qrExpireTimerId);
    qrExpireTimerId = null;
  }

  qrSessionUnsub = onSnapshot(ref, (snap) => {
    const d = snap.exists() ? snap.data() || {} : {};
    const status = String(d.status || "");
    // Không start countdown vì QR vĩnh viễn
    if (status === "scanned" || status === "done") {
      closeQrOverlay();
    }
  });

  // Không auto-expire — QR sống đến khi khách quét xong
  // Ẩn countdown
  if (qrCountdownEl) qrCountdownEl.classList.add('hidden');

  setQrTitle(staffName);
  renderQrForStaff(staffId);
}

function openQrOverlay() {
  if (!currentUser) {
    openLoginOverlay();
    return;
  }
  if (!qrOverlay) return;
  qrOverlay.classList.add("open");
  qrOverlay.setAttribute("aria-hidden", "false");

  if (!qrStaffSelect) return;

  const isPresident = !!currentUser?.isPresident;
  const options = isPresident
    ? getQrStaffOptionsFromChart()
    : [{
        id: String(currentUser?.staffId || "").trim(),
        name: String(currentUser?.name || currentUser?.staffId || "Nhân viên").trim() || "Nhân viên"
      }].filter((item) => item.id);

  if (qrRowSelect) qrRowSelect.classList.toggle("hidden", !isPresident);
  if (qrLinkEl) qrLinkEl.classList.toggle("hidden", !isPresident);

  if (!options.length) {
    qrStaffSelect.innerHTML = ``;
    if (qrCodeEl) qrCodeEl.textContent = "Chưa có nhân viên để tạo QR.";
    if (qrLinkEl) qrLinkEl.textContent = "";
    setQrTitle("");
    return;
  }

  const currentValue = String(qrStaffSelect.value || "").trim();
  qrStaffSelect.innerHTML = options
    .map((item) => `<option value="${escapeHtmlAttr(item.id)}">${escapeHtmlAttr(item.name)}</option>`)
    .join("");

  const selected = options.find((item) => item.id === currentValue) || options[0];
  qrStaffSelect.value = selected.id;
  setQrTitle(selected.name);
  renderQrForStaff(selected.id);
}

function closeQrOverlay() {
  if (!qrOverlay) return;
  qrOverlay.classList.remove("open");
  qrOverlay.setAttribute("aria-hidden", "true");
  if (qrSessionUnsub) {
    qrSessionUnsub();
    qrSessionUnsub = null;
  }
  activeQrSessionId = null;
  if (qrExpireTimerId) {
    clearTimeout(qrExpireTimerId);
    qrExpireTimerId = null;
  }
  if (qrCountdownTimerId) {
    clearInterval(qrCountdownTimerId);
    qrCountdownTimerId = null;
  }
  qrDeadlineMs = 0;
  if (qrCountdownEl) {
    qrCountdownEl.classList.add("hidden");
    qrCountdownEl.textContent = "01:00";
  }
}

listEl?.addEventListener("click", (e) => {
  const target = e.target?.closest?.(".r-name");
  if (!target) return;
  const sid = String(target.getAttribute("data-staff-id") || "").trim();
  const sname = String(target.getAttribute("data-staff-name") || "").trim();
  if (!sid) return;
  openStaffDetailModal(sid, sname);
});

async function loadData() {
  try {
    if (!currentUser) return;
    if (!app || !db) {
      console.error("Firebase app/db chưa sẵn sàng, bỏ qua loadData.");
      return;
    }
    const dayKey = todayKeyHCM();
    const [staffSnap, punchesSnap, worktimeSnap] = await Promise.all([
      getDocs(collection(db, "staffs")),
      getDocs(query(collection(db, "staff_punches"), where("day", "==", dayKey))),
      getDocs(collection(db, WORKTIME_STATE_COLL))
    ]);

    // Dùng ví sao tổng hợp để giảm truy vấn nặng ở màn hình index.
    const totalStarsMap = Object.create(null);
    try {
      const walletSnap = await getDocs(collection(db, "star_wallets"));
      walletSnap.forEach((d) => {
        const sid = String(d.id || "").trim();
        if (!sid) return;
        totalStarsMap[sid] = Number(d.data()?.balance || 0);
      });
    } catch (walletErr) {
      // Fallback an toàn nếu rule chưa mở cho star_wallets.
      const ratingsSnap = await getDocs(collection(db, "ratings"));
      ratingsSnap.forEach((d) => {
        const r = d.data() || {};
        const sid = String(r.staffId || "").trim();
        if (!sid) return;
        totalStarsMap[sid] = Number(totalStarsMap[sid] || 0) + Number(r.stars || 0);
      });
      console.warn("loadData fallback to ratings:", walletErr);
    }

    const punchMap = {};
    punchesSnap.forEach((d) => {
      const p = d.data() || {};
      const sid = String(p.staffId || "").trim();
      if (!sid) return;
      const at = Number(p.atClient || toMs(p.createdAt) || 0);
      const type = String(p.type || "").toLowerCase();
      const cur = punchMap[sid] || { events: [] };
      cur.events.push({ atMs: at, type });
      punchMap[sid] = cur;
    });
    const worktimeMap = {};
    worktimeSnap.forEach((d) => {
      const w = d.data() || {};
      const sid = String(w.staffId || d.id || "").trim();
      if (!sid) return;
      worktimeMap[sid] = w;
    });

    const rows = staffSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      balance: Number(totalStarsMap[d.id] || 0)
    }));

    const now = Date.now();
    for (const r of rows) {
      const sid = String(r.id || "").trim();
      const worktime = worktimeMap[sid] || null;
      const info = punchMap[sid] || { events: [] };
      const events = normalizePunchEventsWrapper(
        (info.events || []).filter((e) => Number.isFinite(e.atMs) && e.atMs > 0)
      );
      const count = events.length;
      const lastEvent = count ? events[count - 1] : null;
      const lastAtMs = Number(lastEvent?.atMs || 0);
      const lastType = String(lastEvent?.type || "");

      let locState = "black";
      let locPulse = false;
      let locTitle = "Chưa gửi vị trí hôm nay";
      let worktimeState = "unknown";

      if (worktime) {
        if (worktime.active === true) {
          locState = "green";
          locPulse = true;
          locTitle = "Đang tính giờ làm theo backend.";
          worktimeState = "in_shift";
        } else if (worktime.paused === true || String(worktime.stopReason || "") === "outing") {
          locState = "red";
          locPulse = true;
          locTitle = "Đang tạm ngưng tính giờ (ra ngoài).";
          worktimeState = "outside_break";
        } else if (
          String(worktime.stopReason || "") === "outside_working_window" ||
          String(worktime.stopReason || "") === "after_22h"
        ) {
          locState = "black";
          locPulse = false;
          locTitle = "Ngoài khung 06:30-22:00, không tính giờ làm.";
          worktimeState = "out_of_shift";
        }
      }

      if (!worktime && lastType === "in" && lastAtMs) {
        if (isPastDailyCutoffHCM()) {
          locState = "black";
          locPulse = false;
          locTitle = `Đã qua 22:00, hệ thống không tính tiếp ca hôm nay`; //
        } else {
          locState = "green";
          locPulse = true;
          locTitle = `Đang trong ca từ ${fmtTimeHCM(lastAtMs)}`;
        }
      } else if (!worktime && lastType === "out" && lastAtMs) {
        const age = now - lastAtMs;
        if (age <= LOC_EXPIRE_MS) {
          locState = "red";
          locPulse = true;
          const leftMs = Math.max(0, LOC_EXPIRE_MS - age);
          const leftMin = Math.ceil(leftMs / 60000);
          locTitle = `Ra ngoài lúc ${fmtTimeHCM(lastAtMs)} (còn ${leftMin}p để quay lại)`;
        } else {
          locState = "black";
          locPulse = false;
          locTitle = `Đã ra ngoài từ ${fmtTimeHCM(lastAtMs)} (>60p, xem như chưa vào ca)`;
        }
      } else if (!worktime && count > 0 && lastAtMs) {
        // Fallback cho dữ liệu cũ thiếu type: lẻ = đang trong ca, chẵn = đã ra.
        const isInByParity = count % 2 === 1;
        if (isInByParity) {
          locState = "green";
          locPulse = true;
          locTitle = `Đang trong ca (fallback dữ liệu cũ) từ ${fmtTimeHCM(lastAtMs)}`;
        } else {
          const age = now - lastAtMs;
          if (age <= LOC_EXPIRE_MS) {
            locState = "red";
            locPulse = true;
            const leftMs = Math.max(0, LOC_EXPIRE_MS - age);
            const leftMin = Math.ceil(leftMs / 60000);
            locTitle = `Ra ngoài (fallback dữ liệu cũ) lúc ${fmtTimeHCM(lastAtMs)} (còn ${leftMin}p)`;
          } else {
            locState = "black";
            locPulse = false;
            locTitle = `Ra ngoài quá 60p (fallback dữ liệu cũ)`;
          }
        }
      }

      r.locState = locState;
      r.locPulse = locPulse;
      r.locTitle = locTitle;
      r.locCount = count;
      r.locLastAtMs = lastAtMs;
      r.worktimeState = worktimeState;
    }

    lastRows = rows;
    const displayRows = getVisibleRowsForCurrentUser([...rows]);
    render(displayRows);
    saveRankCache(rows);
    publishIndexUiSnapshot(displayRows);
    publishClientRuntime({ lastSyncAtMs: Date.now() });
  } catch (e) {
    console.error("Lỗi sync:", e);
    if (!lastRows || !lastRows.length) {
      render([]);
    }
    showToast(`❌ Lỗi tải Star: ${e?.message || e || "không rõ nguyên nhân"}`);
  }
}

if (btnReload) btnReload.onclick = loadData;
applyAuthUi();

// boot
(() => {
  const sess = loadSession();
  if (sess && sess.staffId) {
    if (!sess?.isPresident && !getShiftWindowStatusHCM().within) {
      doLogout("Ngoài khung 06:30-22:00. Vui lòng đăng nhập lại khi vào ca.");
      openLoginOverlay();
      return; //
    }
    // Session chỉ có hiệu lực nếu đang ở trong shop.
    currentUser = sess;
    if (!Number.isFinite(Number(currentUser?.loginAtMs)) || Number(currentUser?.loginAtMs) <= 0) {
      currentUser.loginAtMs = Date.now();
      saveSession();
    }
    presidentVisibleStaffIds = currentUser?.isPresident
      ? loadPresidentVisibleStaffSelection()
      : null;
    applyAuthUi();
    closeLoginOverlay();
    const cachedRows = loadRankCache();
    if (Array.isArray(cachedRows) && cachedRows.length > 0) {
      lastRows = cachedRows;
      render(getVisibleRowsForCurrentUser([...cachedRows]));
    }
    startSessionPresence().catch(() => {});
    startStaffSessionGeoSync();
    startStaffRuntimeControlSync();
    loadData();
    startLiveDataSync();
    if (autoRefreshId) clearInterval(autoRefreshId);
    autoRefreshId = setInterval(loadData, AUTO_REFRESH_MS);
    geoIntervalId = setInterval(enforceGeoFence, GEO_CHECK_MS);
    startDailyAutoOutGuard();
    enforceGeoFence().catch(() => {});
    return;
  }
  openLoginOverlay();
})();

btnLogin?.addEventListener("click", async () => {
  showLoginError("");
  btnLogin.disabled = true;
  try {
    const staffId = String(loginStaffIdEl?.value || "").trim();
    const pass = String(loginPasswordEl?.value || "").trim();
    let r = null;
    if (isPresidentAccountWrapper(staffId)) {
      // Chủ tịch: xác thực bằng Firebase Auth, không cần GPS.
      r = await verifyPresidentLogin(pass);
    } else {
      const shiftState = getShiftWindowStatusHCM();
      if (!shiftState.within) {
        showLoginError("Chỉ đăng nhập trong khung 06:30-22:00 để vào ca.");
        return;
      }
      const geo = await checkInShop();
      if (!geo.ok) {
        const msg =
          geo.reason === "OUT_OF_SHOP"
            ? `Bạn đang ở ngoài shop (cách ${fmtMeters(geo.distanceM)}). Vui lòng đứng trong shop để đăng nhập.`
            : `Không xác minh được GPS (${geo.reason}). Vui lòng bật định vị để đăng nhập.`;
        showLoginError(msg);
        return;
      }
      r = await verifyLogin(staffId, pass);
    }
    if (!r.ok) {
      showLoginError(r.error || "Đăng nhập thất bại.");
      return;
    }
    currentUser = r.user;
    presidentVisibleStaffIds = currentUser?.isPresident
      ? loadPresidentVisibleStaffSelection()
      : null;
    saveSession();
    applyAuthUi();
    closeLoginOverlay();
    if (!currentUser?.isPresident) {
      await recordAutoShiftPunchOnLogin(currentUser.staffId);
    }
    await startSessionPresence();
    startStaffSessionGeoSync();
    startStaffRuntimeControlSync();
    await loadData();
    startLiveDataSync();

    if (autoRefreshId) clearInterval(autoRefreshId);
    autoRefreshId = setInterval(loadData, AUTO_REFRESH_MS);

    if (geoIntervalId) clearInterval(geoIntervalId);
    geoIntervalId = currentUser?.isPresident
      ? null
      : setInterval(enforceGeoFence, GEO_CHECK_MS);

    startDailyAutoOutGuard();
    enforceGeoFence().catch(() => {});
  } catch (e) {
    console.error("login error:", e);
    showLoginError("Có lỗi khi đăng nhập. Vui lòng thử lại.");
  } finally {
    btnLogin.disabled = false;
  }
});

loginPasswordEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnLogin?.click();
});

btnLogout?.addEventListener("click", () => {
  doLogout("");
});

userNameEl?.addEventListener("click", () => {
  const sid = String(currentUser?.staffId || "").trim();
  const sname = String(currentUser?.name || sid || "").trim();
  if (!sid) return;
  if (currentUser?.isPresident) {
    openPpPanel();
  } else {
    openStaffDetailModal(sid, sname);
  }
});

// ============ PRESIDENT PANEL ============
function openPpPanel() {
  getEl('presidentPanel')?.classList.add('open');
  getEl('presidentPanelBg')?.classList.add('open');
  loadPpStaffList();
}
function closePpPanel() {
  getEl('presidentPanel')?.classList.remove('open');
  getEl('presidentPanelBg')?.classList.remove('open');
}
window.closePpPanel = closePpPanel;
getEl('ppClose')?.addEventListener('click', closePpPanel);

async function loadPpStaffList() {
  const listEl = getEl('ppStaffList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="pp-empty">Đang tải...</div>';
  try {
    const payload = await callInternalPosApi('/staffs');
    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (!items.length) { listEl.innerHTML = '<div class="pp-empty">Chưa có nhân viên nào</div>'; return; }
    listEl.innerHTML = '';
    items.forEach((s) => {
      const row = document.createElement('div');
      row.className = 'pp-row';
      const isLocked = s.active === false;
      row.innerHTML = `
        <div class="pp-cell pp-name-click" data-sid="${s.id}" data-sname="${s.name||s.id}" title="${s.name||s.id}" style="cursor:pointer">${s.name || s.id}</div>
        <div class="pp-cell muted">${s.phone || s.id}</div>
        <div class="pp-mk-wrap" style="display:flex;justify-content:center">
          <button class="pp-icon-btn mk-btn" data-id="${s.id}" title="Đổi mật khẩu">
            <i class="fa-solid fa-key"></i>
          </button>
          <div class="pp-mk-popup" id="mkpop_${s.id}">
            <input class="pp-pass-input" type="password" placeholder="Nhập MK mới..." data-id="${s.id}" autocomplete="new-password">
            <button class="pp-save-btn" data-id="${s.id}"><i class="fa-solid fa-check"></i> Lưu MK</button>
          </div>
        </div>
        <div style="display:flex;justify-content:center">
          <button class="pp-icon-btn ${isLocked?'lock-on':''}" data-id="${s.id}" data-locked="${isLocked?'1':'0'}" title="${isLocked?'Đang khoá - bấm để mở':'Đang mở - bấm để khoá'}">
            <i class="fa-solid ${isLocked?'fa-lock':'fa-lock-open'}"></i>
          </button>
        </div>
        <div style="display:flex;justify-content:center">
          <button class="pp-icon-btn del" data-del="${s.id}" title="Xoá nhân viên">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      `;
      listEl.appendChild(row);
    });

    // Click name → open dashboard
    listEl.querySelectorAll('.pp-name-click').forEach(el => {
      el.addEventListener('click', () => {
        const sid = el.dataset.sid;
        const sname = el.dataset.sname;
        if (sid) openStaffDetailModal(sid, sname);
      });
    });

    // MK icon toggle popup
    listEl.querySelectorAll('.pp-icon-btn.mk-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        const popup = getEl('mkpop_' + id);
        // close all other popups
        listEl.querySelectorAll('.pp-mk-popup.open').forEach(p => { if(p !== popup) p.classList.remove('open'); });
        popup?.classList.toggle('open');
        if (popup?.classList.contains('open')) {
          popup.querySelector('.pp-pass-input')?.focus();
        }
      });
    });

    // Close popup khi click ngoài
    document.addEventListener('click', function handler(e) {
      if (!e.target.closest('.pp-mk-wrap')) {
        listEl.querySelectorAll('.pp-mk-popup.open').forEach(p => p.classList.remove('open'));
      }
    }, { once: false });

    // Save password
    listEl.querySelectorAll('.pp-save-btn').forEach(btn => {
      btn.addEventListener('click', async function(e) {
        e.stopPropagation();
        const id = this.dataset.id;
        const inp = this.previousElementSibling;
        const newPass = inp.value.trim();
        if (!newPass || newPass.length < 4) { showToast('⚠️ Mật khẩu ít nhất 4 ký tự!'); return; }
        this.disabled = true;
        this.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        try {
          await callInternalPosApi(`/staffs/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: { loginPassword: newPass },
          });
          inp.value = '';
          this.closest('.pp-mk-popup')?.classList.remove('open');
          showToast('✅ Đã lưu mật khẩu!');
        } catch(e2) {
          showToast('❌ Lỗi: ' + e2.message);
        } finally {
          this.disabled = false;
          this.innerHTML = '<i class="fa-solid fa-check"></i> Lưu MK';
        }
      });
    });

    // Lock/Unlock
    listEl.querySelectorAll('.pp-icon-btn[data-id]').forEach(btn => {
      btn.addEventListener('click', async function() {
        const id = this.dataset.id;
        const locked = this.dataset.locked === '1';
        const newActive = locked; // toggle
        try {
          await callInternalPosApi(`/staffs/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: { active: newActive },
          });
          this.dataset.locked = newActive ? '0' : '1';
          const icon = this.querySelector('i');
          if (newActive) {
            this.classList.remove('lock-on');
            icon.className = 'fa-solid fa-lock-open';
            this.title = 'Đang mở - bấm để khoá';
          } else {
            this.classList.add('lock-on');
            icon.className = 'fa-solid fa-lock';
            this.title = 'Đang khoá - bấm để mở';
          }
          showToast(newActive ? '🔓 Đã mở khoá!' : '🔒 Đã khoá!');
        } catch(e) { showToast('❌ Lỗi: ' + e.message); }
      });
    });

    // Delete
    listEl.querySelectorAll('.pp-icon-btn.del').forEach(btn => {
      btn.addEventListener('click', async function() {
        const id = this.dataset.del;
        if (!await _confirm(`Xoá nhân viên "${id}"?`)) return;
        try {
          await callInternalPosApi(`/staffs/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          });
          this.closest('.pp-row').remove();
          showToast('🗑️ Đã xoá!');
        } catch(e) { showToast('❌ Lỗi: ' + e.message); }
      });
    });

  } catch(e) {
    listEl.innerHTML = `<div class="pp-empty">Lỗi: ${e.message}</div>`;
  }
}

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);backdrop-filter:blur(8px);padding:12px 20px;border-radius:30px;font-size:13px;font-weight:600;color:#fff;z-index:9999;animation:none';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// Custom confirm modal (thay confirm() của trình duyệt)
function _confirm(msg) {
  return new Promise((resolve) => {
    const overlay = getEl('confirmOverlay');
    const msgEl = getEl('cfMsg');
    const btnOk = getEl('cfOk');
    const btnCancel = getEl('cfCancel');
    if (!overlay) { resolve(confirm(msg)); return; }
    msgEl.textContent = msg;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    function cleanup() {
      overlay.classList.remove('open');
      overlay.setAttribute('aria-hidden', 'true');
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
    }
    function onOk() { cleanup(); resolve(true); }
    function onCancel() { cleanup(); resolve(false); }
    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
  });
}

// Add Staff button — open modal
function openAddStaffModal() {
  const overlay = getEl('addStaffOverlay');
  if (!overlay) return;
  getEl('asName').value = '';
  getEl('asPhone').value = '';
  getEl('asPass').value = '';
  const err = getEl('asErr');
  err.classList.remove('show'); err.textContent = '';
  getEl('asSubmit').disabled = false;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  setTimeout(() => getEl('asName')?.focus(), 200);
}
function closeAddStaffModal() {
  const overlay = getEl('addStaffOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
}
getEl('asClose')?.addEventListener('click', closeAddStaffModal);
getEl('addStaffOverlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'addStaffOverlay') closeAddStaffModal();
});

getEl('asSubmit')?.addEventListener('click', async () => {
  const nameEl = getEl('asName');
  const phoneEl = getEl('asPhone');
  const passEl = getEl('asPass');
  const errEl = getEl('asErr');
  const btn = getEl('asSubmit');
  const name = (nameEl?.value || '').trim();
  const phone = (phoneEl?.value || '').trim();
  const pass = (passEl?.value || '').trim();
  errEl.classList.remove('show'); errEl.textContent = '';
  if (!name) { errEl.textContent = 'Vui lòng nhập tên nhân viên'; errEl.classList.add('show'); nameEl?.focus(); return; }
  if (!phone) { errEl.textContent = 'Vui lòng nhập số điện thoại'; errEl.classList.add('show'); phoneEl?.focus(); return; }
  if (!pass) { errEl.textContent = 'Vui lòng nhập mật khẩu'; errEl.classList.add('show'); passEl?.focus(); return; }
  btn.disabled = true;
  try {
    await callInternalPosApi('/staffs', {
      method: 'POST',
      body: {
        id: phone,
        name,
        phone,
        loginPassword: pass,
        active: true,
        role: 'staff',
      },
    });
    showToast('✅ Đã thêm nhân viên!');
    loadPpStaffList();
    closeAddStaffModal();
  } catch(e) {
    errEl.textContent = '❌ Lỗi: ' + e.message;
    errEl.classList.add('show');
  } finally { btn.disabled = false; }
});

getEl('ppAddStaff')?.addEventListener('click', () => {
  openAddStaffModal();
});
getEl('ppOpenSchedule')?.addEventListener('click', () => {
  window.open('./lichlamviec.html', '_blank', 'noopener,noreferrer');
});
// ============ END PRESIDENT PANEL ============

btnQr?.addEventListener("click", () => {
  if (qrOverlay?.classList.contains("open")) {
    closeQrOverlay();
    return;
  }
  openQrOverlay();
});
btnQrClose?.addEventListener("click", closeQrOverlay);
qrOverlay?.addEventListener("click", (e) => {
  if (e.target === qrOverlay) closeQrOverlay();
});
staffFilterOverlay?.addEventListener("click", (e) => {
  if (e.target === staffFilterOverlay) closeStaffFilterOverlay();
});
btnSfClose?.addEventListener("click", () => {
  commitPresidentDraftSelection();
  closeStaffFilterOverlay();
});
btnSfAll?.addEventListener("click", () => {
  presidentDraftVisibleStaffIds = null;
  renderStaffFilterOptions();
});
btnSfNone?.addEventListener("click", () => {
  presidentDraftVisibleStaffIds = new Set();
  renderStaffFilterOptions();
});
staffFilterListEl?.addEventListener("change", (e) => {
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.type !== "checkbox") return;
  const sid = String(target.getAttribute("data-sid") || "").trim();
  if (!sid) return;
  const all = getQrStaffOptionsFromChart().map((x) => x.id);
  if (presidentDraftVisibleStaffIds === null) {
    presidentDraftVisibleStaffIds = new Set(all);
  }
  if (target.checked) presidentDraftVisibleStaffIds.add(sid);
  else presidentDraftVisibleStaffIds.delete(sid);
  if (presidentDraftVisibleStaffIds.size === all.length) presidentDraftVisibleStaffIds = null;
});
qrStaffSelect?.addEventListener("change", () => {
  const staffId = String(qrStaffSelect.value || "");
  const mine = String(currentUser?.staffId || "").trim();
  const isPresident = !!currentUser?.isPresident;
  const target = isPresident ? staffId : mine;
  if (!isPresident && mine && staffId !== mine) {
    qrStaffSelect.value = mine;
  }
  if (!target) return;
  const options = isPresident ? getQrStaffOptionsFromChart() : [];
  const staffName = isPresident
    ? String(options.find((item) => item.id === target)?.name || target)
    : String(currentUser?.name || target || "");
  setQrTitle(staffName);
  renderQrForStaff(target);
});
window.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (staffFilterOverlay?.classList.contains("open")) {
    closeStaffFilterOverlay();
    return;
  }
  if (staffDetailOverlayEl?.classList.contains("open")) {
    closeStaffDetailModal();
    return;
  }
  closeQrOverlay();
});

window.addEventListener(
  "resize",
  debounce(() => {
    if (!lastRows) return;
    render(getVisibleRowsForCurrentUser([...lastRows]));
  }, 120)
);

// Realtime runtime hooks: soft update without full-page reload.
window.__TK_SOFT_IMPORT_SAFE__ = true;
window.__TK_BEFORE_SOFT_IMPORT__ = async (meta) => {
  if (!meta || meta.pageId !== "star") return;
  try {
    window.__TK_STAR_CURRENT_USER__ = currentUser || null;
    window.__TK_STAR_LAST_ROWS__ = lastRows || null;
  } catch (_) {}
  try {
    stopLiveDataSync();
  } catch (_) {}
  try {
    if (qrSessionUnsub) { qrSessionUnsub(); qrSessionUnsub = null; }
    if (staffSessionGeoUnsub) { staffSessionGeoUnsub(); staffSessionGeoUnsub = null; }
    if (staffRuntimeControlUnsub) { staffRuntimeControlUnsub(); staffRuntimeControlUnsub = null; }
    if (autoRefreshId) { clearInterval(autoRefreshId); autoRefreshId = null; }
    if (geoIntervalId) { clearInterval(geoIntervalId); geoIntervalId = null; }
    if (autoOutIntervalId) { clearInterval(autoOutIntervalId); autoOutIntervalId = null; }
    if (sessionHeartbeatId) { clearInterval(sessionHeartbeatId); sessionHeartbeatId = null; }
    if (qrCountdownTimerId) { clearInterval(qrCountdownTimerId); qrCountdownTimerId = null; }
  } catch (_) {}
};
window.__TK_PAGE_REFRESH__ = async (meta) => {
  if (meta && meta.pageId && meta.pageId !== "star") return;
  try {
    if (currentUser) await loadData();
  } catch (_) {}
};
if (window.TKRealtimeRuntime && typeof window.TKRealtimeRuntime.registerStateHooks === "function") {
  window.TKRealtimeRuntime.registerStateHooks("star", {
    exportState: () => ({
      search: getEl("search")?.value || "",
      selectedStaff: getEl("qrStaffSelect")?.value || ""
    }),
    importState: (state) => {
      if (!state) return;
      const searchEl = getEl("search");
      const staffEl = getEl("qrStaffSelect");
      if (searchEl && typeof state.search === "string") searchEl.value = state.search;
      if (staffEl && typeof state.selectedStaff === "string") staffEl.value = state.selectedStaff;
    }
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => SmartImageRuntime.install(), { once: true });
} else {
  SmartImageRuntime.install();
}
