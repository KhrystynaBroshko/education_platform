'use strict';

const API_BASE = 'http://localhost:5012';

const GOOGLE_CLIENT_ID = '174305187743-rl24n9rk7k8f5frqg2ii1shfbk9kf8al.apps.googleusercontent.com';

const RL = {
  _d: {},
  MAX: 5,
  W: 15 * 60 * 1000,
  ok(k)  { const n=Date.now(); this._d[k]=(this._d[k]||[]).filter(t=>n-t<this.W); return this._d[k].length<this.MAX; },
  hit(k) { (this._d[k]=this._d[k]||[]).push(Date.now()); }
};

const S = {
  email: v => String(v).trim().toLowerCase().slice(0,254),
  text:  v => String(v).trim().replace(/[<>"']/g,'').slice(0,500),
  pass:  v => String(v).slice(0,128)
};

const V = {
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
  pass:  v => v.length>=8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v),
  strength(v) {
    if (v.length<6) return 'weak';
    if (v.length>=8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v)) return 'strong';
    return 'medium';
  }
};

async function api(url, opts={}) {
  const ctrl=new AbortController(), id=setTimeout(()=>ctrl.abort(),10000);
  const tok=localStorage.getItem('token');
  try {
    const r=await fetch(url,{
      ...opts, signal:ctrl.signal,
      headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest',
        ...(tok?{Authorization:`Bearer ${tok}`}:{}), ...(opts.headers||{})}
    });
    clearTimeout(id); return r;
  } catch(e){ clearTimeout(id); throw e; }
}

function tr(key, fb='') {
  if (window.i18next?.t) { const v=i18next.t(key); return (v&&v!==key)?v:fb; }
  return fb;
}

function currentLang() {
  const lng = window.i18next?.language || localStorage.getItem('i18nextLng') || 'uk';
  return lng.startsWith('en') ? 'en' : 'uk';
}

function isLoggedIn() {
  try {
    const raw=localStorage.getItem('user'), tok=localStorage.getItem('token');
    if(!raw||!tok) return false;
    const user=JSON.parse(raw);
    return !!(user?.email);
  } catch { return false; }
}

function authGuard(e, redirectUrl) {
  if(isLoggedIn()) { window.location.href = redirectUrl; return; }
  e.preventDefault();
  sessionStorage.setItem('afterLoginRedirect', redirectUrl);
  bsShow('modalGetStarted');
}

function bsShow(id) {
  const el=document.getElementById(id); if(!el) return;
  (bootstrap.Modal.getInstance(el)||new bootstrap.Modal(el,{backdrop:true,keyboard:true})).show();
}
function bsHide(id) {
  const el=document.getElementById(id); if(!el) return;
  bootstrap.Modal.getInstance(el)?.hide();
}

function showEmailModal() {
  const el=document.getElementById('emailSignUpModal'); if(!el) return;
  el.classList.add('is-open');
  document.body.style.overflow='hidden';
}
function hideEmailModal() {
  const el=document.getElementById('emailSignUpModal'); if(!el) return;
  el.classList.remove('is-open');
  document.body.style.overflow='';
}

function msg(id, text, type) {
  const el=document.getElementById(id); if(!el) return;
  el.textContent=text; el.className=`auth-message ${type}`; el.style.display='block';
}
function clearMsg(id) {
  const el=document.getElementById(id); if(!el) return;
  el.style.display='none'; el.textContent=''; el.className='auth-message';
}

function storeUser(user, token) {
  if(!user) return;
  localStorage.setItem('user', JSON.stringify({
    id: user.id,
    email: S.email(user.email||''),
    name: S.text(user.name||''),
    role: user.role==='admin'?'admin':'user'
  }));
  if(token) localStorage.setItem('token', token);
}

function goAfterLogin(role) {
  const redirect = sessionStorage.getItem('afterLoginRedirect');
  sessionStorage.removeItem('afterLoginRedirect');
  if(redirect) { window.location.href = redirect; return; }
  window.location.href = role==='admin' ? '/admin_page.html' : '/reading.html';
}

