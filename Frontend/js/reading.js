const T = {
  uk: {
    menu:'Меню', home:'Головна', account:'Акаунт', myArticles:'Мої статті',
    statistics:'Статистика', write:'Написати', logout:'Вийти',
    login:'Увійти', loginShort:'Увійти', loginSub:'Читати, писати, надихатись',
    loginPrompt:'Увійдіть, щоб отримати доступ до всіх функцій',
    guest:'Гість', reader:'Читач',
    search:'Пошук статей…', category:'Категорія', author:'Автор',
    sort:'Сортування', all:'Усі', education:'Освіта', career:"Кар'єра",
    productivity:'Продуктивність', science:'Наука', poetry:'Поезія', fiction:'Художні твори',
    newest:'Найновіші', popular:'Популярні', az:'А → Я',
    heroLabel:'Платформа для авторів',
    heroSub:'Тут живуть думки, поезія і знання — обирай те, що резонує з тобою сьогодні.',
    statArticles:'Статей', statAuthors:'Авторів', statLikes:'Вподобань', statSelected:'Вибрано',
    weeklyGoals:'Мої цілі на тиждень',
    goalRead:'📖 Прочитати 5 статей', goalLike:'❤️ Вподобати статті',
    notifications:'Сповіщення', markRead:'Прочитати всі', noNotif:'Немає сповіщень',
    emailPlaceholder:'Email адреса', passPlaceholder:'Пароль',
    or:'або', forgotPass:'Забули пароль?', register:'Зареєструватись',
    footerTagline:'Простір для думок',
    readBtn:'Читати', readers:'читачів', likes:'вподобань',
    subscribe:'Підписатися', unsubscribe:'Відписатися',
    liked:'Вподобано', unliked:'Лайк знято',
    saved:'Збережено в закладки', unsaved:'Видалено з закладок',
    followed:'Підписались на', unfollowed:'Відписались від',
    loginRequired:'Увійдіть, щоб писати', notifEmpty:'Немає нових сповіщень',
    notifLoginReq:'Увійдіть для сповіщень',
    noArticles:'Статей не знайдено',
    welcome:'Ласкаво просимо', loggedOut:'Ви вийшли з акаунту',
    night:'Нічний режим увімкнено', noNight:'Нічний режим вимкнено',
    focus:'Режим читання увімкнено', noFocus:'Режим читання вимкнено',
    copied:'Посилання скопійовано', copyErr:'Не вдалося',
    connErr:"Помилка з'єднання", wrongData:'Невірні дані',
    fillAll:'Заповніть усі поля',
    greetNight:'Доброї ночі', greetMorn:'Доброго ранку',
    greetDay:'Доброго дня', greetEve:'Доброго вечора',
    notifNewLike:'вподобав(-ла) вашу статтю', notifNewFollow:'підписався(-лась) на вас',
    notifNewArticle:'опублікував(-ла) нову статтю', notifTrending:'У тренді',
    loading:'Завантаження…',
  },
  en: {
    menu:'Menu', home:'Home', account:'Account', myArticles:'My Articles',
    statistics:'Statistics', write:'Write', logout:'Log out',
    login:'Log in', loginShort:'Log in', loginSub:'Read, write, be inspired',
    loginPrompt:'Log in to access all features',
    guest:'Guest', reader:'Reader',
    search:'Search articles…', category:'Category', author:'Author',
    sort:'Sort', all:'All', education:'Education', career:'Career',
    productivity:'Productivity', science:'Science', poetry:'Poetry', fiction:'Fiction',
    newest:'Newest', popular:'Popular', az:'A → Z',
    heroLabel:'Platform for authors',
    heroSub:'Ideas, poetry and knowledge live here — pick what resonates with you today.',
    statArticles:'Articles', statAuthors:'Authors', statLikes:'Likes', statSelected:'Selected',
    weeklyGoals:'My weekly goals',
    goalRead:'📖 Read 5 articles', goalLike:'❤️ Like articles',
    notifications:'Notifications', markRead:'Mark all read', noNotif:'No notifications',
    emailPlaceholder:'Email address', passPlaceholder:'Password',
    or:'or', forgotPass:'Forgot password?', register:'Register',
    footerTagline:'Space for thoughts',
    readBtn:'Read', readers:'readers', likes:'likes',
    subscribe:'Follow', unsubscribe:'Unfollow',
    liked:'Liked', unliked:'Like removed',
    saved:'Saved to bookmarks', unsaved:'Removed from bookmarks',
    followed:'Following', unfollowed:'Unfollowed',
    loginRequired:'Log in to write', notifEmpty:'No new notifications',
    notifLoginReq:'Log in for notifications',
    noArticles:'No articles found',
    welcome:'Welcome', loggedOut:'You have logged out',
    night:'Dark mode on', noNight:'Dark mode off',
    focus:'Reading mode on', noFocus:'Reading mode off',
    copied:'Link copied', copyErr:'Failed',
    connErr:'Connection error', wrongData:'Invalid credentials',
    fillAll:'Fill in all fields',
    greetNight:'Good night', greetMorn:'Good morning',
    greetDay:'Good afternoon', greetEve:'Good evening',
    notifNewLike:'liked your article', notifNewFollow:'followed you',
    notifNewArticle:'published a new article', notifTrending:'Trending',
    loading:'Loading…',
  }
};

