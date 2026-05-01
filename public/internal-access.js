export const PUBLIC_ENTRY_URL = '/1';
export const POS_SESSION_TOKEN_STORAGE_KEY = 'thkd_pos_session_token';
export const INTERNAL_HASHES = new Set(['#', '#+', '#-']);

export function hasStoredInternalSession() {
  try {
    return Boolean(String(localStorage.getItem(POS_SESSION_TOKEN_STORAGE_KEY) || '').trim());
  } catch {
    return false;
  }
}

export function hasInternalMarker(hash = window.location.hash) {
  return INTERNAL_HASHES.has(String(hash || '').trim());
}

export function redirectToPublicEntry() {
  if (window.top === window.self) {
    window.location.replace(`${PUBLIC_ENTRY_URL}?_rt=${Date.now()}`);
  }
}

export function ensureInternalClientAccess({ allowHash = true, allowSession = true } = {}) {
  const allowed = (allowHash && hasInternalMarker()) || (allowSession && hasStoredInternalSession());
  if (!allowed) {
    redirectToPublicEntry();
    throw new Error('INTERNAL_ACCESS_REQUIRED');
  }
  return true;
}

export function buildInternalGuardInline() {
  return `(function(){try{var token=String(localStorage.getItem('${POS_SESSION_TOKEN_STORAGE_KEY}')||'').trim();var hash=String(window.location.hash||'').trim();if(!token&&hash!=='#'&&hash!=='#+'&&hash!=='#-'){window.location.replace('${PUBLIC_ENTRY_URL}?_rt='+Date.now());}}catch(_){window.location.replace('${PUBLIC_ENTRY_URL}?_rt='+Date.now());}})();`;
}
