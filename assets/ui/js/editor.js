/* ════════════════════════════════════════
   editor.js — JSON editor:
   real-time validation,
   syntax highlighting (overlay),
   prettify / minify
   ════════════════════════════════════════ */

/**
 * Updates the highlight backdrop and adjusts the textarea height
 */
function syncHighlight(ta) {
  const bd = document.getElementById('jsonHlBackdrop');
  if (!bd) return;
  bd.innerHTML = highlightJson(ta.value) + '\n';
  ta.style.height = 'auto';
  ta.style.height = Math.max(160, ta.scrollHeight) + 'px';
  bd.style.height  = ta.style.height;
}

/**
 * Validates the textarea content and updates the status indicator
 */
function validateJson(ta) {
  const wrap   = document.getElementById('jsonEditorWrap');
  const status = document.getElementById('jsonStatus');
  const errMsg = document.getElementById('jsonErrorMsg');
  if (!wrap || !status) return;

  if (!ta.value.trim()) {
    wrap.classList.remove('has-error');
    status.className = 'json-status valid';
    status.querySelector('.json-status-text').textContent = 'Valid JSON';
    if (errMsg) errMsg.textContent = '';
    return;
  }

  try {
    JSON.parse(ta.value);
    wrap.classList.remove('has-error');
    status.className = 'json-status valid';
    status.querySelector('.json-status-text').textContent = 'Valid JSON';
    if (errMsg) errMsg.textContent = '';
  } catch (e) {
    wrap.classList.add('has-error');
    status.className = 'json-status invalid';
    status.querySelector('.json-status-text').textContent = 'Invalid JSON';
    if (errMsg) errMsg.textContent = '✕ ' + e.message;
  }
}

/**
 * Attaches all handlers to the JSON editor after the endpoint is rendered.
 * Called from request.js → showEndpoint()
 */
function initJsonEditor(initBody) {
  const ta = document.getElementById('requestBody');
  if (!ta) return;

  validateJson(ta);
  syncHighlight(ta);

  ta.addEventListener('input', () => { validateJson(ta); syncHighlight(ta); });

  document.getElementById('prettifyBtn')?.addEventListener('click', () => {
    try {
      let val = ta.value.trim();
      if (!val) return;
      let obj = JSON.parse(val);
      // "Unwrap" loop: if it's a string, try parsing it deeper
      while (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch { break; }
      }
      ta.value = JSON.stringify(obj, null, 2);
      validateJson(ta); syncHighlight(ta);
    } catch {}
    saveEndpointState();
  });

  document.getElementById('minifyBtn')?.addEventListener('click', () => {
    try {
      let val = ta.value.trim();
      if (!val) return;
      let obj = JSON.parse(val);
      while (typeof obj === 'string') {
        try { obj = JSON.parse(obj); } catch { break; }
      }
      ta.value = JSON.stringify(obj);
      validateJson(ta); syncHighlight(ta);
    } catch {}
    saveEndpointState();
  });

  document.getElementById('copyBodyBtn')?.addEventListener('click', () => {
    const val = ta.value.trim();
    if (!val) return;
    copyToClipboard(val, 'Request body copied');
  });

  document.getElementById('downloadBodyBtn')?.addEventListener('click', () => {
    const val = ta.value.trim();
    if (!val) return;
    downloadJson(val, 'request-body.json');
  });

  document.getElementById('stringifyBtn')?.addEventListener('click', () => {
    try {
      let val = ta.value.trim();
      if (!val) return;
      let parsed = JSON.parse(val);

      // If it's already a string (a stringify result), do nothing
      if (typeof parsed === 'string') return;

      // If it's an object/array — turn it into a string
      ta.value = JSON.stringify(JSON.stringify(parsed));
      validateJson(ta); syncHighlight(ta);
    } catch {
      // If it doesn't parse (raw text), just wrap it in quotes once
      ta.value = JSON.stringify(ta.value.trim());
      validateJson(ta); syncHighlight(ta);
    }
    saveEndpointState();
  });

  const resetBtn = document.getElementById('resetBodyBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      ta.value = initBody;
      validateJson(ta);
      syncHighlight(ta);
      saveEndpointState();
    });
  }
}
