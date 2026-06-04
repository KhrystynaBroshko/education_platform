function googleTranslateElementInit() {
  new google.translate.TranslateElement({ pageLanguage: 'uk', autoDisplay: false }, 'google_translate_element');
}

let currentUser = null;
let allArticles = [];
let editingNoteIndex = null;

function getUserData() {
  if (!currentUser) return { likes:[], saves:[], follows:[], readHistory:[], notes:[], weeklyReads:0, weeklyLikes:0 };
  const k = `tvory_user_${currentUser.email}`;
  try { return JSON.parse(localStorage.getItem(k)) || { likes:[], saves:[], follows:[], readHistory:[], notes:[], weeklyReads:0, weeklyLikes:0 }; } catch { return { likes:[], saves:[], follows:[], readHistory:[], notes:[], weeklyReads:0, weeklyLikes:0 }; }
}
function saveUserData(d) {
  if (!currentUser) return;
  localStorage.setItem(`tvory_user_${currentUser.email}`, JSON.stringify(d));
}

function nameColor(n='') {
  const c=['#3a6b86','#6b5e8a','#7a6040','#4a7a6a','#8a5060','#4a6080','#7a7040'];
  let h=0; for(let i=0;i<n.length;i++) h=n.charCodeAt(i)+((h<<5)-h);
  return c[Math.abs(h)%c.length];
}

const toastW = document.getElementById('toastContainer');
function toast(msg, type='', dur=2800) {
  const el=document.createElement('div'); el.className=`tm ${type}`;
  const ic=type==='s'?'check':type==='e'?'times':'info-circle';
  el.innerHTML=`<i class="fas fa-${ic}"></i> ${msg}`;
  toastW.appendChild(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),320);},dur);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff/60000);
  if(m<1) return 'щойно';
  if(m<60) return `${m} хв тому`;
  const h = Math.floor(m/60);
  if(h<24) return `${h} god тому`;
  const d = Math.floor(h/24);
  if(d<7) return `${d} дн тому`;
  return new Date(ts).toLocaleDateString('uk-UA');
}

function setAuthUI(u) {
  const uavEl = document.getElementById('userAvatar');
  const unmEl = document.getElementById('userName');
  const sdAv = document.getElementById('sidebarAvatar');
  const sdNm = document.getElementById('sidebarName');
  if (!u) {
    window.location.href = 'index.html'; return;
  }
  const ini=(u.name||'?').charAt(0).toUpperCase(), col=nameColor(u.name||'');
  unmEl.textContent = u.name||'Користувач';
  sdNm.textContent = u.name||'Користувач';
  document.getElementById('pageSubtitle').textContent = `Простір читача  ${u.name||''}`;
  if(u.avatar){uavEl.innerHTML=`<img src="${u.avatar}" alt="">`;sdAv.innerHTML=`<img src="${u.avatar}" alt="">`;}
  else{uavEl.style.background=col;uavEl.textContent=ini;sdAv.style.background=col;sdAv.textContent=ini;}
}

function showTab(name) {
  ['history','bookmarks','notes','goals','certs'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t===name ? 'block' : 'none';
  });
  document.querySelectorAll('.tab-btn').forEach((b,i)=>{
    b.classList.toggle('active', ['history','bookmarks','notes','goals','certs'][i]===name);
  });
  if(name==='history') renderHistory();
  if(name==='bookmarks') renderBookmarks();
  if(name==='notes') renderNotes();
  if(name==='goals') renderGoals();
  if(name==='certs') renderCerts();
}

