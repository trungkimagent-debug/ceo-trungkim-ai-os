const badge = document.getElementById('apiStatus');
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
