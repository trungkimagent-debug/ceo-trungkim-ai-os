const demoSuppliers = [
  { id: 'demo-1', name: 'Apple Việt Nam Partner', code: 'NCC-APPLE', phone: '0900 000 001', contactName: 'Anh Minh', status: 'active', rating: 5, financials: { totalDebt: 185000000, overdueCount: 0, riskScore: 18, imeiImported: 320, returnCount: 2 } },
  { id: 'demo-2', name: 'Samsung Distributor HCM', code: 'NCC-SS-HCM', phone: '0900 000 002', contactName: 'Chị Lan', status: 'active', rating: 4, financials: { totalDebt: 98000000, overdueCount: 1, riskScore: 42, imeiImported: 210, returnCount: 5 } },
  { id: 'demo-3', name: 'Phụ kiện Kim Dung', code: 'NCC-PK-KD', phone: '0900 000 003', contactName: 'Anh Tài', status: 'paused', rating: 3, financials: { totalDebt: 145500000, overdueCount: 2, riskScore: 72, imeiImported: 0, returnCount: 8 } },
];

const money = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value || 0);
const shortMoney = (value) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format((value || 0) / 1000000)}tr`;
const tokenKey = 'trungkim_os_token';
const state = { suppliers: demoSuppliers, token: localStorage.getItem(tokenKey) || '' };

const el = (id) => document.getElementById(id);
const statusLabel = el('syncStatus');
const tokenInput = el('tokenInput');
if (state.token) tokenInput.value = state.token;

function renderKpis(summary) {
  const data = summary || {
    totalSuppliers: state.suppliers.length,
    totalDebt: state.suppliers.reduce((s, x) => s + (x.financials?.totalDebt || 0), 0),
    overdueCount: state.suppliers.reduce((s, x) => s + (x.financials?.overdueCount || 0), 0),
    highRiskSuppliers: state.suppliers.filter(x => (x.financials?.riskScore || 0) >= 60).length,
  };
  el('kpiSuppliers').textContent = data.totalSuppliers ?? 0;
  el('kpiDebt').textContent = shortMoney(data.totalDebt || 0);
  el('kpiOverdue').textContent = data.overdueCount ?? 0;
  el('kpiRisk').textContent = data.highRiskSuppliers ?? 0;
}

function supplierCard(s) {
  const f = s.financials || {};
  const risk = Math.min(100, f.riskScore || 0);
  return `
    <article class="supplier-item">
      <div class="supplier-main">
        <h3>${s.name || 'Chưa đặt tên'}</h3>
        <div class="supplier-meta">
          <span class="status ${s.status || 'active'}">${statusText(s.status)}</span>
          <span>${s.code || 'Chưa có mã'}</span>
          <span>${s.phone || 'Chưa có SĐT'}</span>
          <span>${s.contactName || 'Chưa có liên hệ'}</span>
          <span>⭐ ${s.rating || 5}/5</span>
        </div>
      </div>
      <div class="supplier-money">
        <span>Công nợ</span>
        <strong>${money(f.totalDebt || 0)}</strong>
        <small>${f.overdueCount || 0} quá hạn · ${f.returnCount || 0} trả hàng · ${f.imeiImported || 0} IMEI</small>
        <div class="risk-bar" title="Risk ${risk}/100"><span style="width:${risk}%"></span></div>
      </div>
    </article>`;
}
function statusText(status = 'active') {
  return ({ active: 'Đang hợp tác', paused: 'Tạm dừng', blacklisted: 'Blacklist' })[status] || status;
}
function renderSuppliers() {
  const q = el('supplierSearch').value.trim().toLowerCase();
  const filtered = state.suppliers.filter(s => [s.name, s.code, s.phone, s.contactName].some(v => String(v || '').toLowerCase().includes(q)));
  el('supplierList').innerHTML = filtered.map(supplierCard).join('') || '<p>Chưa có NCC phù hợp.</p>';
  renderKpis();
}
async function api(path, options = {}) {
  if (!state.token) throw new Error('Chưa có token');
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.token}`, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
async function sync() {
  if (!state.token) { statusLabel.textContent = 'Demo mode'; renderSuppliers(); return; }
  statusLabel.textContent = 'Đang đồng bộ...';
  try {
    const [summary, suppliers] = await Promise.all([api('/suppliers/summary'), api('/suppliers')]);
    state.suppliers = suppliers;
    statusLabel.textContent = 'Dữ liệu thật';
    statusLabel.className = 'pill ok';
    renderKpis(summary);
    renderSuppliers();
  } catch (err) {
    statusLabel.textContent = `Lỗi: ${err.message}`;
    statusLabel.className = 'pill bad';
    renderSuppliers();
  }
}

el('tokenForm').addEventListener('submit', (event) => {
  event.preventDefault();
  state.token = tokenInput.value.trim();
  if (state.token) localStorage.setItem(tokenKey, state.token); else localStorage.removeItem(tokenKey);
  sync();
});
el('supplierSearch').addEventListener('input', renderSuppliers);
el('supplierForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = el('formMessage');
  const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
  payload.paymentTermDays = Number(payload.paymentTermDays || 0);
  payload.creditLimit = Number(payload.creditLimit || 0);
  payload.rating = Number(payload.rating || 5);
  if (!state.token) {
    state.suppliers.unshift({ id: crypto.randomUUID(), ...payload, financials: { totalDebt: 0, overdueCount: 0, riskScore: 0, imeiImported: 0, returnCount: 0 } });
    message.textContent = 'Đã thêm demo. Kết nối token để lưu lên Firebase thật.';
    event.currentTarget.reset();
    renderSuppliers();
    return;
  }
  try {
    await api('/suppliers', { method: 'POST', body: JSON.stringify(payload) });
    message.textContent = 'Đã lưu NCC lên hệ thống.';
    event.currentTarget.reset();
    await sync();
  } catch (err) {
    message.textContent = `Không lưu được: ${err.message}`;
  }
});
sync();