function toast(text, bg='#323232') {
  const el=document.getElementById('toast'); if(!el) return;
  el.innerHTML=text; el.style.background=bg;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 5000);
}

function initPwStrength() {
  const inp=document.getElementById('signUpPassword');
  const bar=document.getElementById('pwStrengthBar');
  const lbl=document.getElementById('pwStrengthLabel');
  if(!inp||!bar||!lbl) return;

  const COLORS  = {weak:'#e74c3c', medium:'#f39c12', strong:'#27ae60'};
  const WIDTHS  = {weak:'33%', medium:'66%', strong:'100%'};
  const LABELS_UK = {weak:'Слабкий пароль', medium:'Середній пароль', strong:'Надійний пароль ✓'};
  const LABELS_EN = {weak:'Weak password',  medium:'Medium password',  strong:'Strong password ✓'};

  inp.addEventListener('input',()=>{
    if(!inp.value){ bar.style.width='0'; lbl.textContent=''; return; }
    const s = V.strength(inp.value);
    const lang = currentLang();
    bar.style.width = WIDTHS[s]; bar.style.background = COLORS[s];
    lbl.textContent = (lang==='en' ? LABELS_EN : LABELS_UK)[s];
    lbl.style.color = COLORS[s];
  });
}

function initGoogleAuth() {
  const checkGoogle = setInterval(() => {
    if (!window.google?.accounts?.id) return;
    clearInterval(checkGoogle);
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
  }, 300);
}

async function handleGoogleCredential(response) {
  try {
    const res = await api(`${API_BASE}/auth/google`, {
      method: 'POST',
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    if (res.ok) {
      storeUser(data.user, data.token);
      bsHide('modalGetStarted');
      bsHide('modalSignIn');
      toast('✓ Увійшли через Google!', '#27ae60');
      setTimeout(() => goAfterLogin(data.user?.role), 1000);
    } else {
      toast(data.error || 'Помилка Google входу', '#c0392b');
    }
  } catch {
    toast("Помилка з'єднання з сервером", '#c0392b');
  }
}

function triggerGoogleSignIn() {
  if (!window.google?.accounts?.id) {
    toast('Google OAuth не налаштований.', '#856404');
    return;
  }
  google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed()) {
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:9999;background:white;padding:30px;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;';
      container.innerHTML = `
        <p style="font-family:'Cormorant Infant',serif;margin-bottom:16px;color:#2D3E54;">Увійти через Google:</p>
        <div id="g-btn-container"></div>
        <button onclick="this.closest('div[style]').remove()" style="margin-top:14px;background:none;border:none;color:#aaa;cursor:pointer;font-size:13px;">Скасувати</button>
      `;
      document.body.appendChild(container);
      google.accounts.id.renderButton(
        document.getElementById('g-btn-container'),
        { theme: 'outline', size: 'large', shape: 'pill', width: 280 }
      );
    }
  });
}

let chatOpen=false, conversation=[];

