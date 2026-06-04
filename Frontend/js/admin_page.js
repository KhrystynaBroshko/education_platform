const ARTICLES_KEY = 'tvory_published_articles';

const user = JSON.parse(localStorage.getItem('user') || 'null');
if (user?.name) {
  document.getElementById('adminName').textContent = user.name;
  document.getElementById('adminAvatar').textContent = user.name.charAt(0).toUpperCase();
}

function showToast(msg, type = '') {
  const wrap = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? 'check' : type === 'error' ? 'times' : 'info-circle';
  el.innerHTML = `<i class="fas fa-${icon}"></i> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3200);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('uk-UA') : '—'; }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getPublishedArticles() {
  try { return JSON.parse(localStorage.getItem(ARTICLES_KEY) || '[]'); }
  catch { return []; }
}

function savePublishedArticle(article) {
  const arts = getPublishedArticles();
  const idx = arts.findIndex(a => String(a.id) === String(article.id));
  const record = {
    ...article,
    status: 'published',
    published_at: article.published_at || new Date().toISOString(),
  };
  if (idx >= 0) arts[idx] = record;
  else arts.push(record);
  localStorage.setItem(ARTICLES_KEY, JSON.stringify(arts));
  updatePublishedCount();
}

function removePublishedArticle(id) {
  const arts = getPublishedArticles().filter(a => String(a.id) !== String(id));
  localStorage.setItem(ARTICLES_KEY, JSON.stringify(arts));
  updatePublishedCount();
}

function updatePublishedCount() {
  document.getElementById('pagesCount').textContent = getPublishedArticles().length;
}

const sectionTitles = {
  dashboard: 'Панель керування',
  'manage-articles': 'Управління статтями',
  'pending-articles': 'На підтвердження',
  'manage-users': 'Управління користувачами',
};

function navigate(id) {
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelector(`.nav-link[data-section="${id}"]`)?.classList.add('active');
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.getElementById('topbarTitle').textContent = sectionTitles[id] || '';
}

document.querySelectorAll('.nav-link[data-section]').forEach(link => {
  link.addEventListener('click', () => navigate(link.getAttribute('data-section')));
});

let currentTab = 'published';
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentTab = this.dataset.tab;
    ['published','drafts','archived'].forEach(t => {
      document.getElementById(`${t}-articles`).style.display = 'none';
    });
    document.getElementById(`${currentTab}-articles`).style.display = 'block';
    const key = currentTab + '-articles';
    if (pagination[key]) pagination[key].page = 1;
    renderArticleList(key);
  });
});

const API = 'http://localhost:5012';
async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API + path, opts);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch { return null; }
}

const PAGE_SIZE = 10;
const pagination = {};
const dataCache = {};

function initPagination(key, items) {
  dataCache[key] = items;
  if (!pagination[key]) pagination[key] = { page: 1 };
  const total = Math.ceil(items.length / PAGE_SIZE);
  if (pagination[key].page > total && total > 0) pagination[key].page = 1;
}

function getPage(key) {
  const items = dataCache[key] || [];
  const page = (pagination[key] || {}).page || 1;
  const start = (page - 1) * PAGE_SIZE;
  return { items: items.slice(start, start + PAGE_SIZE), page, total: Math.ceil(items.length / PAGE_SIZE), count: items.length };
}

function renderPagination(paginElId, key) {
  const el = document.getElementById(paginElId);
  if (!el) return;
  const { page, total, count } = getPage(key);
  if (total <= 1) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const items = dataCache[key] || [];
  const start = (page - 1) * PAGE_SIZE;
  const range = buildRange(page, total);
  let html = `<button class="page-btn" onclick="goPage('${key}','${paginElId}',${page-1})" ${page===1?'disabled':''}><i class="fas fa-chevron-left" style="font-size:.7rem"></i></button>`;
  range.forEach(p => {
    if (p === '…') html += `<span class="page-info">…</span>`;
    else html += `<button class="page-btn ${p===page?'active':''}" onclick="goPage('${key}','${paginElId}',${p})">${p}</button>`;
  });
  html += `<button class="page-btn" onclick="goPage('${key}','${paginElId}',${page+1})" ${page===total?'disabled':''}><i class="fas fa-chevron-right" style="font-size:.7rem"></i></button>`;
  html += `<span class="page-info">${start+1}–${Math.min(start+PAGE_SIZE,count)} з ${count}</span>`;
  el.innerHTML = html;
}

function buildRange(cur, total) {
  if (total <= 7) return Array.from({length:total},(_,i)=>i+1);
  if (cur <= 4) return [1,2,3,4,5,'…',total];
  if (cur >= total-3) return [1,'…',total-4,total-3,total-2,total-1,total];
  return [1,'…',cur-1,cur,cur+1,'…',total];
}

window.goPage = function(key, paginElId, page) {
  if (!pagination[key]) pagination[key] = { page: 1 };
  const total = Math.ceil((dataCache[key]||[]).length / PAGE_SIZE);
  pagination[key].page = Math.max(1, Math.min(total, page));
  if (['published-articles','drafts-articles','archived-articles'].includes(key)) {
    renderArticleList(key);
  } else if (key === 'users-list') {
    _renderUserItems();
    renderPagination(paginElId, key);
  }
};

let _modalArticleId = null;
let _modalChoice    = null; 

function openAIModal(articleId) {
  const article = pendingData[articleId];
  if (!article) return;

  _modalArticleId = articleId;
  _modalChoice    = null;

  document.getElementById('choiceAI').classList.remove('selected');
  document.getElementById('choicePlain').classList.remove('selected');
  document.getElementById('modalConfirmBtn').disabled = true;

  document.getElementById('modalArticlePreview').textContent =
    `Автор: ${article.author || '—'}`;
  document.getElementById('modalTitlePreview').textContent =
    `«${article.title || 'Без назви'}»`;

  document.getElementById('aiConfirmModal').classList.add('show');
}

window.selectChoice = function(choice) {
  _modalChoice = choice;
  document.getElementById('choiceAI').classList.toggle('selected', choice === 'ai');
  document.getElementById('choicePlain').classList.toggle('selected', choice === 'plain');
  document.getElementById('modalConfirmBtn').disabled = false;
};

function closeAIModal() {
  document.getElementById('aiConfirmModal').classList.remove('show');
  _modalArticleId = null;
  _modalChoice    = null;
}

window.doConfirmArticle = async function() {
  if (!_modalArticleId || !_modalChoice) return;
  const id     = _modalArticleId;
  const useAI  = _modalChoice === 'ai';
  closeAIModal();
  await processConfirmArticle(id, useAI);
};

function setStep(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `gen-step ${state}`;
  const icons = { done:'check', active:'spinner fa-spin', pending:'circle' };
  el.querySelector('.step-icon').innerHTML = `<i class="fas fa-${icons[state]||'circle'}"></i>`;
}

async function processConfirmArticle(id, useAI) {
  const article = pendingData[id];
  if (!article) { showToast('Статтю не знайдено', 'error'); return; }

  const overlay = document.getElementById('genOverlay');
  overlay.classList.add('show');

  document.getElementById('genTitle').textContent = `«${article.title}»`;
  document.getElementById('genDots').style.display = 'flex';
  document.getElementById('genLink').style.display = 'none';

 
  const step1El = document.getElementById('step1');
  document.getElementById('step1Text').textContent = useAI
    ? 'AI генерація розширеного контенту (Gemma3:1b)'
    : 'Збереження оригінального тексту';

  document.getElementById('genMsg').textContent = useAI
    ? 'Gemma3:1b генерує розширений контент…'
    : 'Підготовка до публікації…';

  setStep('step1', 'active');
  setStep('step2', 'pending');
  setStep('step3', 'pending');

  
  await apiFetch(`/articles/${id}/status`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ status: 'published' })
  });

  let aiHtml = '';

  if (useAI) {
  
    try {
      const res = await fetch('http://localhost:5012/api/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:   article.title,
          content: article.content || '',
          author:  article.author  || 'Автор'
        })
      });
      const data = await res.json();
      if (data.success) {
        aiHtml = data.html;
        setStep('step1', 'done');
        showToast('AI Gemma3 успішно згенерував контент', 'success');
      } else {
        throw new Error(data.error || 'Невідома помилка');
      }
    } catch (e) {
      console.error(e);
      aiHtml = `<h2>Про що стаття</h2><p>${escapeHtml(article.content || 'Контент відсутній')}</p>`;
      setStep('step1', 'done');
      showToast('Помилка Ollama. Збережено оригінальний текст.', 'error');
    }
  } else {
 
    await sleep(400);
    aiHtml = ''; 
    setStep('step1', 'done');
    showToast('Оригінальний текст збережено', 'success');
  }


  setStep('step2', 'active');
  document.getElementById('genMsg').textContent = 'Збереження на сайт…';
  await sleep(600);

  const publishedArticle = {
    ...article,
    status: 'published',
    ai_html:     useAI ? aiHtml : '',
    ai_enhanced: useAI,
    published_at: new Date().toISOString(),
  };

  savePublishedArticle(publishedArticle);
  setStep('step2', 'done');

 
  setStep('step3', 'active');
  await sleep(400);
  setStep('step3', 'done');

  document.getElementById('genDots').style.display = 'none';
  document.getElementById('genMsg').textContent = '✓ Статтю успішно опубліковано!';
  document.getElementById('genLink').style.display = 'block';
  document.getElementById('genLinkA').href = `article.html?id=${article.id}`;


  showToast(`«${article.title}» опубліковано`, 'success');
  addActivity(`Опубліковано статтю — «${article.title}»`);
  await displayArticlesForConfirmation();
  await displayArticles();
  updateStats();
}

async function fetchArticles(status) {
  const data = await apiFetch(`/articles?status=${status}`);
  return data || getDemoArticles(status);
}

function getDemoArticles(status) {
  const all = [
    {id:1,title:'Мистецтво уваги',author:'Олена Коваль',created_at:'2025-03-15',updated_at:'2025-03-15',status:'published',content:'Про мистецтво концентрації уваги у сучасному світі сповненому відволікань. Ми живемо в епоху інформаційного шуму, коли увага стала найціннішим ресурсом.'},
    {id:2,title:'Осінь у місті',author:'Михайло Лісний',created_at:'2025-03-10',updated_at:'2025-03-10',status:'published',content:'Міський пейзаж осінньої пори. Жовте листя, дощ, кав\'ярні. Місто змінює своє обличчя щороку, але осінь завжди особлива.'},
    {id:3,title:'Перша мова',author:'Соня Берест',created_at:'2025-03-18',updated_at:'2025-03-18',status:'draft',content:'Есе про мову як першу форму самовираження.'},
    {id:4,title:'Квантовий стрибок',author:'Артем Радченко',created_at:'2025-03-12',updated_at:'2025-03-14',status:'archived',content:'Популярно про квантову фізику.'},
    {id:5,title:'Між рядками',author:'Михайло Лісний',created_at:'2025-03-05',updated_at:'2025-03-05',status:'pending',content:'Короткий роман про кохання, яке народилося з листування. Кожен лист — це ціла всесвіт почуттів.'},
    {id:6,title:'Місто вночі',author:'Соня Берест',created_at:'2025-03-20',updated_at:'2025-03-20',status:'pending',content:'Нічне місто живе своїм ритмом. Ліхтарі відбиваються у калюжах, а вулиці стають іншими.'},
  ];
  return all.filter(a => a.status === status);
}

async function displayArticles() {
  const [pub, draft, arch] = await Promise.all([
    fetchArticles('published'), fetchArticles('draft'), fetchArticles('archived')
  ]);
  initPagination('published-articles', pub);
  initPagination('drafts-articles', draft);
  initPagination('archived-articles', arch);
  renderArticleList('published-articles');
  renderArticleList('drafts-articles');
  renderArticleList('archived-articles');
  document.getElementById('drafts-articles').style.display = 'none';
  document.getElementById('archived-articles').style.display = 'none';
  document.getElementById('published-articles').style.display = 'block';
}

function renderArticleList(key) {
  const el = document.getElementById(key);
  if (!el) return;
  const { items } = getPage(key);
  const isPublished = key === 'published-articles';
  const isDraft     = key === 'drafts-articles';

  if (!items.length) {
    el.innerHTML = `<div class="empty-state"><i class="fas fa-feather-alt"></i><p>Немає статей</p></div>`;
    document.getElementById('articlePagination').classList.add('hidden');
    return;
  }

  const publishedLocal = getPublishedArticles();

  el.innerHTML = items.map(a => {
    const localPub  = publishedLocal.find(p => String(p.id) === String(a.id));
    const pubBadge  = isPublished && localPub ? `<span class="page-created-badge" style="margin-left:6px"><i class="fas fa-globe"></i> На сайті</span>` : '';

    let aiTag = '';
    if (isPublished && localPub) {
      aiTag = localPub.ai_enhanced
        ? `<span class="ai-mode-tag with-ai"><i class="fas fa-brain"></i> AI</span>`
        : `<span class="ai-mode-tag no-ai"><i class="fas fa-file-alt"></i> Оригінал</span>`;
    }
    const viewBtn = localPub ? `<a href="article.html?id=${a.id}" target="_blank" class="btn btn-view"><i class="fas fa-eye"></i> Читати</a>` : '';
    const actions = isPublished
      ? `${viewBtn}<button class="btn btn-edit" onclick="editArticle('${a.id}')">Редагувати</button><button class="btn btn-reject" onclick="archiveArticle('${a.id}')">Архівувати</button>`
      : isDraft
      ? `<button class="btn btn-edit" onclick="editArticle('${a.id}')">Редагувати</button><button class="btn btn-confirm" onclick="publishArticle('${a.id}')">Опублікувати</button>`
      : `<button class="btn btn-edit" onclick="restoreArticle('${a.id}')">Відновити</button>`;
    return `
      <div class="item-row">
        <div class="item-info">
          <h3>${escapeHtml(a.title||'Без назви')} ${pubBadge} ${aiTag}</h3>
          <div class="item-meta">${escapeHtml(a.author||'—')} &nbsp;·&nbsp; ${fmtDate(isPublished?a.created_at:a.updated_at)}</div>
        </div>
        <div class="item-actions">${actions}</div>
      </div>`;
  }).join('');

  if (key === currentTab + '-articles') renderPagination('articlePagination', key);
}

async function changeStatus(id, status, msg) {
  await apiFetch(`/articles/${id}/status`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ status })
  });
  ['published-articles','drafts-articles','archived-articles'].forEach(k => {
    if (dataCache[k]) dataCache[k] = dataCache[k].filter(a => String(a.id) !== String(id));
  });
  if (status === 'archived') removePublishedArticle(id);
  if (msg) showToast(msg, 'success');
  await displayArticles();
  updateStats();
}

window.archiveArticle = id => changeStatus(id, 'archived', 'Статтю архівовано');
window.publishArticle = id => changeStatus(id, 'published', 'Статтю опубліковано ✓');
window.restoreArticle = id => changeStatus(id, 'draft', 'Статтю відновлено');
window.editArticle = id => {
  localStorage.setItem('editingArticleId', id);
  window.location.href = 'edit-article.html?id=' + id;
};

let pendingData = {};

async function displayArticlesForConfirmation() {
  const articles = await fetchArticles('pending');
  const wrap = document.getElementById('articlesForConfirmation');
  document.getElementById('pendingBadge').textContent = articles.length;

  if (!articles.length) {
    wrap.innerHTML = `<div class="empty-state"><i class="fas fa-check-circle" style="color:var(--rose)"></i><p>Немає статей для підтвердження</p></div>`;
    return;
  }

  pendingData = {};
  articles.forEach(a => { pendingData[a.id] = a; });

  wrap.innerHTML = articles.map(a => `
    <div class="pending-card" id="pending-${a.id}">
      <div class="pending-card-header">
        <h3>${escapeHtml(a.title||'Без назви')}</h3>
        <div class="item-meta" style="margin-top:4px">
          <span class="badge badge-pending">Очікує</span>
          &nbsp; Автор: ${escapeHtml(a.author||'—')}
        </div>
      </div>
      <div class="pending-card-body">${escapeHtml(a.content||'') || '<em style="opacity:.4">Без вмісту</em>'}</div>
      <div class="pending-card-footer">
        <!-- Єдина кнопка підтвердження — відкриває модалку вибору -->
        <button class="btn btn-confirm" onclick="openAIModal(${a.id})">
          <i class="fas fa-check"></i> Підтвердити
        </button>
        <button class="btn btn-reject" onclick="rejectArticle(${a.id})"><i class="fas fa-times"></i> Відхилити</button>
        <button class="btn btn-edit" onclick="editArticle('${a.id}')"><i class="fas fa-pen"></i> Редагувати</button>
        <span style="margin-left:auto;font-size:.8rem;color:var(--text-muted);font-family:'Cormorant SC',serif">
          <i class="fas fa-info-circle"></i> Оберіть режим після натискання «Підтвердити»
        </span>
      </div>
    </div>`).join('');
}

window.rejectArticle = async (id) => {
  await apiFetch(`/articles/${id}/status`, {
    method: 'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ status: 'archived' })
  });
  showToast('Статтю відхилено');
  await displayArticlesForConfirmation();
  updateStats();
};

async function displayUsers() {
  const data = await apiFetch('/users') || [
    {id:1,email:'olena@example.com',name:'Олена Коваль',is_blocked:false,created_at:'2025-03-01'},
    {id:2,email:'mykhailo@example.com',name:'Михайло Лісний',is_blocked:false,created_at:'2025-03-05'},
    {id:3,email:'sonya@example.com',name:'Соня Берест',is_blocked:true,created_at:'2025-02-20'},
    {id:4,email:'artem@example.com',name:'Артем Радченко',is_blocked:false,created_at:'2025-03-10'},
  ];
  initPagination('users-list', data);
  _renderUserItems();
  renderPagination('usersPagination', 'users-list');
}

function _renderUserItems() {
  const el = document.getElementById('usersList');
  const { items } = getPage('users-list');
  const palette = ['#2D3E54','#C67081','#6a95b0','#7a8e6e','#9a7a9e'];
  const sc = s => { let h=0; for(let c of s) h=c.charCodeAt(0)+((h<<5)-h); return palette[Math.abs(h)%palette.length]; };
  if (!items.length) { el.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>Немає</p></div>`; return; }
  el.innerHTML = items.map(u => `
    <div class="item-row">
      <div class="item-info" style="display:flex;align-items:center;gap:12px">
        <div style="width:38px;height:38px;border-radius:50%;background:${sc(u.email||'')};display:flex;align-items:center;justify-content:center;color:white;font-family:'Cormorant SC',serif;font-size:1rem;font-weight:600;flex-shrink:0">${(u.name||u.email||'?').charAt(0).toUpperCase()}</div>
        <div>
          <h3>${escapeHtml(u.name||u.email)}</h3>
          <div class="item-meta">${escapeHtml(u.email)} &nbsp;·&nbsp; <span class="badge ${u.is_blocked?'badge-rejected':'badge-published'}">${u.is_blocked?'Заблокований':'Активний'}</span> &nbsp;·&nbsp; ${fmtDate(u.created_at)}</div>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn ${u.is_blocked?'btn-confirm':'btn-reject'}" onclick="toggleBlock('${u.id}',${u.is_blocked})">
          ${u.is_blocked?'<i class="fas fa-unlock"></i> Розблокувати':'<i class="fas fa-ban"></i> Блокувати'}
        </button>
      </div>
    </div>`).join('');
}

