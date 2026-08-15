/* ════════════════════════════════════════
   dialogs.js — custom dialogs
   showToast / showConfirm / showPrompt
   ════════════════════════════════════════ */

/**
 * Popup notification
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 */
function showToast(message, type = 'info') {
  const colors = {
    success: { bg: 'rgba(16,217,160,0.12)', border: 'rgba(16,217,160,0.35)', icon: '#10d9a0', path: 'M5 13l4 4L19 7' },
    error:   { bg: 'rgba(255,94,122,0.12)',  border: 'rgba(255,94,122,0.35)',  icon: '#ff5e7a', path: 'M6 18L18 6M6 6l12 12' },
    info:    { bg: 'var(--accent-glow)',      border: 'rgba(91,127,255,0.35)', icon: 'var(--accent)', path: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  };
  const c = colors[type] || colors.info;
  const toast = document.createElement('div');
  toast.style.cssText = `pointer-events:all;display:flex;align-items:center;gap:10px;padding:11px 16px;border-radius:10px;border:1px solid ${c.border};background:${c.bg};backdrop-filter:blur(16px);box-shadow:0 4px 20px rgba(0,0,0,0.25);font-family:'Lexend',sans-serif;font-size:13px;color:var(--text-primary);max-width:320px;animation:toastIn 0.25s ease;`;
  toast.innerHTML = `<svg width="16" height="16" fill="none" stroke="${c.icon}" stroke-width="2.5" viewBox="0 0 24 24" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="${c.path}"/></svg><span>${message}</span>`;
  document.getElementById('toastContainer').appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

/**
 * Custom confirm dialog
 * @param {string} message
 * @param {Function} onOk — callback on confirmation
 * @param {string} okLabel
 * @param {string} title
 */
function showConfirm(message, onOk, okLabel = 'Confirm', title = 'Confirmation') {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmOk').textContent = okLabel;
  modal.classList.add('active');

  const ok     = document.getElementById('confirmOk');
  const cancel = document.getElementById('confirmCancel');
  const close  = () => modal.classList.remove('active');

  const newOk     = ok.cloneNode(true);     ok.replaceWith(newOk);
  const newCancel = cancel.cloneNode(true); cancel.replaceWith(newCancel);

  newOk.addEventListener('click', () => { close(); onOk(); });
  newCancel.addEventListener('click', close);
  modal.onclick = e => { if (e.target === modal) close(); };
}

/**
 * Custom prompt dialog
 * @param {string} title
 * @param {string} defaultValue
 * @param {Function} onOk — callback with the entered value
 */
function showPrompt(title, defaultValue = '', onOk) {
  const modal = document.getElementById('promptModal');
  document.getElementById('promptTitle').textContent = title;
  const input = document.getElementById('promptInput');
  input.value = defaultValue;
  modal.classList.add('active');
  setTimeout(() => { input.focus(); input.select(); }, 100);

  const ok     = document.getElementById('promptOk');
  const cancel = document.getElementById('promptCancel');
  const close  = () => modal.classList.remove('active');

  const newOk     = ok.cloneNode(true);     ok.replaceWith(newOk);
  const newCancel = cancel.cloneNode(true); cancel.replaceWith(newCancel);

  const submit = () => {
    const v = input.value.trim();
    if (v) { close(); onOk(v); }
    else {
      input.style.borderColor = '#ff5e7a';
      input.style.boxShadow   = '0 0 0 3px rgba(255,94,122,0.15)';
    }
  };

  newOk.addEventListener('click', submit);
  newCancel.addEventListener('click', close);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') close(); });
  input.addEventListener('input', () => { input.style.borderColor = ''; input.style.boxShadow = ''; });
  modal.onclick = e => { if (e.target === modal) close(); };
}