function initChat() {
  const toggleBtn = document.getElementById('toggle-chat');
  const closeBtn  = document.getElementById('close-chat');
  const panel     = document.getElementById('chat-panel');
  const msgs      = document.getElementById('messages');
  const inp       = document.getElementById('input');
  const send      = document.getElementById('send');
  if(!toggleBtn||!panel) return;

  function addMsg(text, who) {
    const d=document.createElement('div');
    d.className=`msg ${who}`; d.textContent=text;
    msgs.appendChild(d); msgs.scrollTop=msgs.scrollHeight;
  }

  function getGreeting() {
    return currentLang()==='en'
      ? tr('chat_greeting','Hello! How can I help you?')
      : tr('chat_greeting','Привіт! Чим можу допомогти?');
  }

  function open() {
    panel.classList.add('open');
    if(!chatOpen){ chatOpen=true; const g=getGreeting(); addMsg(g,'bot'); conversation=[{role:'assistant',content:g}]; }
  }
  function close(){ panel.classList.remove('open'); }

  toggleBtn.onclick = () => panel.classList.contains('open') ? close() : open();
  closeBtn.onclick  = close;

  async function sendMsg() {
    const text = inp.value.trim();
    if (!text) return;

    addMsg(text, 'user');
    conversation.push({ role: 'user', content: text });
    inp.value = '';

    const typing = document.createElement('div');
    typing.className = 'msg bot';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: conversation.slice(-6)
        })
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const contentType = res.headers.get('Content-Type') || '';

      if (!contentType.includes('text/event-stream')) {
        const data = await res.json();
        typing.textContent = data.reply || 'Помилка відповіді';
        conversation.push({ role: 'assistant', content: data.reply || '' });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let botText = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;

          try {
            const delta = JSON.parse(raw)?.choices?.[0]?.delta?.content || '';
            if (delta) {
              if (firstChunk) { typing.textContent = ''; firstChunk = false; }
              botText += delta;
              typing.textContent = botText;
              msgs.scrollTop = msgs.scrollHeight;
            }
          } catch {}
        }
      }

      conversation.push({ role: 'assistant', content: botText });

    } catch (e) {
      typing.textContent = 'Помилка: ' + e.message;
    }
  }

  send.onclick = sendMsg;
  inp.addEventListener('keypress', e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();} });

  document.addEventListener('langChanged',({detail:{lang}})=>{
    const first=msgs.querySelector('.msg.bot'); if(!first) return;
    const g = lang.startsWith('en')
      ? tr('chat_greeting','Hello! How can I help you?')
      : tr('chat_greeting','Привіт! Чим можу допомогти?');
    first.textContent=g;
    if(conversation[0]?.role==='assistant') conversation[0].content=g;
    if(inp) inp.placeholder=tr('chat_placeholder','Напиши питання…');
  });
}

function updateHeroBg(lang) {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const isEn = lang?.startsWith('en');
  
  hero.style.transition = 'opacity .35s ease';
  hero.style.opacity = '0.7';

  setTimeout(() => {
    if (isEn) {
      hero.style.backgroundImage = `
        url("images/Group 3 (2).png"),
        url("images/Share your emotions.png"),
        url("images/A place where every voice matters.png"),
        url("images/Write, Read, Feel.png"),
        url("images/Desktop - 21 (6).png")
      `;

      hero.style.backgroundSize = `
        867px, 
        267px, 
        345px, 
        298px, 
        cover
      `;

      hero.style.backgroundPosition = `
        right -198px top -16px,
        left 50px top 621px,
        left 136px top 120px,
        left 897px top 49px,
        center
      `;

      hero.style.backgroundRepeat = 'no-repeat';

    } else {
      hero.style.backgroundImage = `
        url("images/Frame 427 (3).png"),
        url("images/Ділись емоціями..png"),
        url("images/Місце, де кожен голос важливий..png"),
        url("images/Пиши Читай Відчувай.png"),
        url("images/Desktop - 21 (3).png")
      `;

      hero.style.backgroundSize = '867px, 267px, 345px, 298px, cover';
      
      hero.style.backgroundPosition = `
        right -198px top -16px,
        left 50px top 621px,
        left 136px top 120px,
        left 897px top 49px,
        center
      `;

      hero.style.backgroundRepeat = 'no-repeat';
    }
    
    hero.style.opacity = '1';
  }, 200);
}

const PALS = ['pal-1','pal-2','pal-3'];