let lang = localStorage.getItem('tvory_lang') || 'uk';

function t(key){ return (T[lang] && T[lang][key]) || T.uk[key] || key; }

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    el.textContent = t(k);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.getElementById('langLabel').textContent = lang === 'uk' ? 'EN' : 'UA';
  const lnBtn = document.getElementById('loginButton');
  if(lnBtn && !lnBtn.disabled) lnBtn.textContent = t('login');
  if (!currentUser) {
    const unmEl = document.getElementById('userName');
    if(unmEl) unmEl.textContent = t('loginShort');
    const sdNm = document.getElementById('sidebarName');
    if(sdNm) sdNm.textContent = t('guest');
    const sdRole = document.getElementById('sidebarRole');
    if(sdRole) sdRole.textContent = t('reader');
  }
  if(allArticles.length) displayArticles(filterArticles(allArticles));
}

document.getElementById('langToggle').addEventListener('click', () => {
  lang = lang === 'uk' ? 'en' : 'uk';
  localStorage.setItem('tvory_lang', lang);
  applyLang();
  updateGreeting();
  renderNotifications();
});

const AUTO_NOTIF_TEMPLATES = [
  { icon:'fa-heart', type:'like' },
  { icon:'fa-user-plus', type:'follow' },
  { icon:'fa-pen-nib', type:'article' },
  { icon:'fa-fire', type:'trending' },
];

function getNotifications() {
  const k = currentUser ? `tvory_notif_${currentUser.email}` : 'tvory_notif_guest';
  try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; }
}

function updateNotifBadge() {
  const list = getNotifications();
  const unread = list.filter(n => !n.read).length;
  const badge = document.getElementById('notifBadge');
  if(unread > 0){ badge.style.display='block'; badge.title = unread; }
  else badge.style.display='none';
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff/60000);
  if(m < 1) return lang==='uk' ? 'щойно' : 'just now';
  if(m < 60) return lang==='uk' ? `${m} хв тому` : `${m}m ago`;
  const h = Math.floor(m/60);
  if(h < 24) return lang==='uk' ? `${h} год тому` : `${h}h ago`;
  return lang==='uk' ? `${Math.floor(h/24)} д тому` : `${Math.floor(h/24)}d ago`;
}

function renderNotifications() {
  const list = getNotifications();
  const listEl = document.getElementById('notifList');
  if(!listEl) return;
  if(!list.length) {
    listEl.innerHTML = `<div class="notif-empty"><i class="fas fa-bell-slash" style="font-size:1.8rem;opacity:.3;display:block;margin-bottom:8px"></i>${t('noNotif')}</div>`;
    return;
  }
  listEl.innerHTML = list.slice(0,12).map(n => `
    <div class="notif-item ${n.read?'':'unread'}" onclick="markOneRead(${n.id})">
      <div class="notif-icon"><i class="fas ${n.icon}"></i></div>
      <div class="notif-text">
        <div class="notif-title">${n.text}</div>
        <div class="notif-time">${timeAgo(n.time)}</div>
      </div>
      ${n.read?'':'<div class="notif-dot"></div>'}
    </div>`).join('');
}

