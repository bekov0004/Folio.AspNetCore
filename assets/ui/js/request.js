/* ════════════════════════════════════════
   request.js — type-based body cards,
                request sending
   ════════════════════════════════════════ */

let _bodyViewMode      = 'json';
let _currentBodySchema = null;
let _lastCurlCommand   = '';

const BODY_INPUT_CLS = 'tc-input';

/* Remove the "required field not filled" highlight as soon as
   the user starts editing it */
document.addEventListener('input', e => {
  const el = e.target.closest?.('.tc-input-invalid');
  if (el) el.classList.remove('tc-input-invalid');
});

function _isBinary(schema)     { return schema?.format === 'binary'; }
function _isPrimArray(itemSch) {
  return itemSch && ['string','number','integer','boolean'].includes(itemSch.type) && !itemSch.properties;
}

/* ── Human-readable type ── */
function _tcType(schema) {
  const t = schema.type || (schema.properties ? 'object' : schema.items ? 'array' : '');
  if (_isBinary(schema))         return 'file';
  if (t === 'array') {
    if (_isBinary(schema.items)) return 'file[]';
    if (schema.items?.type && !schema.items.properties) return `${schema.items.type}[]`;
    if (schema.items?.properties) return 'object[]';
    return 'array';
  }
  return t || 'any';
}

/* ── Primitive array row ── */
function _tcPrimRow(isch, value) {
  const type = isch?.type || 'string';
  let ctrl = '';
  if (isch?.enum) {
    ctrl = `<select class="${BODY_INPUT_CLS}">${isch.enum.map(o => `<option value="${o}" ${String(o)===String(value??isch.enum[0])?'selected':''}>${o}</option>`).join('')}</select>`;
  } else if (type === 'boolean') {
    ctrl = `<select class="${BODY_INPUT_CLS}">
      <option value="true"  ${value===true||value==='true' ?'selected':''}>true</option>
      <option value="false" ${value===false||value==='false'?'selected':''}>false</option>
    </select>`;
  } else if (type === 'integer' || type === 'number') {
    ctrl = `<input type="number" value="${value??''}" class="${BODY_INPUT_CLS}">`;
  } else {
    ctrl = `<input type="text" value="${value??''}" placeholder="${type}" class="${BODY_INPUT_CLS}">`;
  }
  return `<div class="tc-prim-item">${ctrl}<button type="button" class="tc-prim-remove" onclick="tcPrimArrRemove(this)">×</button></div>`;
}

/* ── Object array item (inline cards) ── */
function _tcObjItem(itemSchema, initValues, idx, depth = 0) {
  const childReq = itemSchema.required || [];
  const initObj  = (typeof initValues === 'object' && initValues !== null) ? initValues : {};
  const childCards = Object.entries(itemSchema.properties || {})
    .map(([n, p]) => renderTypeCard(n, p, childReq.includes(n), initObj[n], depth))
    .join('');
  return `
    <div class="tc-arr-item tc-collapsed">
      <div class="tc-arr-item-hd" onclick="tcToggleArrItem(this)">
        <svg class="tc-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/></svg>
        <span class="tc-arr-item-label">Item ${idx}</span>
        <span class="tc-obj-counter" style="margin-left:auto;margin-right:4px;"></span>
        <button type="button" class="tc-arr-item-remove" onclick="event.stopPropagation();tcArrRemove(this)">×</button>
      </div>
      <div class="tc-arr-item-body">${childCards}</div>
    </div>`;
}

/* ══════════════════════════════════════════
   Main function — renders a card by type
   ══════════════════════════════════════════ */
