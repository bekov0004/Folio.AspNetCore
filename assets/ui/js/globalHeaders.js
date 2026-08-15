/* ════════════════════════════════════════
   globalHeaders.js — global and per-endpoint
   custom header request parameters
   ════════════════════════════════════════ */

const GLOBAL_HEADERS_KEY = 'spectra_global_headers';
const EP_HEADERS_KEY     = 'spectra_ep_headers';

/* ── Utility: safe name for an id attribute ── */
function _hdrSafe(name) {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, '_');
}

/* ── Config: global ── */
function getGlobalHeadersConfig() {
  try { return JSON.parse(localStorage.getItem(GLOBAL_HEADERS_KEY)) || []; } catch { return []; }
}
function _saveGlobalHeadersConfig(arr) {
  try { localStorage.setItem(GLOBAL_HEADERS_KEY, JSON.stringify(arr)); } catch {}
}

/* ── Config: per-endpoint ── */
function _getEpHeadersStore() {
  try { return JSON.parse(localStorage.getItem(EP_HEADERS_KEY)) || {}; } catch { return {}; }
}
function getEndpointHeadersConfig(epKey) {
  return _getEpHeadersStore()[epKey] || [];
}
function _saveEndpointHeadersConfig(epKey, arr) {
  const store = _getEpHeadersStore();
  if (arr.length) store[epKey] = arr;
  else delete store[epKey];
  try { localStorage.setItem(EP_HEADERS_KEY, JSON.stringify(store)); } catch {}
}

/* ── Resolve values for sendRequest ── */
function resolveCustomHeaders(configs, prefix) {
  const result = {};
  for (const h of configs) {
    const id = prefix + _hdrSafe(h.name);
    const el = document.getElementById(id);
    let v = el ? el.value : (h.default || '');
    if (h.type === 'array') {
      try {
        const arr = JSON.parse(v);
        v = Array.isArray(arr) && arr.length ? arr.join(', ') : '';
      } catch { /* keep v */ }
    }
    if (v !== '') result[h.name] = v;
  }
  return result;
}

/* ════════════════════════════════════════
   CONFIG EDITOR (modal window)
   ════════════════════════════════════════ */

const _TYPE_COLOR = {
  string: '#4da8ff', integer: '#10d9a0', number: '#10d9a0',
  boolean: '#b57fff', enum: '#ffb347', array: '#5cf2ff'
};

function _hdrEditorRow(h = {}) {
  const type  = h.type || 'string';
  const color = _TYPE_COLOR[type] || 'var(--accent)';

  const extraFields = _buildExtraFields(h);

  return `
    <div class="gh-row-card" style="border-left-color:${color};">
      <div class="gh-row-top">
        <div class="gh-row-dot" style="background:${color};box-shadow:0 0 6px ${color}55;"></div>
        <input type="text" class="tc-input gh-name hdr-name" placeholder="X-Header-Name" value="${h.name || ''}"
               autocomplete="off" spellcheck="false">
        <select class="tc-input gh-type hdr-type">
          ${['string','integer','number','boolean','enum','array'].map(t =>
            `<option value="${t}"${type === t ? ' selected' : ''}>${t}</option>`
          ).join('')}
        </select>
        <input type="text" class="tc-input gh-default hdr-default" placeholder="Default value" value="${h.default || ''}"
               autocomplete="off" spellcheck="false">
        <button type="button" class="gh-del-btn tooltip-below" data-tooltip="Delete">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      </div>
      ${extraFields ? `<div class="gh-row-fields">${extraFields}</div>` : ''}
    </div>`;
}

function _buildExtraFields(h) {
  if (h.type === 'enum') {
    return `<div class="gh-field gh-enum-group">
      <label class="gh-field-lbl">Options <span class="gh-field-hint">comma-separated</span></label>
      <input type="text" class="tc-input hdr-enum-vals" placeholder="val1, val2, val3"
             value="${(h.enumValues || []).join(', ')}" autocomplete="off" spellcheck="false">
    </div>`;
  }
  if (h.type === 'array') {
    return `<div class="gh-field gh-arr-group">
      <label class="gh-field-lbl">Item type</label>
      <select class="tc-input hdr-arr-item-type">
        ${['string','integer','number','boolean'].map(t =>
          `<option value="${t}"${h.arrayItemType === t ? ' selected' : ''}>${t}</option>`
        ).join('')}
      </select>
    </div>`;
  }
  return '';
}