window.markOneRead = function(id) {
  const list = getNotifications();
  const n = list.find(x => x.id === id);
  if(n) n.read = true;
  saveNotifications(list);
  updateNotifBadge();
  renderNotifications();
};

document.getElementById('markAllRead').addEventListener('click', () => {
  const list = getNotifications().map(n => ({...n, read:true}));
  saveNotifications(list);
  updateNotifBadge();
  renderNotifications();
});

let notifInterval = null;
function startAutoNotifications() {
  if(notifInterval) clearInterval(notifInterval);
  if(!currentUser) return;
  setTimeout(() => {
    pushNotification(generateNotif());
    notifInterval = setInterval(() => {
      if(currentUser) pushNotification(generateNotif());
    }, 45000 + Math.random()*45000);
  }, 15000);
}

const notifBell = document.getElementById('notificationBell');
const notifPanel = document.getElementById('notifPanel');
notifBell.addEventListener('click', e => {
  e.stopPropagation();
  if(!currentUser){ toast(t('notifLoginReq'),'e'); openLM(); return; }
  notifPanel.classList.toggle('show');
  if(notifPanel.classList.contains('show')) renderNotifications();
});
document.addEventListener('click', e => {
  if(!e.target.closest('.ibtn-wrap')) notifPanel.classList.remove('show');
});

let currentUser = null, authors = {}, allArticles = [], currentView = 'grid';

function getUserData() {
  if (!currentUser) return { likes:[], saves:[], follows:[], readHistory:[], weeklyReads:0, weeklyLikes:0 };
  const key = `tvory_user_${currentUser.email}`;
  const stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  return { likes:[], saves:[], follows:[], readHistory:[], weeklyReads:0, weeklyLikes:0 };
}
function saveUserData(data) {
  if (!currentUser) return;
  localStorage.setItem(`tvory_user_${currentUser.email}`, JSON.stringify(data));
}
function getArticleCounts() {
  const s = localStorage.getItem('tvory_article_counts');
  return s ? JSON.parse(s) : {};
}
function saveArticleCounts(c) { localStorage.setItem('tvory_article_counts', JSON.stringify(c)); }

const darkBtn = document.getElementById('darkModeBtn');
const focusBtn = document.getElementById('focusModeBtn');
if(localStorage.getItem('tvory_dark')==='1'){document.body.classList.add('dark-mode');darkBtn.classList.add('active');}
if(localStorage.getItem('tvory_focus')==='1'){document.body.classList.add('focus-mode');focusBtn.classList.add('active');}
darkBtn.addEventListener('click',()=>{
  document.body.classList.toggle('dark-mode');
  const on=document.body.classList.contains('dark-mode');
  localStorage.setItem('tvory_dark',on?'1':'0');darkBtn.classList.toggle('active',on);
  toast(on?`🌙 ${t('night')}`:`☀️ ${t('noNight')}`);
});
focusBtn.addEventListener('click',()=>{
  document.body.classList.toggle('focus-mode');
  const on=document.body.classList.contains('focus-mode');
  localStorage.setItem('tvory_focus',on?'1':'0');focusBtn.classList.toggle('active',on);
  toast(on?`👁 ${t('focus')}`:`👁 ${t('noFocus')}`);
});

window.addEventListener('scroll',()=>{
  const h=document.documentElement;
  const pct=h.scrollTop/(h.scrollHeight-h.clientHeight);
  document.getElementById('rp').style.transform=`scaleX(${pct})`;
  document.getElementById('backToTop').classList.toggle('vis',h.scrollTop>400);
});
document.getElementById('backToTop').addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
document.getElementById('gridView').addEventListener('click',()=>{
  currentView='grid';document.getElementById('gridView').classList.add('active');
  document.getElementById('listView').classList.remove('active');
  document.getElementById('articlesList').classList.remove('list-view');
  displayArticles(filterArticles(allArticles));
});
document.getElementById('listView').addEventListener('click',()=>{
  currentView='list';document.getElementById('listView').classList.add('active');
  document.getElementById('gridView').classList.remove('active');
  document.getElementById('articlesList').classList.add('list-view');
  displayArticles(filterArticles(allArticles));
});

