/* ════════════════════════════════════════
   controls.js — custom form controls
   ════════════════════════════════════════ */

/* ── Close all open selects ── */
function closeAllTcSelects() {
  document.querySelectorAll('.tc-select-wrap.tc-open').forEach(w => w.classList.remove('tc-open'));
  _setTcScrollTrackingActive(false);
}
document.addEventListener('click', closeAllTcSelects);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAllTcSelects(); });

/* The menu is positioned as fixed and doesn't follow scroll on its own —
   on scroll of any (including nested) container we recompute its
   position instead of closing it.
   The scroll listener on document is attached ONLY while at least one
   menu is actually open, not permanently — otherwise it would hang on
   every scroll anywhere on the page (e.g. in the sidebar endpoint list,
   where the menu is never open) and needlessly eat main-thread time
   during fast/inertial scrolling, causing the list to visually lag
   behind the scroll. */
let _tcScrollTrackingActive = false;
function _repositionOpenTcMenus() {
  document.querySelectorAll('.tc-select-wrap.tc-open').forEach(wrap => {
    const menu = wrap.querySelector('.tc-select-menu');
    if (menu) _positionTcMenu(wrap, menu);
  });
}
function _setTcScrollTrackingActive(active) {
  if (active === _tcScrollTrackingActive) return;
  _tcScrollTrackingActive = active;
  if (active) {
    document.addEventListener('scroll', _repositionOpenTcMenus, true);
    window.addEventListener('resize', _repositionOpenTcMenus);
  } else {
    document.removeEventListener('scroll', _repositionOpenTcMenus, true);
    window.removeEventListener('resize', _repositionOpenTcMenus);
  }
}

/* Positions the dropdown menu as fixed relative to the window, not the
   parent — so it doesn't increase the scrollable height of modals/
   overflow containers and doesn't get clipped by their bounds */
function _positionTcMenu(wrap, menu) {
  const rect       = wrap.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  menu.style.position = 'fixed';
  menu.style.left     = rect.left + 'px';
  menu.style.width    = rect.width + 'px';
  if (spaceBelow < 200 && rect.top > 200) {
    menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    menu.style.top    = 'auto';
  } else {
    menu.style.top    = (rect.bottom + 4) + 'px';
    menu.style.bottom = 'auto';
  }
}

/* ── Initialize a single custom select ── */
function initTcSelect(el) {
  if (el.closest('.tc-select-wrap')) return;

  const options  = Array.from(el.options);
  const curLabel = el.options[el.selectedIndex]?.text ?? '';

  const wrap = document.createElement('div');
  wrap.className = 'tc-select-wrap';

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'tc-select-btn';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.innerHTML = `
    <span class="tc-select-label">${curLabel}</span>
    <svg class="tc-select-chevron" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"/>
    </svg>`;

  const menu = document.createElement('ul');
  menu.className = 'tc-select-menu';
  menu.setAttribute('role', 'listbox');

  options.forEach(opt => {
    const li = document.createElement('li');
    li.className = 'tc-select-opt' + (opt.value === el.value ? ' tc-selected' : '');
    li.setAttribute('role', 'option');
    li.dataset.value = opt.value;
    li.innerHTML = `<span class="tc-opt-dot"></span><span>${opt.text}</span>`;

    /* On click, not mousedown: mousedown fires before the browser
       determines the target of the following click by cursor coordinates. If we
       close/hide the menu right away (pointer-events:none), the click "falls
       through" it onto whatever is underneath — e.g. the dimmed
       modal backdrop behind it, which closed the modal itself when
       selecting lower list items (extending past the modal's bounds). */
    li.addEventListener('click', e => {
      e.stopPropagation();
      el.value = opt.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      menu.querySelectorAll('.tc-select-opt').forEach(o => o.classList.remove('tc-selected'));
      li.classList.add('tc-selected');
      btn.querySelector('.tc-select-label').textContent = opt.text;
      closeAllTcSelects();
    });
    menu.appendChild(li);
  });

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = wrap.classList.contains('tc-open');
    closeAllTcSelects();
    if (!isOpen) {
      wrap.classList.add('tc-open');
      _positionTcMenu(wrap, menu);
      _setTcScrollTrackingActive(true);
    }
  });

  el.parentNode.insertBefore(wrap, el);
  el.style.display = 'none';
  wrap.appendChild(btn);
  wrap.appendChild(menu);
  wrap.appendChild(el);
}