function _wireEditorRow(row) {
  const typeEl = row.querySelector('.hdr-type');

  typeEl?.addEventListener('change', function () {
    // Update the color
    const color = _TYPE_COLOR[this.value] || 'var(--accent)';
    row.style.borderLeftColor = color;
    row.querySelector('.gh-row-dot').style.background = color;
    row.querySelector('.gh-row-dot').style.boxShadow  = `0 0 6px ${color}55`;

    // Rebuild extra fields (.gh-row-fields only exists when there's something to show)
    row.querySelector('.gh-row-fields')?.remove();
    const fakeH = { type: this.value, enumValues: [], arrayItemType: 'string' };
    const extra = _buildExtraFields(fakeH);
    if (extra) {
      const fields = document.createElement('div');
      fields.className = 'gh-row-fields';
      fields.innerHTML = extra;
      row.appendChild(fields);
      initTcControls(fields);
    }

    _updateGhEmpty();
  });

  row.querySelector('.gh-del-btn')?.addEventListener('click', () => {
    row.remove();
    _updateGhEmpty();
  });
}

function _updateGhEmpty() {
  const list  = document.getElementById('ghRowsList');
  const empty = document.getElementById('ghEmptyState');
  if (!list || !empty) return;
  empty.style.display = list.children.length === 0 ? '' : 'none';
}

function _readEditorRows(list) {
  return [...list.querySelectorAll('.gh-row-card')].map(row => _readEditorRowEl(row)).filter(Boolean);
}

/* Reads name/type/default (+extra fields) from a single .gh-row-card row
   (used by both the modal and the inline editor in the panel) */
function _readEditorRowEl(row) {
  const name = row.querySelector('.hdr-name')?.value.trim();
  if (!name) return null;
  const type = row.querySelector('.hdr-type')?.value || 'string';
  const def  = row.querySelector('.hdr-default')?.value || '';
  const h    = { name, type, default: def, enumValues: [], arrayItemType: null };
  if (type === 'enum') {
    h.enumValues = (row.querySelector('.hdr-enum-vals')?.value || '')
      .split(',').map(s => s.trim()).filter(Boolean);
  }
  if (type === 'array') {
    h.arrayItemType = row.querySelector('.hdr-arr-item-type')?.value || 'string';
  }
  return h;
}

/* ════════════════════════════════════════
   INLINE EDITOR FOR A SINGLE HEADER (endpoint panel)
   Compact version of .gh-row-card with ✓/✕ instead of a delete-✕ — adds
   and edits a single header right in place, without the modal.
   ════════════════════════════════════════ */

function _hdrInlineEditorRow(h = {}) {
  const type  = h.type || 'string';
  const color = _TYPE_COLOR[type] || 'var(--accent)';
  const extraFields = _buildExtraFields(h);

  return `
    <div class="gh-row-card hdr-inline-editor-card" style="border-left-color:${color};">
      <div class="gh-row-top">
        <div class="gh-row-dot" style="background:${color};box-shadow:0 0 6px ${color}55;"></div>
        <input type="text" class="tc-input gh-name hdr-name" placeholder="X-Header-Name" value="${escapeHtml(h.name || '')}"
               autocomplete="off" spellcheck="false">
        <select class="tc-input gh-type hdr-type">
          ${['string','integer','number','boolean','enum','array'].map(t =>
            `<option value="${t}"${type === t ? ' selected' : ''}>${t}</option>`
          ).join('')}
        </select>
        <input type="text" class="tc-input gh-default hdr-default" placeholder="Default value" value="${escapeHtml(h.default || '')}"
               autocomplete="off" spellcheck="false">
        <button type="button" class="hdr-inline-confirm-btn tooltip-below" data-tooltip="Save">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 6L9 17l-5-5"/></svg>
        </button>
        <button type="button" class="hdr-inline-cancel-btn tooltip-below" data-tooltip="Cancel">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      ${extraFields ? `<div class="gh-row-fields">${extraFields}</div>` : ''}
    </div>`;
}

/* Shared handler for type changes (recolors the dot, rebuilds the
   enum/array extra field) + wires up confirm/cancel */
