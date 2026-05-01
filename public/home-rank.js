import { ensureInternalClientAccess } from "./internal-access.js";
import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { THKD_FIREBASE_CONFIG } from "./star-firebase-config.js";
import { todayKeyHCM, fmtTimeHCM, toMs, normalizePunchEvents, fmtBalance } from "./utils.js";

ensureInternalClientAccess({ allowHash: false, allowSession: true });

const HOME_RANK_FIREBASE_APP = "thkd-home-rank";
const app = getApps().some((item) => item.name === HOME_RANK_FIREBASE_APP)
  ? getApp(HOME_RANK_FIREBASE_APP)
  : initializeApp(THKD_FIREBASE_CONFIG, HOME_RANK_FIREBASE_APP);
const db = getFirestore(app);

const WORKTIME_STATE_COLL = "tk_worktime_states";
const PRESIDENT_EMAIL = "trunghaukimdunggroup@gmail.com";
const PUNCH_DUPLICATE_WINDOW_MS = 2 * 60 * 1000;
const LOC_EXPIRE_MS = 60 * 60 * 1000;
const DAILY_AUTO_OUT_HOUR = 22;
const DAILY_AUTO_OUT_MINUTE = 0;
const AUTO_REFRESH_MS = 30_000;

const HOME_RANK_HTML = `
  <div class="home-rank-shell">
    <div class="home-rank-list" id="homeRankList">
      <div class="home-rank-empty">Đang tải dữ liệu bảng vàng...</div>
    </div>
  </div>
`;

const HOME_RANK_STYLE = `
  .home-rank-shell {
    width: 100%;
    height: 100%;
    min-height: 100%;
    background: #000;
    color: #fff;
    overflow: hidden;
    border-radius: 0;
  }

  .home-rank-list {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    gap: 2px;
    --value-pad: 120px;
  }

  .home-rank-empty {
    height: 100%;
    display: grid;
    place-items: center;
    padding: 20px;
    text-align: center;
    color: rgba(255,255,255,0.78);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .home-rank-shell .bar-wrap {
    flex: 1;
    position: relative;
    min-height: 0;
    border-radius: 6px;
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
    border: 1px solid rgba(255,255,255,0.06);
    overflow: hidden;
    display: flex;
    align-items: center;
  }

  .home-rank-shell .bar-wrap::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: repeating-linear-gradient(to right, rgba(255,255,255,0.06) 0, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 10%);
    opacity: 0.45;
    pointer-events: none;
    z-index: 0;
  }

  .home-rank-shell .bar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 10px;
    opacity: 0.92;
    background: linear-gradient(90deg, #fbbf24, #f59e0b);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14);
    transition: width 1.2s cubic-bezier(0.1, 0.8, 0.2, 1);
    border-radius: 0;
  }

  .home-rank-shell .bar:not(.negative),
  .home-rank-shell .bar.negative {
    border-top-right-radius: 999px;
    border-bottom-right-radius: 999px;
  }

  .home-rank-shell .bar::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, rgba(255,255,255,0.00) 0%, rgba(255,255,255,0.22) 45%, rgba(255,255,255,0.00) 85%);
    transform: translateX(-120%);
    animation: homeRankSheen 2.6s ease-in-out infinite;
    opacity: 0.55;
    pointer-events: none;
  }

  .home-rank-shell .bar.negative {
    background: linear-gradient(90deg, #ef4444, #b91c1c);
    opacity: 0.88;
  }

  .home-rank-shell .bar-content {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 100%;
    padding: 0 15px;
    padding-right: calc(15px + var(--value-pad));
    display: flex;
    align-items: center;
    pointer-events: none;
  }

  .home-rank-shell .r-name {
    font-size: clamp(10px, 1.5vh, 16px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: rgba(0,0,0,0.92);
    text-shadow: none;
    max-width: calc(100% - var(--value-pad));
    font-weight: 800;
  }

  .home-rank-shell .bar-xu {
    font-size: clamp(10px, 1.35vh, 15px);
    font-weight: 900;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
    color: rgba(0,0,0,0.92);
  }

  .home-rank-shell .bar-xu.is-hidden {
    opacity: 0;
    visibility: hidden;
  }

  .home-rank-shell .loc-signal {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-left: 4px;
    flex: 0 0 auto;
  }

  .home-rank-shell .loc-signal i {
    font-size: 14px;
    line-height: 1;
    transform: translateY(-0.5px);
  }

  .home-rank-shell .loc-signal.is-green i { color: #16a34a; }
  .home-rank-shell .loc-signal.is-red i { color: #dc2626; }
  .home-rank-shell .loc-signal.is-black i { color: rgba(0,0,0,0.78); }

  .home-rank-shell .loc-signal.is-pulse::after {
    content: "";
    position: absolute;
    inset: -6px;
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,0.0);
    opacity: 0;
    transform: scale(0.70);
    pointer-events: none;
  }

  .home-rank-shell .loc-signal.is-green.is-pulse::after {
    border-color: rgba(22,163,74,0.70);
    box-shadow: 0 0 0 2px rgba(22,163,74,0.18);
    animation: homeRankPulseGreen 1.25s ease-out infinite;
  }

  .home-rank-shell .loc-signal.is-red.is-pulse::after {
    border-color: rgba(220,38,38,0.75);
    box-shadow: 0 0 0 2px rgba(220,38,38,0.20);
    animation: homeRankPulseRed 1.05s ease-out infinite;
  }

  .home-rank-shell .bar-wrap.is-top1 { border-color: rgba(251,191,36,0.28); }
  .home-rank-shell .bar-wrap.is-top1 .bar { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.20), 0 0 0 1px rgba(251,191,36,0.08); }
  .home-rank-shell .bar-wrap.is-top2,
  .home-rank-shell .bar-wrap.is-top3 { border-color: rgba(255,255,255,0.10); }

  @keyframes homeRankSheen {
    0% { transform: translateX(-120%); }
    45% { transform: translateX(20%); }
    100% { transform: translateX(220%); }
  }

  @keyframes homeRankPulseGreen {
    0% { opacity: 0.0; transform: scale(0.70); }
    18% { opacity: 0.95; }
    100% { opacity: 0.0; transform: scale(1.45); }
  }

  @keyframes homeRankPulseRed {
    0% { opacity: 0.0; transform: scale(0.72); }
    14% { opacity: 0.95; }
    100% { opacity: 0.0; transform: scale(1.55); }
  }
`;

