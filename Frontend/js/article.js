const ARTICLES_KEY = 'tvory_published_articles';
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'gemma3:1b';

let currentArticleData = null;
let articleFullText = '';
let ollamaOk = false;

let flashcards = [];
let fcIndex = 0;
let quizQuestions = [];
let quizState = { cur: 0, score: 0, answered: [] };
let selfCheckQuestions = [];

let quizScores = JSON.parse(localStorage.getItem('slovo_quiz_scores') || '[]');
let earnedAchs = JSON.parse(localStorage.getItem('slovo_earned_achs') || '[]');
let aiPanelOpen = false;
let aiContext = '';

const ACH_DEFS = [
  {id:'reader',     icon:'bi-book',           name:'Читач',       desc:'Почали читання матеріалу'},
  {id:'fullreader', icon:'bi-book-fill',       name:'Прочитано',   desc:'Дочитали до кінця статті'},
  {id:'curious',    icon:'bi-search',          name:'Допитливий',  desc:'Навели на науковий термін'},
  {id:'highlighter',icon:'bi-highlighter',     name:'Marker',      desc:'Підсвітили важливий текст'},
  {id:'flasher',    icon:'bi-layers',          name:'Картяр',      desc:'Вивчали флеш-картки'},
  {id:'tester',     icon:'bi-clipboard-check', name:'Тестер',      desc:'Пройшли повний тест'},
  {id:'noter',      icon:'bi-chat-left-text',  name:'Коментатор',  desc:'Залишили власну думку'},
];

document.addEventListener('DOMContentLoaded', async () => {
  await checkOllama();
  
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    renderError();
    return;
  }

  let article = null;
  try {
    const arts = JSON.parse(localStorage.getItem(ARTICLES_KEY) || '[]');
    article = arts.find(a => String(a.id) === String(id));
  } catch(e) {}

  if (article) {
    renderArticle(article);
  } else {
    try {
      const r = await fetch(`http://localhost:5012/api/articles/${id}`);
      if (r.ok) {
        const data = await r.json();
        renderArticle(data);
      } else {
        renderError();
      }
    } catch {
      renderError();
    }
  }
});

async function checkOllama() {
  const badge = document.getElementById('ollamaBadge');
  try {
    const r = await fetch('http://localhost:11434/api/tags');
    ollamaOk = r.ok;
    if(badge) {
      badge.textContent = ollamaOk ? 'Gemma3 онлайн' : 'Офлайн';
      badge.className = `ollama-badge ${ollamaOk ? 'ok':'err'}`;
    }
  } catch {
    ollamaOk = false;
    if(badge) {
      badge.textContent = 'Офлайн';
      badge.className = 'ollama-badge err';
    }
  }
}

async function ollamaGenerate(prompt) {
  try {
    const r = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false })
    });
    if (!r.ok) return '';
    const d = await r.json();
    return d.response || '';
  } catch {
    return '';
  }
}

function parseJSON(raw) {
  const clean = raw.replace(/```json|```/g,'').trim();
  const m = clean.match(/\[[\s\S]*\]/);
  if (m) return JSON.parse(m[0]);
  return JSON.parse(clean);
}

async function triggerBackgroundGeneration(article) {
  if (!ollamaOk) {
    updateWidgetsNoAi();
    return;
  }
  const text = articleFullText || article.content || "";


  if (!article.flashcards || article.flashcards.length === 0) {
    const p = `Створи 5 флеш-карток у форматі JSON: [{"term": "...", "def": "..."}] українською мовою за цим текстом: ${text.substring(0,2000)}. Поверни виключно JSON масив без коментарів.`;
    const res = await ollamaGenerate(p);
    try { article.flashcards = parseJSON(res); initFlashcards(article); } catch { document.getElementById('fcContainerWidget').style.display='none'; }
  }


  if (!article.quiz || article.quiz.length === 0) {
    const p = `Згенеруй модульний тест за цим текстом: ${text.substring(0,2000)}.
    Поверни виключно чистий масив JSON з 4 об'єктів за наступним зразком структури (Обов'язково підставляй унікальні варіанти за суттю твору, не копіюй слова прикладу!):
    [{"q": "Яку ключову проблему порушує автор у творі?", "opts": ["Вплив класичного мистецтва на свідомість людини", "Трансформація культурних цінностей в епоху модерну", "Роль мовного середовища у формуванні світогляду"], "correct": 0}]
    Варіанти відповідей мають бути розгорнутими реченнями. Не використовуй пусті літери А, Б, В. Поверни тільки валідний JSON.`;
    const res = await ollamaGenerate(p);
    try { article.quiz = parseJSON(res); initQuiz(article); } catch { document.getElementById('quizContainerWidget').style.display='none'; }
  }


  if (!article.self_check || article.self_check.length === 0) {
    const p = `Створи 3 аналітичні питання для самоперевірки у форматі JSON: [{"q": "...", "hint": "..."}] українською за цим текстом: ${text.substring(0,2000)}. Поверни тільки JSON.`;
    const res = await ollamaGenerate(p);
    try { article.self_check = parseJSON(res); initSelfCheck(article); } catch { document.getElementById('selfCheckContainerWidget').style.display='none'; }
  }
}

