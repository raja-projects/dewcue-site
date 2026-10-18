'use strict';
// DewCue pricing: USD first, one currency at a time.
// Order: a saved choice, then a quick location lookup, then the India timezone, else USD.
(() => {
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  if (!document.querySelector('[data-pricing]')) return;
  const KEY = 'dewcue-currency';
  const GEO_URL = 'https://api.dewcue.com/v1/geo';
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

  function render() {
    const p = PRICES[currency];
    $$('[data-billing]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.billing === billing)));
    $$('[data-price="free"]').forEach(el => { el.textContent = p.free; });
    $$('[data-price="premium"]').forEach(el => { el.textContent = p[billing]; });
    $$('[data-price="lifetime"]').forEach(el => { el.textContent = p.lifetime; });
    $$('[data-premium-period]').forEach(el => { el.textContent = billing === 'monthly' ? '/ month' : '/ year'; });
    $$('[data-premium-note]').forEach(el => { el.textContent = p.premiumNote[billing]; });
    $$('[data-lifetime-note]').forEach(el => { el.textContent = p.lifetimeNote; });
    $$('[data-save-label]').forEach(el => { el.textContent = p.savings; });
    $$('[data-payment-note]').forEach(el => { el.textContent = p.paymentNote; });
    $$('[data-currency-only]').forEach(el => { el.hidden = el.dataset.currencyOnly !== currency; });
    $$('[data-currency-switch]').forEach(btn => {
      const arrow = btn.querySelector('svg');
      btn.textContent = p.switchLabel + ' ';
      if (arrow) btn.append(arrow);
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
  async function fromGeo() {
    if (typeof fetch !== 'function') return null;
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), 1500);
    try {
      const res = await fetch(GEO_URL, {signal: ctrl?.signal, credentials: 'omit', cache: 'no-store'});
      if (!res.ok) return null;
      const data = await res.json();
      const country = String(data?.country || '').toUpperCase();
      return country ? (country === 'IN' ? 'INR' : 'USD') : null;
    } catch (_) { return null; } finally { clearTimeout(timer); }
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
  render();
  pick();
})();
