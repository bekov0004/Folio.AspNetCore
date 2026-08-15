/* ════════════════════════════════════════
   schema.js — endpoint schema viewer
   in pseudo-JSON format with highlighting
   ════════════════════════════════════════ */

/* ── Recursive $ref resolution ── */
function resolveSchema(schema, components, visited = new Set()) {
  if (!schema) return {};
  if (schema.$ref) {
    const name = schema.$ref.replace('#/components/schemas/', '');
    if (visited.has(name)) return { _circular: true, _name: name };
    const ref = components?.schemas?.[name];
    if (!ref) return {};
    const next = new Set(visited);
    next.add(name);
    return resolveSchema(ref, components, next);
  }
  if (schema.allOf) {
    let merged = { properties: {}, required: [] };
    for (const s of schema.allOf) {
      const r = resolveSchema(s, components, visited);
      Object.assign(merged, r);
      if (r.properties) Object.assign(merged.properties, r.properties);
      if (r.required)   merged.required = [...merged.required, ...r.required];
    }
    if (!Object.keys(merged.properties).length) delete merged.properties;
    if (!merged.required.length) delete merged.required;
    if (schema.description) merged.description = schema.description;
    return merged;
  }
  const result = { ...schema };
  if (schema.properties) {
    result.properties = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      result.properties[k] = resolveSchema(v, components, visited);
    }
  }
  if (schema.items) result.items = resolveSchema(schema.items, components, visited);
  return result;
}

/* ── Helpers ── */
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PJ_TYPE = {
  string:  'pj-ts',
  integer: 'pj-tn',
  number:  'pj-tn',
  boolean: 'pj-tb',
  object:  'pj-to',
  array:   'pj-ta',
};

function typeSpan(schema) {
  if (schema._circular) return `<span class="pj-tc">[Circular: ${esc(schema._name)}]</span>`;
  const t   = schema.type || (schema.properties ? 'object' : schema.items ? 'array' : 'any');
  const cls = PJ_TYPE[t] || 'pj-tu';
  let   out = `<span class="${cls}">${t}</span>`;
  if (schema.format)   out += `<span class="pj-fmt">(${esc(schema.format)})</span>`;
  if (schema.nullable) out += `<span class="pj-null"> | null</span>`;
  return out;
}

/* ── Recursive line building ── */
function collectLines(name, schema, isRequired, depth, lines, badge = '') {
  const pad  = '  '.repeat(depth);
  const type = schema.type || (schema.properties ? 'object' : schema.items ? 'array' : '');
  const isObj = type === 'object' || !!schema.properties;
  const isArr = type === 'array' && schema.items;

  const keyHtml = name !== null
    ? `<span class="pj-key">${esc(name)}</span><span class="pj-colon">:</span> `
    : '';

  /* ── Object / Array ── */
  if (isObj || isArr) {
    const open  = isArr ? '[' : '{';
    const close = isArr ? ']' : '}';
    let hdr = `${pad}${keyHtml}<span class="pj-brace">${open}</span>`;
    if (isRequired) hdr += ` <span class="pj-req">required</span>`;
    if (badge)      hdr += ` <span class="pj-badge">${esc(badge)}</span>`;
    if (schema.description) hdr += ` <span class="pj-desc">// ${esc(schema.description)}</span>`;
    lines.push(hdr);
    if (isArr && schema.items) {
      collectLines(null, schema.items, false, depth + 1, lines);
    } else if (schema.properties) {
      const req = schema.required || [];
      for (const [cn, cv] of Object.entries(schema.properties)) {
        collectLines(cn, cv, req.includes(cn), depth + 1, lines);
      }
    }
    lines.push(`${pad}<span class="pj-brace">${close}</span>`);
    return;
  }

  /* ── Scalar ── */
  let line = `${pad}${keyHtml}${typeSpan(schema)}`;
  if (isRequired) line += ` <span class="pj-req">required</span>`;
  if ('default' in schema) line += ` <span class="pj-dflt">= ${esc(JSON.stringify(schema.default))}</span>`;
  if (badge) line += ` <span class="pj-badge">${esc(badge)}</span>`;
  if (schema.description) line += ` <span class="pj-desc">// ${esc(schema.description)}</span>`;
  lines.push(line);

  /* enum on the next line, with extra indentation */
  if (schema.enum?.length) {
    const vals = schema.enum
      .map(v => `<span class="pj-ev">${esc(v === null ? 'null' : JSON.stringify(v))}</span>`)
      .join(' ');
    lines.push(`${pad}  <span class="pj-enum-lbl">// enum:</span> ${vals}`);
  }
}

/* ── Wrapper for <pre> ── */
function makePre(lines) {
  return `<div class="pjson-wrap"><pre class="pjson-pre">${lines.join('\n')}</pre></div>`;
}