const toastW=document.getElementById('toastContainer');
function toast(msg,type='',dur=2800){
  const el=document.createElement('div');el.className=`tm ${type}`;
  const ic=type==='s'?'check':type==='e'?'times':'info-circle';
  el.innerHTML=`<i class="fas fa-${ic}"></i> ${msg}`;
  toastW.appendChild(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),320);},dur);
}
function nameColor(n=''){
  const c=['#3a6b86','#6b5e8a','#7a6040','#4a7a6a','#8a5060','#4a6080','#7a7040'];
  let h=0;for(let i=0;i<n.length;i++)h=n.charCodeAt(i)+((h<<5)-h);
  return c[Math.abs(h)%c.length];
}
const catCol={education:'#BFD0DC',career:'#EAC1CB',productivity:'#F2D8DF',nauka:'#BFD0DC',poezia:'#C67081',tvory:'#EAC1CB',default:'#EAE6E2'};

function setAuthUI(u){
  const gN=document.getElementById('sidebarGuestNote');
  const iAcc=document.getElementById('sdItemAccount');
  const iArt=document.getElementById('sdItemArticles');
  const iStat=document.getElementById('sdItemStats');
  const iLo=document.getElementById('sdItemLogout');
  const gP=document.getElementById('goalsPanel');
  const uavEl=document.getElementById('userAvatar');
  const unmEl=document.getElementById('userName');
  const sdAv=document.getElementById('sidebarAvatar');
  const sdNm=document.getElementById('sidebarName');
  const sdRole=document.getElementById('sidebarRole');
  if(!u){
    uavEl.innerHTML=`<i class="fas fa-user" style="font-size:.78rem;opacity:.55"></i>`;
    uavEl.style.background='var(--text)';unmEl.textContent=t('loginShort');
    sdNm.textContent=t('guest');sdAv.innerHTML=`<i class="fas fa-user" style="opacity:.5"></i>`;
    sdAv.style.background='var(--text)';sdRole.textContent=t('reader');
    if(gN)gN.style.display='block';
    [iAcc,iArt,iStat,iLo].forEach(el=>el&&(el.style.display='none'));
    if(gP)gP.style.display='none';
    return;
  }
  const ini=(u.name||'?').charAt(0).toUpperCase();const col=nameColor(u.name||'');
  unmEl.textContent=u.name||t('account');sdNm.textContent=u.name||t('account');
  if(u.avatar){uavEl.innerHTML=`<img src="${u.avatar}" alt="">`;sdAv.innerHTML=`<img src="${u.avatar}" alt="">`;}
  else{uavEl.style.background=col;uavEl.textContent=ini;sdAv.style.background=col;sdAv.textContent=ini;}
  if(gN)gN.style.display='none';
  [iAcc,iArt,iStat,iLo].forEach(el=>el&&(el.style.display='block'));
  if(gP)gP.style.display='block';
  updateGoals();
}
function updateGoals(){
  if(!currentUser)return;
  const ud=getUserData();
  const r=Math.min(ud.weeklyReads||0,5),l=Math.min(ud.weeklyLikes||0,3);
  document.getElementById('goalReadCount').textContent=`${r}/5`;
  document.getElementById('goalLikeCount').textContent=`${l}/3`;
  document.getElementById('goalReadBar').style.width=`${(r/5)*100}%`;
  document.getElementById('goalLikeBar').style.width=`${(l/3)*100}%`;
}
function updateGreeting(){
  const h=new Date().getHours();const gEl=document.getElementById('welcomeMessage');if(!gEl)return;
  const name=currentUser?`, <em>${currentUser.name||''}</em>`:'';
  let g;
  if(h<6)g=t('greetNight');else if(h<12)g=t('greetMorn');else if(h<18)g=t('greetDay');else g=t('greetEve');
  gEl.innerHTML=`${g}${name}!`;
}
function readTime(text=''){
  const w=text.split(/\s+/).length;const m=Math.max(1,Math.round(w/200));
  return lang==='uk'?`${m} хв`:`${m} min`;
}

async function fetchArticles(){
  try{
    const r=await fetch('http://localhost:5012/articles?status=published');
    if(!r.ok)throw new Error();
    const d=await r.json();
    const counts=getArticleCounts();
    return d.map(a=>{const c=counts[a.id]||{};return{...a,likes:c.likes!==undefined?c.likes:(a.likes||0),likedBy:c.likedBy||a.likedBy||[],followers:c.followers!==undefined?c.followers:(a.followers||0),followedBy:c.followedBy||a.followedBy||[]};});
  }catch{}
}