function renderTypeCard(name, schema, isRequired, initValue, depth = 0) {
  const type      = schema.type || (schema.properties ? 'object' : schema.items ? 'array' : '');
  const typeLabel = _tcType(schema);

  /* Property Row — for primitives */
  const leaf = (ctrl) => `
    <div class="tc-prop-row" data-tc-name="${name}">
      <div class="tc-prop-meta">
        <div class="tc-prop-name" data-tooltip="${name}">${name}</div>
        <div class="tc-prop-info">
          <span class="tc-prop-type">${typeLabel}${schema.format ? ' ('+schema.format+')' : ''}</span>
          ${isRequired ? '<span class="tc-prop-req" data-tooltip="Required field">*</span>' : ''}
        </div>
      </div>
      <div class="tc-prop-input">
        ${ctrl}
        ${schema.description ? `<p class="tc-prop-desc">${schema.description}</p>` : ''}
      </div>
    </div>`;

  /* ─ Enum ─ */
  if (schema.enum) {
    const cur = initValue ?? schema.enum[0] ?? '';
    return leaf(`<select data-tc-field="${name}" class="${BODY_INPUT_CLS}">${schema.enum.map(o => `<option value="${o}" ${String(o)===String(cur)?'selected':''}>${o}</option>`).join('')}</select>`);
  }

  /* ─ Boolean ─ */
  if (type === 'boolean') {
    const cur = String(initValue ?? 'false');
    return leaf(`<select data-tc-field="${name}" class="${BODY_INPUT_CLS}">
      <option value="true"  ${cur==='true' ?'selected':''}>true</option>
      <option value="false" ${cur==='false'?'selected':''}>false</option>
    </select>`);
  }

  /* ─ Binary file ─ */
  if (_isBinary(schema)) {
    return leaf(`<input type="file" data-tc-field="${name}" class="tc-input">`);
  }

  /* ─ Number / Integer ─ */
  if (type === 'integer' || type === 'number') {
    return leaf(`<input type="number" data-tc-field="${name}" value="${initValue??schema.default??''}" placeholder="${type}" class="${BODY_INPUT_CLS}">`);
  }

  /* ─ String (format-aware) ─ */
  if (type === 'string') {
    const cur = String(initValue ?? schema.default ?? '');
    const f   = schema.format;
    let ctrl = '';
    if      (f === 'date-time') ctrl = `<input type="datetime-local" data-tc-field="${name}" value="${cur ? cur.slice(0,16) : ''}" class="${BODY_INPUT_CLS}">`;
    else if (f === 'date')      ctrl = `<input type="date"           data-tc-field="${name}" value="${cur}" class="${BODY_INPUT_CLS}">`;
    else if (f === 'time')      ctrl = `<input type="time"           data-tc-field="${name}" value="${cur}" class="${BODY_INPUT_CLS}">`;
    else if (f === 'email')     ctrl = `<input type="email"          data-tc-field="${name}" value="${cur}" placeholder="user@example.com" class="${BODY_INPUT_CLS}">`;
    else if (f === 'uri')       ctrl = `<input type="url"            data-tc-field="${name}" value="${cur}" placeholder="https://" class="${BODY_INPUT_CLS}">`;
    else if (f === 'password')  ctrl = `<input type="password"       data-tc-field="${name}" value="${cur}" placeholder="••••••••" class="${BODY_INPUT_CLS}">`;
    else if (f === 'uuid')      ctrl = `<input type="text"           data-tc-field="${name}" value="${cur}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" class="${BODY_INPUT_CLS}">`;
    else                        ctrl = `<input type="text"           data-tc-field="${name}" value="${cur}" placeholder="${f||'string'}" class="${BODY_INPUT_CLS}">`;
    return leaf(ctrl);
  }

  /* ─ File array ─ */
  if (type === 'array' && _isBinary(schema.items)) {
    return leaf(`<input type="file" data-tc-field="${name}" multiple class="tc-input">`);
  }

  /* ─ Primitive array ─ */
  if (type === 'array' && _isPrimArray(schema.items)) {
    const isch    = schema.items;
    const initArr = Array.isArray(initValue) ? initValue : (initValue !== undefined ? [initValue] : ['']);
    const rows    = initArr.map(v => _tcPrimRow(isch, v)).join('');
    return leaf(`
      <div class="tc-prim-arr" data-item-schema='${JSON.stringify(isch).replace(/'/g,"&#39;")}'>
        <div class="tc-prim-arr-items">${rows}</div>
        <button type="button" class="tc-arr-add" onclick="tcPrimArrAdd(this)">+ Add</button>
      </div>`);
  }

  /* ─ Array of objects (inline expandable) ─ */
  if (type === 'array' && schema.items?.properties && Object.keys(schema.items.properties).length) {
    const initArr = Array.isArray(initValue) ? initValue : [];
    const items   = initArr.map((v, i) => _tcObjItem(schema.items, v, i + 1, depth + 1)).join('');
    return `
      <div class="tc-card tc-card--arr-obj tc-collapsed" data-tc-name="${name}" data-item-schema='${JSON.stringify(schema.items).replace(/'/g,"&#39;")}' data-depth="${depth % 5}">
        <div class="tc-arr-hd" onclick="tcToggleArr(this)">
          <svg class="tc-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/></svg>
          <div class="tc-prop-name">${name}</div>
          <div class="tc-prop-info">
            <span class="tc-prop-type">${typeLabel}</span>
            ${isRequired ? '<span class="tc-prop-req">*</span>' : ''}
          </div>
          <span class="tc-arr-counter tc-obj-counter"></span>
        </div>
        ${schema.description ? `<p class="tc-prop-desc" style="padding:4px 14px 0;">${schema.description}</p>` : ''}
        <div class="tc-arr-items">${items}</div>
        <button type="button" class="tc-arr-add" onclick="tcArrAdd(this)">+ Add item</button>
      </div>`;
  }

  /* ─ Array without schema (textarea fallback) ─ */
  if (type === 'array') {
    const cur = initValue !== undefined ? (typeof initValue === 'string' ? initValue : safeJsonStringify(initValue)) : '[]';
    return leaf(`<textarea data-tc-field="${name}" class="${BODY_INPUT_CLS}" rows="3" style="font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical;" spellcheck="false" placeholder="[...]">${cur}</textarea>`);
  }

  /* ─ Object with known fields (inline collapsible) ─ */
  if ((type === 'object' || schema.properties) && schema.properties && Object.keys(schema.properties).length) {
    const childReq  = schema.required || [];
    const initObj   = (typeof initValue === 'object' && initValue !== null) ? initValue : {};
    const childCards = Object.entries(schema.properties)
      .map(([n, p]) => renderTypeCard(n, p, childReq.includes(n), initObj[n], depth + 1))
      .join('');
    return `
      <div class="tc-card tc-card--object tc-collapsed" data-tc-name="${name}" data-depth="${depth % 5}">
        <button type="button" class="tc-obj-hd" onclick="tcToggleObj(this)">
          <svg class="tc-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/></svg>
          <div class="tc-prop-name">${name}</div>
          <div class="tc-prop-info">
            <span class="tc-prop-type">${typeLabel}</span>
            ${isRequired ? '<span class="tc-prop-req">*</span>' : ''}
          </div>
          <span class="tc-obj-counter"></span>
        </button>
        ${schema.description ? `<p class="tc-prop-desc" style="padding:4px 14px 0;">${schema.description}</p>` : ''}
        <div class="tc-obj-body">${childCards}</div>
      </div>`;
  }

  /* ─ Object without schema (textarea fallback) ─ */
  {
    const cur = initValue !== undefined ? (typeof initValue === 'string' ? initValue : safeJsonStringify(initValue)) : '{}';
    return leaf(`<textarea data-tc-field="${name}" class="${BODY_INPUT_CLS}" rows="3" style="font-family:'JetBrains Mono',monospace;font-size:12px;resize:vertical;" spellcheck="false" placeholder="{...}">${cur}</textarea>`);
  }
}

