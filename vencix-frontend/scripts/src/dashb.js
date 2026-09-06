/* ============ guarda de autenticação (roda primeiro) ============ */
if (!Auth.requireAuth()) {
  // requireAuth já redireciona para vencix-auth.html; interrompe o resto do script
  throw new Error('Não autenticado.');
}

// Cobre o caso de "voltar" pelo navegador depois de deslogar: em alguns
// navegadores, o botão voltar restaura a página inteira da memória (bfcache)
// sem executar o script de novo, então o requireAuth() acima não roda.
// Esse listener pega justamente essa restauração e revalida a sessão.
window.addEventListener('pageshow', (event) => {
  if (event.persisted && !Auth.isLoggedIn()) {
    window.location.href = 'vencix-auth.html';
  }
});

const header = document.getElementById('site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 20);
document.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ============ reveal on scroll ============ */
const revealEls = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
revealEls.forEach(el => io.observe(el));

/* ============ parallax (hero blobs) ============ */
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const parallaxEls = Array.from(document.querySelectorAll('[data-parallax]')).map(el => ({
  el, factor: parseFloat(el.getAttribute('data-parallax'))
}));
let ticking = false;
function updateParallax() {
  const y = window.scrollY;
  parallaxEls.forEach(({ el, factor }) => { el.style.transform = `translate3d(0, ${y * factor}px, 0)`; });
  ticking = false;
}
function onScrollParallax() { if (!ticking && !prefersReduced) { requestAnimationFrame(updateParallax); ticking = true; } }
if (!prefersReduced) { document.addEventListener('scroll', onScrollParallax, { passive: true }); updateParallax(); }

/* ============ helpers ============ */
function formatDateBR(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/* ============ estado local (espelha a última resposta da API) ============ */
let currentProducts = [];
let editingId = null;

/* ============ DOM refs ============ */
const form = document.getElementById('product-form');
const nameInput = document.getElementById('product-name');
const eanInput = document.getElementById('ean-code');
const dateInput = document.getElementById('expiry-date');
const qtyInput = document.getElementById('quantity');
const submitBtn = document.getElementById('submit-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const formTitle = document.getElementById('form-title');
const editTag = document.getElementById('edit-tag');
const formMsg = document.getElementById('form-msg');
const formMsgText = document.getElementById('form-msg-text');
const searchInput = document.getElementById('search-input');
const monthSelect = document.getElementById('month-select');
const tbody = document.getElementById('products-table-body');
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toast-icon');
const toastText = document.getElementById('toast-text');
const logoutBtn = document.getElementById('logout-link'); // link "Sair" já existente no header do dashboard

const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>';

/* ============ dados do usuário logado (nome/e-mail vêm do login) ============ */
document.addEventListener('DOMContentLoaded', () => {
  const emailChip = document.getElementById('user-email-chip');
  const userName = localStorage.getItem('vencix-user-name');
  const userEmail = localStorage.getItem('vencix-user-email');
  if (emailChip) emailChip.textContent = userName || userEmail || '';
});

// intercepta o link "Sair": precisa limpar os tokens antes de navegar, senão a sessão
// continuaria "válida" no localStorage mesmo após o clique.
logoutBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  Auth.logout();
});

/* ============ month select (rolling 12 months) ============ */
const today = new Date();
const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function buildMonthOptions() {
  let html = '<option value="">Todos os meses</option>';
  const base = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = 0; i < 12; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    html += `<option value="${value}">${MONTHS_PT[d.getMonth()]} ${d.getFullYear()}</option>`;
  }
  monthSelect.innerHTML = html;
}
buildMonthOptions();

