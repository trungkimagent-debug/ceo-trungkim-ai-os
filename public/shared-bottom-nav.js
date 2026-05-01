(() => {
  const NAV_LEAVE_OPACITY = 0.96;
  const NAV_LEAVE_FRAME_DELAY = 2;
  const prefetchedUrls = new Set();
  let isNavigating = false;
  const rawCurrentPage = String(window.location.pathname || "")
    .split("/")
    .pop()
    .toLowerCase();
  const searchParams = new URLSearchParams(window.location.search || "");
  const pageAliasMap = new Map([
    ["thumay", "thumay"],
    ["thumay.html", "thumay"],
    ["thugop", "thugop"],
    ["thugop.html", "thugop"],
    ["pos", "pos"],
    ["pos.html", "pos"],
  ]);
  const currentPage = pageAliasMap.get(rawCurrentPage) || rawCurrentPage;

  if (searchParams.get("embed") === "1") return;

  const enabledPages = new Set([
    "thumay",
    "thugop",
    "pos"
  ]);

  if (!enabledPages.has(currentPage)) return;
  if (document.getElementById("thkdBottomNav")) return;

  const currentHash = String(window.location.hash || "").trim();

  function buildInternalHref(pathname) {
    const nextUrl = new URL(pathname, window.location.href);
    if (currentHash === "#" || currentHash === "#+" || currentHash === "#-") {
      nextUrl.hash = currentHash;
    }
    return nextUrl.toString();
  }

  const items = [
    {
      href: buildInternalHref("./thumay.html"),
      key: "thumay",
      label: "Thu máy",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"></rect><path d="M8 8h8M8 12h8M8 16h5"></path></svg>'
    },
    {
      href: buildInternalHref("./thugop.html"),
      key: "thugop",
      label: "Thu góp",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M12 7v10M8.5 10.5h5.2a2 2 0 1 1 0 4H9"></path></svg>'
    },
    {
      href: buildInternalHref("./pos.html"),
      key: "pos",
      label: "POS",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"></rect><path d="M3 10h18M8 15h3"></path></svg>'
    }
  ];

  const style = document.createElement("style");
  style.id = "thkdBottomNavStyle";
  style.textContent = `
    html.thkd-nav-leaving body{
      opacity:var(--thkd-nav-leave-opacity, .96);
      transition:opacity .08s linear;
    }
    @media (prefers-reduced-motion: reduce){
      html.thkd-nav-leaving body{
        transition:none;
      }
    }
    #thkdBottomNav{
      position:fixed;
      left:50%;
      transform:translateX(-50%);
      bottom:0;
      z-index:9999;
      width:min(100%, 560px);
      background:#ffffff;
      border-top:1px solid #e5e7eb;
      border-radius:0;
      box-shadow:none;
      padding:8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
      display:grid;
      grid-template-columns:repeat(3, minmax(0, 1fr));
      gap:8px;
    }
    #thkdBottomNav .thkd-nav-item{
      min-height:62px;
      border-radius:10px;
      border:1px solid transparent;
      color:#6b7280;
      text-decoration:none;
      display:flex;
      flex-direction:column;
      align-items:center;
      justify-content:center;
      gap:5px;
      font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      font-size:11px;
      font-weight:800;
      letter-spacing:.01em;
      transition:all .16s ease;
      user-select:none;
    }
    #thkdBottomNav .thkd-nav-item svg{
      width:19px;
      height:19px;
      fill:none;
      stroke:currentColor;
      stroke-width:2;
      stroke-linecap:round;
      stroke-linejoin:round;
      display:block;
    }
    #thkdBottomNav .thkd-nav-item:hover{
      color:#111827;
      background:#f9fafb;
      border-color:#e5e7eb;
    }
    #thkdBottomNav .thkd-nav-item.active{
      color:#111827;
      background:#fffbeb;
      border-color:#fcd34d;
      box-shadow:none;
    }
    #thkdBottomNav .thkd-nav-item:active{
      transform:scale(.98);
    }
    html.thkd-hide-bottom-nav #thkdBottomNav{
      display:none !important;
    }
    @media (max-width:640px){
      #thkdBottomNav{
        width:100%;
        left:0;
        transform:none;
        padding:6px;
        gap:6px;
        padding-bottom:calc(6px + env(safe-area-inset-bottom, 0px));
      }
      #thkdBottomNav .thkd-nav-item{
        min-height:58px;
        border-radius:12px;
        font-size:10px;
      }
      #thkdBottomNav .thkd-nav-item svg{
        width:18px;
        height:18px;
      }
    }
  `;
  document.head.appendChild(style);

  function prefetchHref(href) {
    if (!href) return;
    const u = new URL(href, window.location.href);
    if (u.origin !== window.location.origin) return;
    if (prefetchedUrls.has(u.href)) return;
    prefetchedUrls.add(u.href);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = u.href;
    link.as = "document";
    document.head.appendChild(link);
  }

  function navigateSmoothly(href) {
    if (!href || isNavigating) return;
    isNavigating = true;
    const nextUrl = new URL(href, window.location.href).toString();
    document.documentElement.style.setProperty("--thkd-nav-leave-opacity", String(NAV_LEAVE_OPACITY));
    document.documentElement.classList.add("thkd-nav-leaving");
    let frameCount = 0;
    const goNextPage = () => {
      frameCount += 1;
      if (frameCount < NAV_LEAVE_FRAME_DELAY) {
        window.requestAnimationFrame(goNextPage);
        return;
      }
      window.location.assign(nextUrl);
    };
    window.requestAnimationFrame(goNextPage);
  }

  window.addEventListener("pageshow", () => {
    document.documentElement.classList.remove("thkd-nav-leaving");
  });

  const nav = document.createElement("nav");
  nav.id = "thkdBottomNav";
  nav.setAttribute("aria-label", "Điều hướng module");

  for (const item of items) {
    const isActive = item.key === currentPage;
    const a = document.createElement("a");
    a.className = `thkd-nav-item${isActive ? " active" : ""}`;
    a.href = item.href;
    a.innerHTML = `${item.icon}<span>${item.label}</span>`;
    if (isActive) a.setAttribute("aria-current", "page");
    a.addEventListener("pointerenter", () => prefetchHref(a.href), { passive: true });
    a.addEventListener("pointerdown", () => prefetchHref(a.href), { passive: true });
    a.addEventListener("focus", () => prefetchHref(a.href), { passive: true });
    a.addEventListener("touchstart", () => prefetchHref(a.href), { passive: true });
    a.addEventListener("click", (ev) => {
      if (ev.defaultPrevented) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      if (a.target && a.target.toLowerCase() !== "_self") return;
      const next = new URL(a.href, window.location.href);
      const sameTarget =
        next.origin === window.location.origin &&
        next.pathname === window.location.pathname &&
        next.search === window.location.search &&
        next.hash === window.location.hash;
      if (sameTarget) return;
      ev.preventDefault();
      prefetchHref(a.href);
      navigateSmoothly(a.href);
    });
    nav.appendChild(a);
  }

  document.body.appendChild(nav);

  const basePaddingBottom = parseFloat(getComputedStyle(document.body).paddingBottom || "0") || 0;
  const navHeight = Math.ceil(nav.getBoundingClientRect().height || 84);
  const requiredPadding = Math.max(basePaddingBottom, navHeight + 10);
  document.documentElement.style.setProperty("--thkd-bottom-nav-offset", `${requiredPadding}px`);
  document.body.style.paddingBottom = `${requiredPadding}px`;
})();
