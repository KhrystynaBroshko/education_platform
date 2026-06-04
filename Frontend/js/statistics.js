function googleTranslateElementInit() {
  new google.translate.TranslateElement({ pageLanguage: 'uk', autoDisplay: false }, 'google_translate_element');
}

let currentUser = null;

function getUserData() {
  if (!currentUser) return { likes:[], saves:[], follows:[], readHistory:[], notes:[], weeklyReads:0, weeklyLikes:0 };
  try { return JSON.parse(localStorage.getItem(`tvory_user_${currentUser.email}`)) || { likes:[], saves:[], follows:[], readHistory:[], notes:[], weeklyReads:0, weeklyLikes:0 }; }
  catch { return { likes:[], saves:[], follows:[], readHistory:[], notes:[], weeklyReads:0, weeklyLikes:0 }; }
}

function nameColor(n='') {
  const c=['#3a6b86','#6b5e8a','#7a6040','#4a7a6a','#8a5060','#4a6080','#7a7040'];
  let h=0; for(let i=0;i<n.length;i++) h=n.charCodeAt(i)+((h<<5)-h);
  return c[Math.abs(h)%c.length];
}

function setAuthUI(u) {
  const uavEl = document.getElementById('userAvatar');
  const unmEl = document.getElementById('userName');
  const sdAv = document.getElementById('sidebarAvatar');
  const sdNm = document.getElementById('sidebarName');
  if (!u) { window.location.href = 'index.html'; return; }
  const ini=(u.name||'?').charAt(0).toUpperCase(), col=nameColor(u.name||'');
  unmEl.textContent = u.name||'Користувач';
  sdNm.textContent = u.name||'Користувач';
  document.getElementById('pageSubtitle').textContent = `Читацький профіль ${u.name||''}`;
  if(u.avatar){uavEl.innerHTML=`<img src="${u.avatar}" alt="" style="width:100%;height:100%;object-fit:cover">`;sdAv.innerHTML=`<img src="${u.avatar}" alt="">` ;}
  else{uavEl.style.background=col;uavEl.textContent=ini;sdAv.style.background=col;sdAv.textContent=ini;}
}

function buildStats(ud) {
  const hist = ud.readHistory || [];
  const likes = ud.likes || [];
  const saves = ud.saves || [];
  const follows = ud.follows || [];
  const notes = ud.notes || [];

  const cards = [
    { ico:'<i class="fas fa-book-open" style="color:var(--accent)"></i>', val: hist.length, lbl:'Прочитано статей', trend:'Всього' },
    { ico:'<i class="fas fa-heart" style="color:var(--accent)"></i>', val: likes.length, lbl:'Вподобань', trend:'Всього' },
    { ico:'<i class="fas fa-bookmark" style="color:var(--accent)"></i>', val: saves.length, lbl:'У закладках', trend:'Збережено' },
    { ico:'<i class="fas fa-file-alt" style="color:var(--accent)"></i>', val: notes.length, lbl:'Конспектів', trend:'Написано' },
    { ico:'<i class="fas fa-user-check" style="color:var(--accent)"></i>', val: follows.length, lbl:'Підписок', trend:'Авторів' },
    { ico:'<i class="fas fa-calendar-day" style="color:var(--accent)"></i>', val: ud.weeklyReads||0, lbl:'Прочитано цього тижня', trend:'з 5 цілі' },
  ];
  document.getElementById('overviewCards').innerHTML = cards.map(c=>`
    <div class="stat-card">
      <div class="stat-card-ico">${c.ico}</div>
      <div class="stat-card-val">${c.val}</div>
      <div class="stat-card-lbl">${c.lbl}</div>
      <div class="stat-card-trend">${c.trend}</div>
    </div>`).join('');

  const catCounts = {};
  hist.forEach(h=>{ if(h.category) catCounts[h.category] = (catCounts[h.category]||0)+1; });
  const topCat = Object.entries(catCounts).sort((a,b)=>b[1]-a[1])[0];
  const authorCounts = {};
  hist.forEach(h=>{ if(h.author) authorCounts[h.author] = (authorCounts[h.author]||0)+1; });
  const topAuthor = Object.entries(authorCounts).sort((a,b)=>b[1]-a[1])[0];

  const daySet = new Set(hist.map(h=>new Date(h.readAt).toDateString()));
  const streak = calcStreak(hist);

  document.getElementById('insightsGrid').innerHTML = `
    <div class="insight-card">
      <div class="insight-icon pink"><i class="fas fa-fire" style="color:var(--accent)"></i></div>
      <div class="insight-text">
        <div class="insight-label">Серія читання</div>
        <div class="insight-val">${streak} дні(в)</div>
        <div class="insight-sub">поспіль</div>
      </div>
    </div>
    <div class="insight-card">
      <div class="insight-icon blue"><i class="fas fa-tag" style="color:var(--detail)"></i></div>
      <div class="insight-text">
        <div class="insight-label">Улюблена категорія</div>
        <div class="insight-val">${topCat ? topCat[0] : '—'}</div>
        <div class="insight-sub">${topCat ? topCat[1]+' статей' : 'Читайте більше!'}</div>
      </div>
    </div>
    <div class="insight-card">
      <div class="insight-icon green"><i class="fas fa-user" style="color:var(--green)"></i></div>
      <div class="insight-text">
        <div class="insight-label">Улюблений автор</div>
        <div class="insight-val">${topAuthor ? topAuthor[0] : '—'}</div>
        <div class="insight-sub">${topAuthor ? topAuthor[1]+' прочитань' : 'Читайте більше!'}</div>
      </div>
    </div>
    <div class="insight-card">
      <div class="insight-icon gold"><i class="fas fa-calendar-check" style="color:var(--gold)"></i></div>
      <div class="insight-text">
        <div class="insight-label">Активних днів</div>
        <div class="insight-val">${daySet.size}</div>
        <div class="insight-sub">з різних днів</div>
      </div>
    </div>`;

  document.getElementById('streakNum').textContent = streak;
  buildWeeklyChart(hist);
  buildCatChart(catCounts);
  buildHeatmap(hist);
  buildTopAuthors(authorCounts);
}

