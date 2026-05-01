(function () {
  "use strict";

  var VERSION_STORE_PREFIX = "tk_rt_version:";
  var STATE_STORE_PREFIX = "tk_rt_state:";
  var RELOAD_GUARD_PREFIX = "tk_rt_reload_guard:";
  var LEGACY_CLEANUP_PREFIX = "tk_rt_legacy_cleanup:";
  var appliedVersionByPage = Object.create(null);
  var inFlightByPage = Object.create(null);
  var customHooks = Object.create(null);

  function nowIso() {
    return new Date().toISOString();
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return fallback;
    }
  }

  function readStoredState(pageId) {
    try {
      var raw = sessionStorage.getItem(STATE_STORE_PREFIX + pageId);
      if (!raw) return null;
      return safeJsonParse(raw, null);
    } catch (_) {
      return null;
    }
  }

  function writeStoredState(pageId, payload) {
    try {
      sessionStorage.setItem(STATE_STORE_PREFIX + pageId, JSON.stringify(payload || {}));
    } catch (_) {}
  }

  function readReloadGuard(pageId) {
    try {
      var raw = sessionStorage.getItem(RELOAD_GUARD_PREFIX + pageId);
      if (!raw) return { version: "", attempts: 0, lastAttemptAt: 0 };
      var parsed = safeJsonParse(raw, null);
      if (!parsed || typeof parsed !== "object") return { version: "", attempts: 0, lastAttemptAt: 0 };
      return {
        version: String(parsed.version || ""),
        attempts: Math.max(0, Number(parsed.attempts || 0)),
        lastAttemptAt: Math.max(0, Number(parsed.lastAttemptAt || 0))
      };
    } catch (_) {
      return { version: "", attempts: 0, lastAttemptAt: 0 };
    }
  }

  function writeReloadGuard(pageId, payload) {
    try {
      sessionStorage.setItem(RELOAD_GUARD_PREFIX + pageId, JSON.stringify(payload || {}));
    } catch (_) {}
  }

  function readVersion(pageId) {
    try {
      return String(localStorage.getItem(VERSION_STORE_PREFIX + pageId) || "");
    } catch (_) {
      return "";
    }
  }

  function writeVersion(pageId, version) {
    try {
      localStorage.setItem(VERSION_STORE_PREFIX + pageId, String(version || ""));
    } catch (_) {}
  }

  function readCleanupVersion(pageId) {
    try {
      return String(localStorage.getItem(LEGACY_CLEANUP_PREFIX + pageId) || "");
    } catch (_) {
      return "";
    }
  }

  function writeCleanupVersion(pageId, version) {
    try {
      localStorage.setItem(LEGACY_CLEANUP_PREFIX + pageId, String(version || ""));
    } catch (_) {}
  }

  async function cleanupLegacyBrowserCache(pageId, targetVersion) {
    var versionTag = String(targetVersion || "").trim();
    if (!versionTag) return;
    if (readCleanupVersion(pageId) === versionTag) return;

    // Best-effort cleanup to avoid stale assets from old service workers/caches.
    try {
      if ("serviceWorker" in navigator && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === "function") {
        var regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all((regs || []).map(function (r) {
          try { return r.unregister(); } catch (_) { return Promise.resolve(false); }
        }));
      }
    } catch (_) {}

    try {
      if ("caches" in window && window.caches && typeof window.caches.keys === "function") {
        var cacheKeys = await window.caches.keys();
        await Promise.all((cacheKeys || []).map(function (key) {
          try { return window.caches.delete(key); } catch (_) { return Promise.resolve(false); }
        }));
      }
    } catch (_) {}

    writeCleanupVersion(pageId, versionTag);
    emit("tk:legacy-cache-cleanup-done", { pageId: pageId, version: versionTag });
  }

  function scheduleIdleCleanupLegacyBrowserCache(pageId, targetVersion) {
    var run = function () {
      cleanupLegacyBrowserCache(pageId, targetVersion).catch(function () {});
    };
    try {
      if ("requestIdleCallback" in window && typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(run, { timeout: 5000 });
        return;
      }
    } catch (_) {}
    setTimeout(run, 2500);
  }

  function toBoolean(v, defaultValue) {
    if (v === undefined || v === null) return !!defaultValue;
    if (typeof v === "boolean") return v;
    var s = String(v).trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
    if (s === "0" || s === "false" || s === "no" || s === "off") return false;
    return !!defaultValue;
  }

  function captureInputs() {
    var fields = {};
    var list = document.querySelectorAll("input, textarea, select");
    list.forEach(function (el) {
      try {
        if (!el || !el.id) return;
        if (el.dataset && el.dataset.tkPersist === "0") return;
        var tag = (el.tagName || "").toLowerCase();
        if (tag === "input") {
          var type = String(el.type || "").toLowerCase();
          if (type === "password" || type === "file" || type === "hidden") return;
          if (type === "checkbox" || type === "radio") {
            fields[el.id] = { kind: "checked", value: !!el.checked };
            return;
          }
        }
        fields[el.id] = { kind: "value", value: el.value };
      } catch (_) {}
    });
    return fields;
  }

  function restoreInputs(snapshot) {
    if (!snapshot || !snapshot.fields) return;
    var fields = snapshot.fields;
    Object.keys(fields).forEach(function (id) {
      try {
        var el = document.getElementById(id);
        if (!el) return;
        var cell = fields[id] || {};
        if (cell.kind === "checked") {
          el.checked = !!cell.value;
        } else {
          el.value = cell.value == null ? "" : String(cell.value);
        }
      } catch (_) {}
    });
  }

  function captureUiState() {
    var activeId = "";
    try {
      activeId = document.activeElement && document.activeElement.id ? String(document.activeElement.id) : "";
    } catch (_) {}
    return {
      scrollX: window.scrollX || 0,
      scrollY: window.scrollY || 0,
      activeId: activeId
    };
  }

  function restoreUiState(snapshot) {
    if (!snapshot || !snapshot.ui) return;
    try {
      window.scrollTo(Number(snapshot.ui.scrollX || 0), Number(snapshot.ui.scrollY || 0));
    } catch (_) {}
    try {
      if (snapshot.ui.activeId) {
        var el = document.getElementById(snapshot.ui.activeId);
        if (el && typeof el.focus === "function") el.focus({ preventScroll: true });
      }
    } catch (_) {}
  }

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    } catch (_) {}
  }

  function captureSnapshot(pageId, versionTag) {
    var hook = customHooks[pageId] || {};
    var snapshot = {
      pageId: pageId,
      version: versionTag,
      capturedAt: nowIso(),
      fields: captureInputs(),
      ui: captureUiState(),
      custom: null
    };
    try {
      if (typeof hook.exportState === "function") {
        snapshot.custom = hook.exportState() || null;
      }
    } catch (_) {}
    writeStoredState(pageId, snapshot);
    return snapshot;
  }

  function matchChangedModules(remoteMeta, moduleUrl, pageId) {
    if (!remoteMeta) return true;
    if (Array.isArray(remoteMeta.changedModules) && remoteMeta.changedModules.length) {
      return remoteMeta.changedModules.some(function (item) {
        var s = String(item || "");
        return s && (moduleUrl.indexOf(s) >= 0 || s.indexOf(pageId) >= 0);
      });
    }
    if (remoteMeta.modules && typeof remoteMeta.modules === "object") {
      var arr = remoteMeta.modules[pageId];
      if (!Array.isArray(arr)) return true;
      return arr.some(function (item) {
        var s = String(item || "");
        return s && moduleUrl.indexOf(s) >= 0;
      });
    }
    return true;
  }

  async function importFreshModule(moduleUrl, versionTag) {
    if (!moduleUrl) return false;
    var sep = moduleUrl.indexOf("?") >= 0 ? "&" : "?";
    var finalUrl = moduleUrl + sep + "_v=" + encodeURIComponent(versionTag || "") + "&_t=" + Date.now();
    await import(finalUrl);
    return true;
  }

  async function runSoftUpdate(config, remoteVersion, remoteMeta) {
    var pageId = config.pageId;
    if (!pageId) return;
    if (inFlightByPage[pageId]) return;
    inFlightByPage[pageId] = true;

    var hook = customHooks[pageId] || {};
    captureSnapshot(pageId, remoteVersion);

    emit("tk:soft-update-start", { pageId: pageId, version: remoteVersion });

    var imported = false;
    try {
      if (
        toBoolean(config.enableModuleImport, true)
        && window.__TK_SOFT_IMPORT_SAFE__ === true
        && config.moduleUrl
        && matchChangedModules(remoteMeta, config.moduleUrl, pageId)
      ) {
        if (typeof window.__TK_BEFORE_SOFT_IMPORT__ === "function") {
          try { await Promise.resolve(window.__TK_BEFORE_SOFT_IMPORT__({ pageId: pageId, version: remoteVersion })); } catch (_) {}
        }
        imported = await importFreshModule(config.moduleUrl, remoteVersion);
      }
    } catch (err) {
      emit("tk:soft-update-import-error", {
        pageId: pageId,
        version: remoteVersion,
        error: String((err && err.message) || err || "import_failed")
      });
    }

    try {
      if (typeof window.__TK_PAGE_REFRESH__ === "function") {
        await Promise.resolve(window.__TK_PAGE_REFRESH__({
          pageId: pageId,
          version: remoteVersion,
          imported: imported,
          reason: "soft_update"
        }));
      }
    } catch (_) {}

    var restored = readStoredState(pageId);
    if (restored) {
      restoreInputs(restored);
      restoreUiState(restored);
      try {
        if (typeof hook.importState === "function") {
          hook.importState(restored.custom || null);
        }
      } catch (_) {}
    }

    writeVersion(pageId, remoteVersion);
    appliedVersionByPage[pageId] = remoteVersion;
    emit("tk:soft-update-done", {
      pageId: pageId,
      version: remoteVersion,
      imported: imported,
      meta: remoteMeta || null
    });
    inFlightByPage[pageId] = false;
  }

  async function checkRemote(config) {
    var pageId = config.pageId;
    var url = config.versionUrl || "./version.json";
    var res = await fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    var json = await res.json();
    var remoteVersion = String((json && (json.version || json.updatedAt)) || "").trim();
    if (!remoteVersion) return;

    var current = readVersion(pageId) || String(config.currentVersion || "");
    if (!current) {
      writeVersion(pageId, remoteVersion);
      return;
    }
    if (current === remoteVersion || appliedVersionByPage[pageId] === remoteVersion) return;

    if (toBoolean(config.forceReloadOnVersionChange, false)) {
      var maxAttempts = Math.max(1, Number(config.hardReloadMaxAttempts || 2));
      var cooldownMs = Math.max(3000, Number(config.hardReloadCooldownMs || 60000));
      var nowMs = Date.now();
      var guard = readReloadGuard(pageId);
      if (guard.version !== remoteVersion) {
        guard.version = remoteVersion;
        guard.attempts = 0;
        guard.lastAttemptAt = 0;
      }
      if (guard.attempts >= maxAttempts && (nowMs - guard.lastAttemptAt) < cooldownMs) {
        emit("tk:hard-reload-skipped", {
          pageId: pageId,
          version: remoteVersion,
          attempts: guard.attempts,
          maxAttempts: maxAttempts,
          cooldownMs: cooldownMs
        });
        return;
      }
      if (guard.attempts >= maxAttempts && (nowMs - guard.lastAttemptAt) >= cooldownMs) {
        guard.attempts = 0;
      }
      guard.attempts += 1;
      guard.lastAttemptAt = nowMs;
      writeReloadGuard(pageId, guard);
      captureSnapshot(pageId, remoteVersion);
      emit("tk:hard-reload-start", {
        pageId: pageId,
        version: remoteVersion,
        attempts: guard.attempts,
        maxAttempts: maxAttempts
      });
      try {
        var nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("_v", remoteVersion);
        nextUrl.searchParams.set("_rt", String(nowMs));
        window.location.replace(nextUrl.toString());
      } catch (_) {
        window.location.reload();
      }
      return;
    }

    await runSoftUpdate(config, remoteVersion, json || null);
  }

  function hardReloadToVersion(pageId, versionTag) {
    var key = String(pageId || "").trim();
    if (!key) return false;
    var targetVersion = String(versionTag || readVersion(key) || "").trim();
    if (!targetVersion) return false;
    captureSnapshot(key, targetVersion);
    emit("tk:hard-reload-start", {
      pageId: key,
      version: targetVersion,
      manual: true
    });
    try {
      var nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("_v", targetVersion);
      nextUrl.searchParams.set("_rt", String(Date.now()));
      window.location.replace(nextUrl.toString());
    } catch (_) {
      window.location.reload();
    }
    return true;
  }

  function boot(options) {
    var config = options || {};
    var pageId = String(config.pageId || "").trim();
    if (!pageId) return;

    var restored = readStoredState(pageId);
    if (restored) {
      try {
        restoreInputs(restored);
        restoreUiState(restored);
      } catch (_) {}
      try {
        var bootHook = customHooks[pageId] || {};
        if (typeof bootHook.importState === "function") {
          bootHook.importState(restored.custom || null);
        }
      } catch (_) {}
    }

    var storedVersion = readVersion(pageId);
    var currentVersion = String(config.currentVersion || "").trim();
    if (currentVersion && storedVersion !== currentVersion) {
      writeVersion(pageId, currentVersion);
    }

    scheduleIdleCleanupLegacyBrowserCache(pageId, currentVersion || storedVersion);

    var checkMs = Math.max(3000, Number(config.checkMs || 15000));
    var enabled = toBoolean(config.enabled, true);
    if (!enabled) return;

    var timer = null;
    var safeCheck = function () {
      checkRemote(config).catch(function (err) {
        emit("tk:soft-update-check-error", {
          pageId: pageId,
          error: String((err && err.message) || err || "check_failed")
        });
      });
    };
    safeCheck();
    timer = setInterval(safeCheck, checkMs);
    emit("tk:soft-runtime-ready", { pageId: pageId, checkMs: checkMs, timerActive: !!timer });
  }

  function registerStateHooks(pageId, hooks) {
    if (!pageId) return;
    customHooks[String(pageId)] = hooks || {};
  }

  function getLiveVersion(pageId) {
    var key = String(pageId || "").trim();
    if (!key) return "";
    return String(appliedVersionByPage[key] || readVersion(key) || "").trim();
  }

  window.TKRealtimeRuntime = {
    boot: boot,
    registerStateHooks: registerStateHooks,
    getLiveVersion: getLiveVersion,
    hardReloadToVersion: hardReloadToVersion
  };
})();
