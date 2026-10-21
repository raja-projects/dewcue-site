'use strict';
// Dewcue pricing: one currency at a time.
// Order: a saved choice, then a quick location lookup, then the India timezone, else USD.
// Paid plans: ask for an email, create a checkout on the licence server, then go to its Razorpay page.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  if (!document.querySelector('[data-pricing]')) return;
  const KEY = 'dewcue-currency';
  const API = 'https://api.dewcue.com';
  const GEO_URL = API + '/v1/geo';
  const PRICES = {
    USD: {free: '$0', monthly: '$4.99', yearly: '$39', lifetime: '$99', savings: 'Save 35%',
      premiumNote: {monthly: 'Billed monthly. Pay by card.', yearly: 'Billed yearly. Pay by card.'},
      lifetimeNote: 'Pay once by card. First 500 buyers.',
      paymentNote: 'Secure card checkout by Razorpay. Start free, with a 14-day Premium trial and no card needed.',
      switchLabel: 'In India? Pay in ₹ with UPI', other: 'INR'},
    INR: {free: '₹0', monthly: '₹199', yearly: '₹1,990', lifetime: '₹4,990', savings: 'Save 17%',
      premiumNote: {monthly: '+ 18% GST. Billed monthly. Pay with UPI or card.', yearly: '+ 18% GST. Billed yearly. Pay with UPI or card.'},
      lifetimeNote: '+ 18% GST. Pay once with UPI or card. First 500 buyers.',
      paymentNote: 'Secure UPI and card checkout by Razorpay. Start free, with a 14-day Premium trial and no card needed.',
      switchLabel: 'Paying from outside India? See USD prices', other: 'USD'}
  };
  let currency = 'USD';
  let billing = 'monthly';
  let chosen = false;
  let lifetimeSoldOut = false;

  function render() {
    const p = PRICES[currency];
    $$('[data-billing]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.billing === billing)));
    $$('[data-price="free"]').forEach(el => { el.textContent = p.free; });
    $$('[data-price="premium"]').forEach(el => { el.textContent = p[billing]; });
    $$('[data-price="lifetime"]').forEach(el => { el.textContent = p.lifetime; });
    $$('[data-premium-period]').forEach(el => { el.textContent = billing === 'monthly' ? '/ month' : '/ year'; });
    $$('[data-premium-note]').forEach(el => { el.textContent = p.premiumNote[billing]; });
    $$('[data-lifetime-note]').forEach(el => { el.textContent = lifetimeSoldOut ? 'All 500 Lifetime places are taken. Monthly and yearly are still open.' : p.lifetimeNote; });
    $$('[data-save-label]').forEach(el => { el.textContent = p.savings; });
    $$('[data-payment-note]').forEach(el => { el.textContent = p.paymentNote; });
    $$('[data-currency-only]').forEach(el => { el.hidden = el.dataset.currencyOnly !== currency; });
    $$('[data-currency-switch]').forEach(btn => {
      const arrow = btn.querySelector('svg');
      btn.textContent = p.switchLabel + ' ';
      if (arrow) btn.append(arrow);
    });
    $$('[data-buy="lifetime"]').forEach(btn => {
      btn.disabled = lifetimeSoldOut;
      btn.textContent = lifetimeSoldOut ? 'Lifetime is sold out' : 'Get Lifetime';
    });
  }
  function setCurrency(code) {
    if (!PRICES[code]) return;
    currency = code; render();
  }

  $$('[data-billing]').forEach(b => b.addEventListener('click', () => { billing = b.dataset.billing; render(); }));
  $$('[data-currency-switch]').forEach(btn => btn.addEventListener('click', () => {
    chosen = true;
    const next = PRICES[currency].other;
    try { localStorage.setItem(KEY, next); } catch (_) { /* storage unavailable */ }
    setCurrency(next);
  }));

  function fromTimezone() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta' ? 'INR' : 'USD';
    } catch (_) { return 'USD'; }
  }
  async function getJson(url, ms) {
    if (typeof fetch !== 'function') return null;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), ms);
    try {
      const res = await fetch(url, {signal: ctrl?.signal, credentials: 'omit', cache: 'no-store'});
      if (!res.ok) return null;
      return await res.json();
    } catch (_) { return null; } finally { clearTimeout(timer); }
  }
  async function fromGeo() {
    const data = await getJson(GEO_URL, 4000);
    const country = String(data?.country || '').toUpperCase();
    return country ? (country === 'IN' ? 'INR' : 'USD') : null;
  }
  async function pick() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (_) { /* storage unavailable */ }
    if (PRICES[saved]) { setCurrency(saved); return; }
    // Show the timezone guess straight away; a location answer (if any) takes priority.
    setCurrency(fromTimezone());
    const geo = await fromGeo();
    if (chosen) return;
    setCurrency(geo || fromTimezone());
  }

  // The licence server's offer list is the source of truth for prices and Lifetime places.
  function money(code, base) {
    const major = base / 100;
    if (code === 'INR') return '₹' + Math.round(major).toLocaleString('en-IN');
    return '$' + (Number.isInteger(major) ? String(major) : major.toFixed(2));
  }
  async function loadOffers() {
    const offers = await getJson(API + '/v1/offers', 8000);
    if (!offers || !offers.currencies) return;
    for (const code of Object.keys(PRICES)) {
      const rows = offers.currencies[code];
      if (!rows) continue;
      for (const plan of ['monthly', 'yearly', 'lifetime']) {
        if (rows[plan] && Number.isFinite(rows[plan].base)) PRICES[code][plan] = money(code, rows[plan].base);
      }
    }
    lifetimeSoldOut = offers.lifetimeRemaining === 0;
    render();
  }

  // Checkout
  const dialog = $('#buy-dialog');
  const form = $('#buy-form');
  const emailInput = $('#buy-email');
  const errorEl = $('[data-buy-error]');
  const submit = $('[data-buy-submit]');
  const submitLabel = submit ? submit.innerHTML : '';
  let order = null;

  function showError(text) {
    if (!errorEl) return;
    errorEl.textContent = text || '';
    errorEl.hidden = !text;
  }
  function busy(on) {
    if (!submit) return;
    submit.disabled = on;
    if (on) submit.textContent = 'Opening checkout…';
    else submit.innerHTML = submitLabel;
  }
  function openBuy(kind) {
    if (!dialog || typeof dialog.showModal !== 'function') {
      window.location.href = 'mailto:hello@dewcue.com?subject=' + encodeURIComponent('Dewcue Premium');
      return;
    }
    const plan = kind === 'lifetime' ? 'lifetime' : billing;
    const p = PRICES[currency];
    order = {plan, currency};
    const names = {monthly: 'Premium · Monthly', yearly: 'Premium · Yearly', lifetime: 'Lifetime · Pay once'};
    const period = {monthly: ' / month', yearly: ' / year', lifetime: ' once'}[plan];
    $('[data-buy-plan]', dialog).textContent = names[plan];
    $('[data-buy-price]', dialog).textContent = p[plan] + period + (currency === 'INR' ? ' + GST' : '');
    const gst = $('[data-buy-gst]', dialog);
    if (gst) gst.hidden = currency !== 'INR';
    showError(''); busy(false);
    dialog.showModal();
    document.body.classList.add('dialog-open');
    setTimeout(() => emailInput?.focus(), 30);
  }
  $$('[data-buy]').forEach(btn => btn.addEventListener('click', () => openBuy(btn.dataset.buy)));
  if (dialog) {
    $('[data-buy-close]', dialog)?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  }
  emailInput?.addEventListener('input', () => showError(''));
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!order) return;
    const email = emailInput.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please add a valid email. Your licence key is sent there.');
      emailInput.focus();
      return;
    }
    showError(''); busy(true);
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), 25000);
    let leaving = false;
    try {
      const res = await fetch(API + '/v1/checkout', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({email, plan: order.plan, currency: order.currency, newsletter: Boolean($('#buy-newsletter')?.checked)}),
        credentials: 'omit',
        signal: ctrl?.signal
      });
      const data = await res.json().catch(() => ({}));
      const url = String(data?.checkoutUrl || '');
      if (res.ok && /^https:\/\/api\.dewcue\.com\/checkout\/[a-f0-9]{32}$/.test(url)) {
        leaving = true;
        window.location.assign(url);
        return;
      }
      if (res.status === 409 && order.plan === 'lifetime' && /sold out/i.test(data?.error || '')) { lifetimeSoldOut = true; render(); }
      showError(data?.error || 'Checkout could not start just now. Please try again in a moment.');
    } catch (_) {
      showError('Checkout could not start just now. Please check your connection and try again.');
    } finally {
      clearTimeout(timer);
      if (!leaving) busy(false);
    }
  });

  render();
  pick();
  loadOffers();
})();