function makeCard(art, i) {
  const pal  = PALS[i % PALS.length];
  const lang = currentLang();

  const title  = art.title;
  const desc   = art.description;
  const author = art.author; 

  const cat = art.category ? tr(art.category.toLowerCase(), art.category) : tr('article_label', 'Стаття');

  const readLabel     = lang === 'en' ? 'Read →' : 'Читати →';
  const platformLabel = lang === 'en' ? 'Word Platform' : 'Платформа Слово';
  const fromLabel     = lang === 'en' ? 'From' : 'Від';
  const stampText     = lang === 'en' ? 'Word' : 'Слово';

  return `<div class="env-scene ${pal}">
    <div class="env-letter"><div class="letter-inner">
      <span class="letter-tag">${cat}</span>
      <h3 class="letter-title">${title}</h3>
      <p class="letter-desc">${desc}</p>
      <div class="letter-footer">
        <span class="letter-author">${author}</span>
        <a href="${art.url}" class="letter-link"
           onclick="return handleArticleClick(event, '${art.url}')">
           ${readLabel}
        </a>
      </div>
    </div></div>
    <div class="env-flap-shadow"></div>
    <div class="env-box">
      <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <rect class="env-base-rect" x="0" y="0" width="320" height="200" rx="6"/>
        <polygon class="env-side-l" points="0,0 0,200 160,100" opacity="0.45"/>
        <polygon class="env-side-r" points="320,0 320,200 160,100" opacity="0.45"/>
        <polygon class="env-bottom-tri" points="0,200 320,200 160,100" opacity="0.60"/>
      </svg>
      <div class="env-stamp">${stampText}<br>✦</div>
      <div class="env-address">
        ${fromLabel}: ${author || (lang === 'en' ? 'Author' : 'Автор')}<br>
        <span style="opacity:.6;font-size:.62rem;">${platformLabel}</span>
      </div>
    </div>
    <div class="env-flap-wrap">
      <svg viewBox="0 0 320 110" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
        <polygon class="env-flap-fill" points="0,0 320,0 160,110"/>
      </svg>
    </div>
  </div>`;
}

window.handleArticleClick = function(e, url) {
  if(!isLoggedIn()) {
    e.preventDefault();
    sessionStorage.setItem('afterLoginRedirect', url);
    bsShow('modalGetStarted');
    return false;
  }
  return true;
};

function renderArticles(articles) {
  const c = document.getElementById('popularArticles');
  if(!c) return;
  c.innerHTML = '';
  if(!articles || !articles.length) {
    c.innerHTML = `<div class="col-12 text-center py-5">
      <p style="font-family:'Cormorant Infant',serif;color:rgba(46,63,85,.45);">
        ${tr('loading_failed','Не вдалося завантажити статті')}
      </p></div>`;
    return;
  }
  articles.forEach((art, i) => {
    const col = document.createElement('div');
    col.className = 'col-lg-4 col-md-6';
    col.innerHTML = makeCard(art, i);
    c.appendChild(col);
  });
}

async function fetchArticles(lang) {
  const langParam = (lang || currentLang()) === 'en' ? 'en' : 'uk';
  const c = document.getElementById('popularArticles');

  try {
    const res = await fetch(`${API_BASE}/api/popular-articles?lang=${langParam}`);
    if (!res.ok) throw new Error();
    const articles = await res.json();
    renderArticles(articles);
  } catch {
    if (c) c.innerHTML = `<div class="col-12 text-center py-5">
      <p style="font-family:'Cormorant Infant',serif;color:rgba(46,63,85,.45);">
        ${tr('loading_failed','Не вдалося завантажити статті')}
      </p></div>`;
  }
}

async function handleLangChangeArticles(lang) {
  const c = document.getElementById('popularArticles');
  if(!c) return;
  c.style.opacity = '0.4';
  c.style.transition = 'opacity 0.25s';
  await fetchArticles(lang);
  c.style.opacity = '1';
}

function fixScroll(){
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click',e=>{
      const sel=a.getAttribute('href');
      if(!sel||sel==='#') return;
      const target=document.querySelector(sel);
      if(!target) return;
      e.preventDefault();
      const off=(document.querySelector('header')?.offsetHeight||72)+8;
      window.scrollTo({top:target.getBoundingClientRect().top+scrollY-off,behavior:'smooth'});
    });
  });
}