const catFlt=document.getElementById('categoryFilter');
const authFlt=document.getElementById('authorFilter');
const srtFlt=document.getElementById('sortFilter');
const artLst=document.getElementById('articlesList');
const srchIn=document.getElementById('searchInput');

function updateAuthorFilter(articles){
  const u=[...new Set(articles.map(a=>a.author).filter(Boolean))];
  authFlt.innerHTML=`<option value="all">${t('all')}</option>`;
  u.forEach(n=>{
    const o=document.createElement('option');o.value=n;o.textContent=n;authFlt.appendChild(o);
    if(!authors[n]){const s=articles.find(a=>a.author===n)||{};authors[n]={followers:s.followers||0,followedBy:[...(s.followedBy||[])]};}
  });
}
function updateStats(all,filtered){
  document.getElementById('statTotal').textContent=all.length;
  document.getElementById('statAuthors').textContent=new Set(all.map(a=>a.author)).size;
  document.getElementById('statLikes').textContent=all.reduce((s,a)=>s+(a.likes||0),0);
  document.getElementById('statFiltered').textContent=filtered.length;
}
window.filterByCategory=function(cat){
  catFlt.value=cat;displayArticles(filterArticles(allArticles));
  window.scrollTo({top:document.querySelector('.flt').offsetTop-70,behavior:'smooth'});
};

function displayArticles(articles){
  artLst.innerHTML='';updateStats(allArticles,articles);
  if(currentView==='list')artLst.classList.add('list-view');else artLst.classList.remove('list-view');
  if(!articles.length){
    artLst.innerHTML=`<div class="col-12"><div class="emp"><i class="fas fa-feather-alt"></i><p>${t('noArticles')}</p></div></div>`;
    return;
  }
  const ud=getUserData();
  articles.forEach((a,idx)=>{
    const liked=ud.likes.includes(a.id);const saved=ud.saves.includes(a.id);const follow=ud.follows.includes(a.author);
    const stripe=catCol[a.category]||catCol.default;const delay=(idx%3)*.08+.04;const rt=readTime(a.description||'');
    const col=document.createElement('div');col.className='col-md-4';col.style.animationDelay=`${delay}s`;
    col.innerHTML=`
      <div class="ac">
        ${a.featured?`<div class="featured-badge">${lang==='uk'?'Топ':'Top'}</div>`:''}
        <div class="ac-stripe" style="background:${stripe}"></div>
        <div class="acc-dot"></div>
        <div class="cb">
          ${a.category?`<span class="ccb">${a.category}</span>`:''}
          <h5 class="ctt">${a.title||''}</h5>
          <p class="cdc">${a.description||''}</p>
          <div class="read-time"><i class="fas fa-clock" style="font-size:.65rem"></i> ${rt}</div>
          <a href="article.html?id=${a.id}" class="rbtn" onclick="trackRead(${a.id})">${t('readBtn')}</a>
        </div>
        <div class="cf">
          <div class="aar">
            <div class="ait">
              <div class="aav" style="background:${nameColor(a.author||'')}">
                ${(a.author||'?').charAt(0).toUpperCase()}
              </div>
              <span class="anm">${a.author||''}</span>
            </div>
            <div class="abt">
              <button class="fbt ${follow?'following':''}" onclick="toggleFollow('${(a.author||'').replace(/'/g,"\\'")}',this)" title="${follow?t('unsubscribe'):t('subscribe')}">
                <i class="fas ${follow?'fa-user-check':'fa-user-plus'}"></i>
              </button>
              <button class="lbt ${liked?'liked':''}" onclick="handleLike(${a.id},this)" title="${liked?t('unliked'):t('liked')}">
                <i class="fas fa-heart"></i><span class="lc">${a.likes||0}</span>
              </button>
              <button class="sbt ${saved?'saved':''}" onclick="handleSave(${a.id},this)" title="${saved?t('unsaved'):t('saved')}">
                <i class="fas fa-bookmark"></i>
              </button>
              <div class="stt-wrap">
                <button class="shbt" onclick="toggleShare(this,'${(a.title||'').replace(/'/g,"\\'")}','${a.url||'#'}')" title="Share">
                  <i class="fas fa-share-alt"></i>
                </button>
                <div class="stt-box">
                  <div class="si" onclick="copyLink('${a.url||window.location.href}')"><i class="fas fa-link"></i>${lang==='uk'?'Копіювати':'Copy'}</div>
                  <div class="si" onclick="shareTG('${a.url||'#'}','${(a.title||'').replace(/'/g,"\\'")}')"><i class="fab fa-telegram"></i>Telegram</div>
                  <div class="si" onclick="shareTW('${a.url||'#'}','${(a.title||'').replace(/'/g,"\\'")}')"><i class="fab fa-twitter"></i>Twitter</div>
                </div>
              </div>
            </div>
          </div>
          <div class="fst">
            <span id="follow-count-${(a.author||'').replace(/\s/g,'-')}">${authors[a.author]?.followers??a.followers??0} ${t('readers')}</span>
            <span>·</span>
            <span>${a.likes||0} ${t('likes')}</span>
          </div>
        </div>
      </div>`;
    artLst.appendChild(col);
    if(currentView==='grid'&&(idx+1)%3===0&&idx<articles.length-1){
      const d=document.createElement('div');d.className='col-12 divg';d.innerHTML='<hr>';artLst.appendChild(d);
    }
  });
}

