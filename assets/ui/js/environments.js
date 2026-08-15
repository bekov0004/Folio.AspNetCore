/* ════════════════════════════════════════
   environments.js — environment management:
   unified selector (carousel + list), CRUD
   ════════════════════════════════════════ */

const DEFAULT_ENVIRONMENTS = [{
  name: 'Default',
  baseUrl: window.location.origin,
}];

let environments    = JSON.parse(localStorage.getItem('api_environments')) || DEFAULT_ENVIRONMENTS;
let currentEnvIndex = parseInt(localStorage.getItem('api_current_env_index')) || 0;

// Carousel state
let currentCarouselIndex     = currentEnvIndex;
let currentCarouselTranslate = -100 * currentCarouselIndex;
let isDragging     = false;
let startX         = 0;
let startTranslate = 0;

const carouselContainer = document.querySelector('.env-carousel-wrapper');
const carouselEl        = document.getElementById('envCarousel');

/* ── Getters ── */
function getCurrentEnv() {
  return environments[currentEnvIndex] || environments[0];
}

/* ── Select environment (single point of change) ── */
function selectEnvironment(i) {
  currentEnvIndex      = i;
  currentCarouselIndex = i;
  localStorage.setItem('api_current_env_index', i);
  renderEnvLabel();
  renderMobileEnvCarousel();
  renderEnvPanelList();
}

/* ── Updates the environment button tooltip with current name/URL ── */
function renderEnvLabel() {
  const btn = document.getElementById('mobileEnvBtn');
  if (!btn) return;
  const e = getCurrentEnv();
  const label = `Environment: ${e.name} (${e.baseUrl})`;
  btn.dataset.tooltip = label;
  btn.setAttribute('aria-label', label);
}