/* ── Building modal content ── */
function buildSchemaContent() {
  if (!currentEndpointData) return '';
  const ep         = currentEndpointData;
  const components = apiSpec?.components;
  let   html       = '';

  /* Parameters */
  const params = (ep.parameters || []).filter(p => ['path', 'query', 'header'].includes(p.in));
  if (params.length) {
    const lines = [`<span class="pj-brace">{</span>`];
    for (const p of params) {
      const sch = resolveSchema(p.schema || {}, components);
      if (p.description && !sch.description) sch.description = p.description;
      collectLines(p.name, sch, !!p.required, 1, lines, p.in);
    }
    lines.push(`<span class="pj-brace">}</span>`);
    html += pjSection('Parameters', String(params.length), makePre(lines));
  }

  /* Request body — JSON */
  const jsonSch = ep.requestBody?.content?.['application/json']?.schema;
  if (jsonSch) {
    const resolved = resolveSchema(jsonSch, components);
    const lines    = [];
    collectLines(null, resolved, false, 0, lines);
    html += pjSection('Request body', 'JSON', makePre(lines));
  }

  /* Request body — multipart */
  const mpSch = ep.requestBody?.content?.['multipart/form-data']?.schema;
  if (mpSch && !jsonSch) {
    const resolvedMp = resolveSchema(mpSch, components);
    const lines = [`<span class="pj-brace">{</span>`];
    const req   = resolvedMp.required || [];
    for (const [n, s] of Object.entries(resolvedMp.properties || {})) {
      const resolved = resolveSchema(s, components);
      collectLines(n, resolved, req.includes(n), 1, lines);
    }
    lines.push(`<span class="pj-brace">}</span>`);
    html += pjSection('Request body', 'multipart', makePre(lines));
  }

  return html || '<p style="color:var(--text-muted);font-size:13px;padding:8px 0;">No schema defined for this endpoint</p>';
}

function pjSection(title, badge, body) {
  return `
    <div class="schema-section">
      <div class="schema-section-hd">
        <span class="schema-section-title">${title}</span>
        <span class="schema-section-line"></span>
        <span class="schema-section-badge">${badge}</span>
      </div>
      ${body}
    </div>`;
}

/* ── Endpoint schema modal ── */
function showSchemaModal() {
  if (!currentEndpointData) {
    showModelsModal();
    return;
  }
  const method = currentEndpointKey.split(' ')[0];
  const path   = currentEndpointKey.split(' ').slice(1).join(' ');
  document.getElementById('schemaModalTitle').innerHTML =
    `<span class="method-badge method-${method.toLowerCase()}" style="font-size:11px;padding:3px 8px;flex-shrink:0;">${method}</span>
     <span style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-secondary);word-break:break-all;">${esc(path)}</span>`;
  const schemaBody = document.getElementById('schemaModalBody');
  schemaBody.innerHTML = buildSchemaContent();
  document.getElementById('schemaModal').classList.add('active');
  addPjsonActions(schemaBody);
}

function initSchemaModal() {
  document.getElementById('schemaViewBtn').addEventListener('click', showSchemaModal);
  const modal = document.getElementById('schemaModal');
  document.getElementById('closeSchemaModal').addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) modal.classList.remove('active');
  });
  initModelsModal();
}

/* ════════════════════════════════════════
   Models browser modal
   ════════════════════════════════════════ */

let _selectedModel = null;

function renderModelsList(query) {
  const schemas = apiSpec?.components?.schemas || {};
  const names   = Object.keys(schemas).filter(n =>
    !query || n.toLowerCase().includes(query.toLowerCase())
  );
  if (!names.length) return '<p class="models-empty">Nothing found</p>';
  return names.map(n =>
    `<div class="models-item" data-model="${esc(n)}" data-tooltip="${esc(n)}">
       <span class="models-dot"></span>
       <span class="models-item-name">${esc(n)}</span>
     </div>`
  ).join('');
}

function renderModelSchema(name) {
  const components = apiSpec?.components;
  const raw        = components?.schemas?.[name];
  if (!raw) return '<p style="color:var(--text-muted);font-size:13px;">Schema not found</p>';
  const resolved = resolveSchema(raw, components);
  const lines    = [];
  collectLines(null, resolved, false, 0, lines);
  return makePre(lines);
}

function selectModel(name) {
  _selectedModel = name;
  document.querySelectorAll('#modelsList .models-item').forEach(el =>
    el.classList.toggle('active', el.dataset.model === name)
  );
  document.getElementById('modelsSchemaTitle').textContent = name;
  const modelsBody = document.getElementById('modelsSchemaBody');
  modelsBody.innerHTML = renderModelSchema(name);
  addPjsonActions(modelsBody, name);
}

function renderModelsPanel(query = '') {
  const listEl = document.getElementById('modelsList');
  listEl.innerHTML = renderModelsList(query);
  const items  = Array.from(listEl.querySelectorAll('.models-item'));
  const toSel  = items.find(el => el.dataset.model === _selectedModel) || items[0];
  if (toSel) selectModel(toSel.dataset.model);
  items.forEach(el => el.addEventListener('click', () => selectModel(el.dataset.model)));
}

function showModelsModal() {
  const schemas = apiSpec?.components?.schemas || {};
  const count   = Object.keys(schemas).length;
  document.getElementById('modelsModalCount').textContent = count ? `${count} model${count === 1 ? '' : 's'}` : '';
  document.getElementById('modelsSearch').value = '';
  renderModelsPanel('');
  document.getElementById('modelsModal').classList.add('active');
}

function initModelsModal() {
  const modal = document.getElementById('modelsModal');
  document.getElementById('closeModelsModal').addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) modal.classList.remove('active');
  });
  document.getElementById('modelsSearch').addEventListener('input', e =>
    renderModelsPanel(e.target.value.trim())
  );
}
