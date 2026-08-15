/* ════════════════════════════════════════
   sidebar.js — endpoint grouping,
                sidebar and mobile menu rendering,
                search
   ════════════════════════════════════════ */

/**
 * Groups OpenAPI paths by their first tag
 */
const HTTP_METHODS = ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'];

function groupEndpointsByTag(paths) {
  const groups = {};
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, data] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(method.toUpperCase())) continue;
      const tag = data.tags?.[0] || 'Other';
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push({ path, method: method.toUpperCase(), ...data });
    }
  }
  return groups;
}

/**
 * Builds the HTML for a single endpoint item
 */
function endpointItemHTML(ep) {
  return `
    <div class="endpoint-item" data-path="${escapeHtml(ep.path)}" data-method="${ep.method}">
      <div class="endpoint-item__header">
        <span class="method-badge method-${ep.method.toLowerCase()}">${ep.method}</span>
        <span class="text-sm text-gray-700 dark:text-gray-300 font-mono" data-tooltip="${escapeHtml(ep.path)}">${escapeHtml(ep.path)}</span>
      </div>
    </div>`;
}

/**
 * Attaches click handlers to endpoint items inside a container
 */
function bindEndpointClicks(container, onSelect) {
  container.querySelectorAll('.endpoint-item').forEach(el => {
    el.addEventListener('click', () => {
      const path   = el.dataset.path;
      const method = el.dataset.method;
      onSelect(path, method, el);
    });
  });
}

/**
 * Renders the desktop sidebar
 */
function renderSidebar() {
  const nav    = document.getElementById('sidebarNav');
  const groups = groupEndpointsByTag(apiSpec.paths);
  let html = '';

  for (const [tag, eps] of Object.entries(groups)) {
    html += `
      <div class="mb-2 sidebar-group">
        <div class="px-4 py-2 bg-gray-100 font-semibold text-gray-700 text-sm uppercase tracking-wide dark:bg-gray-700 dark:text-gray-300">${escapeHtml(tag)}</div>
        ${eps.map(endpointItemHTML).join('')}
      </div>`;
  }
  nav.innerHTML = html;

  bindEndpointClicks(nav, (path, method) => {
    openEndpoint(path, method);
  });
}

/**
 * Renders the mobile menu (clones the sidebar + closes the overlay)
 */
function renderMobileSidebar() {
  const nav = document.getElementById('mobileSidebarNav');
  nav.innerHTML = document.getElementById('sidebarNav').innerHTML;

  bindEndpointClicks(nav, (path, method) => {
    openEndpoint(path, method);
    document.getElementById('mobileEndpointsModal').classList.remove('active');
  });
}

/**
 * Initializes sidebar search
 */
function filterSidebarNav(nav, query) {
  nav.querySelectorAll('.sidebar-group').forEach(group => {
    let anyVisible = false;
    group.querySelectorAll('.endpoint-item').forEach(item => {
      const visible = endpointMatchesQuery(item.dataset.path, item.dataset.method, query);
      item.style.display = visible ? 'flex' : 'none';
      if (visible) anyVisible = true;
    });
    group.style.display = anyVisible ? '' : 'none';
  });
}

function initSearch() {
  document.getElementById('searchInput').addEventListener('input', e => {
    filterSidebarNav(document.getElementById('sidebarNav'), e.target.value);
  });

  document.getElementById('mobileSearchInput').addEventListener('input', e => {
    filterSidebarNav(document.getElementById('mobileSidebarNav'), e.target.value);
  });
}

/**
 * Initializes the mobile endpoints menu
 */
function initMobileMenu() {
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    renderMobileSidebar();
    document.getElementById('mobileEndpointsModal').classList.add('active');
  });
  document.getElementById('closeMobileMenu').addEventListener('click', () => {
    document.getElementById('mobileEndpointsModal').classList.remove('active');
  });
  document.getElementById('mobileEndpointsModal').addEventListener('click', e => {
    if (e.target === document.getElementById('mobileEndpointsModal'))
      document.getElementById('mobileEndpointsModal').classList.remove('active');
  });
}