/* ── Collapse/expand object ── */
function tcToggleObj(btn) {
  const card = btn.closest('.tc-card--object');
  if (!card) return;
  card.classList.toggle('tc-collapsed');
}

function tcToggleArr(hd) {
  hd.closest('.tc-card--arr-obj')?.classList.toggle('tc-collapsed');
}

function tcToggleArrItem(hd) {
  hd.closest('.tc-arr-item')?.classList.toggle('tc-collapsed');
}

/* ── Add an item to an object array ── */
function tcArrAdd(btn) {
  const card  = btn.closest('.tc-card--arr-obj');
  const items = card?.querySelector('.tc-arr-items');
  if (!card || !items) return;
  const isch  = JSON.parse(card.dataset.itemSchema || '{}');
  const depth = parseInt(card.dataset.depth || '0', 10);
  const idx   = items.querySelectorAll(':scope > .tc-arr-item').length + 1;
  const div   = document.createElement('div');
  div.innerHTML = _tcObjItem(isch, {}, idx, depth);
  items.appendChild(div.firstElementChild);
  const newItem = items.lastElementChild;
  newItem.classList.remove('tc-collapsed');
  initTcControls(newItem);
  tcSyncCards();
}

/* ── Remove an item from an object array ── */
function tcArrRemove(btn) {
  const item  = btn.closest('.tc-arr-item');
  const items = item?.closest('.tc-arr-items');
  item?.remove();
  if (items) {
    items.querySelectorAll(':scope > .tc-arr-item .tc-arr-item-label')
      .forEach((lbl, i) => { lbl.textContent = `Item ${i + 1}`; });
  }
  tcSyncCards();
}

/* ── Add a primitive array row ── */
function tcPrimArrAdd(btn) {
  const wrap  = btn.closest('.tc-prim-arr');
  const isch  = JSON.parse(wrap?.dataset.itemSchema || '{}');
  const items = wrap?.querySelector('.tc-prim-arr-items');
  if (!items) return;
  const div = document.createElement('div');
  div.innerHTML = _tcPrimRow(isch, '');
  items.appendChild(div.firstElementChild);
  const newItem = items.lastElementChild;
  initTcControls(newItem);
  (newItem?.querySelector('.tc-select-btn') ?? newItem?.querySelector('input'))?.focus();
  tcSyncCards();
}

/* ── Remove a primitive array row ── */
function tcPrimArrRemove(btn) {
  const item = btn.closest('.tc-prim-item');
  const list = item?.parentElement;
  if (!item || !list) return;
  if (list.children.length > 1) item.remove();
  else { const el = item.querySelector('input,select'); if (el) el.value = ''; }
  tcSyncCards();
}

/* ══════════════════════════════════════
   DOM → JSON (schema-driven traversal)
   ══════════════════════════════════════ */

