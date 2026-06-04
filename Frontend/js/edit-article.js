const API = 'http://localhost:5012';
const ARTICLES_KEY = 'tvory_published_articles';
const HISTORY_KEY = 'tvory_edit_history';
const MAX_HISTORY = 10;

let articleId = null;
let originalData = {};
let isDirty = false;
let saveTimeout = null;

function showToast(msg, type = '') {
  const wrap = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? 'check' : type === 'error' ? 'times' : 'info-circle';
  el.innerHTML = `<i class="fas fa-${icon}"></i> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3500);
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('uk-UA', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function statusBadge(status) {
  const map = {
    published: ['status-published', '<i class="fas fa-check-circle"></i> Опублікована'],
    draft:     ['status-draft',      '<i class="fas fa-pencil-alt"></i> Чернетка'],
    pending:   ['status-pending',    '<i class="fas fa-clock"></i> На підтвердженні'],
    archived:  ['status-archived',   '<i class="fas fa-archive"></i> Архів'],
  };
  const [cls, text] = map[status] || ['status-draft', status];
  return `<span class="status-badge ${cls}">${text}</span>`;
}

function getHistory(id) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    return all[id] || [];
  } catch { return []; }
}

function saveHistory(id, snapshot) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
    const list = all[id] || [];
    list.unshift({ ...snapshot, savedAt: new Date().toISOString() });
    all[id] = list.slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all));
  } catch {}
}

function renderHistory(id) {
  const list = getHistory(id);
  const el = document.getElementById('historyList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:.9rem;padding:8px 0">Немає збережених версій</p>';
    return;
  }
  el.innerHTML = list.map((v, i) => `
    <div class="history-item">
      <div class="hist-dot"></div>
      <div>
        <div class="hist-text">${escHtml(v.title || 'Без назви')}</div>
        <div class="hist-time">${fmtDate(v.savedAt)}</div>
      </div>
      <button class="hist-restore" onclick="restoreVersion(${i})" title="Відновити цю версію">
        <i class="fas fa-undo"></i> Відновити
      </button>
    </div>`).join('');
}

window.restoreVersion = function(idx) {
  const list = getHistory(articleId);
  const v = list[idx];
  if (!v) return;
  if (!confirm(`Відновити версію від ${fmtDate(v.savedAt)}? Поточний текст буде замінено.`)) return;
  document.getElementById('fieldTitle').value = v.title || '';
  document.getElementById('fieldContent').value = v.content || '';
  document.getElementById('fieldAuthor').value = v.author || '';
  updateCharCount();
  markDirty();
  showToast('Версію відновлено', 'success');
};

function markDirty() {
  isDirty = true;
  document.getElementById('headerSaveBtn').disabled = false;
  document.getElementById('mainSaveBtn')?.removeAttribute('disabled');
  document.querySelector('.changed-indicator')?.classList.add('visible');
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(autoSaveDraft, 2000);
}

function markClean() {
  isDirty = false;
  document.getElementById('headerSaveBtn').disabled = true;
  document.getElementById('mainSaveBtn')?.setAttribute('disabled', '');
  document.querySelector('.changed-indicator')?.classList.remove('visible');
}

function autoSaveDraft() {
  const title = document.getElementById('fieldTitle')?.value;
  const content = document.getElementById('fieldContent')?.value;
  if (title || content) {
    localStorage.setItem(`tvory_autosave_${articleId}`, JSON.stringify({ title, content, savedAt: Date.now() }));
    showToast('Чернетку автозбережено', '');
  }
}

function updateCharCount() {
  const content = document.getElementById('fieldContent');
  const count = document.getElementById('charCount');
  if (content && count) {
    const chars = content.value.length;
    const words = content.value.trim().split(/\s+/).filter(Boolean).length;
    count.textContent = `${chars} симв. · ${words} слів`;
  }
}

async function loadArticle(id) {
  try {
    const res = await fetch(`${API}/articles/${id}`);
    if (res.ok) {
      const data = await res.json();
      renderForm(data);
      return;
    }
  } catch {}

  try {
    const arts = JSON.parse(localStorage.getItem(ARTICLES_KEY) || '[]');
    const art = arts.find(a => String(a.id) === String(id));
    if (art) { renderForm(art); return; }
  } catch {}

  const cacheKeys = ['tvory_published_articles'];
  for (const key of cacheKeys) {
    try {
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      const found = arr.find(a => String(a.id) === String(id));
      if (found) { renderForm(found); return; }
    } catch {}
  }

  renderNotFound(id);
}

function renderNotFound(id) {
  document.getElementById('mainPage').innerHTML = `
    <div style="text-align:center;padding:80px 24px;color:var(--muted)">
      <i class="fas fa-exclamation-circle" style="font-size:3rem;display:block;margin-bottom:16px;opacity:.25"></i>
      <h2 style="font-family:'Cormorant SC',serif;font-size:1.6rem;margin-bottom:10px;color:var(--text)">Статтю не знайдено</h2>
      <p style="margin-bottom:24px">ID: ${escHtml(String(id))}</p>
      <a href="admin_page.html" class="btn btn-primary"><i class="fas fa-arrow-left"></i> Повернутись</a>
    </div>`;
}

function renderForm(article) {
  originalData = { ...article };
  articleId = article.id;
  document.title = `Редагувати «${article.title}» - Слово`;

  let autosaveNotice = '';
  try {
    const as = JSON.parse(localStorage.getItem(`tvory_autosave_${articleId}`) || 'null');
    if (as && as.savedAt > (new Date(article.updated_at || 0).getTime())) {
      autosaveNotice = `
        <div style="background:rgba(198,112,129,.1);border:1px solid rgba(198,112,129,.25);border-radius:10px;padding:12px 18px;margin-bottom:20px;display:flex;align-items:center;gap:10px;font-size:.9rem;color:var(--rose)">
          <i class="fas fa-info-circle"></i>
          Знайдено автозбережену чернетку від ${new Date(as.savedAt).toLocaleTimeString('uk-UA')}.
          <button onclick="loadAutosave()" style="margin-left:auto;font-family:'Cormorant SC',serif;font-size:.82rem;color:var(--rose);background:none;border:1px solid var(--rose);border-radius:999px;padding:4px 12px;cursor:pointer">Відновити</button>
          <button onclick="dismissAutosave()" style="font-family:'Cormorant SC',serif;font-size:.82rem;color:var(--muted);background:none;border:none;cursor:pointer">✕</button>
        </div>`;
    }
  } catch {}

  document.getElementById('mainPage').innerHTML = `
    <div class="page-header">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        <h1>Редагувати статтю <span class="changed-indicator" id="dirtyDot"></span></h1>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        ${statusBadge(article.status)}
        <span style="font-family:'DM Sans',sans-serif;font-size:.78rem;color:var(--muted)">
          ID: ${article.id} &nbsp;·&nbsp; Створено: ${fmtDate(article.created_at)} &nbsp;·&nbsp; Оновлено: ${fmtDate(article.updated_at)}
        </span>
      </div>
    </div>

    ${autosaveNotice}

    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-pen" style="margin-right:7px;opacity:.5"></i>Основне</span>
      </div>
      <div class="card-body">
        <div class="form-group">
          <label for="fieldTitle">Назва статті</label>
          <input type="text" id="fieldTitle" class="form-input" value="${escHtml(article.title||'')}" placeholder="Введіть назву…" maxlength="200">
        </div>
        <div class="form-group">
          <label for="fieldAuthor">Автор</label>
          <input type="text" id="fieldAuthor" class="form-input" value="${escHtml(article.author||'')}" placeholder="Ім'я автора…">
        </div>
        <div class="form-group">
          <label for="fieldStatus">Статус</label>
          <select id="fieldStatus" class="form-select">
            <option value="draft" ${article.status==='draft'?'selected':''}>Чернетка</option>
            <option value="pending" ${article.status==='pending'?'selected':''}>На підтвердженні</option>
            <option value="published" ${article.status==='published'?'selected':''}>Опублікована</option>
            <option value="archived" ${article.status==='archived'?'selected':''}>Архів</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-align-left" style="margin-right:7px;opacity:.5"></i>Текст статті</span>
      </div>
      <div class="card-body">
        <div class="toolbar">
          <button class="tool-btn" onclick="wrapText('**','**')" title="Жирний"><i class="fas fa-bold"></i></button>
          <button class="tool-btn" onclick="wrapText('_','_')" title="Курсив"><i class="fas fa-italic"></i></button>
          <button class="tool-btn" onclick="insertHeading()" title="Підзаголовок"><i class="fas fa-heading"></i></button>
          <button class="tool-btn" onclick="insertQuote()" title="Цитата"><i class="fas fa-quote-left"></i></button>
          <button class="tool-btn" onclick="insertBreak()" title="Абзац">¶</button>
        </div>
        <div class="form-group" style="margin-bottom:6px">
          <textarea id="fieldContent" class="form-input form-textarea" placeholder="Текст статті…">${escHtml(article.content||'')}</textarea>
        </div>
        <div class="char-count" id="charCount">0 симв. · 0 слів</div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="actions">
          <button class="btn btn-danger" onclick="deleteArticle()"><i class="fas fa-trash"></i> Видалити</button>
          <div class="actions-right">
            <a href="admin.html" class="btn btn-secondary"><i class="fas fa-times"></i> Скасувати</a>
            <button class="btn btn-primary" id="mainSaveBtn" onclick="saveArticle()" disabled>
              <i class="fas fa-save"></i> Зберегти зміни
            </button>
            ${article.status !== 'published' ? `<button class="btn btn-green" onclick="publishAndSave()"><i class="fas fa-check"></i> Зберегти та опублікувати</button>` : ''}
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title"><i class="fas fa-history" style="margin-right:7px;opacity:.5"></i>Історія версій</span>
        <button class="tool-btn" onclick="renderHistory(articleId)" style="font-size:.78rem"><i class="fas fa-sync-alt"></i> Оновити</button>
      </div>
      <div class="card-body" id="historyList">
        <p style="color:var(--muted);font-size:.9rem">Завантаження…</p>
      </div>
    </div>
  `;

  document.getElementById('fieldTitle').addEventListener('input', markDirty);
  document.getElementById('fieldContent').addEventListener('input', () => { markDirty(); updateCharCount(); });
  document.getElementById('fieldAuthor').addEventListener('input', markDirty);
  document.getElementById('fieldStatus').addEventListener('change', markDirty);

  updateCharCount();
  renderHistory(articleId);
  window.onbeforeunload = () => isDirty ? 'Є незбережені зміни. Вийти?' : undefined;
}

function wrapText(before, after) {
  const ta = document.getElementById('fieldContent');
  const start = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(start, end);
  ta.value = ta.value.slice(0, start) + before + selected + after + ta.value.slice(end);
  ta.focus();
  ta.setSelectionRange(start + before.length, end + before.length);
  markDirty(); updateCharCount();
}

function insertHeading() {
  const ta = document.getElementById('fieldContent');
  const pos = ta.selectionStart;
  const nl = pos > 0 ? '\n\n' : '';
  ta.value = ta.value.slice(0, pos) + nl + '## ' + ta.value.slice(pos);
  ta.focus();
  ta.setSelectionRange(pos + nl.length + 3, pos + nl.length + 3);
  markDirty();
}

function insertQuote() {
  const ta = document.getElementById('fieldContent');
  const pos = ta.selectionStart, end = ta.selectionEnd;
  const selected = ta.value.slice(pos, end);
  const quoted = '\n> ' + (selected || 'Текст цитати');
  ta.value = ta.value.slice(0, pos) + quoted + ta.value.slice(end);
  markDirty();
}

function insertBreak() {
  const ta = document.getElementById('fieldContent');
  const pos = ta.selectionStart;
  ta.value = ta.value.slice(0, pos) + '\n\n' + ta.value.slice(pos);
  ta.focus();
  ta.setSelectionRange(pos + 2, pos + 2);
  markDirty();
}

window.loadAutosave = function() {
  const as = JSON.parse(localStorage.getItem(`tvory_autosave_${articleId}`) || 'null');
  if (!as) return;
  document.getElementById('fieldTitle').value = as.title || '';
  document.getElementById('fieldContent').value = as.content || '';
  updateCharCount();
  markDirty();
  showToast('Автозбережену чернетку завантажено', 'success');
};

window.dismissAutosave = function() {
  localStorage.removeItem(`tvory_autosave_${articleId}`);
  document.querySelector('[onclick="loadAutosave()"]')?.closest('[style]')?.remove();
};

async function saveArticle(overrideStatus) {
  const titleEl = document.getElementById('fieldTitle');
  const contentEl = document.getElementById('fieldContent');
  const authorEl = document.getElementById('fieldAuthor');
  const statusEl = document.getElementById('fieldStatus');

  if (!titleEl || !contentEl) return;

  const title = titleEl.value.trim();
  const content = contentEl.value.trim();
  const author = authorEl?.value.trim() || originalData.author || '';
  const status = overrideStatus || statusEl?.value || originalData.status;

  if (!title) {
    showToast('Вкажіть назву статті', 'error');
    titleEl.focus();
    titleEl.style.borderColor = 'var(--rose)';
    setTimeout(() => titleEl.style.borderColor = '', 2000);
    return false;
  }
  if (!content) {
    showToast('Текст статті не може бути порожнім', 'error');
    contentEl.focus();
    return false;
  }

  saveHistory(articleId, { title: originalData.title, content: originalData.content, author: originalData.author, status: originalData.status });

  const updated = {
    ...originalData,
    title,
    content,
    author,
    status,
    updated_at: new Date().toISOString(),
  };

  const btns = document.querySelectorAll('#mainSaveBtn, #headerSaveBtn');
  btns.forEach(b => { b.disabled = true; b.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Збереження…'; });

  let savedViaApi = false;

  try {
    const res = await fetch(`${API}/articles/${articleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, author, status }),
    });
    if (res.ok) {
      savedViaApi = true;
      const data = await res.json();
      Object.assign(updated, data);
    }
  } catch {}

  try {
    const arts = JSON.parse(localStorage.getItem(ARTICLES_KEY) || '[]');
    const idx = arts.findIndex(a => String(a.id) === String(articleId));
    if (idx >= 0) {
      arts[idx] = { ...arts[idx], ...updated };
      localStorage.setItem(ARTICLES_KEY, JSON.stringify(arts));
    } else if (status === 'published') {
      arts.push(updated);
      localStorage.setItem(ARTICLES_KEY, JSON.stringify(arts));
    }
  } catch {}

  localStorage.removeItem(`tvory_autosave_${articleId}`);

  originalData = { ...updated };
  markClean();
  renderHistory(articleId);

  btns.forEach(b => {
    b.innerHTML = '<i class="fas fa-check"></i> Збережено';
    setTimeout(() => {
      b.innerHTML = b.id === 'headerSaveBtn' ? '<i class="fas fa-save"></i> Зберегти' : '<i class="fas fa-save"></i> Зберегти зміни';
    }, 2000);
  });

  showToast(savedViaApi ? 'Збережено у базі даних ✓' : 'Збережено локально ✓', 'success');
  return true;
}