window.toggleBlock = async (id, blocked) => {
  await apiFetch(`/users/${id}/block`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ block: !blocked }) });
  if (dataCache['users-list']) {
    dataCache['users-list'] = dataCache['users-list'].map(u => String(u.id)===String(id) ? {...u, is_blocked: !blocked} : u);
  }
  _renderUserItems();
  showToast(blocked ? 'Розблоковано' : 'Заблоковано', blocked ? 'success' : '');
};

async function updateStats() {
  const pub     = (dataCache['published-articles']||[]).length;
  const draft   = (dataCache['drafts-articles']||[]).length;
  const arch    = (dataCache['archived-articles']||[]).length;
  const pending = (await fetchArticles('pending')).length;
  const users   = (dataCache['users-list']||[]).length;
  document.getElementById('totalArticles').textContent = pub + draft + arch;
  document.getElementById('pendingCount').textContent  = pending;
  document.getElementById('totalUsers').textContent    = users;
  document.getElementById('pendingBadge').textContent  = pending;
  updatePublishedCount();
}

const ACTIVITY_KEY = 'tvory_activity_log';
function addActivity(text) {
  const log = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  log.unshift({ text, time: new Date().toISOString() });
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(log.slice(0, 20)));
  displayRecentActivities();
}

async function displayRecentActivities() {
  const localLog = JSON.parse(localStorage.getItem(ACTIVITY_KEY) || '[]');
  const apiActs  = await apiFetch('/admin-logs');
  const el = document.getElementById('recentActivities');

  const acts = localLog.length ? localLog : (apiActs || [
    { text: 'Підтверджено «Мистецтво уваги» — з\'явилось на reading.html', time: new Date(Date.now()-36000000).toISOString() },
    { text: 'Зареєстровано sonya@example.com', time: new Date(Date.now()-54000000).toISOString() },
    { text: '«Між рядками» — відправлено на перевірку', time: new Date(Date.now()-86400000).toISOString() },
  ]);

  if (!acts.length) {
    el.innerHTML = `<li class="activity-item"><div class="act-dot"></div><div><div class="act-text">Немає активності</div></div></li>`;
    return;
  }
  el.innerHTML = acts.slice(0, 8).map(a => {
    const mins = Math.floor((Date.now() - new Date(a.time||a.created_at)) / 60000);
    const timeStr = mins < 60 ? `${mins} хв. тому` : `${Math.floor(mins/60)} год. тому`;
    return `<li class="activity-item"><div class="act-dot"></div><div><div class="act-text">${escapeHtml(a.text||a.action_details)}</div><div class="act-time">${timeStr}</div></div></li>`;
  }).join('');
}

document.getElementById('articleSearch')?.addEventListener('input', function() {
  const q = this.value.toLowerCase().trim();
  if (!q) { displayArticles(); return; }
  ['published-articles','drafts-articles','archived-articles'].forEach(key => {
    const all = dataCache[key] || [];
    const filtered = all.filter(a =>
      (a.title||'').toLowerCase().includes(q) || (a.author||'').toLowerCase().includes(q)
    );
    initPagination(key, filtered);
    renderArticleList(key);
  });
});

document.getElementById('userSearch')?.addEventListener('input', function() {
  const q   = this.value.toLowerCase().trim();
  const all = dataCache['users-list'] || [];
  const filtered = q ? all.filter(u => (u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)) : all;
  initPagination('users-list', filtered);
  _renderUserItems();
  renderPagination('usersPagination', 'users-list');
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('user'); localStorage.removeItem('token');
  showToast('Ви вийшли з системи');
  setTimeout(() => window.location.href = 'index.html', 1200);
});

document.getElementById('aiConfirmModal').addEventListener('click', function(e) {
  if (e.target === this) closeAIModal();
});

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([
    displayArticles(),
    displayArticlesForConfirmation(),
    displayUsers(),
    displayRecentActivities(),
  ]);
  updateStats();
});