function refreshAuthUI(){
  try {
    const raw=localStorage.getItem('user'), tok=localStorage.getItem('token');
    if(!raw||!tok) return;
    const user=JSON.parse(raw); if(!user?.email) return;
    const label=user.name||user.email.split('@')[0];
    const si=document.getElementById('openSignIn');
    if(si){ si.textContent=label; si.href=user.role==='admin'?'/admin_page.html':'/reading.html'; si.onclick=null; }
    const gs=document.getElementById('openGetStarted');
    if(gs){ gs.textContent='Вийти'; gs.onclick=e=>{e.preventDefault();localStorage.clear();location.reload();}; }
  } catch { localStorage.removeItem('user'); localStorage.removeItem('token'); }
}

document.addEventListener('DOMContentLoaded', () => {

  initChat();
  initPwStrength();
  initGoogleAuth();
  refreshAuthUI();
  fixScroll();

  const btnRead = document.querySelector('.btnread');
  if(btnRead) btnRead.addEventListener('click', e => authGuard(e, 'reading.html'));

  document.querySelectorAll('footer a[href="write.html"], footer a[data-i18n="footer_write"]').forEach(link => {
    link.addEventListener('click', e => authGuard(e, 'write.html'));
  });

  document.querySelectorAll('.membership-btn, [data-i18n="membership_btn"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      if(isLoggedIn()) {
        toast(tr('membership_already','Ви вже є членом спільноти!'), '#EAC1CB');
        return;
      }
      bsShow('modalGetStarted');
    });
  });

  document.getElementById('openSignIn')     ?.addEventListener('click',e=>{e.preventDefault();bsShow('modalSignIn');});
  document.getElementById('openGetStarted') ?.addEventListener('click',e=>{e.preventDefault();bsShow('modalGetStarted');});

  document.getElementById('switchToSignIn')      ?.addEventListener('click',e=>{e.preventDefault();bsHide('modalGetStarted');bsShow('modalSignIn');});
  document.getElementById('switchToRegister')    ?.addEventListener('click',e=>{e.preventDefault();bsHide('modalSignIn');bsShow('modalGetStarted');});
  document.getElementById('openEmailSignUp')     ?.addEventListener('click',e=>{e.preventDefault();bsHide('modalGetStarted');showEmailModal();});
  document.getElementById('switchEmailToSignIn') ?.addEventListener('click',e=>{e.preventDefault();hideEmailModal();bsShow('modalSignIn');});
  document.getElementById('openForgotPassword')  ?.addEventListener('click',e=>{e.preventDefault();bsHide('modalSignIn');bsShow('resetPasswordModal');});

  document.getElementById('closeGetStarted') ?.addEventListener('click',()=>bsHide('modalGetStarted'));
  document.getElementById('closeSignIn')     ?.addEventListener('click',()=>bsHide('modalSignIn'));
  document.getElementById('closeReset')      ?.addEventListener('click',()=>bsHide('resetPasswordModal'));
  document.getElementById('closeEmailSignUp')?.addEventListener('click',hideEmailModal);

  document.getElementById('emailSignUpModal')?.addEventListener('click',e=>{
    if(e.target.id==='emailSignUpModal') hideEmailModal();
  });

  document.getElementById('modalSignIn')?.addEventListener('show.bs.modal',()=>clearMsg('loginMessage'));

  document.getElementById('googleSignUpButton')?.addEventListener('click', triggerGoogleSignIn);
  document.getElementById('googleSignInBtn')   ?.addEventListener('click', triggerGoogleSignIn);

  document.getElementById('modalSignInForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    if(!RL.ok('login')){ msg('loginMessage','Забагато спроб. Зачекайте 15 хвилин.','danger'); return; }

    const email=S.email(document.getElementById('loginEmail')?.value||'');
    const pass =S.pass (document.getElementById('loginPassword')?.value||'');

    if(!email||!pass){ msg('loginMessage',tr('signin_fill_fields','Заповніть обидва поля'),'warning'); return; }
    if(!V.email(email)){ msg('loginMessage',tr('emailreg_email_invalid','Введіть дійсну email адресу'),'warning'); return; }

    RL.hit('login');
    msg('loginMessage','Перевіряємо…','info');

    try {
      const res=await api(`${API_BASE}/login`,{method:'POST',body:JSON.stringify({email,password:pass})});
      const data=await res.json();
      if(res.ok){
        storeUser(data.user,data.token);
        msg('loginMessage',tr('signin_success','Авторизація успішна. Перенаправлення...'),'success');
        bsHide('modalSignIn');
        setTimeout(()=>goAfterLogin(data.user?.role),1400);
      } else {
        msg('loginMessage',data.error||tr('signin_wrong_data','Неправильні дані для входу'),'danger');
      }
    } catch { msg('loginMessage',tr('signin_server_error',"Помилка з'єднання"),'danger'); }
  });

  document.getElementById('submitEmailSignUp')?.addEventListener('click', async ()=>{
    if(!RL.ok('register')){ showRegMsg('Забагато спроб. Зачекайте 15 хвилин.','danger'); return; }

    const email=S.email(document.getElementById('signUpEmail')?.value||'');
    const pass =S.pass (document.getElementById('signUpPassword')?.value||'');
    const conf =S.pass (document.getElementById('confirmPassword')?.value||'');

    if(!email||!pass||!conf){ showRegMsg(tr('emailreg_fill_all','Заповніть усі поля'),'warning'); return; }
    if(!V.email(email))     { showRegMsg(tr('emailreg_email_invalid','Введіть дійсну email адресу'),'warning'); return; }
    if(!V.pass(pass))       { showRegMsg(tr('emailreg_password_weak','Пароль: мін. 8 символів, велика, мала літера і цифра'),'warning'); return; }
    if(pass!==conf)         { showRegMsg(tr('emailreg_passwords_mismatch','Паролі не співпадають'),'warning'); return; }

    RL.hit('register');
    const btn=document.getElementById('submitEmailSignUp');
    const orig=btn?.textContent;
    if(btn){ btn.textContent='Реєстрація…'; btn.disabled=true; }

    try {
      const res=await api(`${API_BASE}/register`,{method:'POST',body:JSON.stringify({email,password:pass})});
      const data=await res.json();
      if(res.ok){
        showRegMsg(tr('emailreg_success','Реєстрацію завершено! Тепер увійдіть.'),'success');
        if(data.token) storeUser(data.user,data.token);
        setTimeout(()=>{ hideEmailModal(); bsShow('modalSignIn'); },1600);
      } else {
        showRegMsg(data.error||tr('emailreg_error','Помилка реєстрації'),'danger');
      }
    } catch { showRegMsg(tr('emailreg_server_error',"Помилка з'єднання"),'danger'); }
    finally { if(btn){ btn.textContent=orig; btn.disabled=false; } }
  });

  function showRegMsg(text, type) { msg('regMessage',text,type); }

  document.getElementById('newsletterForm')?.addEventListener('submit', async e=>{
    e.preventDefault();
    if(!RL.ok('nl')) return;
    const name  = S.text (document.getElementById('nlName')?.value||'');
    const email = S.email(document.getElementById('nlEmail')?.value||'');
    const box   = document.getElementById('newsletterMessage');
    if(!V.email(email)){if(box)box.innerHTML='<div class="alert alert-warning">Введіть дійсну email адресу</div>';return;}
    RL.hit('nl');
    try {
      const res=await api('/subscribe',{method:'POST',body:JSON.stringify({name,email})});
      const r=await res.json();
      if(box) box.innerHTML=res.ok
        ?`<div class="alert alert-success">${r.message||tr('newsletter_success','Дякуємо! Ви підписалися.')}</div>`
        :`<div class="alert alert-danger">${r.error||tr('newsletter_error','Помилка при підписці')}</div>`;
    } catch { if(box) box.innerHTML=`<div class="alert alert-danger">${tr('newsletter_server_error',"Помилка з'єднання")}</div>`; }
  });

  document.getElementById('submitResetPassword')?.addEventListener('click', async ()=>{
    const email=S.email(document.getElementById('resetEmail')?.value||'');
    if(!V.email(email)){ toast('Введіть дійсну email адресу','#856404'); return; }
    try {
      const res=await api(`${API_BASE}/reset-password`,{method:'POST',body:JSON.stringify({email})});
      const data=await res.json();
      toast(res.ok?(data.message||'Лист відправлено!'):(data.error||'Помилка'),'#27ae60');
      if(res.ok) setTimeout(()=>bsHide('resetPasswordModal'),1500);
    } catch { toast("Помилка з'єднання",'#c0392b'); }
  });
});