function _wireInlineEditorRow(row, { onConfirm, onCancel }) {
  const typeEl = row.querySelector('.hdr-type');
  typeEl?.addEventListener('change', function () {
    const color = _TYPE_COLOR[this.value] || 'var(--accent)';
    row.style.borderLeftColor = color;
    const dot = row.querySelector('.gh-row-dot');
    if (dot) { dot.style.background = color; dot.style.boxShadow = `0 0 6px ${color}55`; }
    row.querySelector('.gh-row-fields')?.remove();
    const fakeH = { type: this.value, enumValues: [], arrayItemType: 'string' };
    const extra = _buildExtraFields(fakeH);
    if (extra) {
      const fields = document.createElement('div');
      fields.className = 'gh-row-fields';
      fields.innerHTML = extra;
      row.appendChild(fields);
      initTcControls(fields);
    }
  });
  row.querySelector('.hdr-inline-confirm-btn').addEventListener('click', onConfirm);
  row.querySelector('.hdr-inline-cancel-btn').addEventListener('click', onCancel);
  /* Enter in the name/default field acts as confirm, Esc as cancel */
  row.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.target.classList.contains('hdr-name') || e.target.classList.contains('hdr-default'))) {
      e.preventDefault(); onConfirm();
    }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  });
}

/* ── Expand/collapse the inline add form within a group ── */
function hdrToggleInlineAdd(groupKey) {
  const container = document.getElementById(`hdrInlineAdd-${groupKey}`);
  if (!container) return;
  if (container.children.length) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }
  container.innerHTML = _hdrInlineEditorRow({});
  container.style.display = '';
  const row = container.firstElementChild;
  _wireInlineEditorRow(row, {
    onConfirm: () => _hdrInlineAddConfirm(groupKey, row),
    onCancel:  () => { container.innerHTML = ''; container.style.display = 'none'; },
  });
  initTcControls(row);
  row.querySelector('.hdr-name')?.focus();
}

function _hdrInlineAddConfirm(groupKey, row) {
  const h = _readEditorRowEl(row);
  if (!h) { showToast('Enter a header name', 'error'); return; }
  const isGlobal = groupKey === 'global';
  const cfg = isGlobal ? getGlobalHeadersConfig() : getEndpointHeadersConfig(currentEndpointKey);
  if (cfg.some(x => x.name === h.name)) { showToast('A header with this name already exists', 'error'); return; }
  cfg.push(h);
  if (isGlobal) _saveGlobalHeadersConfig(cfg); else _saveEndpointHeadersConfig(currentEndpointKey, cfg);
  rerenderEndpointHeadersSection();
  showToast('Header added', 'success');
}

/* ── Edit an existing header directly in the row ── */
function hdrEditField(btn) {
  const groupKey = btn.dataset.group;
  const name     = btn.dataset.name;
  const row      = btn.closest('.hdr-ep-row');
  if (!row) return;
  const isGlobal = groupKey === 'global';
  const cfg = isGlobal ? getGlobalHeadersConfig() : getEndpointHeadersConfig(currentEndpointKey);
  const h = cfg.find(x => x.name === name);
  if (!h) return;

  const wrap = document.createElement('div');
  wrap.innerHTML = _hdrInlineEditorRow(h);
  const editorRow = wrap.firstElementChild;
  row.replaceWith(editorRow);
  _wireInlineEditorRow(editorRow, {
    onConfirm: () => _hdrInlineEditConfirm(groupKey, name, editorRow),
    onCancel:  () => rerenderEndpointHeadersSection(),
  });
  initTcControls(editorRow);
  editorRow.querySelector('.hdr-name')?.focus();
}

function _hdrInlineEditConfirm(groupKey, oldName, row) {
  const h = _readEditorRowEl(row);
  if (!h) { showToast('Enter a header name', 'error'); return; }
  const isGlobal = groupKey === 'global';
  const cfg = isGlobal ? getGlobalHeadersConfig() : getEndpointHeadersConfig(currentEndpointKey);
  const idx = cfg.findIndex(x => x.name === oldName);
  if (idx === -1) return;
  if (h.name !== oldName && cfg.some(x => x.name === h.name)) {
    showToast('A header with this name already exists', 'error');
    return;
  }
  cfg[idx] = h;
  if (isGlobal) _saveGlobalHeadersConfig(cfg); else _saveEndpointHeadersConfig(currentEndpointKey, cfg);
  rerenderEndpointHeadersSection();
  showToast('Header updated', 'success');
}

