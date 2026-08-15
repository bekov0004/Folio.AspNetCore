/* ════════════════════════════════════════
   app.js — entry point:
   global state, spec loading,
   welcome screen, theme, global events
   ════════════════════════════════════════ */

/* ── Global state ──
   window.__SPECTRA_CONFIG__ is provided by the host (e.g.
   Spectra.AspNetCore when embedded into an ASP.NET Core app) —
   if it's absent, defaults are used for local
   development of the prototype itself. */
const SPECTRA_CONFIG   = window.__SPECTRA_CONFIG__ || {};
const OPENAPI_FILE     = SPECTRA_CONFIG.specUrl || 'eip-openapi.json';
let apiSpec             = null;
let currentEndpointKey  = null;
let currentEndpointData = null;

/* ── Persistent endpoint state ── */
const STATE_KEY = 'swapi_ep_state';

function saveEndpointState() {
  if (!currentEndpointKey || !currentEndpointData) return;
  const parts  = currentEndpointKey.split(' ');
  const method = parts[0];
  const path   = parts.slice(1).join(' ');

  const state = { key: currentEndpointKey, path, method, params: {}, body: null, response: null };

  for (const par of currentEndpointData.parameters || []) {
    const el = document.getElementById(paramId(par.name, par.in));
    if (el && el.type !== 'file') state.params[el.id] = el.value;
  }

  // Save runtime values of custom headers (G, E)
  document.querySelectorAll('[id^="gh-"], [id^="eh-"]').forEach(el => {
    if (el.id) state.params[el.id] = el.value;
  });

  const ta = document.getElementById('requestBody');
  if (ta) state.body = ta.value;

  const rb = document.getElementById('responseBlock');
  const rc = document.getElementById('responseContent');
  const re = document.getElementById('responseExample');
  if (rb && !rb.classList.contains('hidden') && rc) {
    state.response = {
      html:          rc.innerHTML,
      className:     rc.className,
      exampleHidden: re?.classList.contains('hidden') ?? false
    };
  }

  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
}

function restoreEndpointState() {
  if (!currentEndpointKey) return;
  let state;
  try { state = JSON.parse(localStorage.getItem(STATE_KEY)); } catch { return; }
  if (!state || state.key !== currentEndpointKey) return;

  for (const [id, value] of Object.entries(state.params || {})) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  if (state.body !== null && state.body !== undefined) {
    const ta = document.getElementById('requestBody');
    if (ta) { ta.value = state.body; validateJson(ta); syncHighlight(ta); }
  }

  if (state.response) {
    const rb = document.getElementById('responseBlock');
    const rc = document.getElementById('responseContent');
    const re = document.getElementById('responseExample');
    if (rb && rc) {
      rc.innerHTML = state.response.html;
      rc.className = state.response.className;
      rb.classList.remove('hidden');
      if (state.response.exampleHidden && re) re.classList.add('hidden');
    }
  }
}

function clearEndpointState() {
  try { localStorage.removeItem(STATE_KEY); } catch {}
}

/* ── Recent endpoints ── */
const RECENT_KEY = 'swapi_recent';
const RECENT_MAX = 10;

function saveRecentEndpoint(path, method) {
  const summary = apiSpec?.paths?.[path]?.[method.toLowerCase()]?.summary || '';
  let list = getRecentEndpoints().filter(e => !(e.path === path && e.method === method));
  list.unshift({ path, method, summary });
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); } catch {}
}

function getRecentEndpoints() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}

/* ── Narrow/overflow mode only ("More" is visible, see @media in
   env-panel.css) — while an endpoint is open, the "Schema" button's slot
   in the main row is taken by "Execute request" (the most frequent action
   on mobile), and the schema button itself moves into envPanelOverflow —
   accessible via "More". On desktop the button order never changes:
   Execute stays last, as before. ── */
const _envOverflowMedia = window.matchMedia('(max-width: 600px)');