function _tcVal(schema, name, containerEl) {
  const type = schema.type || (schema.properties ? 'object' : schema.items ? 'array' : '');

  /* Object with fields → recurse into .tc-obj-body */
  if ((type === 'object' || schema.properties) && schema.properties && Object.keys(schema.properties).length) {
    const body = containerEl.querySelector(`:scope > .tc-card--object[data-tc-name="${name}"] > .tc-obj-body`);
    if (!body) return undefined;
    return buildJsonFromDom(schema, body);
  }

  /* Array of objects → iterate over .tc-arr-item */
  if (type === 'array' && schema.items?.properties && Object.keys(schema.items.properties).length) {
    const card = containerEl.querySelector(`:scope > .tc-card--arr-obj[data-tc-name="${name}"]`);
    if (!card) return undefined;
    const result = [];
    for (const body of card.querySelectorAll(':scope > .tc-arr-items > .tc-arr-item > .tc-arr-item-body')) {
      result.push(buildJsonFromDom(schema.items, body));
    }
    return result.length ? result : undefined;
  }

  /* Binary → skip for JSON */
  if (_isBinary(schema) || (type === 'array' && _isBinary(schema.items))) return undefined;

  /* Primitive array */
  if (type === 'array' && _isPrimArray(schema.items)) {
    const card = containerEl.querySelector(`:scope > .tc-card--arr-prim[data-tc-name="${name}"]`);
    if (!card) return undefined;
    const it   = schema.items.type;
    const vals = Array.from(card.querySelectorAll('.tc-prim-arr-items > .tc-prim-item input, .tc-prim-arr-items > .tc-prim-item select'))
      .map(el => {
        const v = el.value;
        if (it === 'integer' || it === 'number') return v === '' ? null : (isNaN(Number(v)) ? v : Number(v));
        if (it === 'boolean') return v === 'true';
        return v;
      }).filter(v => v !== '' && v !== null && v !== undefined);
    return vals.length ? vals : undefined;
  }

  /* Leaf / fallback → look for [data-tc-field] inside the card */
  const card = containerEl.querySelector(`:scope > [data-tc-name="${name}"]`);
  if (!card) return undefined;
  const el = card.querySelector('[data-tc-field]');
  if (!el) return undefined;
  const v = el.value;
  if (v === '' || v == null) return undefined;
  if (type === 'integer' || type === 'number') return isNaN(Number(v)) ? v : Number(v);
  if (type === 'boolean') return v === 'true';
  if (type === 'array' || type === 'object') {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

function buildJsonFromDom(schema, containerEl) {
  const obj = {};
  for (const [name, prop] of Object.entries(schema.properties || {})) {
    const val = _tcVal(prop, name, containerEl);
    if (val !== undefined) obj[name] = val;
  }
  return obj;
}

/* ── Marks a field as actually changed by the user ── */
function markTcFieldTouched(el) {
  if (el?.matches?.('[data-tc-field]')) el.dataset.tcTouched = '1';
}

/* A field is considered "filled" only if the user actually edited it
   (otherwise auto-generated placeholders like "string"/0/false would
   immediately count as filled) */
function _tcIsFilled(el) {
  return el.dataset.tcTouched === '1' && el.value !== '';
}

/* ── Update filled-field counters across all objects and arrays ── */
function updateObjCounters(container) {
  /* object cards */
  container.querySelectorAll('.tc-card--object').forEach(card => {
    const body    = card.querySelector(':scope > .tc-obj-body');
    const counter = card.querySelector(':scope > .tc-obj-hd > .tc-obj-counter');
    if (!body || !counter) return;
    const fields = [...body.querySelectorAll('[data-tc-field]:not([type="file"])')];
    const total  = fields.length;
    const filled = fields.filter(_tcIsFilled).length;
    counter.textContent = `${filled} / ${total}`;
    counter.title = `Filled in by user: ${filled} of ${total}`;
    counter.classList.toggle('tc-obj-counter--has', filled > 0);
  });

  /* array items */
  container.querySelectorAll('.tc-arr-item').forEach(item => {
    const body    = item.querySelector(':scope > .tc-arr-item-body');
    const counter = item.querySelector(':scope > .tc-arr-item-hd .tc-obj-counter');
    if (!body || !counter) return;
    const fields = [...body.querySelectorAll('[data-tc-field]:not([type="file"])')];
    const total  = fields.length;
    const filled = fields.filter(_tcIsFilled).length;
    counter.textContent = `${filled} / ${total}`;
    counter.title = `Filled in by user: ${filled} of ${total}`;
    counter.classList.toggle('tc-obj-counter--has', filled > 0);
  });

  /* array container — item count */
  container.querySelectorAll('.tc-card--arr-obj').forEach(card => {
    const counter = card.querySelector(':scope > .tc-arr-hd .tc-arr-counter');
    if (!counter) return;
    const n = card.querySelectorAll(':scope > .tc-arr-items > .tc-arr-item').length;
    counter.textContent = n > 0 ? String(n) : '';
    counter.classList.toggle('tc-obj-counter--has', n > 0);
  });
}

/* ── Sync cards → JSON textarea ── */
function tcSyncCards() {
  if (!_currentBodySchema) return;
  const container = document.getElementById('bodyCardsView');
  if (!container) return;
  const ta = document.getElementById('requestBody');
  if (!ta) return;
  ta.value = safeJsonStringify(buildJsonFromDom(_currentBodySchema, container));
  validateJson(ta); syncHighlight(ta); saveEndpointState();
  updateObjCounters(container);
}

/* ══════════════════════════════════
   Entry points for the view toggle
   ══════════════════════════════════ */

function buildBodyCardsHtml(resolved, initBodyStr) {
  const props = resolved.properties || {};
  const req   = resolved.required   || [];
  let   init  = {};
  try { init = JSON.parse(initBodyStr || '{}'); } catch {}
  let html = '';
  for (const [name, prop] of Object.entries(props)) {
    html += renderTypeCard(name, prop, req.includes(name), init[name]);
  }
  return html || '<p style="color:var(--text-muted);font-size:13px;">No fields to display</p>';
}

function syncBodyCardsToJson(_resolved) {
  tcSyncCards();
}

function syncJsonToBodyCards(resolved) {
  const ta = document.getElementById('requestBody');
  if (!ta) return;
  const container = document.getElementById('bodyCardsView');
  if (!container) return;
  /* Rebuild with current values */
  container.innerHTML = buildBodyCardsHtml(resolved, ta.value);
  container.addEventListener('input',  e => { markTcFieldTouched(e.target); tcSyncCards(); });
  container.addEventListener('change', e => { markTcFieldTouched(e.target); tcSyncCards(); });
  initTcControls(container);
  updateObjCounters(container);
}

/* ── Initialize the JSON ↔ Fields toggle ── */
function initBodyToggle(resolved, initBody) {
  const jsonView  = document.getElementById('bodyJsonView');
  const cardsView = document.getElementById('bodyCardsView');
  const btns      = document.querySelectorAll('.body-toggle-btn');
  if (!jsonView || !cardsView || !btns.length) return;

  function applyView(view) {
    _bodyViewMode = view;
    btns.forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'cards') {
      syncJsonToBodyCards(resolved);
      jsonView.style.display  = 'none';
      cardsView.style.display = '';
    } else {
      syncBodyCardsToJson(resolved);
      jsonView.style.display  = '';
      cardsView.style.display = 'none';
      /* Sync height and highlighting when switching back */
      const ta = document.getElementById('requestBody');
      if (ta) syncHighlight(ta);
    }
  }

  btns.forEach(btn => btn.addEventListener('click', () => applyView(btn.dataset.view)));

  /* Event delegation — also works for dynamically added elements */
  cardsView.addEventListener('input',  e => markTcFieldTouched(e.target));
  cardsView.addEventListener('change', e => markTcFieldTouched(e.target));

  document.getElementById('resetBodyBtn')?.addEventListener('click', () => {
    if (_bodyViewMode === 'cards') {
      const ta = document.getElementById('requestBody');
      if (ta) { ta.value = initBody; validateJson(ta); syncHighlight(ta); }
      syncJsonToBodyCards(resolved);
    }
  });
}

/**
 * Recursively generates an example value from an OpenAPI schema
 */
function generateExampleFromSchema(schema, components, visited = new Set()) {
  if (!schema) return null;

  if (schema.$ref) {
    const name = schema.$ref.replace('#/components/schemas/', '');
    if (visited.has(name)) return null;
    const ref  = components?.schemas?.[name];
    if (!ref) return null;
    const next = new Set(visited);
    next.add(name);
    return generateExampleFromSchema(ref, components, next);
  }

  if (schema.type === 'array') {
    const item = generateExampleFromSchema(schema.items, components, visited);
    return item !== null ? [item] : [];
  }

  if (schema.type === 'object' || schema.properties) {
    const obj = {};
    for (const prop in schema.properties) {
      const val = generateExampleFromSchema(schema.properties[prop], components, visited);
      obj[prop] = val !== null ? val : '';
    }
    return obj;
  }

  if (schema.type === 'string') {
    if (schema.format === 'binary')    return null;
    if (schema.enum?.length)           return schema.enum[0];
    if ('example' in schema)           return schema.example;
    if ('default' in schema)           return schema.default;
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'date')      return new Date().toISOString().split('T')[0];
    return 'string';
  }

  if (schema.type === 'boolean') return schema.default ?? false;
  if (schema.type === 'integer' || schema.type === 'number') return schema.default ?? 0;

  return null;
}