/* ── List of environments inside the panel ── */
function renderEnvPanelList() {
  const list = document.getElementById('envPanelList');
  if (!list) return;

  list.innerHTML = environments.map((e, i) => {
    const url    = e.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const active = i === currentEnvIndex;
    return `
      <div class="env-panel-item${active ? ' active' : ''}" data-index="${i}">
        <span class="env-panel-dot"></span>
        <div class="env-panel-item-body">
          <span class="env-panel-item-name">${e.name}</span>
          <span class="env-panel-item-url">${url}</span>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.env-panel-item').forEach(el => {
    el.addEventListener('click', () => {
      selectEnvironment(parseInt(el.dataset.index));
      collapseEnvList();
    });
  });

  _updateImportServersBtn();
}

/* ── Servers declared in the spec's servers[] that aren't yet among
   the environments (compared by baseUrl without trailing slash) ── */
function _getUnimportedSpecServers() {
  if (!apiSpec?.servers?.length) return [];
  const known = new Set(environments.map(e => e.baseUrl.replace(/\/$/, '')));
  return apiSpec.servers.filter(s => s.url && !known.has(s.url.replace(/\/$/, '')));
}

function _updateImportServersBtn() {
  const btn = document.getElementById('importSpecServersBtn');
  if (!btn) return;
  const servers = _getUnimportedSpecServers();
  btn.style.display = servers.length ? '' : 'none';
  const label = document.getElementById('importSpecServersBtnLabel');
  if (label) label.textContent = `Import servers from spec (${servers.length})`;
}

function importSpecServers() {
  const servers = _getUnimportedSpecServers();
  if (!servers.length) return;
  servers.forEach((s, i) => {
    environments.push({ name: s.description || `Server ${i + 1}`, baseUrl: s.url.replace(/\/$/, '') });
  });
  localStorage.setItem('api_environments', JSON.stringify(environments));
  renderEnvLabel();
  renderMobileEnvCarousel();
  renderEnvPanelList();
  showToast(`Imported ${servers.length} environment(s)`, 'success');
}

/* ── Carousel ── */
function renderMobileEnvCarousel() {
  carouselEl.innerHTML = '';
  environments.forEach(env => {
    const item = document.createElement('div');
    item.className = 'env-item';
    item.textContent = env.name;
    carouselEl.appendChild(item);
  });
  currentCarouselIndex     = currentEnvIndex;
  currentCarouselTranslate = -100 * currentCarouselIndex;
  carouselEl.style.transform = `translateX(${currentCarouselTranslate}%)`;
  updateEnvCarouselActive();
}

function updateEnvCarouselPosition() {
  currentCarouselTranslate = -100 * currentCarouselIndex;
  carouselEl.style.transform = `translateX(${currentCarouselTranslate}%)`;
}

function updateEnvCarouselActive() {
  carouselEl.querySelectorAll('.env-item').forEach((el, i) => {
    el.classList.toggle('active', i === currentCarouselIndex);
  });
}

/* ── Carousel drag / swipe ── */
function startDrag(e) {
  isDragging     = true;
  startX         = 'touches' in e ? e.touches[0].clientX : e.clientX;
  startTranslate = currentCarouselTranslate;
  carouselEl.style.transition = 'none';
  e.preventDefault();
}

function moveDrag(e) {
  if (!isDragging) return;
  const currentX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const delta    = (currentX - startX) / carouselContainer.clientWidth * 100;
  carouselEl.style.transform = `translateX(${startTranslate + delta}%)`;
  e.preventDefault();
}

function endDrag(e) {
  if (!isDragging) return;
  isDragging = false;
  carouselEl.style.transition = 'transform 0.3s ease-out';

  const currentX     = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
  const movedPercent = (currentX - startX) / carouselContainer.clientWidth * 100;
  let proposed = Math.round(-(startTranslate + movedPercent) / 100);
  proposed = Math.max(0, Math.min(proposed, environments.length - 1));

  currentCarouselTranslate = -100 * proposed;
  carouselEl.style.transform = `translateX(${currentCarouselTranslate}%)`;

  if (proposed !== currentCarouselIndex) {
    currentCarouselIndex = proposed;
    currentEnvIndex      = proposed;
    localStorage.setItem('api_current_env_index', currentEnvIndex);
    renderEnvLabel();
    updateEnvCarouselActive();
    renderEnvPanelList();
  }
}

carouselContainer.addEventListener('touchstart', startDrag, { passive: false });
carouselContainer.addEventListener('touchmove',  moveDrag,  { passive: false });
carouselContainer.addEventListener('touchend',   endDrag);
carouselContainer.addEventListener('mousedown',  startDrag);
document.addEventListener('mousemove', moveDrag);
document.addEventListener('mouseup',   endDrag);

/* ── Open / close panel ── */
function openEnvPanel() {
  renderMobileEnvCarousel();
  updateEnvCarouselPosition();
  updateEnvCarouselActive();
  // don't auto-expand the list — user toggles it manually
  document.getElementById('envSelectorPanel').classList.add('active');
}

function closeEnvPanel() {
  document.getElementById('envSelectorPanel').classList.remove('active');
  // collapse the list too when closing the panel
  collapseEnvList();
}

function collapseEnvList() {
  const list   = document.getElementById('envPanelList');
  const toggle = document.getElementById('envListToggle');
  list?.classList.remove('open');
  toggle?.classList.remove('open');
}

/* ── List toggle inside the panel ── */
document.getElementById('envListToggle').addEventListener('click', () => {
  const list   = document.getElementById('envPanelList');
  const toggle = document.getElementById('envListToggle');
  const isOpen = list.classList.contains('open');
  if (isOpen) {
    list.classList.remove('open');
    toggle.classList.remove('open');
  } else {
    renderEnvPanelList();
    list.classList.add('open');
    toggle.classList.add('open');
  }
});

document.getElementById('mobileEnvBtn').addEventListener('click', () => {
  document.getElementById('envSelectorPanel').classList.contains('active')
    ? closeEnvPanel()
    : openEnvPanel();
});

document.addEventListener('click', e => {
  if (document.getElementById('envSelectorPanel').classList.contains('active') &&
      !e.target.closest('#mobileEnvBtn') &&
      !e.target.closest('#envSelectorPanel')) {
    closeEnvPanel();
  }
});

/* ── Modal CRUD ── */
function openEnvModal(i = currentEnvIndex) {
  isAddingNewEnv = false;
  if (!environments[i]) i = 0;
  const e = environments[i];
  const isDefault = e.baseUrl === window.location.origin;
  document.getElementById('envName').value    = e.name;
  document.getElementById('envBaseUrl').value = e.baseUrl;
  document.getElementById('envBaseUrl').disabled = isDefault;
  document.getElementById('deleteEnvBtn').style.display = isDefault ? 'none' : 'inline-block';
  currentEnvIndex = i;
  document.getElementById('envModal').classList.add('active');
}

function saveCurrentEnv() {
  const n = document.getElementById('envName').value.trim();
  const u = document.getElementById('envBaseUrl').value.trim();

  if (!n) { showToast('Name is required', 'error'); return; }
  if (!u) { showToast('Base URL is required', 'error'); return; }

  if (isAddingNewEnv) {
    const dup = environments.some(e => e.baseUrl === u);
    if (dup) { showToast('An environment with this Base URL already exists', 'error'); return; }
    environments.push({ name: n, baseUrl: u });
    currentEnvIndex = environments.length - 1;
    isAddingNewEnv  = false;
  } else {
    const dup = environments.some((e, i) => i !== currentEnvIndex && e.baseUrl === u);
    if (dup) { showToast('An environment with this Base URL already exists', 'error'); return; }
    environments[currentEnvIndex] = { name: n, baseUrl: u };
  }

  localStorage.setItem('api_environments', JSON.stringify(environments));
  localStorage.setItem('api_current_env_index', currentEnvIndex);
  renderEnvLabel();
  renderMobileEnvCarousel();
  renderEnvPanelList();
  document.getElementById('envModal').classList.remove('active');
  showToast('Environment saved', 'success');
}

function deleteCurrentEnv() {
  if (!environments[currentEnvIndex]) currentEnvIndex = 0;
  const e = environments[currentEnvIndex];
  if (e.baseUrl === window.location.origin) { showToast('Cannot delete the default environment', 'error'); return; }
  if (environments.length <= 1)             { showToast('Cannot delete the last environment', 'error'); return; }

  showConfirm(`Delete environment "${e.name}"?`, () => {
    environments.splice(currentEnvIndex, 1);
    currentEnvIndex = Math.min(currentEnvIndex, environments.length - 1);
    localStorage.setItem('api_environments', JSON.stringify(environments));
    localStorage.setItem('api_current_env_index', currentEnvIndex);
    renderEnvLabel();
    renderMobileEnvCarousel();
    renderEnvPanelList();
    document.getElementById('envModal').classList.remove('active');
    showToast('Environment deleted', 'info');
  }, 'Delete');
}

let isAddingNewEnv = false;

function addNewEnv() {
  isAddingNewEnv = true;
  document.getElementById('envName').value    = '';
  document.getElementById('envBaseUrl').value = 'https://';
  document.getElementById('envBaseUrl').disabled = false;
  document.getElementById('deleteEnvBtn').style.display = 'none';
  document.getElementById('envModal').classList.add('active');
}

/* ── Init ── */
function initEnvironments() {
  renderEnvLabel();
  renderMobileEnvCarousel();

  document.getElementById('mobileAddEnvBtn').addEventListener('click', () => {
    closeEnvPanel();
    addNewEnv();
  });
  document.getElementById('mobileEditEnvBtn').addEventListener('click', () => {
    closeEnvPanel();
    openEnvModal(currentEnvIndex);
  });
  document.getElementById('importSpecServersBtn').addEventListener('click', importSpecServers);

  document.getElementById('saveEnvBtn').addEventListener('click',   saveCurrentEnv);
  document.getElementById('deleteEnvBtn').addEventListener('click', deleteCurrentEnv);
  document.getElementById('cancelEnvBtn').addEventListener('click', () => {
    isAddingNewEnv = false;
    document.getElementById('envModal').classList.remove('active');
  });
  document.getElementById('envModal').addEventListener('click', e => {
    if (e.target === document.getElementById('envModal')) {
      isAddingNewEnv = false;
      document.getElementById('envModal').classList.remove('active');
    }
  });
}