function updateWidgetsNoAi() {
  const msg = `<div style="font-size:0.75rem; color:var(--accent); text-align:center; padding:10px 0;">Ollama сервер офлайн. Автогенерація неможлива.</div>`;
  if(!flashcards.length) document.getElementById('fcContainerWidget').innerHTML += msg;
  if(!quizQuestions.length) document.getElementById('quizContainerWidget').innerHTML += msg;
  if(!selfCheckQuestions.length) document.getElementById('selfCheckContainerWidget').innerHTML += msg;
}

function renderArticle(article) {
  currentArticleData = article;
  document.title = `${article.title} — Слово`;

  let bodyHtml = article.ai_html || article.content || '<p>Текст відсутній.</p>';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = bodyHtml;
  articleFullText = tempDiv.innerText.trim();

  if (article.terms) {
    const parsedTerms = typeof article.terms === 'string' ? JSON.parse(article.terms) : article.terms;
    Object.keys(parsedTerms).forEach(term => {
      const regex = new RegExp(`\\b(${term})\\b`, 'gi');
      bodyHtml = bodyHtml.replace(regex, `<span class="term" data-term="${term}" data-def="${parsedTerms[term]}">$1</span>`);
    });
  }

  document.getElementById('sidebarWrapper').style.display = 'flex';
  document.getElementById('commentsWrapper').style.display = 'block';

  let summaryHtml = '';
  if (article.summary || article.lead) {
    summaryHtml = `
      <div class="panel-card">
        <div class="panel-head" onclick="togglePanel(this)">
          <i class="bi bi-text-paragraph pi"></i> <span>Стислий зміст</span>
          <i class="bi bi-chevron-down chevron rotate"></i>
        </div>
        <div class="panel-body open">
          <p style="font-size:0.95rem; font-style:italic; line-height:1.6; text-align:justify;">${article.summary || article.lead}</p>
        </div>
      </div>`;
  }
const rawDate = article.date || article.created_at || new Date();
  const formattedDate = new Date(rawDate).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  
  document.getElementById('pageContent').innerHTML = `
    <main id="articleToExport">
      <div class="art-meta">
        <span class="tag">${article.category || 'Література'}</span>
        <span class="meta-info"><i class="bi bi-calendar3"></i> ${formattedDate}</span>
      </div>
      <h1>${article.title}</h1>
      <div class="author-card">
        <div class="author-av" style="background:#C67081">${(article.author || 'С').charAt(0).toUpperCase()}</div>
        <div>
          <div class="author-name">${article.author || 'Платформа Слово'}</div>
          <div class="author-label">Освітній матеріал</div>
        </div>
      </div>
      ${summaryHtml}
      <div class="divider"><div class="div-line"></div><div class="div-dot"></div><div class="div-line"></div></div>
      <div class="body" id="articleTextContent">${bodyHtml}</div>
      <div class="dl-section">
        <p>Завантажити статтю</p>
        <div class="dl-btns">
          <button class="dl-btn" onclick="exportToPDF()"><i class="bi bi-file-pdf"></i> PDF</button>
          <button class="dl-btn" onclick="exportToTxt()"><i class="bi bi-file-text"></i> TXT</button>
          <button class="dl-btn" onclick="exportToDocx()"><i class="bi bi-file-word"></i> DOCX</button>
        </div>
      </div>
    </main>`;

  calculateMetrics(bodyHtml);
  initSkeletonWidgets(article);
  initRecommendations(article);
  initCommentsSystem(article.id);
  initScrollAndReadingProgress();
  initTooltipsAndSelection();
  renderAchs();
  updateQuizProgressUI();

  triggerBackgroundGeneration(article);
}