/* ── Wrap a date/time input after flatpickr init ── */
function wrapTcDate(el, fp) {
  if (el.closest('.tc-date-wrap')) return;

  const isTime = el.type === 'time';
  const wrap   = document.createElement('div');
  wrap.className = 'tc-date-wrap';

  el.classList.add('tc-date-inp');

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'tc-date-btn';
  btn.innerHTML = isTime
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (fp.isOpen) fp.close(); else fp.open();
  });

  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  wrap.appendChild(btn);
}

/* ── Initialize flatpickr on date/time inputs ── */
function initTcDatePickers(container) {
  if (typeof flatpickr === 'undefined') return;

  const arrowPrev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
  const arrowNext = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

  container.querySelectorAll('input[type="date"].tc-input').forEach(el => {
    if (el._flatpickr) return;
    const fp = flatpickr(el, {
      dateFormat   : 'Y-m-d',
      allowInput   : true,
      clickOpens   : false,
      disableMobile: true,
      prevArrow    : arrowPrev,
      nextArrow    : arrowNext,
      onChange     : () => el.dispatchEvent(new Event('input', { bubbles: true })),
      onClose      : () => el.blur(),
    });
    wrapTcDate(el, fp);
  });

  container.querySelectorAll('input[type="datetime-local"].tc-input').forEach(el => {
    if (el._flatpickr) return;
    const fp = flatpickr(el, {
      dateFormat   : 'Y-m-dTH:i',
      enableTime   : true,
      time_24hr    : true,
      allowInput   : true,
      clickOpens   : false,
      disableMobile: true,
      prevArrow    : arrowPrev,
      nextArrow    : arrowNext,
      onChange     : () => el.dispatchEvent(new Event('input', { bubbles: true })),
      onClose      : () => el.blur(),
    });
    wrapTcDate(el, fp);
  });

  container.querySelectorAll('input[type="time"].tc-input').forEach(el => {
    if (el._flatpickr) return;
    const fp = flatpickr(el, {
      enableTime   : true,
      noCalendar   : true,
      dateFormat   : 'H:i',
      time_24hr    : true,
      allowInput   : true,
      clickOpens   : false,
      disableMobile: true,
      onChange     : () => el.dispatchEvent(new Event('input', { bubbles: true })),
      onClose      : () => el.blur(),
    });
    wrapTcDate(el, fp);
  });
}

/* ── Initialize a single custom number input ── */
function initTcNumber(el) {
  if (el.closest('.tc-number-wrap')) return;

  const wrap = document.createElement('div');
  wrap.className = 'tc-number-wrap';

  const side = document.createElement('div');
  side.className = 'tc-number-side';

  const inc = document.createElement('button');
  inc.type      = 'button';
  inc.className = 'tc-number-btn tc-number-inc';
  inc.textContent = '+';
  inc.addEventListener('mousedown', e => {
    e.preventDefault();
    el.stepUp();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const dec = document.createElement('button');
  dec.type      = 'button';
  dec.className = 'tc-number-btn tc-number-dec';
  dec.textContent = '−';
  dec.addEventListener('mousedown', e => {
    e.preventDefault();
    el.stepDown();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  el.classList.add('tc-number-inp');
  el.parentNode.insertBefore(wrap, el);
  side.appendChild(dec);
  side.appendChild(inc);
  wrap.appendChild(el);
  wrap.appendChild(side);
}

/* ── Initialize a single password input with a toggle ── */
function initTcPassword(el) {
  if (el.closest('.tc-password-wrap')) return;

  const EYE     = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const EYE_OFF = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  const wrap = document.createElement('div');
  wrap.className = 'tc-password-wrap';

  const btn = document.createElement('button');
  btn.type      = 'button';
  btn.className = 'tc-password-btn';
  btn.innerHTML = EYE;

  let visible = false;
  btn.addEventListener('mousedown', e => {
    e.preventDefault();
    visible = !visible;
    el.type = visible ? 'text' : 'password';
    btn.innerHTML = visible ? EYE_OFF : EYE;
  });

  el.classList.add('tc-password-inp');
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  wrap.appendChild(btn);
}

/* ── Main function — call after any render ── */
function initTcControls(container) {
  container.querySelectorAll('select.tc-input').forEach(el => initTcSelect(el));
  container.querySelectorAll('input[type="number"].tc-input').forEach(el => initTcNumber(el));
  container.querySelectorAll('input[type="password"].tc-input').forEach(el => initTcPassword(el));
  initTcDatePickers(container);
}