function _swapSchemaForExecute() {
  const anchor    = document.getElementById('schemaBarAnchor');
  const schemaBtn = document.getElementById('schemaViewBtn');
  const execBtn   = document.getElementById('executeRequestBtn');
  const overflow  = document.getElementById('envPanelOverflow');
  if (!anchor || !schemaBtn || !execBtn || !overflow) return;
  if (anchor.nextElementSibling === execBtn) return; // already swapped
  anchor.after(execBtn);
  overflow.prepend(schemaBtn);
}
function _restoreSchemaInBar() {
  const anchorBar      = document.getElementById('schemaBarAnchor');
  const anchorOverflow = document.getElementById('executeOverflowAnchor');
  const schemaBtn      = document.getElementById('schemaViewBtn');
  const execBtn        = document.getElementById('executeRequestBtn');
  if (!anchorBar || !anchorOverflow || !schemaBtn || !execBtn) return;
  if (anchorBar.nextElementSibling === schemaBtn) return; // already restored
  anchorBar.after(schemaBtn);
  anchorOverflow.after(execBtn);
}
/* Recomputes the needed layout for the current screen width and
   state (whether an endpoint is open) — called both when opening/closing
   an endpoint and when crossing the breakpoint during resize. */
function _updateExecuteSlot() {
  const endpointOpen = document.getElementById('endpointActions')?.style.display === 'flex';
  if (endpointOpen && _envOverflowMedia.matches) _swapSchemaForExecute();
  else _restoreSchemaInBar();
}
_envOverflowMedia.addEventListener('change', _updateExecuteSlot);

/* ── Open an endpoint (from the welcome screen or from search) ── */
function openEndpoint(path, method) {
  currentEndpointKey  = `${method} ${path}`;
  currentEndpointData = apiSpec.paths[path][method.toLowerCase()];
  showEndpoint(path, method);
  document.querySelectorAll('.endpoint-item').forEach(x => x.classList.remove('active'));
  document.querySelector(`.endpoint-item[data-path="${path}"][data-method="${method}"]`)?.classList.add('active');
  document.getElementById('endpointActions').style.display = 'flex';
  _updateExecuteSlot();
  saveRecentEndpoint(path, method);
  history.replaceState(null, '', '#' + method + path);
}

/* ── Open an endpoint from the URL hash ── */
function openFromHash() {
  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (!hash) return false;
  const slashIdx = hash.indexOf('/');
  if (slashIdx === -1) return false;
  const method = hash.slice(0, slashIdx).toUpperCase();
  const path   = hash.slice(slashIdx);
  if (apiSpec?.paths?.[path]?.[method.toLowerCase()]) {
    openEndpoint(path, method);
    return true;
  }
  return false;
}

/* ── Shared query-to-endpoint matching logic ──
   Used by both the sidebar search and the welcome-screen search,
   so the same query gives the same set of matches in both places. */
function endpointMatchesQuery(path, method, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const data = apiSpec?.paths?.[path]?.[method.toLowerCase()];
  const text = `${method} ${path} ${data?.summary || ''} ${(data?.tags || []).join(' ')}`.toLowerCase();
  return text.includes(q);
}

/* ── Endpoint search for the welcome screen ──
   Returns { results, total }: results — at most `limit` cards to
   display, total — how many matches were found overall (so we can
   show "showing N of total" if the result was truncated). */
function searchEndpointsWelcome(query, limit = 10) {
  const all = [];
  for (const [path, methods] of Object.entries(apiSpec.paths || {})) {
    for (const method of Object.keys(methods)) {
      const m = method.toUpperCase();
      if (!HTTP_METHODS.includes(m)) continue;
      if (endpointMatchesQuery(path, m, query)) {
        const data = apiSpec.paths[path][method];
        all.push({ path, method: m, summary: data.summary || '' });
      }
    }
  }
  return { results: all.slice(0, limit), total: all.length };
}