function initSkeletonWidgets(article) {
  flashcards = article.flashcards || [];
  quizQuestions = article.quiz || [];
  selfCheckQuestions = article.self_check || [];

  document.getElementById('fcContainerWidget').innerHTML = `
    <div class="panel-card">
      <div class="panel-head" onclick="togglePanel(this)"><i class="bi bi-layers pi"></i> Картки термінів <i class="bi bi-chevron-down chevron rotate"></i></div>
      <div class="panel-body open" id="fcWrap">
        <div class="widget-loading"><div class="widget-spinner"></div> ШІ створює картки...</div>
      </div>
    </div>`;
  if(flashcards.length) initFlashcards(article);

  document.getElementById('quizContainerWidget').innerHTML = `
    <div class="panel-card">
      <div class="panel-head" onclick="togglePanel(this)"><i class="bi bi-clipboard-check pi"></i> Модульний тест <i class="bi bi-chevron-down chevron rotate"></i></div>
      <div class="panel-body open" id="quizWrap">
        <div class="widget-loading"><div class="widget-spinner"></div> ШІ генерує питання...</div>
      </div>
    </div>`;
  if(quizQuestions.length) initQuiz(article);

  document.getElementById('selfCheckContainerWidget').innerHTML = `
    <div class="panel-card">
      <div class="panel-head" onclick="togglePanel(this)"><i class="bi bi-question-circle pi"></i> Питання для роздумів <i class="bi bi-chevron-down chevron"></i></div>
      <div class="panel-body" id="selfCheckWrap">
        <div class="widget-loading"><div class="widget-spinner"></div> Складання питань ШІ...</div>
      </div>
    </div>`;
  if(selfCheckQuestions.length) initSelfCheck(article);
}

function initTooltipsAndSelection() {
  const tip = document.getElementById('termTip');
  document.querySelectorAll('.term').forEach(el => {
    el.addEventListener('mouseenter', () => {
      tip.innerHTML = `<strong style="display:block;margin-bottom:4px;color:var(--accent)">${el.dataset.term}</strong>${el.dataset.def}`;
      tip.style.opacity = '1';
      unlock('curious');
    });
    el.addEventListener('mousemove', e => {
      tip.style.left = (e.clientX + 15) + 'px';
      tip.style.top = (e.clientY - 15) + 'px';
    });
    el.addEventListener('mouseleave', () => tip.style.opacity = '0');
  });

  const menu = document.getElementById('selectionMenu');
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim().length) {
      menu.style.display = 'none';
      return;
    }
    const range = sel.getRangeAt(0);
    const textBlock = document.getElementById('articleTextContent');
    if (!textBlock || !textBlock.contains(range.commonAncestorContainer)) {
      menu.style.display = 'none';
      return;
    }

    menu.style.display = 'flex';
    const rect = range.getBoundingClientRect();
    menu.style.left = `${rect.left + window.scrollX + (rect.width / 2) - (menu.offsetWidth / 2)}px`;
    menu.style.top = `${rect.top + window.scrollY - menu.offsetHeight - 12}px`;
  });
}

function highlightSelection(cls) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  
  try {
    const span = document.createElement('span');
    span.className = `hl ${cls}`;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    
    toast('Маркер додано', 's');
    unlock('highlighter');
  } catch(e) {
    console.error(e);
    toast('Виділяйте текст простішими фрагментами', 'e');
  }
  sel.removeAllRanges();
  document.getElementById('selectionMenu').style.display = 'none';
}

function clearSelectionHighlight() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer.parentElement;
  if (node && node.classList.contains('hl')) {
    const p = node.parentElement;
    while (node.firstChild) p.insertBefore(node.firstChild, node);
    p.removeChild(node);
  }
  sel.removeAllRanges();
  document.getElementById('selectionMenu').style.display = 'none';
}

function askAiForSelection() {
  const txt = window.getSelection().toString().trim();
  if (txt) {
    openAiPanelWithContext(txt);
    document.getElementById('selectionMenu').style.display = 'none';
  }
}