async function fetchArticles() {
  try {
    const r = await fetch('http://localhost:5012/articles?status=published');
    if(!r.ok) throw new Error();
    return await r.json();
  } catch {
    return [
      {id:1,title:'Мистецтво уваги',author:'Олена Коваль',category:'productivity'},
      {id:2,title:'Осінь у місті',author:'Михайло Лісний',category:'poezia'},
      {id:3,title:'Перша мова',author:'Соня Берест',category:'education'},
      {id:4,title:"Кар'єра чи покликання",author:'Олена Коваль',category:'career'},
      {id:5,title:'Квантовий стрибок',author:'Артем Радченко',category:'nauka'},
      {id:6,title:'Між рядками',author:'Михайло Лісний',category:'tvory'},
      {id:7,title:'Звичка читати',author:'Соня Берест',category:'productivity'},
      {id:8,title:'Вечірні думки',author:'Артем Радченко',category:'poezia'},
      {id:9,title:'Наука натхнення',author:'Олена Коваль',category:'nauka'},
    ];
  }
}

function renderHistory() {
  const ud = getUserData();
  const hist = ud.readHistory || [];
  document.getElementById('histBadge').textContent = hist.length;
  const el = document.getElementById('historyList');
  if(!hist.length){
    el.innerHTML=`<div class="empty-state"><i class="fas fa-book-open"></i><p>Ви ще нічого не читали.<br>Поверніться на головну і починайте!</p></div>`;
    return;
  }
  el.innerHTML = hist.map(h=>`
    <div class="hist-item">
      <div class="hist-icon"><i class="fas fa-book-open"></i></div>
      <div class="hist-info">
        <div class="hist-title">${h.title||'Без назви'}</div>
        <div class="hist-meta">${h.author||''} · ${timeAgo(h.readAt)}</div>
      </div>
      ${h.category?`<span class="hist-cat">${h.category}</span>`:''}
    </div>`).join('');
}

function renderBookmarks() {
  const ud = getUserData();
  const saves = ud.saves || [];
  document.getElementById('bkBadge').textContent = saves.length;
  const el = document.getElementById('bookmarksList');
  if(!saves.length){
    el.innerHTML=`<div class="empty-state"><i class="fas fa-bookmark"></i><p>Немає збережених статей.<br>Натисніть 🔖 на будь-якій статті.</p></div>`;
    return;
  }
  const arts = allArticles.filter(a => saves.includes(a.id));
  if(!arts.length){
    el.innerHTML=`<div class="empty-state"><i class="fas fa-bookmark"></i><p>Збережені статті не знайдено.</p></div>`;
    return;
  }
  el.innerHTML = arts.map(a=>`
    <div class="bk-card">
      <div class="bk-title">${a.title||'Без назви'}</div>
      <div class="bk-meta">
        <span><i class="fas fa-user" style="opacity:.5"></i> ${a.author||''}</span>
        ${a.category?`<span><i class="fas fa-tag" style="opacity:.5"></i> ${a.category}</span>`:''}
      </div>
      <div class="art-card-actions">
        <button class="act-btn" onclick="window.location.href='${a.url||'#'}'"><i class="fas fa-book-open"></i> Читати</button>
        <button class="act-btn danger" onclick="removeBookmark(${a.id})"><i class="fas fa-trash"></i> Видалити</button>
      </div>
    </div>`).join('');
}

window.removeBookmark = function(id) {
  const ud = getUserData();
  ud.saves = (ud.saves||[]).filter(x=>x!==id);
  saveUserData(ud);
  toast('Видалено з закладок');
  renderBookmarks();
};

function renderNotes() {
  const ud = getUserData();
  const notes = ud.notes || [];
  document.getElementById('notesBadge').textContent = notes.length;
  const el = document.getElementById('notesList');
  if(!notes.length){
    el.innerHTML=`<div class="empty-state"><i class="fas fa-sticky-note"></i><p>Немає конспектів.<br>Створіть перший вище!</p></div>`;
    return;
  }
  el.innerHTML = notes.map((n,i)=>`
    <div class="note-card">
      <div class="note-title"><i class="fas fa-file-lines"></i> ${n.title||'Без назви'}</div>
      <div class="note-source">${new Date(n.createdAt).toLocaleDateString('uk-UA')}</div>
      <div class="note-text">${n.content||''}</div>
      <div class="art-card-actions">
        <button class="act-btn" onclick="editNote(${i})"><i class="fas fa-edit"></i> Редагувати</button>
        <button class="act-btn danger" onclick="deleteNote(${i})"><i class="fas fa-trash"></i> Видалити</button>
      </div>
    </div>`).join('');
}