function showSkeletons(){
  artLst.innerHTML='';
  for(let i=0;i<6;i++){
    const c=document.createElement('div');c.className='col-md-4';
    c.innerHTML=`<div class="skc"><div style="height:7px;background:#eeeeee"></div>
      <div class="skb"><div class="sk sk-s"></div><div class="sk sk-m"></div><div class="sk sk-l"></div><div class="sk sk-x"></div><div class="sk sk-b"></div></div>
      <div class="skf"><div class="sk sk-l" style="width:52%"></div></div></div>`;
    artLst.appendChild(c);
  }
}

function filterArticles(articles){
  const cat=catFlt.value,auth=authFlt.value,srt=srtFlt.value;
  const q=srchIn.value.toLowerCase().trim();
  let r=articles.filter(a=>{
    const okC=cat==='all'||a.category===cat;
    const okA=auth==='all'||a.author===auth;
    const okQ=!q||a.title?.toLowerCase().includes(q)||a.description?.toLowerCase().includes(q)||a.author?.toLowerCase().includes(q);
    return okC&&okA&&okQ;
  });
  if(srt==='popular')r=[...r].sort((a,b)=>(b.likes||0)-(a.likes||0));
  else if(srt==='az')r=[...r].sort((a,b)=>(a.title||'').localeCompare(b.title||'','uk'));
  return r;
}

async function init(){
  updateGreeting();showSkeletons();
  allArticles=await fetchArticles();
  updateAuthorFilter(allArticles);
  displayArticles(filterArticles(allArticles));
  let st;
  srchIn.addEventListener('input',()=>{clearTimeout(st);st=setTimeout(()=>displayArticles(filterArticles(allArticles)),320);});
  catFlt.addEventListener('change',()=>displayArticles(filterArticles(allArticles)));
  authFlt.addEventListener('change',()=>displayArticles(filterArticles(allArticles)));
  srtFlt.addEventListener('change',()=>displayArticles(filterArticles(allArticles)));
}

document.addEventListener('DOMContentLoaded',async()=>{
  applyLang();
  const stored=JSON.parse(localStorage.getItem('user')||'null');
  if(stored){currentUser=stored;setAuthUI(stored);}else setAuthUI(null);
  init();
  updateNotifBadge();
  renderNotifications();
  checkWeeklyReset();
  document.getElementById('sidebarLoginLink')?.addEventListener('click',e=>{e.preventDefault();closeSdb();openLM();});
  if(currentUser) startAutoNotifications();
});

function checkWeeklyReset(){
  const last=localStorage.getItem('tvory_weekly_reset');const now=Date.now();const week=7*24*60*60*1000;
  if(!last||now-parseInt(last)>week){
    localStorage.setItem('tvory_weekly_reset',now.toString());
    if(currentUser){const ud=getUserData();ud.weeklyReads=0;ud.weeklyLikes=0;saveUserData(ud);}
  }
}