function initQuiz(article) {
  quizQuestions = article.quiz || [];
  quizState = { cur: 0, score: 0, answered: new Array(quizQuestions.length).fill(null) };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const w = document.getElementById('quizWrap');
  if (!w || !quizQuestions.length) return;

  if (quizState.cur >= quizQuestions.length) {
    const pct = Math.round((quizState.score / quizQuestions.length) * 100);
    quizScores.push(pct);
    localStorage.setItem('slovo_quiz_scores', JSON.stringify(quizScores));
    updateQuizProgressUI();
    unlock('tester');
    w.innerHTML = `
      <div class="quiz-res">
        <div class="big">${quizState.score}/${quizQuestions.length}</div>
        <p>Правильних відповідей: <b>${pct}%</b></p>
        <button class="q-restart" onclick="resetQuiz()">↻ Знову</button>
      </div>`;
    return;
  }

  const q = quizQuestions[quizState.cur];
  const ans = quizState.answered[quizState.cur];

  w.innerHTML = `
    <div class="quiz-prog">Питання ${quizState.cur + 1} з ${quizQuestions.length}</div>
    <div class="quiz-q">${q.q}</div>
    <div class="quiz-opts">
      ${q.opts.map((o, i) => {
        let c = '';
        if (ans !== null) {
          if (i === q.correct) c = ' ok';
          else if (i === ans) c = ' bad';
        }
        return `<button class="qopt${c}" onclick="pickQuizOption(${i}, ${q.correct})" ${ans !== null ? 'disabled':''}>${o}</button>`;
      }).join('')}
    </div>
    <div class="quiz-nav">
      <button class="qnav-btn" onclick="quizNav(-1)" ${quizState.cur===0?'disabled':''}>←</button>
      <button class="qnav-btn" onclick="quizNav(1)">${quizState.cur === quizQuestions.length - 1 ? 'Фініш':'→'}</button>
    </div>`;
}

function pickQuizOption(sel, correct) {
  if (quizState.answered[quizState.cur] !== null) return;
  quizState.answered[quizState.cur] = sel;
  if (sel === correct) quizState.score++;
  renderQuizQuestion();
}

function quizNav(dir) {
  quizState.cur += dir;
  renderQuizQuestion();
}

function resetQuiz() {
  quizState = { cur: 0, score: 0, answered: new Array(quizQuestions.length).fill(null) };
  renderQuizQuestion();
}

function initFlashcards(article) {
  flashcards = article.flashcards || [];
  fcIndex = 0;
  
  document.getElementById('fcWrap').innerHTML = `
    <div class="fc-wrap">
      <div class="fc" id="fcCardElement" onclick="this.classList.toggle('flipped')">
        <div class="fc-front"><div class="fc-label">Концепт</div><div class="fc-term" id="fcTerm">—</div></div>
        <div class="fc-back"><div class="fc-label">Тлумачення</div><div class="fc-def" id="fcDef">—</div></div>
      </div>
    </div>
    <div class="fc-nav">
      <button class="fc-nav-btn" id="fcPrev" onclick="fcNav(-1)">←</button>
      <span class="fc-counter" id="fcCounter">1/1</span>
      <button class="fc-nav-btn" id="fcNext" onclick="fcNav(1)">→</button>
    </div>`;
  renderFlashcard();
}

function renderFlashcard() {
  if(!flashcards.length) return;
  document.getElementById('fcCardElement').classList.remove('flipped');
  document.getElementById('fcTerm').textContent = flashcards[fcIndex].term;
  document.getElementById('fcDef').textContent = flashcards[fcIndex].def;
  document.getElementById('fcCounter').textContent = `${fcIndex+1} / ${flashcards.length}`;
  document.getElementById('fcPrev').disabled = fcIndex === 0;
  document.getElementById('fcNext').disabled = fcIndex === flashcards.length - 1;
}

function fcNav(dir) {
  fcIndex += dir;
  renderFlashcard();
  unlock('flasher');
}

function initSelfCheck(article) {
  selfCheckQuestions = article.self_check || [];
  document.getElementById('selfCheckWrap').innerHTML = selfCheckQuestions.map((q, i) => `
    <div class="q-item">
      <p style="font-size:0.88rem; margin-bottom:4px;"><b>${i+1}. ${q.q}</b></p>
      <textarea class="ans-area" id="qa-${i}" placeholder="Введіть міркування..."></textarea>
      <button class="chk-btn" onclick="checkSelfCheck(${i})">Звірити</button>
      <div class="ans-fb" id="qf-${i}"></div>
    </div>`).join('');
}