let styleInjected = false;
let refreshTimerId = null;
let pillMeasureEl = null;
let lastValuePadPx = 120;

function ensureStyle() {
  if (styleInjected) return;
  const style = document.createElement("style");
  style.id = "home-rank-style";
  style.textContent = HOME_RANK_STYLE;
  document.head.appendChild(style);
  styleInjected = true;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isPastDailyCutoffHCM() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return (hour * 60 + minute) >= (DAILY_AUTO_OUT_HOUR * 60 + DAILY_AUTO_OUT_MINUTE);
}

function ensurePillMeasureEl() {
  if (pillMeasureEl && document.body.contains(pillMeasureEl)) return pillMeasureEl;
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  el.style.top = "-9999px";
  el.style.visibility = "hidden";
  el.style.pointerEvents = "none";
  el.style.zIndex = "-1";
  el.className = "bar-xu";
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
}

function updateValuePadCssVar(listEl, rows) {
  const maxText = (rows || []).reduce((best, r) => {
    const t = fmtBalance(r?.balance || 0);
    return t.length > best.length ? t : best;
  }, "0");
  const w = measurePillWidth(maxText);
  const px = Math.max(80, w + 18);
  lastValuePadPx = Math.ceil(px);
  listEl.style.setProperty("--value-pad", `${lastValuePadPx}px`);
}

function calcMinPctFromLongestName(listEl, valuePadPx) {
  if (!listEl) return 30;
  const names = Array.from(listEl.querySelectorAll(".r-name"));
  if (!names.length) return 30;
  const containerW = listEl.getBoundingClientRect().width || 300;
  let maxNamePx = 0;
  names.forEach((el) => {
    const w = el.scrollWidth || el.offsetWidth || 0;
    if (w > maxNamePx) maxNamePx = w;
  });
  const minPx = maxNamePx + 300 + (valuePadPx || 120);
  const pct = Math.min(50, Math.ceil((minPx / containerW) * 100));
  return Math.max(20, pct);
}

function renderRank(listEl, rows = []) {
  if (!listEl) return;
  if (!Array.isArray(rows) || !rows.length) {
    listEl.innerHTML = `<div class="home-rank-empty">Chưa có dữ liệu bảng vàng</div>`;
    return;
  }

  rows.sort((a, b) => (b.balance || 0) - (a.balance || 0));
  const maxAbs = Math.max(1, ...rows.map((item) => Math.abs(item.balance || 0)));
  updateValuePadCssVar(listEl, rows);

  listEl.innerHTML = rows.map((item, idx) => {
    const bal = Number(item.balance || 0);
    const abs = Math.abs(bal);
    const textBal = fmtBalance(bal);
    const locState = String(item.locState || "black");
    const locPulse = !!item.locPulse;
    const locTitle = String(item.locTitle || "");
    const locCls = locState === "green" ? "is-green" : locState === "red" ? "is-red" : "is-black";
    const wrapCls = idx === 0 ? "is-top1" : idx === 1 ? "is-top2" : idx === 2 ? "is-top3" : "";
    return `
      <div class="bar-wrap ${wrapCls}" data-abs="${abs}" data-neg="${bal < 0 ? "1" : "0"}">
        <div class="bar ${bal < 0 ? "negative" : ""}" style="width:0%">
          <span class="bar-xu is-hidden"><span class="num">${textBal}⭐</span><span class="loc-signal ${locCls} ${locPulse ? "is-pulse" : ""}" title="${escapeHtml(locTitle)}"><i class="fa-solid fa-star"></i></span></span>
        </div>
        <div class="bar-content">
          <span class="r-name">${escapeHtml(item.name || "N/A")}</span>
        </div>
      </div>
    `;
  }).join("");

  requestAnimationFrame(() => {
    const minPct = calcMinPctFromLongestName(listEl, lastValuePadPx);
    const bars = Array.from(listEl.querySelectorAll(".bar-wrap"));
    for (const wrap of bars) {
      const abs = Number(wrap.getAttribute("data-abs") || 0);
      const pctExtra = (abs / maxAbs) * Math.max(0, 100 - minPct);
      const pct = Math.min(100, minPct + pctExtra);
      const bar = wrap.querySelector(".bar");
      const label = wrap.querySelector(".bar-xu");
      if (bar) bar.style.width = `${pct}%`;
      if (label) label.classList.toggle("is-hidden", pct < 10);
    }
  });
}