window.addNote = function() {
  const title = document.getElementById('noteTitle').value.trim();
  const content = document.getElementById('noteContent').value.trim();
  if(!title && !content){ toast('Заповніть хоча б одне поле','e'); return; }
  
  const ud = getUserData();
  if(!ud.notes) ud.notes=[];
  
  if (editingNoteIndex !== null) {
    ud.notes[editingNoteIndex] = { 
      title, 
      content, 
      createdAt: ud.notes[editingNoteIndex].createdAt || Date.now() 
    };
    editingNoteIndex = null;
    document.getElementById('saveNoteBtn').innerHTML = '<i class="fas fa-save"></i> Зберегти конспект';
    toast('Конспект оновлено','s');
  } else {
    ud.notes.unshift({ title, content, createdAt: Date.now() });
    toast('Конспект збережено','s');
  }
  
  saveUserData(ud);
  document.getElementById('noteTitle').value='';
  document.getElementById('noteContent').value='';
  document.getElementById('notesBadge').textContent = ud.notes.length;
  renderNotes();
};

window.deleteNote = function(i) {
  const ud = getUserData();
  ud.notes.splice(i,1);
  saveUserData(ud);
  
  if (editingNoteIndex === i) {
    editingNoteIndex = null;
    document.getElementById('saveNoteBtn').innerHTML = '<i class="fas fa-save"></i> Зберегти конспект';
    document.getElementById('noteTitle').value='';
    document.getElementById('noteContent').value='';
  } else if (editingNoteIndex > i) {
    editingNoteIndex--;
  }
  
  document.getElementById('notesBadge').textContent = ud.notes.length;
  toast('Конспект видалено');
  renderNotes();
};

window.editNote = function(i) {
  const ud = getUserData();
  const n = ud.notes[i];
  
  document.getElementById('noteTitle').value = n.title||'';
  document.getElementById('noteContent').value = n.content||'';
  
  editingNoteIndex = i;
  document.getElementById('saveNoteBtn').innerHTML = '<i class="fas fa-save"></i> Оновити конспект';
  document.getElementById('noteTitle').scrollIntoView({behavior:'smooth'});
  toast('Редагування конспекту. Зміни вступлять в силу після збереження.');
};

function renderGoals() {
  const ud = getUserData();
  const r = Math.min(ud.weeklyReads||0, 5);
  const l = Math.min(ud.weeklyLikes||0, 3);
  const n = Math.min((ud.notes||[]).length, 2);
  const s = Math.min((ud.saves||[]).length, 5);
  document.getElementById('g1text').textContent=`${r}/5`;
  document.getElementById('g2text').textContent=`${l}/3`;
  document.getElementById('g3text').textContent=`${n}/2`;
  document.getElementById('g4text').textContent=`${s}/5`;
  document.getElementById('g1bar').style.width=`${(r/5)*100}%`;
  document.getElementById('g2bar').style.width=`${(l/3)*100}%`;
  document.getElementById('g3bar').style.width=`${(n/2)*100}%`;
  document.getElementById('g4bar').style.width=`${(s/5)*100}%`;
}