/* ── Delete a header ── */
function hdrDeleteField(btn) {
  const groupKey = btn.dataset.group;
  const name     = btn.dataset.name;
  const isGlobal = groupKey === 'global';
  const cfg = (isGlobal ? getGlobalHeadersConfig() : getEndpointHeadersConfig(currentEndpointKey))
    .filter(x => x.name !== name);
  if (isGlobal) _saveGlobalHeadersConfig(cfg); else _saveEndpointHeadersConfig(currentEndpointKey, cfg);
  rerenderEndpointHeadersSection();
  showToast('Header deleted', 'info');
}

/* ════════════════════════════════════════
   RENDERING IN THE ENDPOINT PANEL
   ════════════════════════════════════════ */

/* Array item row */
function _hdrArrItemRow(itemType, value = '') {
  const isNum = itemType === 'integer' || itemType === 'number';
  return `<div class="hdr-arr-item-row">
    <input type="${isNum ? 'number' : 'text'}" class="tc-input hdr-arr-item-inp" value="${value}" placeholder="${itemType}" style="flex:1;min-width:0;">
    <button type="button" class="hdr-arr-item-del" onclick="hdrArrItemRemove(this)">×</button>
  </div>`;
}

function hdrArrItemRemove(btn) {
  const row  = btn.closest('.hdr-arr-item-row');
  const wrap = row?.closest('.hdr-arr-wrap');
  row?.remove();
  if (wrap) _syncHdrArr(wrap);
}

function hdrArrAdd(btn) {
  const wrap     = btn.closest('.hdr-arr-wrap');
  const itemType = wrap?.dataset.itemType || 'string';
  const items    = wrap?.querySelector('.hdr-arr-items');
  if (!items) return;
  const div = document.createElement('div');
  div.innerHTML = _hdrArrItemRow(itemType, '');
  items.appendChild(div.firstElementChild);
  _syncHdrArr(wrap);
}

function _syncHdrArr(wrap) {
  const vals   = [...wrap.querySelectorAll('.hdr-arr-item-inp')].map(el => el.value).filter(v => v !== '');
  const hidden = document.getElementById(wrap.dataset.inputId);
  if (hidden) hidden.value = JSON.stringify(vals);
  if (typeof saveEndpointState === 'function') saveEndpointState();
}

/* Input control for a single header (in the endpoint panel) */
function _renderHdrInput(h, inputId) {
  const val = h.default || '';
  if (h.type === 'boolean') {
    return `<select id="${inputId}" class="tc-input">
      <option value="true"  ${val === 'true'  ? 'selected' : ''}>true</option>
      <option value="false" ${val !== 'true'  ? 'selected' : ''}>false</option>
    </select>`;
  }
  if (h.type === 'enum') {
    return `<select id="${inputId}" class="tc-input">${
      (h.enumValues || []).map(o => `<option value="${o}"${o === val ? ' selected' : ''}>${o}</option>`).join('')
    }</select>`;
  }
  if (h.type === 'integer' || h.type === 'number') {
    return `<input type="number" id="${inputId}" class="tc-input" value="${val}" placeholder="${h.type}">`;
  }
  if (h.type === 'array') {
    const itemType = h.arrayItemType || 'string';
    const arrVals  = (() => {
      try { const p = JSON.parse(val); return Array.isArray(p) && p.length ? p : ['']; } catch { return ['']; }
    })();
    return `<div class="hdr-arr-wrap" data-item-type="${itemType}" data-input-id="${inputId}">
      <div class="hdr-arr-items">${arrVals.map(v => _hdrArrItemRow(itemType, v)).join('')}</div>
      <button type="button" class="tc-arr-add" onclick="hdrArrAdd(this)" style="margin-top:4px;width:100%;">+ Add</button>
      <input type="hidden" id="${inputId}" value="${val}">
    </div>`;
  }
  return `<input type="text" id="${inputId}" class="tc-input" value="${val}" placeholder="string">`;
}

/* Row for a custom header (global/endpoint) in the endpoint panel.
   The group (its color/label) now shows the source — a badge on
   the row is no longer needed. */
