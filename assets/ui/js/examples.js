/* ════════════════════════════════════════
   examples.js — saving / loading /
                 applying request body examples
   ════════════════════════════════════════ */

let selectedExample = null;

/* ── localStorage helpers ── */
function _exKey() {
  return `api_request_bodies_${currentEndpointKey}`;
}

function saveRequestBody(name, body) {
  if (!currentEndpointKey) return;
  const list = JSON.parse(localStorage.getItem(_exKey()) || '[]');
  list.push({ name, body, timestamp: new Date().toISOString() });
  localStorage.setItem(_exKey(), JSON.stringify(list));
}

function loadRequestBodies() {
  if (!currentEndpointKey) return [];
  return JSON.parse(localStorage.getItem(_exKey()) || '[]');
}

function deleteExample(i) {
  const list = JSON.parse(localStorage.getItem(_exKey()) || '[]');
  list.splice(i, 1);
  localStorage.setItem(_exKey(), JSON.stringify(list));
}

/* ── Modal rendering ── */
function renderExamplesModal() {
  const exs   = loadRequestBodies();
  const list  = document.getElementById('examplesList');
  const prev  = document.getElementById('examplePreview');
  const apply = document.getElementById('applyExampleBtn');

  if (exs.length === 0) {
    list.innerHTML  = '<p class="text-gray-500 dark:text-gray-400">No saved examples.</p>';
    prev.innerHTML  = '<p class="text-gray-500 dark:text-gray-400">No data to display.</p>';
    apply.disabled  = true;
    selectedExample = null;
    return;
  }

  list.innerHTML = exs.map((e, i) => `
    <div class="example-item flex items-start justify-between p-3 rounded-lg cursor-pointer transition hover:bg-gray-100 dark:hover:bg-gray-700" data-index="${i}">
      <div>
        <div class="font-medium text-gray-800 dark:text-gray-200">${e.name}</div>
        <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${new Date(e.timestamp).toLocaleString()}</div>
      </div>
      <button class="delete-example-btn p-1 text-red-500 hover:bg-red-500/10 rounded" data-tooltip="Delete" data-index="${i}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
      </button>
    </div>`).join('');

  if (selectedExample === null) selectExample(0, exs[0]);

  list.querySelectorAll('.example-item').forEach(el => {
    el.addEventListener('click', ev => {
      if (ev.target.closest('.delete-example-btn')) return;
      const idx = parseInt(el.dataset.index);
      selectExample(idx, exs[idx]);
    });
  });

  list.querySelectorAll('.delete-example-btn').forEach(btn => {
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      showConfirm('Delete this example?', () => {
        deleteExample(idx);
        selectedExample = null;
        renderExamplesModal();
        showToast('Example deleted', 'info');
      }, 'Delete');
    });
  });

  apply.disabled = !selectedExample;
  apply.onclick  = () => {
    if (selectedExample) {
      applyRequestBody(selectedExample.body);
      document.getElementById('examplesModal').classList.remove('active');
    }
  };
}

function selectExample(i, e) {
  selectedExample = { index: i, ...e };
  const prev  = document.getElementById('examplePreview');
  const apply = document.getElementById('applyExampleBtn');

  let formatted = '';
  if (typeof e.body === 'object') {
    try { formatted = safeJsonStringify(e.body); } catch { formatted = JSON.stringify(e.body, null, 2); }
  } else {
    formatted = String(e.body);
  }

  prev.style.position = 'relative';
  prev.innerHTML = `
    ${jsonActionBtnsHtml('copyExamplePreviewBtn', 'downloadExamplePreviewBtn')}
    <pre>${highlightJson(formatted)}</pre>`;
  apply.disabled = false;

  document.getElementById('copyExamplePreviewBtn').addEventListener('click', () => {
    copyToClipboard(formatted, 'Example copied');
  });
  document.getElementById('downloadExamplePreviewBtn').addEventListener('click', () => {
    downloadJson(formatted, 'example.json');
  });

  document.querySelectorAll('.example-item').forEach(el =>
    el.classList.remove('bg-purple-100', 'dark:bg-purple-900/30')
  );
  document.querySelector(`.example-item[data-index="${i}"]`)
    ?.classList.add('bg-purple-100', 'dark:bg-purple-900/30');
}

function applyRequestBody(body) {
  const el = document.getElementById('requestBody');
  if (el) {
    el.value = safeJsonStringify(body);
    validateJson(el);
    syncHighlight(el);
    return;
  }
  // multipart fallback
  if (currentEndpointData?.requestBody) {
    const ms = currentEndpointData.requestBody.content?.['multipart/form-data']?.schema;
    if (ms) {
      for (const pn in ms.properties) {
        if (pn in body) {
          const field = document.getElementById(paramId(pn, 'formData'));
          if (field && field.type !== 'file') field.value = body[pn];
        }
      }
    }
  }
}

/* ── Toolbar buttons (wired in app.js) ── */
function initExamplesListeners() {
  document.getElementById('saveExampleBtn').addEventListener('click', () => {
    if (!currentEndpointKey) { showToast('Select an endpoint first', 'error'); return; }

    const ta = document.getElementById('requestBody');
    let body = null;

    if (ta) {
      try { body = JSON.parse(ta.value); }
      catch { showToast('Invalid JSON in request body', 'error'); return; }
    } else {
      const fd = {};
      const ms = currentEndpointData?.requestBody?.content?.['multipart/form-data']?.schema;
      if (ms) {
        for (const pn in ms.properties) {
          const field = document.getElementById(paramId(pn, 'formData'));
          if (field && field.type !== 'file') fd[pn] = field.value;
        }
      }
      if (Object.keys(fd).length === 0) { showToast('No data to save', 'error'); return; }
      body = fd;
    }

    showPrompt('Example name', 'Example 1', name => {
      saveRequestBody(name, body);
      showToast('Example saved!', 'success');
    });
  });

  document.getElementById('showExamplesBtn').addEventListener('click', () => {
    if (!currentEndpointKey) { showToast('Select an endpoint first', 'error'); return; }
    selectedExample = null;
    renderExamplesModal();
    document.getElementById('examplesModal').classList.add('active');
  });

  document.getElementById('closeExamplesModal').addEventListener('click', () => {
    selectedExample = null;
    document.getElementById('examplesModal').classList.remove('active');
  });

  document.getElementById('examplesModal').addEventListener('click', e => {
    if (e.target === document.getElementById('examplesModal')) {
      selectedExample = null;
      document.getElementById('examplesModal').classList.remove('active');
    }
  });
}
