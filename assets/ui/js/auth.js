/* Authorization: support for OpenAPI security schemes (apiKey, http basic/bearer). */

const AUTH_STORAGE_KEY = 'spectra_auth_schemes';

function getAuthSchemesConfig() {
  try { return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function _saveAuthSchemesConfig(cfg) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cfg));
  _updateAuthorizeBtnState();
}

function _authIsSchemeConfigured(schemeName, scheme, cfg) {
  const v = cfg[schemeName];
  if (!v) return false;
  if (scheme.type === 'http' && String(scheme.scheme).toLowerCase() === 'basic') {
    return !!(v.username || v.password);
  }
  return !!v.value;
}

function _updateAuthorizeBtnState() {
  const btn = document.getElementById('authorizeBtn');
  if (!btn) return;
  const schemes = apiSpec?.components?.securitySchemes || {};
  const names = Object.keys(schemes);
  btn.style.display = names.length ? '' : 'none';
  if (!names.length) return;
  const cfg = getAuthSchemesConfig();
  const anyConfigured = names.some(n => _authIsSchemeConfigured(n, schemes[n], cfg));
  btn.classList.toggle('env-btn--active', anyConfigured);
  btn.style.color = anyConfigured ? '#10d9a0' : '';
}

function _authSchemeLabel(scheme) {
  if (scheme.type === 'http' && String(scheme.scheme).toLowerCase() === 'bearer') return 'HTTP Bearer';
  if (scheme.type === 'http' && String(scheme.scheme).toLowerCase() === 'basic')  return 'HTTP Basic';
  if (scheme.type === 'apiKey') return `API Key (${scheme.in}: ${scheme.name})`;
  if (scheme.type === 'oauth2') return 'OAuth2';
  if (scheme.type === 'openIdConnect') return 'OpenID Connect';
  return scheme.type || 'Scheme';
}

function _renderAuthSchemesList() {
  const wrap = document.getElementById('authSchemesList');
  if (!wrap) return;
  const schemes = apiSpec?.components?.securitySchemes || {};
  const cfg = getAuthSchemesConfig();
  const names = Object.keys(schemes);

  if (!names.length) {
    wrap.innerHTML = '<p style="color:var(--text-muted);font-size:12.5px;">The spec does not declare any security schemes.</p>';
    return;
  }

  wrap.innerHTML = names.map(name => {
    const scheme = schemes[name];
    const desc = scheme.description ? `<p style="color:var(--text-muted);font-size:11.5px;margin-top:2px;">${escapeHtml(scheme.description)}</p>` : '';
    const label = _authSchemeLabel(scheme);
    const isUnsupported = scheme.type === 'oauth2' || scheme.type === 'openIdConnect';

    let fields = '';
    if (isUnsupported) {
      fields = `<p style="color:var(--text-muted);font-size:11.5px;">This scheme isn't supported by the prototype yet — set the final token manually via Global headers.</p>`;
    } else if (scheme.type === 'http' && String(scheme.scheme).toLowerCase() === 'basic') {
      const v = cfg[name] || {};
      fields = `
        <div style="display:flex;gap:8px;">
          <input type="text" class="tc-input auth-input" data-scheme="${escapeHtml(name)}" data-field="username"
                 placeholder="Username" value="${escapeHtml(v.username || '')}" style="flex:1;">
          <input type="password" class="tc-input auth-input" data-scheme="${escapeHtml(name)}" data-field="password"
                 placeholder="Password" value="${escapeHtml(v.password || '')}" style="flex:1;">
        </div>`;
    } else {
      const v = cfg[name] || {};
      const placeholder = scheme.type === 'http' ? 'JWT token' : 'Value';
      fields = `<input type="text" class="tc-input auth-input" data-scheme="${escapeHtml(name)}" data-field="value"
                        placeholder="${placeholder}" value="${escapeHtml(v.value || '')}" style="width:100%;">`;
    }

    return `
      <div class="auth-scheme-card" style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;">
          <div>
            <span style="font-family:'Lexend',sans-serif;font-weight:600;font-size:13px;color:var(--text-primary);">${escapeHtml(name)}</span>
            <span style="color:var(--text-muted);font-size:11px;margin-left:6px;">${escapeHtml(label)}</span>
          </div>
          ${isUnsupported ? '' : `<button type="button" class="auth-clear-btn" data-scheme="${escapeHtml(name)}" style="background:none;border:none;color:var(--text-muted);font-size:11px;cursor:pointer;">Clear</button>`}
        </div>
        ${desc}
        ${fields}
      </div>`;
  }).join('');

  wrap.querySelectorAll('.auth-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const cfg2 = getAuthSchemesConfig();
      const schemeName = inp.dataset.scheme;
      const field = inp.dataset.field;
      cfg2[schemeName] = { ...(cfg2[schemeName] || {}), [field]: inp.value };
      _saveAuthSchemesConfig(cfg2);
    });
  });

  wrap.querySelectorAll('.auth-clear-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cfg2 = getAuthSchemesConfig();
      delete cfg2[btn.dataset.scheme];
      _saveAuthSchemesConfig(cfg2);
      _renderAuthSchemesList();
    });
  });
}

function openAuthorizeModal() {
  _renderAuthSchemesList();
  document.getElementById('authorizeModal')?.classList.add('active');
}

function closeAuthorizeModal() {
  document.getElementById('authorizeModal')?.classList.remove('active');
}

/* Substitutes authorization values into headers/query based on the
   operation's security requirements (or global ones, if the operation has none). */
function applyAuthToRequest(ep, headers, query) {
  const schemes = apiSpec?.components?.securitySchemes;
  if (!schemes) return;
  const requirements = ep?.security ?? apiSpec?.security ?? [];
  const cfg = getAuthSchemesConfig();

  const neededNames = new Set();
  for (const req of requirements) {
    for (const name of Object.keys(req)) neededNames.add(name);
  }
  if (!neededNames.size) return;

  for (const name of neededNames) {
    const scheme = schemes[name];
    const v = cfg[name];
    if (!scheme || !v) continue;

    if (scheme.type === 'http' && String(scheme.scheme).toLowerCase() === 'bearer') {
      if (v.value) headers['Authorization'] = `Bearer ${v.value}`;
    } else if (scheme.type === 'http' && String(scheme.scheme).toLowerCase() === 'basic') {
      if (v.username || v.password) headers['Authorization'] = `Basic ${btoa(`${v.username || ''}:${v.password || ''}`)}`;
    } else if (scheme.type === 'apiKey') {
      if (!v.value) continue;
      if (scheme.in === 'header') headers[scheme.name] = v.value;
      else if (scheme.in === 'query') query[scheme.name] = v.value;
    }
  }
}

function initAuth() {
  document.getElementById('authorizeBtn')?.addEventListener('click', openAuthorizeModal);
  document.getElementById('closeAuthorizeModal')?.addEventListener('click', closeAuthorizeModal);
  document.getElementById('authorizeCloseBtn')?.addEventListener('click', closeAuthorizeModal);
  document.getElementById('authorizeModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'authorizeModal') closeAuthorizeModal();
  });
}