window.handleLike=async function(id,btn){
  if(!currentUser){openLM();return;}
  const ud=getUserData();const counts=getArticleCounts();const art=allArticles.find(a=>a.id===id);if(!art)return;
  const isLiked=ud.likes.includes(id);
  if(isLiked){
    ud.likes=ud.likes.filter(x=>x!==id);ud.weeklyLikes=Math.max(0,(ud.weeklyLikes||0)-1);
    art.likes=Math.max(0,(art.likes||1)-1);
    if(!counts[id])counts[id]={likes:art.likes,likedBy:[]};
    counts[id].likes=art.likes;counts[id].likedBy=(counts[id].likedBy||[]).filter(e=>e!==currentUser.email);
  }else{
    ud.likes.push(id);ud.weeklyLikes=(ud.weeklyLikes||0)+1;art.likes=(art.likes||0)+1;
    if(!counts[id])counts[id]={likes:art.likes,likedBy:[]};
    counts[id].likes=art.likes;if(!counts[id].likedBy)counts[id].likedBy=[];counts[id].likedBy.push(currentUser.email);
  }
  saveUserData(ud);saveArticleCounts(counts);updateGoals();
  if(btn){
    btn.classList.toggle('liked',!isLiked);const lc=btn.querySelector('.lc');if(lc)lc.textContent=art.likes;
    btn.title=!isLiked?t('unliked'):t('liked');
    if(!isLiked){const i=btn.querySelector('i');if(i){i.style.animation='none';requestAnimationFrame(()=>{i.style.animation='hpop .4s ease';});}}
  }
  document.getElementById('statLikes').textContent=allArticles.reduce((s,a)=>s+(a.likes||0),0);
  try{
    const r=await fetch(`http://localhost:5012/api/articles/${id}/like`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:currentUser.name||currentUser.nickname})});
    if(r.ok){const updated=await r.json();art.likes=updated.likes??art.likes;if(btn){const lc=btn.querySelector('.lc');if(lc)lc.textContent=art.likes;}document.getElementById('statLikes').textContent=allArticles.reduce((s,a)=>s+(a.likes||0),0);}
  }catch{}
  toast(!isLiked?`♥ ${t('liked')}`:`♡ ${t('unliked')}`);
};

window.handleSave=function(id,btn){
  if(!currentUser){openLM();return;}
  const ud=getUserData();const isSaved=ud.saves.includes(id);
  if(isSaved){ud.saves=ud.saves.filter(x=>x!==id);toast(t('unsaved'));}
  else{ud.saves.push(id);toast(`🔖 ${t('saved')}`,'s');}
  saveUserData(ud);if(btn)btn.classList.toggle('saved',!isSaved);
};

window.toggleFollow=async function(n,btn){
  if(!currentUser||!n){openLM();return;}
  if(!authors[n])authors[n]={followers:0,followedBy:[]};
  const ud=getUserData();const isF=ud.follows.includes(n);
  if(isF){
    ud.follows=ud.follows.filter(x=>x!==n);authors[n].followers=Math.max(0,authors[n].followers-1);
    toast(`${t('unfollowed')} ${n}`);
  }else{
    ud.follows.push(n);authors[n].followers++;
    toast(`✓ ${t('followed')} ${n}`,'s');
  }
  saveUserData(ud);
  if(btn){btn.classList.toggle('following',!isF);const i=btn.querySelector('i');if(i)i.className=`fas ${!isF?'fa-user-check':'fa-user-plus'}`;btn.title=!isF?t('unsubscribe'):t('subscribe');}
  const fcEl=document.getElementById(`follow-count-${n.replace(/\s/g,'-')}`);
  if(fcEl)fcEl.textContent=`${authors[n].followers} ${t('readers')}`;
  try{
    const r=await fetch(`http://localhost:5012/api/authors/${encodeURIComponent(n)}/follow`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:currentUser.name||currentUser.nickname})});
    if(r.ok){const res=await r.json();if(res?.followers!==undefined){authors[n].followers=res.followers;const fcEl2=document.getElementById(`follow-count-${n.replace(/\s/g,'-')}`);if(fcEl2)fcEl2.textContent=`${res.followers} ${t('readers')}`;}}
  }catch{}
};