/* ── Welcome screen ── */
function renderWelcome() {
  const content = document.getElementById('content');
  const info    = apiSpec.info    || {};
  const server  = apiSpec.servers?.[0]?.url || '';

  // Count endpoints by method
  const counts = {};
  let total = 0;
  for (const methods of Object.values(apiSpec.paths || {})) {
    for (const m of Object.keys(methods)) {
      const u = m.toUpperCase();
      if (!HTTP_METHODS.includes(u)) continue;
      counts[u] = (counts[u] || 0) + 1;
      total++;
    }
  }
  const chips = ['GET','POST','PUT','PATCH','DELETE']
    .filter(m => counts[m])
    .map(m => `<span class="method-badge method-${m.toLowerCase()}" style="font-size:11px;">${m} · ${counts[m]}</span>`)
    .join('');

  // Recent (filter out stale ones)
  const recent = getRecentEndpoints()
    .filter(e => apiSpec.paths?.[e.path]?.[e.method.toLowerCase()]);

  const epItem = ({ path, method, summary }) => `
    <div class="welcome-ep-item" data-path="${escapeHtml(path)}" data-method="${method}">
      <span class="method-badge method-${method.toLowerCase()}" style="font-size:10px;padding:2px 6px;flex-shrink:0;">${method}</span>
      <span class="welcome-ep-path">${escapeHtml(path)}</span>
      ${summary ? `<span class="welcome-ep-summary">${escapeHtml(summary)}</span>` : ''}
    </div>`;

  content.innerHTML = `
    <div class="welcome-card">

      <div class="welcome-api-header">
        <div class="welcome-api-icon">
          <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <div style="min-width:0;">
          <div class="welcome-api-title-row">
            <span class="welcome-api-name">${escapeHtml(info.title || 'API Documentation')}</span>
            ${info.version ? `<span class="welcome-api-version">v${escapeHtml(info.version)}</span>` : ''}
          </div>
          ${info.description ? `<p class="welcome-api-desc">${escapeHtml(info.description)}</p>` : ''}
          ${server ? `<p class="welcome-api-server">${escapeHtml(server)}</p>` : ''}
        </div>
      </div>

      <div class="welcome-stats-row">
        <span class="welcome-total">${total} endpoint${total === 1 ? '' : 's'}</span>
        <div class="welcome-method-chips">${chips}</div>
      </div>

      <div class="welcome-search-section">
        <div class="welcome-search-wrap">
          <svg class="welcome-search-icon" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" stroke-width="2.5"/>
            <path d="m21 21-4.35-4.35" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          <input type="text" id="welcomeSearch" class="welcome-search-input"
                 placeholder="Search endpoints..." autocomplete="off" spellcheck="false">
        </div>
        <div id="welcomeSearchResults" class="welcome-ep-list" style="display:none;margin-top:10px;"></div>
      </div>

      ${recent.length ? `
        <div id="welcomeRecent">
          <div class="welcome-section-label">Recent</div>
          <div class="welcome-ep-list">${recent.map(epItem).join('')}</div>
        </div>` : ''}

    </div>`;

  // Search
  const searchInput   = document.getElementById('welcomeSearch');
  const searchResults = document.getElementById('welcomeSearchResults');
  const recentSection = document.getElementById('welcomeRecent');

  function renderWelcomeSearchResults(q, showAll) {
    const { results: found, total } = searchEndpointsWelcome(q, showAll ? Infinity : 10);
    const moreBtn = total > found.length
      ? `<button type="button" id="welcomeSearchShowAll" style="margin:8px 4px 0;">Show all ${total}</button>`
      : '';
    searchResults.innerHTML = found.length
      ? found.map(epItem).join('') + moreBtn
      : '<p class="welcome-no-results">Nothing found</p>';
    searchResults.querySelectorAll('.welcome-ep-item').forEach(el =>
      el.addEventListener('click', () => openEndpoint(el.dataset.path, el.dataset.method)));
    document.getElementById('welcomeSearchShowAll')?.addEventListener('click', () => {
      renderWelcomeSearchResults(q, true);
    });
    searchResults.style.display = '';
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (!q) {
      searchResults.style.display = 'none';
      if (recentSection) recentSection.style.display = '';
      return;
    }
    if (recentSection) recentSection.style.display = 'none';
    renderWelcomeSearchResults(q, false);
  });

  // Recent — clicks
  document.querySelectorAll('#welcomeRecent .welcome-ep-item').forEach(el =>
    el.addEventListener('click', () => openEndpoint(el.dataset.path, el.dataset.method)));
}

