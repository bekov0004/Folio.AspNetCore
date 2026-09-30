/* ════════════════════════════════════════
   utils.js — common helpers
   ════════════════════════════════════════ */

/**
 * Escapes HTML special characters in a string
 */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * JSON syntax highlighting — returns HTML with span tags
 */
function highlightJson(str) {
  const esc = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    m => {
      if (/^"/.test(m)) return /:$/.test(m)
        ? `<span class="json-key">${m}</span>`
        : `<span class="json-str">${m}</span>`;
      if (/true|false/.test(m)) return `<span class="json-bool">${m}</span>`;
      if (/null/.test(m))       return `<span class="json-null">${m}</span>`;
      return `<span class="json-num">${m}</span>`;
    }
  );
}

/**
 * Lightweight per-language token rules for highlightCode() below — not a
 * full parser, just enough to color the shapes the code generator actually
 * emits (see CODEGEN_LANGS/_build* in request.js): comments, quoted
 * strings, numbers, a short keyword list, and (for cURL) CLI flags.
 */
const CODE_LANG_RULES = {
  bash: {
    string: /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
    keywords: ['curl'],
    flag: /(?<=\s|^)--?[A-Za-z][\w-]*/,
  },
  javascript: {
    comment: /\/\/.*/,
    string: /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
    keywords: ['const', 'let', 'var', 'async', 'await', 'function', 'return', 'new',
      'if', 'else', 'try', 'catch', 'throw', 'typeof', 'import', 'from', 'export',
      'of', 'in', 'null', 'true', 'false'],
  },
  python: {
    comment: /#.*/,
    // Triple-quote alternatives must come first — otherwise the plain
    // double/single-quote pattern matches an empty "" at the start of a
    // """...""" block and desyncs the rest of the highlighting.
    string: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
    keywords: ['import', 'from', 'as', 'return', 'if', 'elif', 'else', 'for', 'while',
      'try', 'except', 'def', 'class', 'with', 'None', 'True', 'False', 'and', 'or',
      'not', 'in', 'is'],
  },
  csharp: {
    comment: /\/\/.*/,
    string: /@"(?:[^"]|"")*"|\$"(?:[^"\\]|\\.)*"|"(?:[^"\\]|\\.)*"/,
    keywords: ['using', 'var', 'new', 'public', 'private', 'static', 'async', 'await',
      'return', 'class', 'void', 'string', 'int', 'bool', 'namespace', 'null', 'true', 'false'],
  },
  go: {
    comment: /\/\/.*/,
    string: /`[^`]*`|"(?:[^"\\]|\\.)*"/,
    keywords: ['package', 'import', 'func', 'var', 'const', 'if', 'else', 'for', 'range',
      'return', 'struct', 'type', 'nil', 'true', 'false'],
  },
  powershell: {
    comment: /#.*/,
    string: /@'[\s\S]*?'@|@"[\s\S]*?"@|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/,
    keywords: ['param', 'if', 'else', 'foreach', 'return'],
    variable: /\$[A-Za-z_]\w*/,
  },
};
CODE_LANG_RULES.curl = CODE_LANG_RULES.bash;

/**
 * Syntax-highlights a code snippet for one of CODEGEN_LANGS (request.js) —
 * returns HTML with span tags, same approach as highlightJson() above but
 * driven by a small per-language rule set instead of a fixed grammar.
 */
function highlightCode(code, lang) {
  const rules = CODE_LANG_RULES[lang] || CODE_LANG_RULES.bash;

  const parts = [];
  if (rules.comment)  parts.push(`(?<comment>${rules.comment.source})`);
  if (rules.string)   parts.push(`(?<string>${rules.string.source})`);
  if (rules.variable) parts.push(`(?<variable>${rules.variable.source})`);
  parts.push(`(?<number>\\b\\d+(?:\\.\\d+)?\\b)`);
  if (rules.keywords?.length) parts.push(`(?<keyword>\\b(?:${rules.keywords.join('|')})\\b)`);
  if (rules.flag) parts.push(`(?<flag>${rules.flag.source})`);

  const re = new RegExp(parts.join('|'), 'g');
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(code))) {
    out += escapeHtml(code.slice(last, m.index));
    const cls = m.groups.comment  ? 'code-comment'
      : m.groups.string   ? 'code-string'
      : m.groups.variable ? 'code-variable'
      : m.groups.number   ? 'code-number'
      : m.groups.keyword  ? 'code-keyword'
      : 'code-flag';
    out += `<span class="${cls}">${escapeHtml(m[0])}</span>`;
    last = re.lastIndex;
  }
  out += escapeHtml(code.slice(last));
  return out;
}

/**
 * Safely serializes an object to an indented JSON string
 */
function safeJsonStringify(o) {
  try { return JSON.stringify(o, null, 2); } catch { return String(o); }
}

/**
 * Stable id for a parameter field (used in renderInput and sendRequest)
 */
function paramId(name, location) {
  return `param-${name.replace(/\./g, '_').replace(/\[/g, '_').replace(/\]/g, '_')}-${location}`;
}

/* ── Icons for JSON action buttons ── */
const ICON_COPY = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_DOWNLOAD = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

/**
 * Generates HTML for overlay buttons on JSON blocks
 */
function jsonActionBtnsHtml(copyId, downloadId = null) {
  return `<div class="json-action-btns">
    <button type="button" class="json-action-btn" id="${copyId}" data-tooltip="Copy">${ICON_COPY}</button>
    ${downloadId ? `<button type="button" class="json-action-btn" id="${downloadId}" data-tooltip="Download .json">${ICON_DOWNLOAD}</button>` : ''}
  </div>`;
}

/**
 * Adds copy/download buttons to the top-right corner of each .pjson-wrap inside the container
 */
function addPjsonActions(container, filenameHint = 'schema') {
  container.querySelectorAll('.pjson-wrap').forEach(wrap => {
    const pre = wrap.querySelector('.pjson-pre');
    if (!pre) return;

    const sectionTitle = wrap.closest('.schema-section')
      ?.querySelector('.schema-section-title')?.textContent
      ?.trim().toLowerCase().replace(/\s+/g, '-') || filenameHint;

    const btns = document.createElement('div');
    btns.className = 'json-action-btns';
    btns.innerHTML = `
      <button type="button" class="json-action-btn" data-tooltip="Copy">${ICON_COPY}</button>
      <button type="button" class="json-action-btn" data-tooltip="Download .json">${ICON_DOWNLOAD}</button>`;
    wrap.appendChild(btns);

    const [copyBtn, dlBtn] = btns.querySelectorAll('.json-action-btn');
    copyBtn.onclick = () => copyToClipboard(pre.textContent.trim(), 'Copied');
    dlBtn.onclick   = () => downloadJson(pre.textContent.trim(), `${sectionTitle}.json`);
  });
}

/**
 * Downloads text as a file
 */
function downloadJson(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Copies text to the clipboard, with a fallback for non-HTTPS
 */
function copyToClipboard(text, label = 'Copied') {
  const fallback = () => {
    const ta = Object.assign(document.createElement('textarea'), {
      value: text, style: 'position:fixed;opacity:0'
    });
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
    showToast(label, 'success');
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast(label, 'success')).catch(fallback);
  } else {
    fallback();
  }
}
