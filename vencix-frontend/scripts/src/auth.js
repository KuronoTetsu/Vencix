const container = document.getElementById('authContainer');

document.querySelectorAll('[data-action="register"]').forEach(btn => {
  btn.addEventListener('click', () => container.classList.add('right-panel-active'));
});
document.querySelectorAll('[data-action="login"]').forEach(btn => {
  btn.addEventListener('click', () => container.classList.remove('right-panel-active'));
});

// alternância de visibilidade de senha
document.querySelectorAll('.toggle-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.style.color = isPass ? 'var(--violet-2)' : '';
  });
});

// se já existe um token válido, não faz sentido ficar na tela de login
if (typeof isLoggedIn === 'function' && isLoggedIn()) {
  window.location.href = 'vencix-dashboard.html';
}

function showFormMessage(msgId, text, isError = false) {
  const msg = document.getElementById(msgId);
  if (!msg) return;
  msg.textContent = text;
  msg.classList.toggle('error', isError);
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 4000);
}

// aplica os erros de validação do backend (ex.: { email: "..." }) nos campos certos
function applyFieldErrors(errors, fieldMap) {
  if (!errors) return;
  Object.entries(fieldMap).forEach(([backendKey, inputId]) => {
    const input = document.getElementById(inputId);
    if (input && errors[backendKey]) {
      input.classList.add('invalid');
      input.title = errors[backendKey];
    }
  });
}

function clearFieldErrors(inputIds) {
  inputIds.forEach(id => {
    const input = document.getElementById(id);
    if (input) { input.classList.remove('invalid'); input.title = ''; }
  });
}

/* ============ Cadastro ============ */
const signUpForm = document.getElementById('signUpForm');

if (signUpForm) {
  signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!signUpForm.checkValidity()) {
      signUpForm.reportValidity();
      return;
    }

    clearFieldErrors(['su-name', 'su-email', 'su-pass']);

    const name = document.getElementById('su-name').value.trim();
    const email = document.getElementById('su-email').value.trim();
    const password = document.getElementById('su-pass').value;

    const submitBtn = signUpForm.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await Auth.register(name, email, password);
      showFormMessage('signUpMsg', 'Cadastro realizado! Faça login para continuar.');
      signUpForm.reset();
      // leva o usuário direto pro painel de login após o cadastro
      setTimeout(() => container.classList.remove('right-panel-active'), 1200);
    } catch (err) {
      applyFieldErrors(err.errors, { name: 'su-name', email: 'su-email', password: 'su-pass' });
      showFormMessage('signUpMsg', err.message || 'Não foi possível concluir o cadastro.', true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

/* ============ Login ============ */
const signInForm = document.getElementById('signInForm');

if (signInForm) {
  signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!signInForm.checkValidity()) {
      signInForm.reportValidity();
      return;
    }

    clearFieldErrors(['si-email', 'si-pass']);

    const email = document.getElementById('si-email').value.trim();
    const password = document.getElementById('si-pass').value;

    const submitBtn = signInForm.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await Auth.login(email, password);
      window.location.href = 'vencix-dashboard.html';
    } catch (err) {
      showFormMessage('signInMsg', err.message || 'E-mail ou senha inválidos.', true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById('si-email').focus();
}