/* ============ toast ============ */
let toastTimer = null;
function showToast(message, type = 'success') {
  toast.className = 'toast show ' + type;
  toastIcon.innerHTML = type === 'success' ? ICON_CHECK : ICON_TRASH;
  toastText.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ============ validação client-side (UX — o backend sempre revalida) ============ */
function setFieldError(fieldId, invalid) {
  document.getElementById(fieldId).classList.toggle('invalid', invalid);
}
function validateForm() {
  let valid = true;
  const nameOk = nameInput.value.trim().length > 0;
  setFieldError('field-name', !nameOk); if (!nameOk) valid = false;

  const eanVal = eanInput.value.trim();
  const eanOk = eanVal === '' || /^[0-9]{8,13}$/.test(eanVal);
  setFieldError('field-ean', !eanOk); if (!eanOk) valid = false;

  const dateOk = dateInput.value !== '';
  setFieldError('field-date', !dateOk); if (!dateOk) valid = false;

  const qtyOk = qtyInput.value !== '' && Number(qtyInput.value) >= 1;
  setFieldError('field-qty', !qtyOk); if (!qtyOk) valid = false;

  return valid;
}
// mapeia nomes de campo que o backend retorna para os ids dos inputs no form
function applyServerErrors(errors) {
  if (!errors) return;
  if (errors.name) setFieldError('field-name', true);
  if (errors.ean) setFieldError('field-ean', true);
  if (errors.expiry) setFieldError('field-date', true);
  if (errors.quantity) setFieldError('field-qty', true);
}

/* ============ render ============ */
function updateKpis(kpis) {
  document.getElementById('kpi-total').textContent = kpis.total;
  document.getElementById('kpi-safe').textContent = kpis.safe;
  document.getElementById('kpi-warn').textContent = kpis.warn;
  document.getElementById('kpi-danger').textContent = kpis.danger;
}

function renderRows(list) {
  if (list.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6" style="border:none; background:transparent;">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 7l2-4h14l2 4"/><path d="M9 11a3 3 0 006 0"/></svg>
          <p>Nenhum produto encontrado para esse filtro.</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => `
    <tr class="row-enter" data-id="${p.id}">
      <td>${escapeHtml(p.name)}</td>
      <td class="ean-mono">${p.ean ? escapeHtml(p.ean) : '—'}</td>
      <td>${formatDateBR(p.expiry)}</td>
      <td>${p.quantity}</td>
      <td><span class="status-badge ${p.status.cls}"><span class="sdot"></span>${p.status.label}</span></td>
      <td>
        <span class="row-actions">
          <button class="icon-btn ${editingId === p.id ? 'editing' : ''}" data-action="edit" data-id="${p.id}" aria-label="Editar produto" title="Editar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>
          </button>
          <button class="icon-btn danger" data-action="delete" data-id="${p.id}" aria-label="Excluir produto" title="Excluir">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg>
          </button>
        </span>
      </td>
    </tr>`).join('');

  requestAnimationFrame(() => {
    tbody.querySelectorAll('tr.row-enter').forEach((tr, i) => {
      setTimeout(() => tr.classList.remove('row-enter'), i * 35);
    });
  });
}

// busca a lista atual no backend (filtros + KPIs já vêm calculados do servidor)
async function loadProducts() {
  try {
    const data = await ProductsAPI.list({
      q: searchInput.value.trim(),
      month: monthSelect.value,
    });
    currentProducts = data.products;
    updateKpis(data.kpis);
    renderRows(currentProducts);
  } catch (err) {
    showToast(err.message || 'Erro ao carregar produtos.', 'danger');
  }
}

/* ============ edit mode ============ */
function enterEditMode(product) {
  editingId = product.id;
  nameInput.value = product.name;
  eanInput.value = product.ean || '';
  dateInput.value = product.expiry;
  qtyInput.value = product.quantity;
  formTitle.textContent = 'Editar produto';
  editTag.style.display = 'inline-block';
  submitBtn.textContent = 'Salvar alterações';
  cancelEditBtn.style.display = 'inline-flex';
  formMsg.classList.remove('show');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  nameInput.focus();
}
function exitEditMode() {
  editingId = null;
  form.reset();
  qtyInput.value = 1;
  formTitle.textContent = 'Cadastrar produto';
  editTag.style.display = 'none';
  submitBtn.textContent = 'Cadastrar produto';
  cancelEditBtn.style.display = 'none';
  ['field-name', 'field-ean', 'field-date', 'field-qty'].forEach(id => setFieldError(id, false));
}
cancelEditBtn.addEventListener('click', () => exitEditMode());

/* ============ form submit ============ */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const payload = {
    name: nameInput.value.trim(),
    ean: eanInput.value.trim(),
    expiry: dateInput.value,
    quantity: Number(qtyInput.value),
  };

  submitBtn.disabled = true;
  try {
    if (editingId) {
      await ProductsAPI.update(editingId, payload);
      formMsgText.textContent = 'Produto atualizado!';
      showToast('Produto atualizado com sucesso.', 'success');
      exitEditMode();
    } else {
      await ProductsAPI.create(payload);
      formMsgText.textContent = 'Produto cadastrado!';
      showToast('Produto cadastrado com sucesso.', 'success');
      form.reset();
      qtyInput.value = 1;
      nameInput.focus();
    }
    formMsg.classList.add('show');
    setTimeout(() => formMsg.classList.remove('show'), 3000);
    await loadProducts();
  } catch (err) {
    applyServerErrors(err.errors);
    showToast(err.message || 'Não foi possível salvar o produto.', 'danger');
  } finally {
    submitBtn.disabled = false;
  }
});

/* ============ table actions (edit / delete) ============ */
tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('.icon-btn');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const product = currentProducts.find(p => p.id === id);
  if (!product) return;

  if (btn.dataset.action === 'edit') {
    enterEditMode(product);
    renderRows(currentProducts);
  } else if (btn.dataset.action === 'delete') {
    if (confirm(`Excluir "${product.name}" do estoque?`)) {
      try {
        await ProductsAPI.remove(id);
        if (editingId === id) exitEditMode();
        showToast('Produto excluído.', 'danger');
        await loadProducts();
      } catch (err) {
        showToast(err.message || 'Não foi possível excluir o produto.', 'danger');
      }
    }
  }
});

/* ============ filtros (com debounce na busca por texto) ============ */
let searchDebounce = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadProducts, 300);
});
monthSelect.addEventListener('change', loadProducts);

/* ============ init ============ */
loadProducts();