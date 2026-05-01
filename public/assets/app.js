const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || 'dev';
const badge = document.getElementById('apiStatus');

if (badge) {
  fetch('/api/health', { cache: 'no-store' })
    .then((res) => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
    .then((data) => {
      badge.textContent = `API Online · v${data.version || '1.x'}`;
      badge.classList.add('ok');
    })
    .catch(() => {
      badge.textContent = 'API cần cấu hình/deploy';
      badge.classList.add('bad');
    });
}

const bindQuickMenu = () => {
  const homeToggle = document.querySelector('.home-toggle');
  const bottomMenu = document.querySelector('.bottom-menu');
  const quickMenu = document.getElementById('quickMenu');

  const closeQuickMenu = () => {
    bottomMenu?.classList.remove('is-open');
    homeToggle?.setAttribute('aria-expanded', 'false');
    quickMenu?.setAttribute('aria-hidden', 'true');
  };

  homeToggle?.addEventListener('click', () => {
    const isOpen = bottomMenu?.classList.toggle('is-open') || false;
    homeToggle.setAttribute('aria-expanded', String(isOpen));
    quickMenu?.setAttribute('aria-hidden', String(!isOpen));
  });

  quickMenu?.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeQuickMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeQuickMenu();
  });
};

const updateCenter = document.getElementById('updateCenter');
const updateButton = document.getElementById('updateButton');
const versionText = document.getElementById('versionText');
let availableVersion = null;
let updateBusy = false;

const setUpdateState = (state, text) => {
  updateCenter?.setAttribute('data-state', state);
  if (versionText && text) versionText.textContent = text;
};

const swapHeadAssets = (nextDoc, version) => {
  const nextLinks = [...nextDoc.querySelectorAll('link[rel="stylesheet"]')];
  const currentLinks = [...document.querySelectorAll('link[rel="stylesheet"]')];

  currentLinks.forEach((link) => link.remove());
  nextLinks.forEach((link) => {
    const clone = link.cloneNode(true);
    const href = new URL(clone.getAttribute('href'), location.origin);
    href.searchParams.set('v', version);
    clone.setAttribute('href', href.pathname + href.search);
    document.head.appendChild(clone);
  });
};

const runNextScripts = (nextDoc, version) => {
  document.querySelectorAll('script[src]').forEach((script) => script.remove());
  [...nextDoc.querySelectorAll('script[src]')].forEach((script) => {
    const clone = document.createElement('script');
    const src = new URL(script.getAttribute('src'), location.origin);
    src.searchParams.set('v', version);
    clone.src = src.pathname + src.search;
    clone.defer = true;
    document.body.appendChild(clone);
  });
};

const applySoftUpdate = async () => {
  if (!availableVersion || updateBusy) return;
  updateBusy = true;
  setUpdateState('updating', 'Đang nâng cấp...');

  try {
    const res = await fetch(`/?v=${encodeURIComponent(availableVersion)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const nextDoc = new DOMParser().parseFromString(html, 'text/html');
    const nextVersion = nextDoc.querySelector('meta[name="app-version"]')?.content || availableVersion;

    document.querySelector('meta[name="app-version"]')?.setAttribute('content', nextVersion);
    document.title = nextDoc.title;
    swapHeadAssets(nextDoc, nextVersion);
    document.body.innerHTML = nextDoc.body.innerHTML;
    history.replaceState({}, '', location.pathname + location.search + location.hash);
    runNextScripts(nextDoc, nextVersion);
  } catch (error) {
    updateBusy = false;
    setUpdateState('error', 'Lỗi nâng cấp · bấm lại');
    console.error('Soft update failed', error);
  }
};

const checkVersion = async () => {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const latest = data.version || data.label;
    if (!latest) return;

    if (latest !== APP_VERSION) {
      availableVersion = latest;
      setUpdateState('available', `Có bản mới ${latest} · bấm nâng cấp`);
    } else {
      setUpdateState('current', `v${APP_VERSION}`);
    }
  } catch (error) {
    setUpdateState('error', `v${APP_VERSION} · lỗi kiểm tra`);
  }
};

bindQuickMenu();
updateButton?.addEventListener('click', applySoftUpdate);
checkVersion();
setInterval(checkVersion, 30000);