window.trackRead=function(id){
  if(!currentUser)return;
  const ud=getUserData();const art=allArticles.find(a=>a.id===id);if(!art)return;
  const ex=(ud.readHistory||[]).findIndex(h=>h.id===id);if(ex>-1)ud.readHistory.splice(ex,1);
  ud.readHistory=[{id,title:art.title,category:art.category,author:art.author,readAt:Date.now()},...(ud.readHistory||[])].slice(0,50);
  ud.weeklyReads=(ud.weeklyReads||0)+1;saveUserData(ud);updateGoals();
};

let openSB=null;
window.toggleShare=function(btn,title,url){
  const tt=btn.parentElement.querySelector('.stt-box');
  if(openSB&&openSB!==btn)openSB.parentElement.querySelector('.stt-box').classList.remove('show');
  tt.classList.toggle('show');openSB=tt.classList.contains('show')?btn:null;
};
document.addEventListener('click',e=>{
  if(!e.target.closest('.stt-wrap')&&openSB){openSB.parentElement.querySelector('.stt-box').classList.remove('show');openSB=null;}
});
window.copyLink=function(url){navigator.clipboard.writeText(url).then(()=>toast(`🔗 ${t('copied')}`,'s')).catch(()=>toast(t('copyErr'),'e'));};
window.shareTG=(u,t2)=>window.open(`https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t2)}`,'_blank');
window.shareTW=(u,t2)=>window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t2)}`,'_blank');

const lnMdl=document.getElementById('loginModal');
const lnBtn=document.getElementById('loginButton');
const lnCls=document.getElementById('loginCloseBtn');
function openLM(){lnMdl.style.display='flex';requestAnimationFrame(()=>lnMdl.classList.add('show'));}
function closeLM(){lnMdl.classList.remove('show');setTimeout(()=>{lnMdl.style.display='none';},340);}
lnCls.onclick=closeLM;
lnMdl.addEventListener('click',e=>{if(e.target===lnMdl)closeLM();});
document.getElementById('userInfo').addEventListener('click',()=>{
  if(currentUser)window.location.href='user.html';else openLM();
});

lnBtn.addEventListener('click',async()=>{
  const em=document.getElementById('loginEmail').value.trim();
  const pw=document.getElementById('loginPassword').value;
  if(!em||!pw){toast(t('fillAll'),'e');return;}
  lnBtn.textContent=t('loading');lnBtn.disabled=true;
  try{
    const r=await fetch('http://localhost:5012/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em,password:pw})});
    const d=await r.json();
    if(r.ok){
      localStorage.setItem('user',JSON.stringify(d.user));localStorage.setItem('token',d.token);
      currentUser=d.user;setAuthUI(currentUser);closeLM();
      toast(`✓ ${t('welcome')}, ${d.user.name||''}!`,'s');
      displayArticles(filterArticles(allArticles));
      startAutoNotifications();
    }else toast(d.error||t('wrongData'),'e');
  }catch{toast(t('connErr'),'e');}
  finally{lnBtn.textContent=t('login');lnBtn.disabled=false;}
});
document.getElementById('loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')lnBtn.click();});

const sdbar=document.getElementById('sidebar');const sdOv=document.getElementById('sidebarOverlay');const mnBtn=document.getElementById('menuButton');
function openSdb(){sdbar.classList.add('open');sdOv.classList.add('show');}
function closeSdb(){sdbar.classList.remove('open');sdOv.classList.remove('show');}
mnBtn?.addEventListener('click',openSdb);
document.getElementById('closeSidebar')?.addEventListener('click',closeSdb);
sdOv?.addEventListener('click',closeSdb);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeSdb();closeLM();}});

document.getElementById('logoutLink')?.addEventListener('click',e=>{
  e.preventDefault();localStorage.removeItem('user');localStorage.removeItem('token');
  currentUser=null;setAuthUI(null);closeSdb();
  if(notifInterval)clearInterval(notifInterval);
  toast(t('loggedOut'));displayArticles(filterArticles(allArticles));
});

document.getElementById('writeButton')?.addEventListener('click',()=>{
  if(currentUser)window.location.href='write.html';else{toast(t('loginRequired'),'e');openLM();}
});