function renderCustomHeaderRow(h, inputId, groupKey) {
  const color = groupKey === 'global' ? '#10d9a0' : '#b57fff';
  return `
    <div class="tc-prop-row hdr-ep-row" data-hdr-group="${groupKey}" data-hdr-name="${escapeHtml(h.name)}"
         style="border-radius:10px;margin-bottom:4px;border:1px solid var(--border);border-left:3px solid ${color};">
      <div class="tc-prop-meta">
        <div class="tc-prop-name" data-tooltip="${escapeHtml(h.name)}">${escapeHtml(h.name)}</div>
        <div class="tc-prop-info"><span class="tc-prop-type">${escapeHtml(h.type)}</span></div>
      </div>
      <div class="tc-prop-input hdr-ep-input-wrap">
        ${_renderHdrInput(h, inputId)}
        <button type="button" class="hdr-edit-btn tooltip-below" data-group="${groupKey}" data-name="${escapeHtml(h.name)}" onclick="hdrEditField(this)" data-tooltip="Edit">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
        </button>
        <button type="button" class="hdr-reset-btn tooltip-below" data-input-id="${inputId}" onclick="hdrResetField(this)" data-tooltip="Reset to default">↺</button>
        <button type="button" class="hdr-del-field-btn tooltip-below" data-group="${groupKey}" data-name="${escapeHtml(h.name)}" onclick="hdrDeleteField(this)" data-tooltip="Delete">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>`;
}

/* Row for an OpenAPI header param in the endpoint panel — defined by the
   spec, so its definition can't be edited/deleted, only its value. */
function renderApiHeaderRow(param) {
  const id   = paramId(param.name, 'header');
  const sch  = param.schema || {};
  const type = sch.type || 'string';
  const def  = String(sch.default ?? '');

  let ctrl = '';
  if (sch.enum) {
    ctrl = `<select id="${id}" class="tc-input">${
      sch.enum.map(o => `<option value="${o}"${o === def ? ' selected' : ''}>${o}</option>`).join('')
    }</select>`;
  } else if (type === 'boolean') {
    ctrl = `<select id="${id}" class="tc-input">
      <option value="true"  ${def === 'true'  ? 'selected' : ''}>true</option>
      <option value="false" ${def !== 'true'  ? 'selected' : ''}>false</option>
    </select>`;
  } else {
    ctrl = `<input type="text" id="${id}" class="tc-input" value="${escapeHtml(def)}" placeholder="${escapeHtml(type)}">`;
  }

  return `
    <div class="tc-prop-row hdr-ep-row" style="border-radius:10px;margin-bottom:4px;border:1px solid var(--border);border-left:3px solid #4da8ff;">
      <div class="tc-prop-meta">
        <div class="tc-prop-name" data-tooltip="${escapeHtml(param.name)}">${escapeHtml(param.name)}</div>
        <div class="tc-prop-info">
          <span class="tc-prop-type">${escapeHtml(type)}${sch.format ? ' (' + escapeHtml(sch.format) + ')' : ''}</span>
          ${param.required ? '<span class="tc-prop-req" data-tooltip="Required">*</span>' : ''}
        </div>
      </div>
      <div class="tc-prop-input hdr-ep-input-wrap">
        ${ctrl}
        <button type="button" class="hdr-reset-btn tooltip-below" data-input-id="${id}" data-api-default="${escapeHtml(def)}" onclick="hdrResetField(this)" data-tooltip="Reset to default">↺</button>
      </div>
      ${param.description ? `<div class="tc-prop-desc" style="padding:0 4px 4px;">${escapeHtml(param.description)}</div>` : ''}
    </div>`;
}

/* ── Reset a field to its default ── */
function hdrResetField(btn) {
  const inputId = btn.dataset.inputId;
  const el      = document.getElementById(inputId);
  if (!el) return;

  let def = '';
  if (inputId.startsWith('gh-')) {
    const safe = inputId.slice(3);
    def = getGlobalHeadersConfig().find(h => _hdrSafe(h.name) === safe)?.default || '';
  } else if (inputId.startsWith('eh-')) {
    const safe = inputId.slice(3);
    def = getEndpointHeadersConfig(currentEndpointKey).find(h => _hdrSafe(h.name) === safe)?.default || '';
  } else {
    def = btn.dataset.apiDefault || '';
  }

  if (el.type === 'hidden') {
    const wrap = el.closest('.hdr-arr-wrap');
    if (wrap) {
      const itemType = wrap.dataset.itemType || 'string';
      const arrVals  = (() => {
        try { const p = JSON.parse(def); return Array.isArray(p) && p.length ? p : ['']; } catch { return ['']; }
      })();
      wrap.querySelector('.hdr-arr-items').innerHTML = arrVals.map(v => _hdrArrItemRow(itemType, v)).join('');
      el.value = def;
    }
  } else {
    el.value = def;
  }
  if (typeof saveEndpointState === 'function') saveEndpointState();
}