/**
 * Renders a parameter card: meta on the left, input on the right
 * (used for path / query / header)
 */
function renderParamCard(param, value = '') {
  const id   = paramId(param.name, param.in);
  const sch  = param.schema || {};
  const req  = param.required;
  const type = sch.type || 'string';

  const inputCls = BODY_INPUT_CLS;

  let control = '';
  if (sch.enum) {
    control = `<select id="${id}" class="${inputCls}">${sch.enum.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  } else if (sch.type === 'boolean') {
    const boolVal = String(value ?? 'false');
    control = `<select id="${id}" class="${inputCls}"><option value="true" ${boolVal === 'true' ? 'selected' : ''}>true</option><option value="false" ${boolVal === 'false' ? 'selected' : ''}>false</option></select>`;
  } else if (sch.format === 'binary') {
    control = `<input type="file" id="${id}" multiple="${sch.type === 'array'}" class="tc-input" />`;
  } else {
    control = `<input type="text" id="${id}" value="${escapeHtml(value)}" placeholder="${escapeHtml(type)}" class="${inputCls}" />`;
  }

  return `
    <div class="tc-prop-row tc-prop-row--${param.in}" style="border-radius:10px;margin-bottom:4px;border:1px solid var(--border);">
      <div class="tc-prop-meta">
        <div class="tc-prop-name" data-tooltip="${escapeHtml(param.name)}">${escapeHtml(param.name)}</div>
        <div class="tc-prop-info">
          <span class="tc-prop-type">${escapeHtml(type)}${sch.format ? ' ('+escapeHtml(sch.format)+')' : ''}</span>
          ${req ? '<span class="tc-prop-req" data-tooltip="Required parameter">*</span>' : ''}
        </div>
      </div>
      <div class="tc-prop-input">
        ${control}
        ${param.description ? `<p class="tc-prop-desc">${escapeHtml(param.description)}</p>` : ''}
      </div>
    </div>`;
}

/**
 * Builds the HTML for one section (header divider + content)
 */
function epSection(title, badge, content) {
  return `
    <div class="ep-section">
      <div class="ep-section-hd">
        <span class="ep-section-title">${title}</span>
        <span class="ep-section-line"></span>
        ${badge ? `<span class="ep-section-badge">${badge}</span>` : ''}
      </div>
      ${content}
    </div>`;
}

/**
 * Renders the selected endpoint's panel into #content
 */
function showEndpoint(path, method) {
  const ep      = currentEndpointData;
  const content = document.getElementById('content');
  let formContent    = '';
  let initBody       = '';
  _currentBodySchema = null;

  // ── Parameters — path and query (header params moved to the "Headers" section) ──
  const paramOrder = ['path', 'query'];
  const grouped    = {};
  let   paramCount = 0;
  for (const par of (ep.parameters || []).filter(p => paramOrder.includes(p.in))) {
    (grouped[par.in] ||= []).push(par);
    paramCount++;
  }

  if (paramCount > 0) {
    let groupsHtml = '';
    for (const loc of paramOrder) {
      if (!grouped[loc]) continue;
      const cards = grouped[loc].map(par => renderParamCard(par, par.schema?.default ?? '')).join('');
      groupsHtml += `
        <div class="param-location-group">
          <div class="param-location-label param-location-label--${loc}">${loc}</div>
          <div class="param-cards-list">${cards}</div>
        </div>`;
    }
    formContent += epSection('Parameters', String(paramCount), groupsHtml);
  }

  // ── Headers (global + endpoint-custom + OpenAPI in:header) ──
  formContent += buildEndpointHeadersHtml(ep);

  // ── Request body ──
  if (ep.requestBody) {
    const jsonSchema = ep.requestBody.content?.['application/json']?.schema;
    if (jsonSchema) {
      const resolved  = resolveSchema(jsonSchema, apiSpec.components);
      _currentBodySchema = resolved;
      const example   = generateExampleFromSchema(jsonSchema, apiSpec.components);
      initBody        = example ? safeJsonStringify(example) : '{}';
      const hasProps  = !!(resolved.properties && Object.keys(resolved.properties).length);
      const isCards   = _bodyViewMode === 'cards' && hasProps;

      const toggleHtml = hasProps ? `
        <div class="body-view-toggle">
          <button type="button" class="body-toggle-btn${!isCards ? ' active' : ''}" data-view="json">JSON</button>
          <button type="button" class="body-toggle-btn${isCards  ? ' active' : ''}" data-view="cards">Fields</button>
        </div>` : '';

      const bodyHtml = `
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <button type="button" id="resetBodyBtn">Reset</button>
            ${toggleHtml}
          </div>
          <div id="bodyJsonView"${isCards ? ' style="display:none;"' : ''}>
            <div class="json-editor-wrap" id="jsonEditorWrap">
              <div class="json-toolbar">
                <button type="button" class="json-toolbar-btn" id="prettifyBtn">Prettify</button>
                <button type="button" class="json-toolbar-btn" id="minifyBtn">Minify</button>
                <button type="button" class="json-toolbar-btn" id="stringifyBtn">Stringify</button>
                <div class="json-status valid" id="jsonStatus">
                  <div class="json-status-dot"></div>
                  <span class="json-status-text">Valid JSON</span>
                </div>
              </div>
              <div class="json-hl-container">
                <pre class="json-hl-backdrop" id="jsonHlBackdrop" aria-hidden="true"></pre>
                <textarea id="requestBody" class="mt-0 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 font-mono shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white" spellcheck="false">${initBody}</textarea>
                ${jsonActionBtnsHtml('copyBodyBtn', 'downloadBodyBtn')}
              </div>
              <div class="json-error-msg" id="jsonErrorMsg"></div>
            </div>
          </div>
          ${hasProps ? `<div id="bodyCardsView" class="param-cards-list"${!isCards ? ' style="display:none;"' : ''}>${buildBodyCardsHtml(resolved, initBody)}</div>` : ''}
        </div>`;
      formContent += epSection('Request body', 'JSON', bodyHtml);
    } else {
      const mp = ep.requestBody.content?.['multipart/form-data']?.schema;
      if (mp) {
        const resolvedMp = resolveSchema(mp, apiSpec.components);
        const mpReq      = resolvedMp.required || [];
        let cards = '';
        for (const [pn, pr] of Object.entries(resolvedMp.properties || {})) {
          cards += renderTypeCard(pn, pr, mpReq.includes(pn), undefined);
        }
        formContent += epSection('Request body', 'multipart', `<div class="param-cards-list" id="mpCardsView">${cards}</div>`);
      }
    }
  }

  // ── Response — all codes from the spec, switchable via tabs ──
  const responseCodes = Object.keys(ep.responses || {});
  let _exRaw = '';
  const preferredCode = ['200', '201', 'default'].find(c => responseCodes.includes(c)) || responseCodes[0] || null;

  const codeTabsHtml = responseCodes.length > 1
    ? `<div class="resp-code-tabs">${responseCodes.map(code =>
        `<button type="button" class="resp-code-tab${code === preferredCode ? ' active' : ''}${(ep.responses[code].description || '').match(/error/i) || Number(code) >= 400 ? ' resp-code-tab--err' : ''}" data-code="${escapeHtml(code)}">${escapeHtml(code)}</button>`
      ).join('')}</div>`
    : '';

  formContent += epSection('Response', preferredCode || '', `
    <div id="responseBlock" class="hidden" style="position:relative;margin-bottom:14px;">
      ${jsonActionBtnsHtml('copyResponseBtn', 'downloadResponseBtn')}
      <div id="responseContent" class="response-block"></div>
    </div>
    <div id="curlBlock" class="hidden" style="margin-bottom:14px;">
      <div class="curl-label">
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 17l6-6-6-6M12 19h8"/>
        </svg>
        cURL
      </div>
      <div id="curlContent" style="position:relative;margin-top:8px;">
        ${jsonActionBtnsHtml('copyCurlBtn')}
        <pre class="code-block" id="curlPre"></pre>
      </div>
    </div>
    ${codeTabsHtml}
    <div id="responseExample"></div>`);

  content.innerHTML = `
    <div class="endpoint-card">
      <div class="endpoint-header">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;${ep.summary ? 'margin-bottom:8px;' : ''}min-width:0;">
          <span class="method-badge method-${method.toLowerCase()}" style="font-size:12px;padding:4px 10px;flex-shrink:0;">${method}</span>
          <h2 style="flex:1;">${escapeHtml(path)}</h2>
        </div>
        ${ep.summary     ? `<p style="font-size:13px;color:var(--text-muted);margin-bottom:${ep.description ? '4px' : '0'};">${escapeHtml(ep.summary)}</p>` : ''}
        ${ep.description ? `<div class="ep-description">${marked.parse(ep.description)}</div>` : ''}
      </div>
      <form id="tryApiForm" enctype="multipart/form-data">${formContent}</form>
    </div>`;

  initJsonEditor(initBody);
  if (_currentBodySchema) initBodyToggle(_currentBodySchema, initBody);
  restoreEndpointState();
  saveEndpointState();
  initTcControls(content);
  updateObjCounters(content);

  document.getElementById('requestBody')
    ?.addEventListener('input', saveEndpointState);
  document.querySelectorAll('#content .tc-prop-row--path .tc-prop-input input, #content .tc-prop-row--path .tc-prop-input select, #content .tc-prop-row--query .tc-prop-input input, #content .tc-prop-row--query .tc-prop-input select')
    .forEach(el => el.addEventListener('input', saveEndpointState));

  // Wire custom header inputs (G, E) + API header params to saveEndpointState
  _wireHdrSectionInputs();
  // Also subscribe API header params (they now live in the Headers section, not Parameters)
  const apiHdrParams = (ep.parameters || []).filter(p => p.in === 'header');
  for (const par of apiHdrParams) {
    const el = document.getElementById(paramId(par.name, 'header'));
    if (el) el.addEventListener('input', saveEndpointState);
  }

  /* Click a value in the response block — copy without quotes */
  document.getElementById('responseContent')?.addEventListener('click', e => {
    const span = e.target.closest('.json-str, .json-num, .json-bool');
    if (!span) return;
    let val = span.textContent;
    if (span.classList.contains('json-str') && val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    }
    copyToClipboard(val, 'Value copied');
  });

  /* Response example for the selected code — rebuilds #responseExample
     and rebinds copy/download (elements are recreated each time) */
  function _renderRespExample(code) {
    const resp = code ? ep.responses?.[code] : null;
    const exampleEl = document.getElementById('responseExample');
    if (!exampleEl) return;

    if (!resp) {
      exampleEl.innerHTML = `<p style="font-size:13px;color:var(--text-muted);">No responses defined in the spec</p>`;
      return;
    }

    const jc = resp.content?.['application/json'];
    let ex = '';
    if (jc?.example)     ex = safeJsonStringify(jc.example);
    else if (jc?.schema) { const exa = generateExampleFromSchema(jc.schema, apiSpec.components); ex = exa ? safeJsonStringify(exa) : '{}'; }
    else                 ex = 'No response example specified in the spec';
    _exRaw = ex;
    const isJson = ex !== 'No response example specified in the spec';

    exampleEl.innerHTML = `
      ${resp.description ? `<p class="resp-code-desc">${escapeHtml(resp.description)}</p>` : ''}
      <div style="position:relative;" class="code-block-wrap">
        ${isJson ? jsonActionBtnsHtml('copyExampleBtn', 'downloadExampleBtn') : ''}
        <pre class="code-block">${highlightJson(ex)}</pre>
      </div>`;

    document.getElementById('copyExampleBtn')?.addEventListener('click', () => {
      copyToClipboard(_exRaw, 'Example copied');
    });
    document.getElementById('downloadExampleBtn')?.addEventListener('click', () => {
      const parts    = currentEndpointKey.split(' ');
      const method   = parts[0];
      const pathPart = (parts[1] || '').replace(/\//g, '-').replace(/[{}]/g, '').replace(/^-/, '');
      const filename = `example-${method}-${code}-${pathPart}.json`;
      const blob     = new Blob([_exRaw], { type: 'application/json' });
      const url      = URL.createObjectURL(blob);
      const a        = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    });
  }

  _renderRespExample(preferredCode);

  document.querySelectorAll('.resp-code-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.resp-code-tab').forEach(t => t.classList.toggle('active', t === tab));
      _renderRespExample(tab.dataset.code);
    });
  });

  document.getElementById('copyCurlBtn')?.addEventListener('click', () => {
    copyToClipboard(_lastCurlCommand, 'cURL copied');
  });
}

/**
 * Builds the equivalent cURL command for the last executed request
 */
function _buildCurlCommand(method, url, headers, { json, multipart, form } = {}) {
  const escSingle = s => String(s).replace(/'/g, `'\\''`);
  const lines = [`curl -X ${method} '${escSingle(url)}'`];

  for (const [k, v] of Object.entries(headers || {})) {
    lines.push(`  -H '${escSingle(k)}: ${escSingle(v)}'`);
  }

  if (multipart && form) {
    for (const [k, v] of form.entries()) {
      if (v instanceof File) lines.push(`  -F '${escSingle(k)}=@${escSingle(v.name)}'`);
      else lines.push(`  -F '${escSingle(k)}=${escSingle(v)}'`);
    }
  } else if (json !== null && json !== undefined) {
    lines.push(`  -d '${escSingle(JSON.stringify(json))}'`);
  }

  return lines.join(' \\\n');
}

/**
 * Builds the list of response headers
 */
function _responseHeadersHtml(entries) {
  if (!entries.length) return '';
  const rows = entries
    .map(([k, v]) => `<div class="response-header-row"><span class="response-header-key">${escapeHtml(k)}</span><span class="response-header-val">${escapeHtml(v)}</span></div>`)
    .join('');
  return `<div class="response-headers">${rows}</div>`;
}

/**
 * Checks required path/query/header parameters and required
 * top-level body fields before sending. Returns the first
 * invalid element (for scroll/focus) and a message for the toast.
 */
function _validateRequiredFields(ep, json) {
  document.querySelectorAll('.tc-input-invalid').forEach(el => el.classList.remove('tc-input-invalid'));

  for (const par of ep.parameters || []) {
    if (!par.required) continue;
    const el = document.getElementById(paramId(par.name, par.in));
    if (el && el.type !== 'file' && el.value === '') {
      el.classList.add('tc-input-invalid');
      return { el, message: `Fill in the required parameter "${par.name}"` };
    }
  }

  if (_currentBodySchema?.required?.length && json && typeof json === 'object') {
    const missing = _currentBodySchema.required.filter(name => {
      const v = json[name];
      return v === undefined || v === null || v === '';
    });
    if (missing.length) {
      const ta = document.getElementById('requestBody');
      ta?.classList.add('tc-input-invalid');
      return { el: ta, message: `Fill in the required request body fields: ${missing.join(', ')}` };
    }
  }

  return {};
}

/**
 * Sends the HTTP request for the selected endpoint
 */
async function sendRequest() {
  if (!currentEndpointData) return;

  const env = getCurrentEnv();
  const ep  = currentEndpointData;
  const btn = document.getElementById('executeRequestBtn');
  const origHTML = btn.innerHTML;

  btn.disabled  = true;
  btn.innerHTML = '<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="4" stroke-opacity=".3"/><path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 6.627 5.373 12 12 12v-4c-3.314 0-6-2.686-6-6z" fill="currentColor"/></svg>';

  const query      = {};
  const pathParams = {};

  // Merge order: global custom → endpoint custom → OpenAPI header params.
  // Auth/extra headers are now configured only via Global headers.
  const headers = {
    ...resolveCustomHeaders(getGlobalHeadersConfig(), 'gh-'),
    ...resolveCustomHeaders(getEndpointHeadersConfig(currentEndpointKey), 'eh-'),
  };
  applyAuthToRequest(ep, headers, query);

  let multipart = false;
  let json      = null;
  let form      = null;

  // Collect params
  for (const par of ep.parameters || []) {
    const el = document.getElementById(paramId(par.name, par.in));
    if (!el || el.type === 'file') continue;
    const v = el.value;
    if (par.in === 'query')  query[par.name]   = v;
    if (par.in === 'header' && v !== '') headers[par.name] = v;  // overrides custom headers
    if (par.in === 'path')   pathParams[par.name] = v;
  }

  // Body
  if (ep.requestBody) {
    const ms = ep.requestBody.content?.['multipart/form-data']?.schema;
    if (ms) {
      multipart = true;
      form = new FormData();
      const mpContainer = document.getElementById('mpCardsView');
      if (mpContainer) {
        /* Files — collect by data-tc-field */
        for (const fileEl of mpContainer.querySelectorAll('input[type="file"]')) {
          const fname = fileEl.dataset.tcField;
          if (fname && fileEl.files.length) {
            for (const file of fileEl.files) form.append(fname, file);
          }
        }
        /* Remaining data — DOM traversal (binary is skipped) */
        const resolvedMs = resolveSchema(ms, apiSpec.components);
        const data = buildJsonFromDom(resolvedMs, mpContainer);
        for (const [k, v] of Object.entries(data)) {
          form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        }
      }
    } else {
      const ta = document.getElementById('requestBody');
      if (ta?.value) {
        try { json = JSON.parse(ta.value); }
        catch { showToast('Invalid JSON in request body', 'error'); btn.innerHTML = origHTML; btn.disabled = false; return; }
      }
    }
  }

  // Validate required fields before sending
  const invalid = _validateRequiredFields(ep, json);
  if (invalid.el) {
    showToast(invalid.message, 'error');
    invalid.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    invalid.el.focus?.();
    btn.innerHTML = origHTML; btn.disabled = false;
    return;
  }

  // Build URL
  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) { if (v !== '') qp.append(k, v); }
  let url = `${env.baseUrl}${currentEndpointKey.split(' ')[1]}`;
  for (const [k, v] of Object.entries(pathParams)) {
    url = url.replace(`{${k}}`, encodeURIComponent(v));
  }
  if (qp.toString()) url += `?${qp.toString()}`;

  if (json) headers['Content-Type'] = 'application/json';

  const method = currentEndpointKey.split(' ')[0].toUpperCase();

  /* Build the cURL before sending — it reflects the request itself, not
     the result, so we show it even on a network error */
  _lastCurlCommand = _buildCurlCommand(method, url, json ? { ...headers, 'Content-Type': 'application/json' } : headers, { json, multipart, form });
  const curlPre = document.getElementById('curlPre');
  if (curlPre) curlPre.textContent = _lastCurlCommand;
  document.getElementById('curlBlock')?.classList.remove('hidden');

  const rb = document.getElementById('responseBlock');
  const rc = document.getElementById('responseContent');
  document.getElementById('responseExample')?.classList.add('hidden');
  rb.classList.add('hidden');

  const t0 = performance.now();

  try {
    const opts = { method };

    if (multipart) {
      opts.body = form;
      // Headers for multipart are set automatically by the browser (including boundary)
      if (Object.keys(headers).length) opts.headers = headers;
    } else if (json) {
      opts.headers = { ...headers, 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(json);
    } else {
      opts.headers = headers;
    }

    const res    = await fetch(url, opts);
    const durMs  = Math.round(performance.now() - t0);
    const ct     = res.headers.get('content-type');
    let body  = '';
    if (ct?.includes('application/json')) { const j = await res.json(); body = safeJsonStringify(j); }
    else body = await res.text();

    const st = `${res.status} ${res.statusText}`;
    const ok = res.ok;
    const resHeaders = [...res.headers.entries()];

    rc.innerHTML = `
      <div class="response-status ${ok ? 'bg-green-500' : 'bg-red-500'} text-white">${st} <span class="response-duration">· ${durMs} ms</span></div>
      <div class="response-body-wrap ${ok ? 'text-green-200' : 'text-red-200'}">
        ${_responseHeadersHtml(resHeaders)}
        <pre>${ct?.includes('application/json') ? highlightJson(body) : escapeHtml(body)}</pre>
      </div>`;
    rc.className = `response-block p-4 rounded-lg ${ok ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'}`;
    rb.classList.remove('hidden');
    bindResponseActions(body);
    saveEndpointState();
    scrollToResponse(rb);

  } catch (err) {
    const durMs = Math.round(performance.now() - t0);
    rc.innerHTML = `<div class="response-status bg-red-500 text-white">Network error <span class="response-duration">· ${durMs} ms</span></div><div class="response-body-wrap text-red-200"><pre>${escapeHtml(err.message)}</pre></div>`;
    rc.className = 'response-block p-4 rounded-lg bg-red-900/30 border border-red-800';
    rb.classList.remove('hidden');
    bindResponseActions(err.message);
    saveEndpointState();
    scrollToResponse(rb);

  } finally {
    btn.innerHTML = origHTML;
    btn.disabled  = false;
  }
}

/* ── Wires the Copy / Download buttons to the received response ── */
function bindResponseActions(rawBody) {
  const copyBtn = document.getElementById('copyResponseBtn');
  const dlBtn   = document.getElementById('downloadResponseBtn');

  if (copyBtn) {
    copyBtn.onclick = () => copyToClipboard(rawBody, 'Response copied');
  }

  if (dlBtn) {
    dlBtn.onclick = () => {
      const parts    = currentEndpointKey.split(' ');
      const method   = parts[0];
      const path     = (parts[1] || '').replace(/\//g, '-').replace(/[{}]/g, '').replace(/^-/, '');
      const filename = `response-${method}-${path}.json`;
      const blob     = new Blob([rawBody], { type: 'application/json' });
      const url      = URL.createObjectURL(blob);
      const a        = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
  }
}

/**
 * Smoothly scrolls to the response block, accounting for the fixed header height
 */
function scrollToResponse(el) {
  setTimeout(() => {
    const headerH = 52 + 16;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, 50);
}