function checkSelfCheck(i) {
  const val = document.getElementById(`qa-${i}`).value.trim();
  const fb = document.getElementById(`qf-${i}`);
  if(!val) return;
  fb.className = 'ans-fb hint';
  fb.textContent = `Критерій відповіді: ${selfCheckQuestions[i].hint}`;
}

function calculateMetrics(html) {
  const txt = html.replace(/<[^>]*>/g, '').trim();
  const words = txt.split(/\s+/).filter(w => w.length).length;
  document.getElementById('statWords').textContent = words;
  document.getElementById('statMinutes').textContent = Math.max(1, Math.ceil(words / 150));
}

function initScrollAndReadingProgress() {
  window.addEventListener('scroll', () => {
    const d = document.documentElement;
    const pct = Math.round(d.scrollTop / (d.scrollHeight - d.clientHeight) * 100) || 0;
    document.getElementById('rp').style.width = pct + '%';
    document.getElementById('readFill').style.width = pct + '%';
    document.getElementById('readPct').textContent = pct + '%';
    document.getElementById('btt').classList.toggle('v', d.scrollTop > 300);
    if(pct > 10) unlock('reader');
    if(pct > 92) unlock('fullreader');
  });
}

function togglePanel(head) {
  const body = head.nextElementSibling;
  const ch = head.querySelector('.chevron');
  body.classList.toggle('open');
  if(ch) ch.classList.toggle('rotate');
}

function updateQuizProgressUI() {
  if(!quizScores.length) return;
  const avg = Math.round(quizScores.reduce((a,b)=>a+b,0)/quizScores.length);
  document.getElementById('quizFill').style.width = avg + '%';
  document.getElementById('quizPct').textContent = avg + '%';
}

function renderAchs() {
  document.getElementById('achGrid').innerHTML = ACH_DEFS.map(a => `
    <div class="ach ${earnedAchs.includes(a.id)?'on':''}">
      <i class="bi ${a.icon} ach-ico"></i>
      <div class="ach-n">${a.name}</div>
      <div class="ach-d">${a.desc}</div>
    </div>`).join('');
}

function unlock(id) {
  if(earnedAchs.includes(id)) return;
  earnedAchs.push(id);
  localStorage.setItem('slovo_earned_achs', JSON.stringify(earnedAchs));
  renderAchs();
  const a = ACH_DEFS.find(x => x.id === id);
  if(a) toast(`Досягнення: ${a.name}`, 's');
}

function initRecommendations(curr) {
  const wrap = document.getElementById('recsWrap');
  let arts = [];
  try { arts = JSON.parse(localStorage.getItem(ARTICLES_KEY) || '[]'); } catch {}
  const list = arts.filter(a => String(a.id) !== String(curr.id)).slice(0, 2);
  if(!list.length) {
    wrap.innerHTML = '<div style="font-size:0.75rem; color:var(--muted)">Інші статті відсутні</div>';
    return;
  }
  wrap.innerHTML = list.map(a => `
    <a class="rec" href="article.html?id=${a.id}">
      <div class="rec-inner"><div class="rec-stripe" style="background:var(--panel)"></div><div class="rec-title">${a.title}</div></div>
    </a>`).join('');
}