/* ════════════════════════════════════════
   "HEADERS" SECTION IN THE ENDPOINT PANEL
   ════════════════════════════════════════ */

/* "Global"/"Endpoint headers" group — edited directly in place (its own
   "+", its own row for each header with ✎/↺/✕).
   An empty group isn't shown at all — the first header can be added
   via the "Headers" button on the panel (modal). */
function _hdrGroupHtml(groupKey, title, configs) {
  if (!configs.length) return '';
  const prefix = groupKey === 'global' ? 'gh-' : 'eh-';
  const rows = configs.map(h => renderCustomHeaderRow(h, prefix + _hdrSafe(h.name), groupKey)).join('');
  return `
    <div class="hdr-group" data-hdr-group="${groupKey}">
      <div class="hdr-group-hd">
        <span class="hdr-group-title">${title}</span>
        <span class="hdr-group-count">${configs.length}</span>
        <span class="hdr-group-line"></span>
        <button type="button" class="hdr-group-add-btn tooltip-below tooltip-right" onclick="hdrToggleInlineAdd('${groupKey}')" data-tooltip="Add header">
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
        </button>
      </div>
      <div class="hdr-group-rows">${rows}</div>
      <div class="hdr-inline-add" id="hdrInlineAdd-${groupKey}" style="display:none;"></div>
    </div>`;
}

/* "From API spec" group — definition is read-only (name/type/
   required from the spec), but the value can still be entered and reset */
function _hdrApiGroupHtml(apiParams) {
  if (!apiParams.length) return '';
  const rows = apiParams.map(renderApiHeaderRow).join('');
  return `
    <div class="hdr-group" data-hdr-group="api">
      <div class="hdr-group-hd">
        <span class="hdr-group-title">From API spec</span>
        <span class="hdr-group-count">${apiParams.length}</span>
        <span class="hdr-group-line"></span>
      </div>
      <div class="hdr-group-rows">${rows}</div>
    </div>`;
}

function buildEndpointHeadersHtml(ep) {
  const globalCfg = getGlobalHeadersConfig();
  const epCfg     = currentEndpointKey ? getEndpointHeadersConfig(currentEndpointKey) : [];
  const apiParams = (ep.parameters || []).filter(p => p.in === 'header');
  const total     = globalCfg.length + epCfg.length + apiParams.length;

  return `
    <div id="epHeadersSection" class="ep-section" style="border-top:1px solid var(--border);">
      <div class="ep-section-hd">
        <span class="ep-section-title">Headers</span>
        <span class="ep-section-line"></span>
        ${total > 0 ? `<span class="ep-section-badge">${total}</span>` : ''}
      </div>
      <div id="epHeadersContent">
        ${total > 0
          ? `${_hdrGroupHtml('global', 'Global', globalCfg)}${_hdrGroupHtml('endpoint', 'Endpoint headers', epCfg)}${_hdrApiGroupHtml(apiParams)}`
          : '<p class="hdr-group-empty">No headers</p>'}
      </div>
    </div>`;
}

/* Rebuild the section after the config changes */
function rerenderEndpointHeadersSection() {
  const old = document.getElementById('epHeadersSection');
  if (!old || !currentEndpointData) return;

  const div = document.createElement('div');
  div.innerHTML = buildEndpointHeadersHtml(currentEndpointData);
  old.replaceWith(div.firstElementChild);

  restoreEndpointState();
  initTcControls(document.getElementById('epHeadersSection'));
  _wireHdrSectionInputs();
}