function calcStreak(hist) {
  if(!hist.length) return 0;
  const days = [...new Set(hist.map(h=>new Date(h.readAt).toDateString()))].map(d=>new Date(d)).sort((a,b)=>b-a);
  let streak=1;
  const today = new Date(); today.setHours(0,0,0,0);
  const first = new Date(days[0]); first.setHours(0,0,0,0);
  if(today - first > 86400000) return 0;
  for(let i=1;i<days.length;i++){
    const diff = (days[i-1]-days[i])/86400000;
    if(diff<=1) streak++;
    else break;
  }
  return streak;
}

function buildWeeklyChart(hist) {
  const weeks = [];
  const now = Date.now();
  for(let w=6; w>=0; w--) {
    const start = now - (w+1)*7*86400000;
    const end = now - w*7*86400000;
    const count = hist.filter(h => {
      const rAt = new Date(h.readAt).getTime();
      return rAt >= start && rAt < end;
    }).length;
    const label = `Т-${w}`;
    weeks.push({ count, label: w===0?'Цей тиж.':w===1?'Мин. тиж.':label });
  }
  const maxVal = Math.max(...weeks.map(w=>w.count), 1);
  const container = document.getElementById('activityChart');
  container.innerHTML = weeks.map(w=>`
    <div class="bar-wrap">
      <div class="bar" data-val="${w.count}" style="height:${Math.max(4,(w.count/maxVal)*140)}px"></div>
      <div class="bar-label">${w.label}</div>
    </div>`).join('');
}

function buildCatChart(catCounts) {
  const catColors = {
    education:'#BFD0DC', career:'#EAC1CB', productivity:'#F2D8DF',
    nauka:'#6b9bbd', poezia:'#C67081', tvory:'#b08570', default:'#aaa'
  };
  const entries = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]);
  const max = Math.max(...entries.map(e=>e[1]), 1);
  if(!entries.length){
    document.getElementById('catChart').innerHTML=`<div style="font-family:'Cormorant SC',serif;color:var(--muted);text-align:center;padding:20px">Немає даних</div>`;
    return;
  }
  document.getElementById('catChart').innerHTML = entries.map(([cat,cnt])=>`
    <div class="cat-row">
      <div class="cat-name">${cat}</div>
      <div class="cat-bar"><div class="cat-fill" style="width:${(cnt/max)*100}%;background:${catColors[cat]||catColors.default}"></div></div>
      <div class="cat-count">${cnt}</div>
    </div>`).join('');
}

function buildHeatmap(hist) {
  const dayCounts = {};
  hist.forEach(h=>{
    const d = new Date(h.readAt);
    d.setHours(0,0,0,0);
    const k = d.toISOString().slice(0,10);
    dayCounts[k] = (dayCounts[k]||0)+1;
  });
  const hm = document.getElementById('heatmap');
  const cells = [];
  const now = new Date(); now.setHours(0,0,0,0);
  for(let i=363; i>=0; i--) {
    const d = new Date(now - i*86400000);
    const k = d.toISOString().slice(0,10);
    const cnt = dayCounts[k]||0;
    const cls = cnt===0?'':cnt===1?'hm-1':cnt<=3?'hm-2':cnt<=6?'hm-3':'hm-4';
    cells.push(`<div class="hm-cell ${cls}" title="${k}: ${cnt} статей"></div>`);
  }
  hm.innerHTML = cells.join('');
}

function buildTopAuthors(authorCounts) {
  const el = document.getElementById('topAuthors');
  const entries = Object.entries(authorCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(!entries.length){
    el.innerHTML=`<div style="font-family:'Cormorant SC',serif;color:var(--muted);text-align:center;padding:20px">Поки що немає даних</div>`;
    return;
  }
  el.innerHTML = entries.map(([author,cnt],i)=>`
    <div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="font-family:'Cormorant SC',serif;font-size:1.2rem;font-weight:700;color:var(--muted);min-width:28px">${i+1}</div>
      <div style="width:36px;height:36px;border-radius:50%;background:${nameColor(author)};display:flex;align-items:center;justify-content:center;color:white;font-family:'Cormorant SC',serif;font-size:.9rem;font-weight:700;flex-shrink:0">${author.charAt(0).toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-family:'Cormorant SC',serif;font-size:1rem;font-weight:700;color:var(--text)">${author}</div>
        <div style="font-size:.78rem;color:var(--muted);font-family:'Cormorant SC',serif">${cnt} прочитань</div>
      </div>
      <div style="font-family:'Cormorant SC',serif;font-size:.85rem;font-weight:700;color:var(--accent)">${cnt} ст.</div>
    </div>`).join('');
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

document.addEventListener('DOMContentLoaded', () => {
  const stored = JSON.parse(localStorage.getItem('user')||'null');
  if(!stored){ window.location.href='index.html'; return; }
  currentUser = stored;
  setAuthUI(stored);
  const ud = getUserData();
  buildStats(ud);
});