window.addEventListener('load', ()=>{
  const check=setInterval(()=>{
    if(!window.i18next?.isInitialized) return;
    clearInterval(check);
    updateHeroBg(i18next.language);
    i18next.on('languageChanged', lang => {
      updateHeroBg(lang);
      handleLangChangeArticles(lang);
    });
  },100);
});

document.addEventListener('langChanged', ({detail:{lang}}) => {
  handleLangChangeArticles(lang);
});

(function(){
  const Q=[
    {text:'Борітеся — поборете!',author:'Тарас Шевченко'},
    {text:'Нації вмирають не від інфаркту. Спочатку їм відбирає мову.',author:'Ліна Костенко'},
    {text:'Коли не я, то хто ж?',author:'Олена Теліга'},
    {text:'Свобода — це право говорити те, що думаєш.',author:'Леся Українка'},
    {text:'Хто не жив посеред бурі, той цінити сонця не вміє.',author:'Ольга Кобилянська'}
  ];
  window.addEventListener('load',()=>{
    setTimeout(()=>{
      const q=Q[Math.floor(Math.random()*Q.length)];
      const el=document.getElementById('toast'); if(!el) return;
      el.innerHTML=`"${q.text}"<br><em>— ${q.author}</em>`;
      el.style.background='#323232'; el.classList.add('show');
      setTimeout(()=>el.classList.remove('show'),7000);
    },900);
  });
})();