window.saveArticle = saveArticle;

window.publishAndSave = async function() {
  const ok = await saveArticle('published');
  if (ok) showToast('Статтю опубліковано ✓', 'success');
};

window.deleteArticle = async function() {
  if (!confirm(`Видалити статтю «${originalData.title}»? Це незворотно.`)) return;

  try {
    await fetch(`${API}/articles/${articleId}`, { method: 'DELETE' });
  } catch {}

  try {
    const arts = JSON.parse(localStorage.getItem(ARTICLES_KEY) || '[]');
    localStorage.setItem(ARTICLES_KEY, JSON.stringify(arts.filter(a => String(a.id) !== String(articleId))));
  } catch {}

  localStorage.removeItem(`tvory_autosave_${articleId}`);
  window.onbeforeunload = null;
  showToast('Статтю видалено', 'error');
  setTimeout(() => window.location.href = 'admin_page.html', 1200);
};

const params = new URLSearchParams(window.location.search);
const idFromUrl = params.get('id') || localStorage.getItem('editingArticleId');

if (idFromUrl) {
  localStorage.removeItem('editingArticleId');
  loadArticle(idFromUrl);
} else {
  document.getElementById('mainPage').innerHTML = `
    <div style="text-align:center;padding:80px 24px;color:var(--muted)">
      <i class="fas fa-question-circle" style="font-size:3rem;display:block;margin-bottom:16px;opacity:.25"></i>
      <h2 style="font-family:'Cormorant SC',serif;font-size:1.6rem;margin-bottom:10px;color:var(--text)">Не вказано ID статті</h2>
      <a href="admin_page.html" class="btn btn-primary"><i class="fas fa-arrow-left"></i> Повернутись</a>
    </div>`;
}
