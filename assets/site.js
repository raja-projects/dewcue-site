'use strict';
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  let toastTimeout;
  function announce(text) {
    const el = $('#toast');
    if (!el) return;
    clearTimeout(toastTimeout);
    el.textContent = text;
    el.hidden = false;
    toastTimeout = setTimeout(() => { el.hidden = true; }, 4200);
  }
  const menuToggle = $('.menu-toggle');
  const mobileMenu = $('#mobile-menu');
  function closeMenu() {
    if (!menuToggle || !mobileMenu) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open menu');
    mobileMenu.hidden = true;
  }
  menuToggle?.addEventListener('click', () => {
    const opening = mobileMenu.hidden;
    mobileMenu.hidden = !opening;
    menuToggle.setAttribute('aria-expanded', String(opening));
    menuToggle.setAttribute('aria-label', opening ? 'Close menu' : 'Open menu');
  });
  mobileMenu?.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobileMenu && !mobileMenu.hidden) {
      closeMenu(); menuToggle.focus();
    }
  });
  const desktopQuery = window.matchMedia('(min-width: 901px)');
  desktopQuery.addEventListener?.('change', event => { if (event.matches) closeMenu(); });

  function openDialog(id) {
    const dialog = $(id);
    if (!dialog) return;
    closeMenu();
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      document.body.classList.add('dialog-open');
    } else {
      window.location.href = ($('a[href$="contact/"]')?.href || 'mailto:hello@dewcue.com');
    }
  }
  $$('[data-install]').forEach(button => button.addEventListener('click', () => openDialog('#install-dialog')));
  $$('dialog').forEach(dialog => {
    $('[data-close-dialog]', dialog)?.addEventListener('click', () => dialog.close());
    $$('[data-close-on-link]', dialog).forEach(link => link.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  });

  function keyboardTabs(buttons, select) {
    buttons.forEach((button, index) => button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault();
      select(buttons[next]);
      buttons[next].focus();
    }));
  }
  const featureTabs = $$('[data-feature-tab]');
  function selectFeature(button) {
    featureTabs.forEach(tab => {
      const selected = tab === button;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !selected;
    });
  }
  featureTabs.forEach(button => button.addEventListener('click', () => selectFeature(button)));
  keyboardTabs(featureTabs, selectFeature);

  // The website demo stores its examples only in this page's memory.
  // It does not call the extension, schedule notifications or request permissions.
  const initialTasks = [
    {id: 0, title: 'Drink a little water', time: '10:30 AM · Every day', group: 'today', tag: 'You', tone: 'mint', done: false},
    {id: 1, title: 'Send the proposal', time: '11:00 AM · Today', group: 'today', tag: 'Work', tone: '', done: false},
    {id: 2, title: 'A moment away from the screen', time: '12:00 PM · Every day', group: 'today', tag: 'You', tone: 'peach', done: false},
    {id: 3, title: 'Call mom', time: 'Tomorrow · 6:00 PM', group: 'upcoming', tag: 'Life', tone: 'mint', done: false},
    {id: 4, title: 'Check back on the proposal', time: 'Tomorrow · 10:00 AM', group: 'upcoming', tag: 'Work', tone: '', done: false}
  ];
  let tasks = initialTasks.map(task => ({...task}));
  let activeDemo = 'today';
  let nextId = 5;
  const demoList = $('#demo-list');
  const demoTabs = $$('[data-demo-tab]');
  function createIcon(type) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'icon'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    if (type === 'clock') {
      const circle = document.createElementNS(svg.namespaceURI, 'circle');
      circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '9'); svg.append(circle);
    }
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', type === 'check' ? 'm5 12 4 4L19 6' : 'M12 7v5l3 2');
    svg.append(path); return svg;
  }
  function renderDemo() {
    if (!demoList) return;
    const visible = tasks.filter(task => activeDemo === 'done' ? task.done : !task.done && task.group === activeDemo);
    const fragment = document.createDocumentFragment();
    visible.forEach(task => {
      const row = document.createElement('div'); row.className = 'reminder-row' + (task.done ? ' is-done' : '');
      const check = document.createElement('button'); check.type = 'button'; check.className = 'task-check';
      check.setAttribute('role', 'checkbox'); check.setAttribute('aria-checked', String(task.done));
      check.setAttribute('aria-label', (task.done ? 'Restore ' : 'Complete ') + task.title); check.dataset.task = task.id;
      if (task.done) check.append(createIcon('check'));
      const textWrap = document.createElement('div');
      const title = document.createElement('div'); title.className = 'task-text'; title.textContent = task.title;
      const meta = document.createElement('div'); meta.className = 'task-meta'; meta.append(createIcon('clock'), document.createTextNode(task.time));
      textWrap.append(title, meta);
      const tag = document.createElement('span'); tag.className = 'task-tag ' + task.tone; tag.textContent = task.tag;
      row.append(check, textWrap, tag); fragment.append(row);
    });
    if (!visible.length) {
      const empty = document.createElement('p'); empty.className = 'demo-empty';
      empty.textContent = activeDemo === 'done' ? 'Your little wins will show up here.' : 'A little more room in your day. All clear!';
      fragment.append(empty);
    }
    demoList.replaceChildren(fragment);
    demoList.setAttribute('aria-labelledby', 'demo-tab-' + activeDemo);
    demoTabs.forEach(tab => {
      const value = tab.dataset.demoTab;
      const selected = value === activeDemo;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
      const count = $('[data-count]', tab);
      if (count) count.textContent = String(tasks.filter(task => value === 'done' ? task.done : !task.done && task.group === value).length);
    });
  }
  function chooseDemo(button) { activeDemo = button.dataset.demoTab; renderDemo(); }
  demoTabs.forEach(button => button.addEventListener('click', () => chooseDemo(button)));
  keyboardTabs(demoTabs, chooseDemo);
  demoList?.addEventListener('click', event => {
    const button = event.target.closest('[data-task]');
    if (!button) return;
    const task = tasks.find(item => String(item.id) === button.dataset.task);
    if (!task) return;
    task.done = !task.done;
    announce(task.done ? 'One less thing on your mind. Marked complete in the demo.' : 'Reminder restored in the demo.');
    renderDemo();
    ($('.task-check', demoList) || $('[data-demo-tab="' + activeDemo + '"]'))?.focus({preventScroll: true});
  });
  $$('[data-add-reminder]').forEach(button => button.addEventListener('click', () => {
    openDialog('#reminder-dialog'); $('#demo-title')?.focus();
  }));
  $('#demo-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#demo-title'); const when = $('#demo-when').value; const title = input.value.trim();
    if (!title) { input.setCustomValidity('Add a little something to remember.'); input.reportValidity(); return; }
    input.setCustomValidity('');
    const meta = {today: ['Today · 4:00 PM', 'today'], tomorrow: ['Tomorrow · 10:00 AM', 'upcoming'], week: ['Next week · 9:00 AM', 'upcoming']}[when];
    tasks.push({id: nextId++, title, time: meta[0], group: meta[1], tag: 'You', tone: 'mint', done: false});
    activeDemo = meta[1]; renderDemo(); $('#reminder-dialog').close(); event.target.reset();
    announce('Added to the website demo. No notification is scheduled.');
  });
  $('#demo-title')?.addEventListener('input', event => event.target.setCustomValidity(''));
  $('[data-reset-demo]')?.addEventListener('click', () => {
    tasks = initialTasks.map(task => ({...task})); activeDemo = 'today'; nextId = 5; renderDemo();
    announce('Demo reset. A fresh little start.');
  });
  $$('[data-try-demo]').forEach(link => link.addEventListener('click', () => {
    setTimeout(() => $('[data-add-reminder]')?.focus({preventScroll: true}), 350);
  }));
  renderDemo();

  // Pricing (billing period and currency) lives in pricing.js.

  let answerCategory = 'all'; const search = $('#answer-search'); const questions = $$('[data-question]');
  function filterAnswers() {
    if (!search) return;
    const query = search.value.toLocaleLowerCase().trim();
    let count = 0;
    questions.forEach(question => {
      const matches = (answerCategory === 'all' || question.dataset.category === answerCategory) && (!query || question.textContent.toLocaleLowerCase().includes(query));
      question.hidden = !matches;
      if (matches) { count++; if (query) question.open = true; }
      else question.open = false;
    });
    $$('[data-answer-group]').forEach(group => { group.hidden = !$('[data-question]:not([hidden])', group); });
    const label = $('#answer-count');
    if (label) label.textContent = count + (count === 1 ? ' helpful answer' : ' helpful answers') + (query ? ' matching your search' : '');
    const empty = $('#empty-answers'); if (empty) empty.hidden = count > 0;
    $$('[data-answer-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.answerCategory === answerCategory)));
  }
  search?.addEventListener('input', filterAnswers);
  $$('[data-answer-category]').forEach(button => button.addEventListener('click', () => { answerCategory = button.dataset.answerCategory; filterAnswers(); }));
  $('[data-reset-answers]')?.addEventListener('click', () => { answerCategory = 'all'; search.value = ''; questions.forEach(q => { q.open = false; }); filterAnswers(); search.focus(); });
  function revealHashAnswer() {
    if (!window.location.hash) return;
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    const item = document.getElementById(id);
    if (item?.tagName === 'DETAILS') {
      if (search) { search.value = ''; answerCategory = 'all'; filterAnswers(); }
      item.open = true;
      item.scrollIntoView({block:'start', behavior: 'auto'});
    }
  }
  window.addEventListener('hashchange', revealHashAnswer);
  revealHashAnswer();

  // Focus timer demonstration, scoped to this page only.
  let secondsLeft = 25 * 60; let running = false; let timerEnd = 0; let timerInterval;
  function renderTimer() {
    const text = String(Math.floor(secondsLeft / 60)).padStart(2, '0') + ':' + String(secondsLeft % 60).padStart(2, '0');
    $$('[data-timer-display]').forEach(el => { el.textContent = text; });
    $$('[data-timer-toggle]').forEach(el => { el.textContent = running ? 'Pause demo' : secondsLeft === 0 ? 'Restart demo' : secondsLeft === 1500 ? 'Start demo' : 'Resume demo'; });
    $$('[data-timer-label]').forEach(el => { el.textContent = secondsLeft === 0 ? 'A little break is due' : running ? 'One thing at a time' : 'Focus session'; });
  }
  function tick() {
    secondsLeft = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
    if (secondsLeft === 0) { running = false; clearInterval(timerInterval); announce('Your demo focus session is complete. Time for a little break.'); }
    renderTimer();
  }
  $$('[data-timer-toggle]').forEach(button => button.addEventListener('click', () => {
    if (running) { tick(); running = false; clearInterval(timerInterval); }
    else { if (secondsLeft === 0) secondsLeft = 1500; timerEnd = Date.now() + secondsLeft * 1000; running = true; timerInterval = setInterval(tick, 250); }
    renderTimer();
  }));
  $$('[data-timer-reset]').forEach(button => button.addEventListener('click', () => { clearInterval(timerInterval); running = false; secondsLeft = 1500; renderTimer(); }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && running) tick(); });

  $$('[data-copy-email]').forEach(button => button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText('hello@dewcue.com'); announce('Email address copied: hello@dewcue.com'); }
    catch { announce('Please copy this email address: hello@dewcue.com'); }
  }));
})();
