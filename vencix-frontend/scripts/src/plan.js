const header = document.getElementById('site-header');
  document.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 20), { passive:true });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => { if (entry.isIntersecting){ entry.target.classList.add('in'); io.unobserve(entry.target); } });
  }, { threshold:0.12, rootMargin:'0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const parallaxEls = Array.from(document.querySelectorAll('[data-parallax]')).map(el => ({ el, factor: parseFloat(el.getAttribute('data-parallax')) }));
  let ticking = false;
  function updateParallax(){
    const y = window.scrollY;
    parallaxEls.forEach(({el, factor}) => { el.style.transform = `translate3d(0, ${y * factor}px, 0)`; });
    ticking = false;
  }
  function onScrollParallax(){ if (!ticking && !prefersReduced){ requestAnimationFrame(updateParallax); ticking = true; } }
  if (!prefersReduced){ document.addEventListener('scroll', onScrollParallax, { passive:true }); updateParallax(); }

  /* ============ toast ============ */
  let toastTimer = null;
  function showToast(msg){
    const toast = document.getElementById('toast');
    document.getElementById('toast-text').textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  /* ============ plans data ============ */
  const PLANS = {
    basico: { label: 'Básico', price: 69 },
    pro:    { label: 'Pro',    price: 169 }
  };
  let currentPlan = null;
  let currentMethod = null;

  const viewPlans = document.getElementById('view-plans');
  const viewCheckout = document.getElementById('view-checkout');
  const viewSuccess = document.getElementById('view-success');
  const methodPlaceholder = document.getElementById('method-placeholder');

  function switchView(view){
    [viewPlans, viewCheckout, viewSuccess].forEach(v => v.classList.add('hidden'));
    view.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hidePanel(el){ el.classList.remove('visible'); el.classList.add('hidden'); }
  function revealPanel(el){
    el.classList.remove('hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  }

  /* ============ plan selection ============ */
  document.querySelectorAll('[data-select-plan]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPlan = btn.dataset.selectPlan;
      const plan = PLANS[currentPlan];
      document.getElementById('co-plan-name').textContent = `Plano ${plan.label}`;
      document.getElementById('co-plan-price').innerHTML = `R$ ${plan.price}<span>/mês</span>`;
      resetMethodSelection();
      switchView(viewCheckout);
    });
  });
  document.getElementById('change-plan-btn').addEventListener('click', () => switchView(viewPlans));
  document.getElementById('back-to-plans').addEventListener('click', () => switchView(viewPlans));

  /* ============ method tabs — panel only appears after a method is clicked ============ */
  const panelCard = document.getElementById('panel-card');
  const panelPix = document.getElementById('panel-pix');

  function resetMethodSelection(){
    currentMethod = null;
    document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
    hidePanel(panelCard);
    hidePanel(panelPix);
    methodPlaceholder.classList.remove('hidden');
  }

  document.querySelectorAll('.method-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentMethod = tab.dataset.method;
      methodPlaceholder.classList.add('hidden');
      showMethodPanel();
    });
  });

  function showMethodPanel(){
    if (!currentPlan || !currentMethod) return;
    const plan = PLANS[currentPlan];
    if (currentMethod === 'pix'){
      hidePanel(panelCard);
      renderPix(plan);
      revealPanel(panelPix);
    } else {
      hidePanel(panelPix);
      document.getElementById('card-panel-title').textContent =
        currentMethod === 'debito' ? 'Pagamento no cartão de débito' : 'Pagamento no cartão de crédito';
      document.getElementById('card-submit-label').textContent = `Pagar R$ ${plan.price} no ${currentMethod === 'debito' ? 'débito' : 'crédito'}`;
      revealPanel(panelCard);
    }
  }

  /* ============ card input masks ============ */
  const cardNumberInput = document.getElementById('card-number');
  const cardBrandTag = document.getElementById('card-brand');
  cardNumberInput.addEventListener('input', () => {
    let digits = cardNumberInput.value.replace(/\D/g, '').slice(0, 16);
    cardNumberInput.value = digits.replace(/(.{4})/g, '$1 ').trim();
    cardBrandTag.textContent = detectBrand(digits);
  });
  function detectBrand(digits){
    if (/^4/.test(digits)) return digits.length ? 'Visa' : '';
    if (/^5[1-5]/.test(digits)) return 'Mastercard';
    if (/^3[47]/.test(digits)) return 'Amex';
    return digits.length >= 2 ? 'Cartão' : '';
  }

  const cardExpiryInput = document.getElementById('card-expiry');
  cardExpiryInput.addEventListener('input', () => {
    let v = cardExpiryInput.value.replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
    cardExpiryInput.value = v;
  });

  const cardCvvInput = document.getElementById('card-cvv');
  cardCvvInput.addEventListener('input', () => { cardCvvInput.value = cardCvvInput.value.replace(/\D/g, '').slice(0,4); });

  const cardCpfInput = document.getElementById('card-cpf');
  cardCpfInput.addEventListener('input', () => {
    let v = cardCpfInput.value.replace(/\D/g, '').slice(0, 11);
    v = v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    cardCpfInput.value = v;
  });

  /* ============ card form validation + submit ============ */
  function setFieldError(id, invalid){ document.getElementById(id).classList.toggle('invalid', invalid); }

  function isValidCPF(cpf){
    const digits = (cpf || '').replace(/\D/g, '');
    if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(digits.charAt(i), 10) * (10 - i);
    }
    let rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(digits.charAt(9), 10)) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(digits.charAt(i), 10) * (11 - i);
    }
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    return rest === parseInt(digits.charAt(10), 10);
  }

  function validateCardForm(){
    let valid = true;
    const digits = cardNumberInput.value.replace(/\D/g, '');
    const numOk = digits.length === 16;
    setFieldError('field-card-number', !numOk); if (!numOk) valid = false;

    const nameOk = document.getElementById('card-name').value.trim().length > 2;
    setFieldError('field-card-name', !nameOk); if (!nameOk) valid = false;

    const [mm, yy] = cardExpiryInput.value.split('/');
    const expOk = mm && yy && yy.length === 2 && Number(mm) >= 1 && Number(mm) <= 12;
    setFieldError('field-card-expiry', !expOk); if (!expOk) valid = false;

    const cvvOk = cardCvvInput.value.length >= 3;
    setFieldError('field-card-cvv', !cvvOk); if (!cvvOk) valid = false;

    const cpfOk = isValidCPF(cardCpfInput.value);
    setFieldError('field-card-cpf', !cpfOk); if (!cpfOk) valid = false;

    return valid;
  }

  const API_CHECKOUT_URL = window.API_BASE_URL ? `${window.API_BASE_URL}/checkout` : 'http://127.0.0.1:5000/api/checkout';
  let currentTxid = null;

  document.getElementById('card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateCardForm()) return;
    const btn = document.getElementById('card-submit-btn');
    const last4 = cardNumberInput.value.replace(/\D/g,'').slice(-4);
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      // Comunica com a rota segura de checkout
      const res = await fetch(`${API_CHECKOUT_URL}/card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: currentPlan,
          method: currentMethod,
        }),
      });

      if (!res.ok) {
        throw new Error('Falha no processamento com a operadora.');
      }

      showSuccess({
        method: currentMethod === 'debito' ? `Cartão de débito •••• ${last4}` : `Cartão de crédito •••• ${last4}`
      });
      document.getElementById('card-form').reset();
      cardBrandTag.textContent = '';
    } catch (err) {
      showToast(err.message || 'Erro ao processar pagamento.', 'danger');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  /* ============ PIX — BR Code (Copia e Cola) + QR ============ */
  let pixKeyConfig = '07722445535';
  const MERCHANT_NAME = 'VENCIX';
  const MERCHANT_CITY = 'SALVADOR';

  function tlv(id, value){ return `${id}${String(value.length).padStart(2,'0')}${value}`; }

  function crc16(payload){
    let result = 0xFFFF;
    for (let i = 0; i < payload.length; i++){
      result ^= (payload.charCodeAt(i) << 8);
      for (let j = 0; j < 8; j++){
        result = (result & 0x8000) ? ((result << 1) ^ 0x1021) : (result << 1);
        result &= 0xFFFF;
      }
    }
    return result.toString(16).toUpperCase().padStart(4, '0');
  }

  function buildPixPayload(txid, amount){
    const merchantAccount = tlv('00','br.gov.bcen.pix') + tlv('01', pixKeyConfig);
    const txidFormatted = (txid || ('VENCIX' + currentPlan)).toUpperCase().slice(0, 25);
    let payload =
      tlv('00','01') +
      tlv('01','11') +
      tlv('26', merchantAccount) +
      tlv('52','0000') +
      tlv('53','986') +
      tlv('54', amount.toFixed(2)) +
      tlv('58','BR') +
      tlv('59', MERCHANT_NAME) +
      tlv('60', MERCHANT_CITY) +
      tlv('62', tlv('05', txidFormatted)) +
      '6304';
    return payload + crc16(payload);
  }

  let pixQr = null;
  async function renderPix(plan){
    document.getElementById('pix-amount').textContent = `R$ ${plan.price.toFixed(2).replace('.', ',')}`;

    try {
      // Registra a transação Pix no backend para obter txid único
      const res = await fetch(`${API_CHECKOUT_URL}/pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: currentPlan }),
      });
      if (res.ok) {
        const data = await res.json();
        currentTxid = data.txid;
        if (data.pix_key) pixKeyConfig = data.pix_key;
      }
    } catch (_) {
      currentTxid = `VCX${Date.now()}`;
    }

    const payload = buildPixPayload(currentTxid, plan.price);
    document.getElementById('pix-code').value = payload;

    const qrBox = document.getElementById('pix-qrcode');
    qrBox.innerHTML = '';
    if (window.QRCode){
      pixQr = new QRCode(qrBox, { text: payload, width: 200, height: 200, colorDark: '#0E0A29', colorLight: '#ffffff' });
    }
  }

  document.getElementById('pix-copy-btn').addEventListener('click', async () => {
    const codeInput = document.getElementById('pix-code');
    try{
      await navigator.clipboard.writeText(codeInput.value);
    }catch(err){
      codeInput.removeAttribute('readonly');
      codeInput.select();
      document.execCommand('copy');
      codeInput.setAttribute('readonly', true);
    }
    showToast('Código Pix copiado!');
  });

  document.getElementById('pix-simulate-btn').addEventListener('click', async () => {
    if (currentTxid) {
      try {
        await fetch(`${API_CHECKOUT_URL}/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txid: currentTxid, status: 'approved' }),
        });
      } catch (_) {}
    }
    showSuccess({ method: 'Pix' });
  });

  /* ============ success view ============ */
  function showSuccess({ method }){
    const plan = PLANS[currentPlan];
    document.getElementById('sum-plan').textContent = `VenciX ${plan.label}`;
    document.getElementById('sum-amount').textContent = `R$ ${plan.price.toFixed(2).replace('.', ',')}/mês`;
    document.getElementById('sum-method').textContent = method;
    switchView(viewSuccess);
  }