/* ── Navigate home ── */
function goHome() {
  if (!apiSpec) return;
  currentEndpointKey  = null;
  currentEndpointData = null;
  clearEndpointState();
  document.querySelectorAll('.endpoint-item').forEach(x => x.classList.remove('active'));
  document.getElementById('endpointActions').style.display = 'none';
  _updateExecuteSlot();
  renderWelcome();
  history.replaceState(null, '', window.location.pathname + window.location.search);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Load OpenAPI spec ── */
async function initApp() {
  if (SPECTRA_CONFIG.title) {
    document.title = SPECTRA_CONFIG.title;
    const headerTitleEl = document.getElementById('headerTitleText');
    if (headerTitleEl) headerTitleEl.textContent = SPECTRA_CONFIG.title;
  }

  try {
    const response = await fetch(OPENAPI_FILE);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    apiSpec = await response.json();
    renderSidebar();
    document.getElementById('schemaViewBtn').disabled = false;
    _updateImportServersBtn();
    _updateAuthorizeBtnState();

    /* URL hash takes priority — direct link to an endpoint */
    if (openFromHash()) return;

    let savedState;
    try { savedState = JSON.parse(localStorage.getItem(STATE_KEY)); } catch {}

    if (savedState?.path && apiSpec.paths?.[savedState.path]?.[savedState.method?.toLowerCase()]) {
      openEndpoint(savedState.path, savedState.method);
    } else {
      renderWelcome();
    }
  } catch (err) {
    document.getElementById('content').innerHTML = `
      <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded dark:bg-red-900/30 dark:text-red-200">
        <p class="font-bold">Failed to load OpenAPI spec</p>
        <p>${escapeHtml(err.message)}</p>
      </div>`;
  }
}

/* ── Theme ── */
function initTheme() {
  const saved    = localStorage.getItem('theme');
  const prefDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefDark)) {
    document.documentElement.classList.add('dark');
  }

  document.getElementById('themeToggle').addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  });
}

/* ── Execute button ── */
function initExecuteBtn() {
  document.getElementById('executeRequestBtn').addEventListener('click', sendRequest);
}

/* ── Home navigation ── */
function initHomeNav() {
  document.getElementById('homeBtn').addEventListener('click', goHome);
  document.getElementById('headerBrand').addEventListener('click', goHome);
}

/* ── Share button ── */
function initShareBtn() {
  document.getElementById('shareBtn').addEventListener('click', () => {
    const url = window.location.href;

    const fallback = () => {
      const ta = Object.assign(document.createElement('textarea'), {
        value: url, style: 'position:fixed;opacity:0'
      });
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
      showToast('Link copied', 'success');
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url)
        .then(() => showToast('Link copied', 'success'))
        .catch(fallback);
    } else {
      fallback();
    }
  });

  window.addEventListener('hashchange', () => {
    if (apiSpec) openFromHash();
  });
}

/* ── Keyboard shortcuts ── */
function initShortcuts() {
  const modal      = document.getElementById('shortcutsModal');
  const openModal  = () => modal.classList.add('active');
  const closeModal = () => modal.classList.remove('active');

  document.getElementById('shortcutsBtn').addEventListener('click', openModal);
  document.getElementById('closeShortcutsModal').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.addEventListener('keydown', e => {
    const tag      = document.activeElement?.tagName;
    const editing  = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
                     document.activeElement?.isContentEditable;

    /* / — focus the search input */
    if (e.key === '/' && !editing) {
      e.preventDefault();
      const s = document.getElementById('searchInput');
      if (s) { s.focus(); s.select(); }
    }

    /* Ctrl/Cmd + Enter — execute request */
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const btn = document.getElementById('executeRequestBtn');
      if (btn && !btn.disabled) btn.click();
    }

    /* Esc — close the active modal */
    if (e.key === 'Escape') {
      document.querySelector('.modal-overlay.active')?.classList.remove('active');
    }

    /* ? — cheat sheet */
    if (e.key === '?' && !editing) modal.classList.toggle('active');
  });
}

