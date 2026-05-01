(function () {
  "use strict";

  function getPathname() {
    try { return String(window.location.pathname || ""); } catch (_) { return ""; }
  }

  function getPageFromPath(pathname) {
    var file = String(pathname || "").split("/").pop() || "";
    if (!file) return "index";
    var noQuery = file.split("?")[0].trim();
    if (!noQuery) return "index";
    var dot = noQuery.lastIndexOf(".");
    return dot > 0 ? noQuery.slice(0, dot) : noQuery;
  }

  function inferModuleUrl() {
    try {
      var scripts = document.querySelectorAll('script[type="module"][src]');
      for (var i = 0; i < scripts.length; i += 1) {
        var src = String(scripts[i].getAttribute("src") || "").trim();
        if (!src) continue;
        if (src.indexOf("http://") === 0 || src.indexOf("https://") === 0) continue;
        if (src.indexOf("./") === 0 || src.indexOf("/") === 0) return src;
      }
    } catch (_) {}
    return "";
  }

  function toBool(v, fallback) {
    if (v === undefined || v === null) return !!fallback;
    if (typeof v === "boolean") return v;
    var s = String(v).trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
    if (s === "0" || s === "false" || s === "no" || s === "off") return false;
    return !!fallback;
  }

  function mergedConfig() {
    var pathname = getPathname();
    var inferredPage = getPageFromPath(pathname);
    var globalCfg = (window.__TK_RT_ROLLOUT__ && typeof window.__TK_RT_ROLLOUT__ === "object") ? window.__TK_RT_ROLLOUT__ : {};
    var moduleUrl = globalCfg.moduleUrl || inferModuleUrl();

    return {
      pageId: String(globalCfg.pageId || inferredPage),
      currentVersion: String(globalCfg.currentVersion || window.__TK_APP_VERSION__ || ""),
      versionUrl: String(globalCfg.versionUrl || "./version.json"),
      checkMs: Math.max(3000, Number(globalCfg.checkMs || 15000)),
      enabled: toBool(globalCfg.enabled, true),
      forceReloadOnVersionChange: toBool(globalCfg.forceReloadOnVersionChange, false),
      enableModuleImport: toBool(globalCfg.enableModuleImport, true),
      moduleUrl: String(moduleUrl || ""),
      hardReloadMaxAttempts: Math.max(1, Number(globalCfg.hardReloadMaxAttempts || 2)),
      hardReloadCooldownMs: Math.max(3000, Number(globalCfg.hardReloadCooldownMs || 60000))
    };
  }

  function bootWhenReady() {
    if (!window.TKRealtimeRuntime || typeof window.TKRealtimeRuntime.boot !== "function") return;
    try {
      var cfg = mergedConfig();
      window.TKRealtimeRuntime.boot(cfg);
      window.dispatchEvent(new CustomEvent("tk:bootstrap-ready", { detail: cfg }));
    } catch (err) {
      try {
        window.dispatchEvent(new CustomEvent("tk:bootstrap-error", {
          detail: { error: String((err && err.message) || err || "bootstrap_failed") }
        }));
      } catch (_) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootWhenReady, { once: true });
  } else {
    bootWhenReady();
  }
})();
