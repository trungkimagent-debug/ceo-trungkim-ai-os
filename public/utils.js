// Shared frontend utilities for Trung Kim GEN-X.

export function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export function fmtDateTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function fmtMeters(m) {
  if (!Number.isFinite(m)) return "";
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(2)}km`;
}

export function getHcmTimeParts(ms = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const read = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: read("year"), month: read("month"), day: read("day"), hour: read("hour"), minute: read("minute") };
}

export function todayKeyHCM(ms = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(ms));
}

export function fmtTimeHCM(ms) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(Number(ms || 0)));
  } catch {
    return "";
  }
}

export function toMs(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  const d = new Date(v);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function newSessionId() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return `SID-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function normalizePunchEvents(events, PUNCH_DUPLICATE_WINDOW_MS) {
  const sorted = (events || [])
    .filter((x) => x?.atMs && (x.type === "in" || x.type === "out"))
    .sort((a, b) => a.atMs - b.atMs);
  const out = [];
  for (const ev of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      last.type === ev.type &&
      ev.atMs - last.atMs >= 0 &&
      ev.atMs - last.atMs <= PUNCH_DUPLICATE_WINDOW_MS
    ) {
      out[out.length - 1] = ev;
      continue;
    }
    out.push(ev);
  }
  return out;
}

export function buildSessions(events, endMs, MIN_VALID_SESSION_MS, MAX_SESSION_MS, PUNCH_DUPLICATE_WINDOW_MS) {
  const e = normalizePunchEvents(events, PUNCH_DUPLICATE_WINDOW_MS);
  const sessions = [];
  let start = null;

  for (const ev of e) {
    if (ev.type === "in") {
      if (start == null) {
        start = ev.atMs;
      } else if (ev.atMs > start + MIN_VALID_SESSION_MS) {
        sessions.push({
          start,
          end: ev.atMs,
          durationMs: Math.min(MAX_SESSION_MS, ev.atMs - start),
          implicitOut: true
        });
        start = ev.atMs;
      }
      continue;
    }

    if (start != null && ev.atMs > start) {
      sessions.push({
        start,
        end: ev.atMs,
        durationMs: Math.min(MAX_SESSION_MS, ev.atMs - start)
      });
      start = null;
    }
  }
  if (start != null && endMs > start) {
    sessions.push({
      start,
      end: endMs,
      durationMs: Math.min(MAX_SESSION_MS, endMs - start),
      open: true
    });
  }
  return sessions;
}

export function buildAttendanceWorkMs(events, endMs, MIN_VALID_SESSION_MS, MAX_SESSION_MS, PUNCH_DUPLICATE_WINDOW_MS) {
  return buildSessions(events, endMs, MIN_VALID_SESSION_MS, MAX_SESSION_MS, PUNCH_DUPLICATE_WINDOW_MS).reduce(
    (sum, s) => sum + Math.max(0, Number(s.durationMs || 0)),
    0
  );
}

export function getShiftWindowStatusHCM(SHIFT_START_HOUR, SHIFT_START_MINUTE, DAILY_AUTO_OUT_HOUR, DAILY_AUTO_OUT_MINUTE) {
  const now = getHcmTimeParts();
  const currentMin = now.hour * 60 + now.minute;
  const startMin = SHIFT_START_HOUR * 60 + SHIFT_START_MINUTE;
  const endMin = DAILY_AUTO_OUT_HOUR * 60 + DAILY_AUTO_OUT_MINUTE;
  return {
    within: currentMin >= startMin && currentMin <= endMin,
    beforeStart: currentMin < startMin,
    afterEnd: currentMin > endMin || currentMin === endMin
  };
}

export function isPresidentAccount(input, PRESIDENT_EMAIL) {
  return String(input || "").trim().toLowerCase() === PRESIDENT_EMAIL;
}

export function getEffectiveDayEndMsHCM(day, DAILY_AUTO_OUT_HOUR, DAILY_AUTO_OUT_MINUTE) {
  const cutoffMs = new Date(
    `${String(day)}T${String(DAILY_AUTO_OUT_HOUR).padStart(2, "0")}:${String(
      DAILY_AUTO_OUT_MINUTE
    ).padStart(2, "0")}:00+07:00`
  ).getTime();
  if (!Number.isFinite(cutoffMs)) return Date.now();
  if (String(day) === todayKeyHCM()) return Math.min(Date.now(), cutoffMs);
  return cutoffMs;
}

export function fmtBalance(bal) {
  return `${Math.round(bal).toLocaleString()}`;
}

export function fmtMoney(v) {
  return `${Math.round(Number(v || 0)).toLocaleString("vi-VN")}đ`;
}

export function classifyBreakLabel(durationMs) {
  const mins = Number(durationMs || 0) / 60000;
  return mins < 60 ? "Ra ngoài" : "Nghỉ giữa ca";
}

export function formatMoneyInput(n) {
  return Math.round(n || 0).toLocaleString("vi-VN");
}

export function normalizeMoneyInput(value) {
  return Number(String(value || "").replace(/[^\d]/g, "")) || 0;
}

export function durText(ms) {
  const s = Math.floor((ms || 0) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h${String(m).padStart(2, "0")}`;
}

export function fmtAgo(ms) {
  const now = Date.now();
  const t = Number(ms || 0);
  if (!t) return "--";
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}