const certsConfig = [
  { id:'first_read', icon:'<i class="fas fa-book-open"></i>', name:'Перший читач', desc:'Прочитайте свою першу статтю', goal:1, type:'reads' },
  { id:'reader5', icon:'<i class="fas fa-book"></i>', name:'Допитливий розум', desc:'Прочитайте 5 статей', goal:5, type:'reads' },
  { id:'reader50', icon:'<i class="fas fa-graduation-cap"></i>', name:'Бібліофіл', desc:'Прочитайте 50 статей', goal:50, type:'reads' },
  { id:'reader1000', icon:'<i class="fas fa-trophy"></i>', name:'Майстер знань', desc:'Прочитайте 1000+ статей (освіта)', goal:1000, type:'reads' },
  { id:'liker10', icon:'<i class="fas fa-heart"></i>', name:'Цінитель', desc:'Вподобайте 10 статей', goal:10, type:'likes' },
  { id:'saver10', icon:'<i class="fas fa-bookmark"></i>', name:'Колекціонер', desc:'Збережіть 10 статей у закладки', goal:10, type:'saves' },
  { id:'noter5', icon:'<i class="fas fa-pen-fancy"></i>', name:'Конспектор', desc:'Створіть 5 конспектів', goal:5, type:'notes' },
  { id:'allgoals', icon:'<i class="fas fa-star"></i>', name:'Всебічний розвиток', desc:'Виконайте всі тижневі цілі', goal:4, type:'goals' },
];

function renderCerts() {
  const ud = getUserData();
  const totalReads = (ud.readHistory||[]).length;
  const totalLikes = (ud.likes||[]).length;
  const totalSaves = (ud.saves||[]).length;
  const totalNotes = (ud.notes||[]).length;
  const goalsCompleted = [
    Math.min(ud.weeklyReads||0,5)>=5,
    Math.min(ud.weeklyLikes||0,3)>=3,
    Math.min(totalNotes,2)>=2,
    Math.min(totalSaves,5)>=5
  ].filter(Boolean).length;

  const grid = document.getElementById('certGrid');
  grid.innerHTML = certsConfig.map(c => {
    let current;
    if(c.type==='reads') current=totalReads;
    else if(c.type==='likes') current=totalLikes;
    else if(c.type==='saves') current=totalSaves;
    else if(c.type==='notes') current=totalNotes;
    else if(c.type==='goals') current=goalsCompleted;
    const pct = Math.min(100, Math.round((current/c.goal)*100));
    const earned = current >= c.goal;
    return `<div class="cert-card ${earned?'earned':'locked'}">
      ${earned?`<div class="cert-badge"><i class="fas fa-check" style="font-size:0.65rem;"></i> Отримано</div>`:`<div class="cert-badge"><i class="fas fa-lock" style="font-size:0.65rem;"></i> ${pct}%</div>`}
      <div class="cert-icon">${c.icon}</div>
      <div class="cert-name">${c.name}</div>
      <div class="cert-desc">${c.desc}</div>
      <div class="cert-progress"><div class="cert-fill" style="width:${pct}%"></div></div>
      <div class="cert-pct">${current}/${c.goal}</div>
    </div>`;
  }).join('');
}

function openSdb(){document.getElementById('sidebar').classList.add('open');document.getElementById('sidebarOverlay').classList.add('show')}
function closeSdb(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('show')}
document.getElementById('menuButton').addEventListener('click',openSdb);
document.getElementById('closeSidebar').addEventListener('click',closeSdb);
document.getElementById('sidebarOverlay').addEventListener('click',closeSdb);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSdb()});
document.getElementById('logoutLink').addEventListener('click',e=>{
  e.preventDefault();
  localStorage.removeItem('user');localStorage.removeItem('token');
  window.location.href='index.html';
});

document.addEventListener('DOMContentLoaded', async () => {
  const stored = JSON.parse(localStorage.getItem('user')||'null');
  if(!stored){ window.location.href='index.html'; return; }
  currentUser = stored;
  setAuthUI(stored);
  allArticles = await fetchArticles();
  renderHistory();
  const ud = getUserData();
  document.getElementById('bkBadge').textContent = (ud.saves||[]).length;
  document.getElementById('notesBadge').textContent = (ud.notes||[]).length;
  document.getElementById('histBadge').textContent = (ud.readHistory||[]).length;
});