/* Subscribe input/change events to saveEndpointState for custom headers */
function _wireHdrSectionInputs() {
  const section = document.getElementById('epHeadersSection');
  if (!section) return;
  section.querySelectorAll('[id^="gh-"], [id^="eh-"]').forEach(el => {
    el.addEventListener('input',  saveEndpointState);
    el.addEventListener('change', saveEndpointState);
  });
  section.querySelectorAll('.hdr-arr-item-inp').forEach(inp => {
    inp.addEventListener('input', () => {
      const wrap = inp.closest('.hdr-arr-wrap');
      if (wrap) _syncHdrArr(wrap);
    });
  });
}

/* ════════════════════════════════════════
   MODAL WINDOW — opened only via the button on the panel.
   Tabs by source: Global (always) / Endpoint headers +
   From spec (only if an endpoint is currently open).
   ════════════════════════════════════════ */

let _ghEpKey      = null;   // snapshot of currentEndpointKey at open time
let _ghActiveTab  = 'global'; // 'global' | 'endpoint' | 'api'

function openHeadersModal() {
  _ghEpKey     = currentEndpointKey || null;
  _ghActiveTab = 'global';
  _renderHdrModalTabs();
  _renderHdrModalActiveTab();
  document.getElementById('globalHeadersModal').classList.add('active');
}

function _renderHdrModalTabs() {
  const tabsEl = document.getElementById('ghTabs');
  if (!tabsEl) return;
  const hasEp = !!_ghEpKey;

  if (!hasEp) {
    /* Outside an endpoint there's exactly one source — tabs would just confuse */
    tabsEl.innerHTML = '';
    tabsEl.style.display = 'none';
    return;
  }

  tabsEl.style.display = '';
  tabsEl.innerHTML = `
    <button type="button" class="gh-tab" data-tab="global">Global</button>
    <button type="button" class="gh-tab" data-tab="endpoint">Endpoint headers</button>
    <button type="button" class="gh-tab" data-tab="api">From spec</button>`;
  tabsEl.querySelectorAll('.gh-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === _ghActiveTab);
    btn.addEventListener('click', () => {
      _ghActiveTab = btn.dataset.tab;
      _renderHdrModalTabs();
      _renderHdrModalActiveTab();
    });
  });
}

