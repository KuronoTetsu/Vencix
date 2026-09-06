/* ============================================================
   api.js — cliente central da API do VenciX
   Carregue este arquivo ANTES de auth.js e de dashb.js.
   ============================================================ */

// Ajuste para a URL real do backend quando for para produção.
const API_BASE_URL = 'http://127.0.0.1:5000/api';

// ─── Gestão de sessão ───────────────────────────────────────
// Os tokens JWT ficam em cookies HttpOnly gerenciados pelo backend —
// não são acessíveis ao JavaScript (proteção contra XSS).
// Armazenamos apenas uma flag não-sensível e dados de exibição no localStorage.
const SESSION_KEY = 'vencix-session';

function isLoggedIn() {
  return localStorage.getItem(SESSION_KEY) === '1';
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('vencix-user-name');
  localStorage.removeItem('vencix-user-email');
}

// ─── CSRF (Double Submit Cookie) ────────────────────────────
// O backend (Flask-JWT-Extended) grava o cookie não-HttpOnly `csrf_access_token`
// com o valor do CSRF token. O JS lê esse cookie e o reenvia no header
// X-CSRF-TOKEN — o servidor valida que os dois coincidem (padrão Double Submit).
function getCookie(name) {
  return document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(name + '='))
    ?.split('=').slice(1).join('=') ?? null;
}

// ─── Refresh token ──────────────────────────────────────────
// O refresh token também está em cookie HttpOnly — enviado automaticamente.
// O CSRF do refresh usa o cookie csrf_refresh_token (não-HttpOnly).
async function tryRefreshToken() {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': getCookie('csrf_refresh_token') || '',
      },
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Wrapper de fetch que:
 * - envia cookies HttpOnly automaticamente via credentials: 'include'
 * - injeta X-CSRF-TOKEN (lido do cookie não-HttpOnly) para requisições não-GET
 * - em caso de 401, tenta renovar o token UMA vez e refaz a chamada
 * - se não conseguir renovar, limpa a sessão e redireciona pro login
 * - já retorna o JSON parseado, ou lança um Error com .status e .errors
 */
async function apiFetch(path, options = {}, _isRetry = false) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  // Proteção CSRF: lê o token do cookie não-HttpOnly e o envia no header.
  // Requisições GET são seguras por design (não alteram estado), não precisam de CSRF.
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCookie('csrf_access_token');
    if (csrf) headers['X-CSRF-TOKEN'] = csrf;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',  // envia cookies HttpOnly automaticamente
  });

  if (res.status === 401 && !_isRetry) {
    const refreshed = await tryRefreshToken();
    if (refreshed) return apiFetch(path, options, true);
    clearSession();
    window.location.href = 'vencix-auth.html';
    return Promise.reject(new Error('Sessão expirada. Faça login novamente.'));
  }

  let data = null;
  try { data = await res.json(); } catch (_) { /* resposta sem corpo JSON */ }

  if (!res.ok) {
    // o backend usa duas formas pra erro: {"error": "..."} para falhas gerais
    // (login inválido, 404, etc.) e {"errors": {campo: "motivo"}} para validação
    // (cadastro, produtos). Aqui a gente cobre as duas, senão cai sempre na
    // mensagem genérica mesmo quando o backend já mandou o motivo certo.
    let message = 'Não foi possível completar a operação.';
    if (data && data.error) {
      message = data.error;
    } else if (data && data.errors) {
      message = Object.values(data.errors).join(' ');
    }
    const err = new Error(message);
    err.status = res.status;
    err.errors = data && data.errors; // erros de validação por campo, quando existirem
    throw err;
  }

  return data;
}

/* ================= Autenticação ================= */
const Auth = {
  async register(name, email, password) {
    return apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  async login(email, password) {
    // O backend define os cookies HttpOnly — o JSON de resposta contém só dados de exibição.
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.user) {
      localStorage.setItem('vencix-user-name',  data.user.name  || '');
      localStorage.setItem('vencix-user-email', data.user.email || '');
    }
    localStorage.setItem(SESSION_KEY, '1');  // flag não-sensível: sessão ativa
    return data;
  },

  async logout() {
    // Pede ao backend para limpar os cookies HttpOnly (o JS não consegue fazer isso sozinho).
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': getCookie('csrf_access_token') || '',
        },
        credentials: 'include',
      });
    } catch (_) { /* ignora erro de rede — limpa sessão local de qualquer jeito */ }
    clearSession();
    window.location.href = 'vencix-auth.html';
  },

  isLoggedIn,

  // Chame no topo de páginas protegidas (dashboard). Redireciona se não estiver logado.
  requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'vencix-auth.html';
      return false;
    }
    return true;
  },
};

/* ================= Produtos ================= */
const ProductsAPI = {
  list({ q, month } = {}) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (month) params.set('month', month);
    const qs = params.toString();
    return apiFetch(`/products${qs ? `?${qs}` : ''}`);
  },
  create(payload) {
    return apiFetch('/products', { method: 'POST', body: JSON.stringify(payload) });
  },
  update(id, payload) {
    return apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  remove(id) {
    return apiFetch(`/products/${id}`, { method: 'DELETE' });
  },
};