function initCommentsSystem(artId) {
  const container = document.getElementById('commentsContainer');
  const BASE = window.location.origin;
 
  const renderCmts = (arr) => {
    if (!arr.length) {
      container.innerHTML = '<p style="font-size:0.8rem; color:var(--muted); font-style:italic;">Напишіть першу думку!</p>';
      return;
    }
    container.innerHTML = arr.map(c => {
      const date = new Date(c.created_at).toLocaleDateString('uk-UA');
      return `
      <div class="cmt">
        <div class="cmt-hdr"><div class="cmt-av" style="background:#2E3F55; color:white">${c.username.charAt(0).toUpperCase()}</div><strong>${c.username}</strong><em>${date}</em></div>
        <p>${c.text}</p>
      </div>`;
    }).join('');
  };
 
  const loadCmts = async () => {
    try {
      const res = await fetch(`${BASE}/comments?article_id=${artId}`);
      const arr = await res.json();
      renderCmts(Array.isArray(arr) ? arr : []);
    } catch {
      container.innerHTML = '<p style="font-size:0.8rem; color:var(--muted); font-style:italic;">Не вдалося завантажити коментарі.</p>';
    }
  };
 
  document.getElementById('cmt-submit').onclick = async () => {
    const inp = document.getElementById('cmt-input');
    const text = inp.value.trim();
    if (!text) return;
 
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    const username = storedUser?.nickname || storedUser?.name || storedUser?.email?.split('@')[0] || 'Гість';
 
    const btn = document.getElementById('cmt-submit');
    btn.disabled = true;
    btn.textContent = 'Надсилаємо…';
 
    try {
      const res = await fetch(`${BASE}/add-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, user_id: storedUser?.id, article_id: artId })
      });
      if (!res.ok) throw new Error();
      inp.value = '';
      unlock('noter');
      await loadCmts();
    } catch {
      alert('Не вдалося надіслати коментар. Спробуйте ще раз.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Додати коментар';
    }
  };
 
  loadCmts();
}

function toggleAiPanel() {
  aiPanelOpen = !aiPanelOpen;
  document.getElementById('aiPanel').classList.toggle('show', aiPanelOpen);
}

function openAiPanelWithContext(txt) {
  aiContext = txt;
  aiPanelOpen = true;
  document.getElementById('aiPanel').classList.add('show');
  const el = document.getElementById('aipContext');
  el.innerHTML = `<strong>Контекст:</strong> "${txt.slice(0,60)}..."`;
  el.classList.add('show');
}

function aiAsk(q) {
  const p = aiContext ? `Запитання: ${q}\nФрагмент тексту: "${aiContext}"` : q;
  sendAiRequest(q, p);
}

function aiSend() {
  const inp = document.getElementById('aipInp');
  if(!inp.value.trim()) return;
  const v = inp.value.trim();
  inp.value = '';
  sendAiRequest(v, v);
}

async function sendAiRequest(display, fullPrompt) {
  const box = document.getElementById('aipMessages');
  const u = document.createElement('div'); u.className = 'aip-msg user'; u.textContent = display;
  box.appendChild(u);
  
  const ai = document.createElement('div'); ai.className = 'aip-msg ai'; ai.textContent = 'Думаю...';
  box.appendChild(ai);
  box.scrollTop = box.scrollHeight;

  const res = await ollamaGenerate(`Ти - філологічний помічник платформи "Слово". Дай лаконічну відповідь українською мовою на запит: ${fullPrompt}`);
  ai.textContent = res || 'Не вдалося зв\'язатися з серверною моделлю ШІ.';
  box.scrollTop = box.scrollHeight;
}

function exportToPDF() {
  const el = document.getElementById('articleToExport');
  html2pdf().from(el).set({ margin:15, filename:`${currentArticleData.id}.pdf` }).save();
}

function exportToTxt() {
  let t = `${currentArticleData.title}\n\n${articleFullText}`;
  const blob = new Blob([t], {type:'text/plain;charset=utf-8'});
  saveAs(blob, `${currentArticleData.id}.txt`);
}

function exportToDocx() {
  try {
    const docxLib = window.docx || docx;
    if (!docxLib) {
      toast('Бібліотека DOCX недоступна', 'e');
      return;
    }
    
    const docParagraphs = [
      new docxLib.Paragraph({
        children: [
          new docxLib.TextRun({ text: currentArticleData ? currentArticleData.title : "Стаття", bold: true, size: 32 })
        ],
        spacing: { after: 400 }
      })
    ];

    if (articleFullText) {
      const lines = articleFullText.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          docParagraphs.push(new docxLib.Paragraph({
            children: [ new docxLib.TextRun({ text: line.trim(), size: 24 }) ],
            spacing: { after: 200 }
          }));
        }
      });
    }

    const doc = new docxLib.Document({
      sections: [{
        properties: {},
        children: docParagraphs
      }]
    });

    docxLib.Packer.toBlob(doc).then(blob => {
      saveAs(blob, `${(currentArticleData && currentArticleData.id) || 'article'}.docx`);
      toast('Файл .DOCX завантажено', 's');
    }).catch(err => {
      console.error("Packer error:", err);
      toast('Помилка збирання файлу', 'e');
    });
  } catch(e) {
    console.error("Docx generation crash:", e);
    toast('Сбій архітектури docx-генератора', 'e');
  }
}

function toast(m, type='') {
  const el = document.createElement('div'); el.className = `tm ${type}`; el.innerHTML = m;
  document.getElementById('tc').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 2500);
}

function renderError() {
  document.getElementById('pageContent').innerHTML = `<h3 style="text-align:center; padding:50px;">Статтю не знайдено</h3>`;
}