function _renderHdrModalActiveTab() {
  const tab      = _ghActiveTab;
  const body     = document.getElementById('ghModalBody');
  const footer   = document.getElementById('ghModalFooterActions');
  const titleEl  = document.querySelector('.gh-modal-title');
  const icon     = document.getElementById('ghModalIcon');
  const badge    = document.getElementById('ghModalModeBadge');
  const hint     = document.getElementById('ghModalHint');
  const sub      = document.getElementById('ghModalSubtitle');

  if (tab === 'api') {
    titleEl.textContent = 'Headers from spec';
    icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
    </svg>`;
    icon.style.cssText  = 'background:rgba(77,168,255,0.12);border-color:rgba(77,168,255,0.3);color:#4da8ff;';
    badge.textContent   = _ghEpKey || '';
    badge.style.cssText = 'background:rgba(77,168,255,0.12);color:#4da8ff;border-color:rgba(77,168,255,0.25);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    sub.textContent     = 'Declared in the OpenAPI spec for this endpoint';
    hint.innerHTML      = `<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;">
      <circle cx="12" cy="12" r="10" stroke-width="2"/>
      <path stroke-linecap="round" stroke-width="2" d="M12 8v4l2 2"/>
    </svg>Values are set right in the endpoint panel`;

    const apiParams = (currentEndpointData?.parameters || []).filter(p => p.in === 'header');
    body.innerHTML = apiParams.length
      ? `<div class="gh-api-readonly-list">${apiParams.map(_hdrApiReadonlyRow).join('')}</div>`
      : '<div class="gh-empty-state"><p class="gh-empty-sub">This endpoint doesn\'t declare any headers in the spec</p></div>';
    footer.style.display = 'none';
    return;
  }

  footer.style.display = '';
  const isGlobal = tab === 'global';
  const configs  = isGlobal ? getGlobalHeadersConfig() : getEndpointHeadersConfig(_ghEpKey);

  if (isGlobal) {
    titleEl.textContent = 'Global headers';
    icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke-width="1.8"/>
      <path stroke-width="1.8" d="M2 12h20M12 2a15.3 15.3 0 0 1 0 20M12 2a15.3 15.3 0 0 0 0 20"/>
    </svg>`;
    icon.style.cssText  = 'background:rgba(16,217,160,0.12);border-color:rgba(16,217,160,0.3);color:#10d9a0;';
    badge.textContent   = 'Global';
    badge.style.cssText = 'background:rgba(16,217,160,0.12);color:#10d9a0;border-color:rgba(16,217,160,0.25);';
    sub.textContent     = 'Applied to all requests across all endpoints';
    hint.innerHTML      = `<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;">
      <circle cx="12" cy="12" r="10" stroke-width="2"/>
      <path stroke-linecap="round" stroke-width="2" d="M12 8v4l2 2"/>
    </svg>Changes apply to new requests`;
  } else {
    titleEl.textContent = 'Endpoint headers';
    icon.innerHTML = `<svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
            d="M4 6h16M4 12h8m-8 6h16"/>
    </svg>`;
    icon.style.cssText  = 'background:rgba(181,127,255,0.12);border-color:rgba(181,127,255,0.3);color:#b57fff;';
    badge.textContent   = _ghEpKey || 'Endpoint';
    badge.style.cssText = 'background:rgba(181,127,255,0.12);color:#b57fff;border-color:rgba(181,127,255,0.25);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    sub.textContent     = 'Applied only to this endpoint, override global headers';
    hint.innerHTML      = `<svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="flex-shrink:0;">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>Overrides global headers with the same name`;
  }

  body.innerHTML = `
    <div class="gh-empty-state" id="ghEmptyState" style="display:${configs.length ? 'none' : ''};">
      <div class="gh-empty-icon">
        <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h10M4 18h16"/>
        </svg>
      </div>
      <p class="gh-empty-title">No headers</p>
      <p class="gh-empty-sub">Click "Add header" to create the first one</p>
    </div>
    <div id="ghRowsList">${configs.map(h => _hdrEditorRow(h)).join('')}</div>
    <button type="button" id="ghAddRowBtn" class="gh-add-btn">
      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
      </svg>
      Add header
    </button>`;

  document.getElementById('ghRowsList').querySelectorAll('.gh-row-card').forEach(_wireEditorRow);
  initTcControls(body);
  _updateGhEmpty();

  document.getElementById('ghAddRowBtn').addEventListener('click', () => {
    const list = document.getElementById('ghRowsList');
    const div  = document.createElement('div');
    div.innerHTML = _hdrEditorRow({});
    const row = div.firstElementChild;
    list.appendChild(row);
    _wireEditorRow(row);
    initTcControls(row);
    _updateGhEmpty();
    row.querySelector('.hdr-name')?.focus();
  });
}

/* Read-only row for an API header in the modal (no value input —
   the value is set in the endpoint panel, only the definition here) */
function _hdrApiReadonlyRow(param) {
  const sch  = param.schema || {};
  const type = sch.type || 'string';
  return `
    <div class="gh-api-row">
      <div class="gh-api-row-top">
        <span class="gh-api-row-name">${escapeHtml(param.name)}</span>
        <span class="gh-api-row-type">${escapeHtml(type)}${sch.format ? ' (' + escapeHtml(sch.format) + ')' : ''}</span>
        ${param.required ? '<span class="tc-prop-req" data-tooltip="Required">*</span>' : ''}
      </div>
      ${param.description ? `<p class="gh-api-row-desc">${escapeHtml(param.description)}</p>` : ''}
    </div>`;
}

function _saveHdrModal() {
  if (_ghActiveTab === 'api') return; // nothing to save
  const arr = _readEditorRows(document.getElementById('ghRowsList'));
  if (_ghActiveTab === 'global') {
    _saveGlobalHeadersConfig(arr);
  } else if (_ghActiveTab === 'endpoint' && _ghEpKey) {
    _saveEndpointHeadersConfig(_ghEpKey, arr);
  }
  document.getElementById('globalHeadersModal').classList.remove('active');
  rerenderEndpointHeadersSection();
  showToast('Headers saved', 'success');
}

/* ── Init ── */
function initGlobalHeaders() {
  const modal = document.getElementById('globalHeadersModal');

  document.getElementById('globalHeadersBtn').addEventListener('click', () => {
    closeEnvPanel();
    openHeadersModal();
  });

  document.getElementById('ghSaveBtn').addEventListener('click', _saveHdrModal);
  document.getElementById('ghCancelBtn').addEventListener('click', () => modal.classList.remove('active'));
  document.getElementById('closeGhModal').addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
}