function computeRowStates(rows, punchesSnap, worktimeSnap) {
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

  const now = Date.now();
  for (const row of rows) {
    const sid = String(row.id || "").trim();
    const worktime = worktimeMap[sid] || null;
    const info = punchMap[sid] || { events: [] };
    const events = normalizePunchEvents(
      (info.events || []).filter((item) => Number.isFinite(item.atMs) && item.atMs > 0),
      PUNCH_DUPLICATE_WINDOW_MS
    );
    const count = events.length;
    const lastEvent = count ? events[count - 1] : null;
    const lastAtMs = Number(lastEvent?.atMs || 0);
    const lastType = String(lastEvent?.type || "");

    let locState = "black";
    let locPulse = false;
    let locTitle = "Chưa gửi vị trí hôm nay";

    if (worktime) {
      if (worktime.active === true) {
        locState = "green";
        locPulse = true;
        locTitle = "Đang tính giờ làm theo backend.";
      } else if (worktime.paused === true || String(worktime.stopReason || "") === "outing") {
        locState = "red";
        locPulse = true;
        locTitle = "Đang tạm ngưng tính giờ (ra ngoài).";
      } else if (
        String(worktime.stopReason || "") === "outside_working_window" ||
        String(worktime.stopReason || "") === "after_22h"
      ) {
        locState = "black";
        locPulse = false;
        locTitle = "Ngoài khung 06:30-22:00, không tính giờ làm.";
      }
    }

    if (!worktime && lastType === "in" && lastAtMs) {
      if (isPastDailyCutoffHCM()) {
        locState = "black";
        locPulse = false;
        locTitle = "Đã qua 22:00, hệ thống không tính tiếp ca hôm nay";
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
          locTitle = "Ra ngoài quá 60p (fallback dữ liệu cũ)";
        }
      }
    }

    row.locState = locState;
    row.locPulse = locPulse;
    row.locTitle = locTitle;
  }
}

async function loadHomeRank(host) {
  const listEl = host.querySelector("#homeRankList");
  if (!listEl) return;
  const dayKey = todayKeyHCM();
  const [staffSnap, punchesSnap, worktimeSnap] = await Promise.all([
    getDocs(collection(db, "staffs")),
    getDocs(query(collection(db, "staff_punches"), where("day", "==", dayKey))),
    getDocs(collection(db, WORKTIME_STATE_COLL))
  ]);

  const totalStarsMap = Object.create(null);
  try {
    const walletSnap = await getDocs(collection(db, "star_wallets"));
    walletSnap.forEach((d) => {
      const sid = String(d.id || "").trim();
      if (!sid) return;
      totalStarsMap[sid] = Number(d.data()?.balance || 0);
    });
  } catch {
    const ratingsSnap = await getDocs(collection(db, "ratings"));
    ratingsSnap.forEach((d) => {
      const rating = d.data() || {};
      const sid = String(rating.staffId || "").trim();
      if (!sid) return;
      totalStarsMap[sid] = Number(totalStarsMap[sid] || 0) + Number(rating.stars || 0);
    });
  }

  const rows = staffSnap.docs
    .map((d) => ({
      id: d.id,
      ...d.data(),
      balance: Number(totalStarsMap[d.id] || 0)
    }))
    .filter((row) => String(row.id || "").trim() && String(row.id || "").trim() !== PRESIDENT_EMAIL);

  computeRowStates(rows, punchesSnap, worktimeSnap);
  renderRank(listEl, rows);
}

export async function mountHomeRank(host) {
  if (!host) throw new Error("Thiếu vùng mount Rank.");
  ensureStyle();
  host.innerHTML = HOME_RANK_HTML;

  const refresh = async () => {
    try {
      await loadHomeRank(host);
    } catch (error) {
      const listEl = host.querySelector("#homeRankList");
      if (listEl) {
        listEl.innerHTML = `<div class="home-rank-empty">Lỗi tải bảng vàng</div>`;
      }
      throw error;
    }
  };

  await refresh();

  if (refreshTimerId) clearInterval(refreshTimerId);
  refreshTimerId = setInterval(() => {
    refresh().catch((error) => {
      console.error("Home Rank refresh error:", error);
    });
  }, AUTO_REFRESH_MS);
}