/* ── "More" in the button panel (narrow screens where all 9 buttons don't fit) ── */
function initEnvPanelOverflow() {
  const btn     = document.getElementById('envMoreBtn');
  const overlay = document.getElementById('envPanelOverflow');
  if (!btn || !overlay) return;

  const isOpen = () => overlay.classList.contains('env-overflow-open');

  function openOverflow() {
    overlay.classList.add('env-overflow-open');
    btn.setAttribute('aria-expanded', 'true');
  }
  function closeOverflow() {
    overlay.classList.remove('env-overflow-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    isOpen() ? closeOverflow() : openOverflow();
  });

  /* Close on click outside the popover, on Esc, and on click on any button inside
     (after an action — save example, share, etc. — there's no reason for the popover to stay open) */
  document.addEventListener('click', e => {
    if (isOpen() && !e.target.closest('#envPanelOverflow') && !e.target.closest('#envMoreBtn')) {
      closeOverflow();
    }
  });
  overlay.addEventListener('click', e => {
    if (e.target.closest('.env-btn')) closeOverflow();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) closeOverflow();
  });
}

/* ── Panel button tooltips on touch devices: shown on long-press,
   not on a regular tap ── */
function initEnvBtnTouchTooltips() {
  const DELAY = 500;
  let timer      = null;
  let activeEl   = null;
  let longPressed = false;

  function reset() {
    clearTimeout(timer);
    activeEl?.classList.remove('tc-tooltip-show');
    activeEl = null;
    longPressed = false;
  }

  document.addEventListener('touchstart', e => {
    const el = e.target.closest('[data-tooltip]');
    if (!el) return;
    activeEl = el;
    longPressed = false;
    timer = setTimeout(() => {
      longPressed = true;
      el.classList.add('tc-tooltip-show');
    }, DELAY);
  }, { passive: true });

  document.addEventListener('touchend', e => {
    clearTimeout(timer);
    if (longPressed && activeEl) {
      /* The long-press was for the tooltip — don't let this same touch
         also fire as a regular click on the button */
      e.preventDefault();
    }
    reset();
  }, { passive: false });

  document.addEventListener('touchmove', reset, { passive: true });
  document.addEventListener('touchcancel', reset, { passive: true });
}

/* ── Sidebar resize ── */
function initSidebarResize() {
  const wrap      = document.getElementById('sidebarWrap');
  const resizer   = document.getElementById('sidebarResizer');
  const STORE_KEY = 'sidebar_w';
  const MIN = 220, MAX = 600;

  /* Restore width from localStorage */
  const saved = parseInt(localStorage.getItem(STORE_KEY));
  if (saved >= MIN && saved <= MAX) {
    wrap.style.width    = saved + 'px';
    wrap.style.minWidth = 'unset';
  }

  resizer.addEventListener('mousedown', e => {
    e.preventDefault();
    const startX     = e.clientX;
    const startWidth = wrap.offsetWidth;

    document.body.style.userSelect = 'none';
    document.body.style.cursor     = 'col-resize';
    resizer.classList.add('is-dragging');

    const onMove = e => {
      const w = Math.min(MAX, Math.max(MIN, startWidth + e.clientX - startX));
      wrap.style.width    = w + 'px';
      wrap.style.minWidth = 'unset';
    };

    const onUp = () => {
      document.body.style.userSelect = '';
      document.body.style.cursor     = '';
      resizer.classList.remove('is-dragging');
      localStorage.setItem(STORE_KEY, wrap.offsetWidth);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  });
}

/* ── Bootstrap everything ── */
initTheme();
initEnvironments();
initGlobalHeaders();
initAuth();
initExamplesListeners();
initSearch();
initMobileMenu();
initExecuteBtn();
initHomeNav();
initSchemaModal();
initShortcuts();
initShareBtn();
initSidebarResize();
initEnvPanelOverflow();
initEnvBtnTouchTooltips();
initApp();