(async function initTranslation() {
  await i18next
    .use(i18nextBrowserLanguageDetector)
    .init({
      debug: false,
      fallbackLng: 'uk',
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: 'i18nextLng',
        checkWhitelist: true
      },
      supportedLngs: ['uk', 'en'],
      resources: {}
    });

  try {
    const [ukData, enData] = await Promise.all([
      fetch('locales/uk.json').then(r => r.json()),
      fetch('locales/en.json').then(r => r.json())
    ]);
    i18next.addResourceBundle('uk', 'translation', ukData.translation);
    i18next.addResourceBundle('en', 'translation', enData.translation);
  } catch (err) {
    console.error('Помилка завантаження перекладів:', err);
    return;
  }

  const detectedLang = i18next.language || 'uk';
  const safeLang = detectedLang.startsWith('en') ? 'en' : 'uk';

  if (i18next.language !== safeLang) {
    await i18next.changeLanguage(safeLang);
  }

  applyTranslations();
  fetchArticles(safeLang);

  const sw = document.getElementById('lang-switch');
  if (sw) {
    sw.checked = safeLang === 'en';
  }

  setupLangToggle();
})();

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = i18next.t(key);
    if (val && val !== key) el.innerHTML = val;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = i18next.t(key);
    if (val && val !== key) el.placeholder = val;
  });
}

function setupLangToggle() {
  const sw = document.getElementById('lang-switch');
  if (!sw) return;
  sw.addEventListener('change', () => {
    const lang = sw.checked ? 'en' : 'uk';
    i18next.changeLanguage(lang, () => {
      localStorage.setItem('i18nextLng', lang);
      applyTranslations();
      document.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
    });
  });
}