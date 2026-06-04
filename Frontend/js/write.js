const editorEl   = document.getElementById('editorText');
const aliasEl    = document.getElementById('alias');
const titleEl    = document.getElementById('title');
const categoryEl = document.getElementById('category');
const descEl     = document.getElementById('description');
const DRAFT_KEY  = 'tvory_draft';
const TBAR_KEY   = 'tvory_tbar_v2';
const MAX_CHARS  = 50000;
const MAX_IMAGES = 10;

let currentVideoStream = null;
let recognition  = null;
let isListening  = false;
let canvasCtx    = null;
let isDrawing    = false;
let currentColor = '#2D3E54';
let currentBrush = 4;

let selLang      = null;   
let selLangName  = null;  
let isTranslating = false;
const nodeBackup = new Map();  

function showToast(msg, type='') {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type==='success'?'check':type==='error'?'times':type==='warn'?'exclamation-triangle':'info-circle';
  el.innerHTML = `<i class="fas fa-${icon}"></i> ${msg}`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(()=>el.remove(), 330); }, 3400);
}

function updateStats() {
  const text  = editorEl.innerText || '';
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  document.getElementById('wordCount').textContent = `${words} слів · ${chars} симв.`;
  document.getElementById('readTime').textContent  = `~${Math.ceil(words/200)} хв читання`;
  const fill = document.getElementById('charFill');
  const pct  = Math.min((chars/MAX_CHARS)*100, 100);
  fill.style.width = pct + '%';
  fill.className = 'char-limit-fill' + (pct>95?' over':pct>75?' warn':'');
}

function updateProgress() {
  const h = document.documentElement;
  document.getElementById('progressBar').style.width =
    (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%';
}
window.addEventListener('scroll', updateProgress);

function insertContent(html) {
  editorEl.focus();
  const sel = window.getSelection();
  let range = sel.rangeCount ? sel.getRangeAt(0) : null;
  if (!range || !editorEl.contains(range.commonAncestorContainer)) {
    range = document.createRange(); range.selectNodeContents(editorEl); range.collapse(false);
  }
  range.deleteContents();
  const div = document.createElement('div'); div.innerHTML = html;
  const frag = document.createDocumentFragment();
  while (div.firstChild) frag.appendChild(div.firstChild);
  range.insertNode(frag); range.collapse(false);
  sel.removeAllRanges(); sel.addRange(range);
  setTimeout(() => MathJax.typesetPromise().catch(()=>{}), 60);
}

function fmt(cmd) {
  if (cmd==='header') document.execCommand('formatBlock',false,'h2');
  else if (cmd==='quote') document.execCommand('formatBlock',false,'blockquote');
  else document.execCommand(cmd,false,null);
  editorEl.focus();
}

function countImages() { return editorEl.querySelectorAll('img').length; }

function addImage() {
  if (countImages()>=MAX_IMAGES) { showToast(`Максимум ${MAX_IMAGES} зображень`,'error'); return; }
  const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 8*1024*1024) { showToast('Макс. 8 МБ','error'); return; }
    const r = new FileReader();
    r.onload = ev => { insertContent(`<div style="text-align:center;margin:24px 0"><img src="${ev.target.result}" style="max-width:100%;border-radius:12px;box-shadow:0 4px 16px rgba(45,62,84,0.12)"></div>`); showToast('Зображення додано','success'); updateSecurityIndicator(); };
    r.readAsDataURL(file);
  };
  inp.click();
}

async function openCamera() {
  if (countImages()>=MAX_IMAGES) { showToast(`Максимум ${MAX_IMAGES} зображень`,'error'); return; }
  try {
    currentVideoStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}});
    const ov = document.createElement('div'); ov.id='cameraOverlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(45,62,84,0.7);z-index:4000;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML=`<div style="background:white;border-radius:24px;padding:32px;max-width:700px;width:92%"><div style="font-family:'Cormorant SC',serif;font-size:1.45rem;color:var(--navy);margin-bottom:18px">Зробити фото</div><div id="camContainer" style="border-radius:12px;overflow:hidden;background:#000;margin-bottom:18px;text-align:center"></div><div style="display:flex;gap:12px"><button onclick="capturePhoto()" style="flex:1;padding:13px;background:#2D3E54;color:white;border:none;border-radius:12px;font-family:'Cormorant SC',serif;font-size:1.05rem;cursor:pointer">📸 Зробити фото</button><button onclick="closeCamera()" style="padding:13px 20px;background:#f2d8df;color:#2D3E54;border:none;border-radius:12px;font-family:'Cormorant SC',serif;font-size:1.05rem;cursor:pointer">Скасувати</button></div></div>`;
    document.body.appendChild(ov);
    const vid=document.createElement('video'); vid.srcObject=currentVideoStream; vid.autoplay=true; vid.playsInline=true; vid.style.maxWidth='100%';
    document.getElementById('camContainer').appendChild(vid);
  } catch(err) { showToast('Камера недоступна: '+err.message,'error'); }
}

function capturePhoto() {
  const vid=document.querySelector('#cameraOverlay video'); if(!vid){closeCamera();return;}
  const c=document.createElement('canvas'); c.width=vid.videoWidth||1280; c.height=vid.videoHeight||720;
  c.getContext('2d').drawImage(vid,0,0);
  insertContent(`<div style="text-align:center;margin:24px 0"><img src="${c.toDataURL('image/jpeg',0.92)}" style="max-width:100%;border-radius:12px;box-shadow:0 6px 20px rgba(45,62,84,0.15)"></div>`);
  showToast('Фото додано!','success'); closeCamera(); updateSecurityIndicator();
}

function closeCamera() {
  if(currentVideoStream){currentVideoStream.getTracks().forEach(t=>t.stop());currentVideoStream=null;}
  document.getElementById('cameraOverlay')?.remove();
}

function openMathModal() { document.getElementById('mathModal').classList.add('show'); setTimeout(()=>document.getElementById('mathInput').focus(),200); }
function closeMathModal() { document.getElementById('mathModal').classList.remove('show'); document.getElementById('mathInput').value=''; document.getElementById('mathPreview').innerHTML=''; }

document.getElementById('mathInput').addEventListener('input', () => {
  const v=document.getElementById('mathInput').value.trim();
  const p=document.getElementById('mathPreview'); p.innerHTML=v?`$$${v}$$`:'';
  if(v) MathJax.typesetPromise([p]).catch(()=>{});
});

function insertMath() {
  const v=document.getElementById('mathInput').value.trim(); if(!v){showToast('Введіть формулу','error');return;}
  insertContent(`<div class="math-formula">$$${v}$$</div>`); closeMathModal(); showToast('Формулу додано','success');
}

function openChartModal()  { document.getElementById('chartModal').classList.add('show'); }
function closeChartModal() { document.getElementById('chartModal').classList.remove('show'); }

document.getElementById('chartType').addEventListener('change', function() {
  const fn=this.value==='function';
  document.getElementById('chartDataSection').style.display=fn?'none':'block';
  document.getElementById('functionSection').style.display=fn?'block':'none';
});

function parseChartData(str) {
  const labels=[],values=[];
  str.split(',').forEach(p=>{const[l,v]=p.split(':').map(x=>x.trim());if(l&&!isNaN(parseFloat(v))){labels.push(l);values.push(parseFloat(v));}});
  return {labels,values};
}

function evalFn(str,x) {
  let e=str.toLowerCase().replace(/x/g,`(${x})`).replace(/\^/g,'**').replace(/sin/g,'Math.sin').replace(/cos/g,'Math.cos').replace(/tan/g,'Math.tan').replace(/sqrt/g,'Math.sqrt').replace(/log/g,'Math.log').replace(/abs/g,'Math.abs').replace(/pi/g,'Math.PI').replace(/\be\b/g,'Math.E');
  return new Function('return '+e)();
}

function createChart() { const type=document.getElementById('chartType').value; const id='chart_'+Date.now(); type==='function'?createFunctionChart(id):createDataChart(id,type); }

function createDataChart(id,type) {
  const raw=document.getElementById('chartData').value.trim(); if(!raw){showToast('Введіть дані!','error');return;}
  const{labels,values}=parseChartData(raw); if(!labels.length){showToast('Неправильний формат','error');return;}
  insertContent(`<div style="text-align:center;margin:28px 0"><canvas id="${id}" width="560" height="320"></canvas></div>`);
  closeChartModal();
  setTimeout(()=>{
    const c=document.getElementById(id); if(!c)return;
    new Chart(c,{type,data:{labels,datasets:[{label:'Дані',data:values,backgroundColor:type==='pie'?['#EAC1CB','#BFD0DC','#2D3E54','#F2D8DF','#6a8faf','#c47a30']:'rgba(234,193,203,0.55)',borderColor:'#2D3E54',borderWidth:2}]},options:{responsive:true,plugins:{legend:{labels:{font:{family:'Cormorant SC,serif'}}}}}});
    showToast('Графік створено!','success');
  },300);
}

function createFunctionChart(id) {
  const fn=document.getElementById('mathFunction').value.trim();
  const xMin=parseFloat(document.getElementById('xMin').value);
  const xMax=parseFloat(document.getElementById('xMax').value);
  if(!fn||isNaN(xMin)||isNaN(xMax)||xMin>=xMax){showToast('Неправильні параметри','error');return;}
  const data=[]; const step=(xMax-xMin)/250;
  for(let x=xMin;x<=xMax;x+=step){try{const y=evalFn(fn,x);if(isFinite(y))data.push({x,y});}catch(e){}}
  insertContent(`<div style="text-align:center;margin:28px 0"><canvas id="${id}" width="560" height="320"></canvas></div>`);
  closeChartModal();
  setTimeout(()=>{
    const c=document.getElementById(id); if(!c)return;
    new Chart(c,{type:'line',data:{datasets:[{label:fn,data,borderColor:'#2D3E54',borderWidth:3,tension:0.3,pointRadius:0}]},options:{scales:{x:{min:xMin,max:xMax}},plugins:{legend:{labels:{font:{family:'Cormorant SC,serif'}}}}}});
    showToast('Графік функції готовий!','success');
  },300);
}

function openDrawingModal() {
  document.getElementById('drawingModal').classList.add('show');
  const canvas=document.getElementById('drawingCanvas'); canvasCtx=canvas.getContext('2d'); clearCanvas(); setupCanvasEvents(canvas);
}
function closeDrawingModal() { document.getElementById('drawingModal').classList.remove('show'); }

function setupCanvasEvents(canvas) {
  const gp=e=>{const r=canvas.getBoundingClientRect(),sx=canvas.width/r.width,sy=canvas.height/r.height;if(e.touches)return{x:(e.touches[0].clientX-r.left)*sx,y:(e.touches[0].clientY-r.top)*sy};return{x:(e.clientX-r.left)*sx,y:(e.clientY-r.top)*sy};};
  const start=e=>{e.preventDefault();isDrawing=true;const{x,y}=gp(e);canvasCtx.beginPath();canvasCtx.moveTo(x,y);};
  const draw =e=>{e.preventDefault();if(!isDrawing)return;const{x,y}=gp(e);canvasCtx.lineWidth=currentBrush;canvasCtx.lineCap='round';canvasCtx.lineJoin='round';canvasCtx.strokeStyle=currentColor;canvasCtx.lineTo(x,y);canvasCtx.stroke();canvasCtx.beginPath();canvasCtx.moveTo(x,y);};
  const end  =e=>{e.preventDefault();isDrawing=false;};
  canvas.onmousedown=start;canvas.onmousemove=draw;canvas.onmouseup=end;canvas.onmouseleave=end;
  canvas.ontouchstart=start;canvas.ontouchmove=draw;canvas.ontouchend=end;
}

document.getElementById('colorPalette').addEventListener('click',e=>{
  const s=e.target.closest('.color-swatch');if(!s)return;
  document.querySelectorAll('.color-swatch').forEach(x=>x.classList.remove('active'));
  s.classList.add('active');currentColor=s.dataset.color;
});
document.getElementById('brushSize').addEventListener('input',function(){currentBrush=+this.value;document.getElementById('brushSizeVal').textContent=this.value;});

function clearCanvas() {
  const c=document.getElementById('drawingCanvas'); if(!canvasCtx)canvasCtx=c.getContext('2d');
  canvasCtx.fillStyle='#ffffff';canvasCtx.fillRect(0,0,c.width,c.height);
}
function saveDrawing() {
  if(countImages()>=MAX_IMAGES){showToast(`Максимум ${MAX_IMAGES} зображень`,'error');return;}
  insertContent(`<div style="text-align:center;margin:20px 0"><img src="${document.getElementById('drawingCanvas').toDataURL('image/png')}" style="max-width:100%;border-radius:12px;border:1px solid #eae6e2"></div>`);
  closeDrawingModal();showToast('Малюнок додано!','success');updateSecurityIndicator();
}

function openScientificAssistant() {
  if(prompt("Введіть задачу (демо):\ny' = -0.5*y, y(0)=1, [0,10]\n\n(OK для демо-розв'язку)")===null)return;
  const id='de_'+Date.now();
  insertContent(`<div style="margin:28px 0;padding:24px;border:1.5px solid #EAC1CB;border-radius:16px;background:#FFF9F1"><div style="font-family:'Cormorant SC',serif;font-size:1.2rem;color:#2D3E54;margin-bottom:12px">Чисельний розв'язок ДР: y' = −0.5y</div><canvas id="${id}" width="640" height="320"></canvas><div style="font-size:0.88rem;color:rgba(45,62,84,0.5);margin-top:10px;font-family:'Cormorant SC',serif">Метод Ейлера · dt = 0.05</div></div>`);
  setTimeout(()=>{
    const c=document.getElementById(id);if(!c)return;
    let t=0,y=1;const data=[],dt=0.05,k=-0.5;
    while(t<=10){data.push({x:t,y});y+=k*y*dt;t+=dt;}
    new Chart(c,{type:'line',data:{datasets:[{label:'y(t)',data,borderColor:'#2D3E54',borderWidth:3,tension:0.4,pointRadius:0,backgroundColor:'rgba(234,193,203,0.15)',fill:true}]},options:{scales:{x:{title:{display:true,text:'t'}},y:{title:{display:true,text:'y(t)'}}}}});
    showToast('Графік ДР побудовано!','success');
  },400);
}

function toggleVoiceInput() {
  if(!('SpeechRecognition' in window||'webkitSpeechRecognition' in window)){showToast('Браузер не підтримує голосовий ввід','error');return;}
  if(!recognition){
    recognition=new(window.SpeechRecognition||window.webkitSpeechRecognition)();
    recognition.lang='uk-UA';recognition.interimResults=true;recognition.continuous=true;
    recognition.onresult=e=>{let t='';for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript;if(t){editorEl.focus();document.execCommand('insertText',false,t+' ');}};
    recognition.onerror=()=>{showToast('Помилка голосового вводу','error');stopVoice();};
    recognition.onend=stopVoice;
  }
  isListening?stopVoice():startVoice();
}
function startVoice(){try{recognition.start();isListening=true;document.getElementById('voice-btn').classList.add('listening');showToast('Говоріть українською…');}catch(e){showToast('Не вдалося запустити','error');}}
function stopVoice(){if(recognition)recognition.stop();isListening=false;document.getElementById('voice-btn').classList.remove('listening');}

let draftTimeout;
function autoSave() {
  clearTimeout(draftTimeout);
  draftTimeout=setTimeout(()=>{
    const d={alias:aliasEl.value.trim(),title:titleEl.value.trim(),category:categoryEl.value,desc:descEl.value.trim(),content:editorEl.innerHTML.trim()};
    if(d.alias||d.title||d.content){localStorage.setItem(DRAFT_KEY,JSON.stringify(d));const b=document.getElementById('draftBadge');b.classList.add('show');setTimeout(()=>b.classList.remove('show'),2000);}
  },2000);
}
function saveDraft(){localStorage.setItem(DRAFT_KEY,JSON.stringify({alias:aliasEl.value.trim(),title:titleEl.value.trim(),category:categoryEl.value,desc:descEl.value.trim(),content:editorEl.innerHTML.trim()}));showToast('Чернетку збережено','success');}
editorEl.addEventListener('input',()=>{updateStats();autoSave();updateSecurityIndicator();});
aliasEl.addEventListener('input',autoSave);
titleEl.addEventListener('input',autoSave);
setInterval(autoSave,10000);

const XSS_PAT  = [/<script[\s>]/i,/javascript:/i,/on\w+\s*=/i,/data:text\/html/i,/<iframe/i,/<object/i,/<embed/i,/vbscript:/i,/expression\s*\(/i];
const SPAM_PAT = [/(.)\1{20,}/,/\b(buy now|click here|free money)\b/i];

const checkXSS   = s => XSS_PAT.some(p=>p.test(s));
const countLinks = h => {const d=document.createElement('div');d.innerHTML=h;return d.querySelectorAll('a[href]').length;};
const countScripts=h => (h.match(/<script/gi)||[]).length;
const checkSpam  = s => SPAM_PAT.some(p=>p.test(s));

function runSecurityCheck() {
  const alias=aliasEl.value.trim(),title=titleEl.value.trim();
  const content=editorEl.innerHTML.trim(),rawText=editorEl.innerText.trim(),desc=descEl.value.trim();
  const R=[];

  const xss=checkXSS(content)||checkXSS(alias)||checkXSS(title)||checkXSS(desc);
  R.push({label:'XSS-атаки',type:xss?'fail':'ok',icon:xss?'fa-times':'fa-check',desc:xss?'Виявлено підозрілий HTML/JS-код':'Небезпечних скриптів не виявлено'});

  const sc=countScripts(content);
  R.push({label:'Вбудовані скрипти',type:sc>0?'fail':'ok',icon:sc>0?'fa-times':'fa-check',desc:sc>0?`Знайдено ${sc} тег(и) <script>`:'Вбудованих скриптів немає'});

  const aok=alias.length>=2&&alias.length<=60&&/^[\wА-ЯҐЄІЇа-яґєії\s'\-\.]+$/u.test(alias);
  R.push({label:'Псевдонім',type:!alias?'warn':aok?'ok':'fail',icon:!alias?'fa-exclamation':aok?'fa-check':'fa-times',desc:!alias?'Не вказано':aok?`${alias.length} симв. — OK`:'Недозволені символи або задовгий'});

  const tok=title.length>=5&&title.length<=120;
  R.push({label:'Назва статті',type:!title?'warn':tok?'ok':'fail',icon:!title?'fa-exclamation':tok?'fa-check':'fa-times',desc:!title?'Не вказана':title.length<5?'Занадто коротка':title.length>120?'Занадто довга':`${title.length} симв. — OK`});

  const cl=rawText.length;
  R.push({label:'Довжина тексту',type:cl===0?'warn':cl<50?'warn':cl>MAX_CHARS?'fail':'ok',icon:(cl>=50&&cl<=MAX_CHARS)?'fa-check':'fa-exclamation',desc:cl===0?'Порожній':cl<50?`${cl} симв. — занадто коротко`:cl>MAX_CHARS?'Перевищено ліміт':`${cl.toLocaleString()} симв. — OK`});

  const ic=countImages();
  R.push({label:'Зображення',type:ic>MAX_IMAGES?'warn':'ok',icon:ic<=MAX_IMAGES?'fa-check':'fa-exclamation',desc:`${ic}/${MAX_IMAGES} — `+(ic<=MAX_IMAGES?'OK':'ліміт перевищено')});

  const spam=checkSpam(rawText)||checkSpam(title);
  R.push({label:'Спам-фільтр',type:spam?'warn':'ok',icon:spam?'fa-exclamation-triangle':'fa-check',desc:spam?'Виявлено підозрілі слова':'Підозрілого вмісту не знайдено'});

  const lc=countLinks(content);
  R.push({label:'Посилання',type:lc>10?'fail':lc>5?'warn':'ok',icon:lc<=5?'fa-check':'fa-exclamation-triangle',desc:`${lc} посилань — `+(lc<=5?'норма':lc<=10?'забагато':'критично')});

  const pass=R.filter(r=>r.type==='ok').length;
  const warn=R.filter(r=>r.type==='warn').length;
  const fail=R.filter(r=>r.type==='fail').length;
  const score=Math.round(Math.max(0,(pass*12.5)-(warn*5)-(fail*15)));

  const sn=document.getElementById('secScoreNum');
  sn.textContent=score+'%';
  sn.style.color=score>=80?'#2e7d4f':score>=50?'#b35f2f':'#b3354f';
  document.querySelector('#secScoreWrap .sec-score-label').textContent=
    score>=80?'Відмінно — стаття готова до публікації':score>=50?'Є зауваження':'Критичні помилки — публікацію заблоковано';

  const list=document.getElementById('secResultList'); list.innerHTML='';
  R.forEach(r=>{
    const el=document.createElement('div');
    el.className=`sec-result-item ${r.type==='ok'?'ok-item':r.type==='warn'?'warn-item':'fail-item'}`;
    el.innerHTML=`<div class="sec-result-icon"><i class="fas ${r.icon}"></i></div><div class="sec-result-text"><div class="sec-result-title">${r.label}</div><div class="sec-result-desc">${r.desc}</div></div>`;
    list.appendChild(el);
  });
  updateSecurityIndicatorWith(score,fail,warn);
}

function updateSecurityIndicator() {
  const c=editorEl.innerHTML.trim();
  const bad=checkXSS(c)||checkXSS(aliasEl.value)||checkXSS(titleEl.value)||countScripts(c)>0;
  const ind=document.getElementById('securityIndicator'),btn=document.getElementById('secBtn');
  if(bad){ind.className='security-indicator danger';ind.querySelector('span').textContent='Небезпека';btn.className='tb-btn tb-btn-security danger-state';}
  else   {ind.className='security-indicator safe';  ind.querySelector('span').textContent='Безпечно'; btn.className='tb-btn tb-btn-security safe-state';}
}
function updateSecurityIndicatorWith(score,fails,warns){
  const ind=document.getElementById('securityIndicator'),btn=document.getElementById('secBtn');
  if(fails>0)     {ind.className='security-indicator danger';ind.querySelector('span').textContent=`${score}% ✗`;btn.className='tb-btn tb-btn-security danger-state';}
  else if(warns>0){ind.className='security-indicator warn';  ind.querySelector('span').textContent=`${score}%`;  btn.className='tb-btn tb-btn-security warn-state';}
  else            {ind.className='security-indicator safe';  ind.querySelector('span').textContent=`${score}%`;  btn.className='tb-btn tb-btn-security safe-state';}
}
function openSecurityModal()  {document.getElementById('securityModal').classList.add('show');runSecurityCheck();}
function closeSecurityModal() {document.getElementById('securityModal').classList.remove('show');}

async function gtranslate(text, toLang) {
  const url = `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=uk&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('GT ' + r.status);
  const j = await r.json();
  return j[0].map(seg => seg[0]).join('');
}

function gatherTextNodes() {
  const result = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (['SCRIPT','STYLE','CANVAS','NOSCRIPT'].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('#editorText')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = walker.nextNode())) result.push(n);
  return result;
}

function gatherPlaceholders() {
  return [...document.querySelectorAll('[placeholder]')]
    .filter(el => !el.closest('#editorText'));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function translatePage(lang, langName) {
  if (isTranslating) { showToast('Переклад вже виконується…', 'warn'); return; }
  isTranslating = true;
  selLang = lang; selLangName = langName || lang.toUpperCase();

  const spinner = document.getElementById('tbarSpinner');
  const pctEl   = document.getElementById('tbarPct');
  spinner.classList.add('show');
  pctEl.textContent = '0%';

  const trProg  = document.getElementById('trProgress');
  const trLabel = document.getElementById('trProgLabel');
  const trBar   = document.getElementById('trProgBar');
  trProg.classList.add('show');
  trLabel.textContent = `Перекладаємо на ${selLangName}…`;
  trBar.style.width   = '0%';

  const textNodes   = gatherTextNodes();
  const placeholders = gatherPlaceholders();
  const total = textNodes.length + placeholders.length;
  let done = 0;

  function tick() {
    done++;
    const pct = Math.min(Math.round(done / total * 100), 99);
    trBar.style.width   = pct + '%';
    trLabel.textContent = `Перекладаємо… ${pct}%`;
    pctEl.textContent   = pct + '%';
  }

  for (const group of chunk(textNodes, 15)) {
    await Promise.all(group.map(async node => {
      const orig = node.textContent;
      if (!orig.trim()) { tick(); return; }
      if (!nodeBackup.has(node)) nodeBackup.set(node, orig);
      try {
        node.textContent = await gtranslate(orig.trim(), lang);
      } catch (e) {}
      tick();
    }));
  }

  for (const group of chunk(placeholders, 10)) {
    await Promise.all(group.map(async el => {
      const orig = el.getAttribute('placeholder');
      if (!orig || !orig.trim()) { tick(); return; }
      const key = 'ph__' + (el.id || el.name || el.className || Math.random().toString(36).slice(2));
      if (!nodeBackup.has(key)) nodeBackup.set(key, { el, orig });
      try {
        el.setAttribute('placeholder', await gtranslate(orig.trim(), lang));
      } catch (e) {}
      tick();
    }));
  }

  try { document.title = await gtranslate('Слово — Написати статтю', lang); } catch (e) {}

  isTranslating = false;
  trBar.style.width   = '100%';
  trLabel.textContent = `Перекладено на ${selLangName} ✓`;
  pctEl.textContent   = '100%';
  setTimeout(() => spinner.classList.remove('show'), 3000);

  document.getElementById('tbarText').textContent = `Перекладено: ${selLangName}`;
  document.getElementById('tbarEnBtn').style.display = 'none';
  document.getElementById('tbarDeBtn').style.display = 'none';
  document.getElementById('tbarPlBtn').style.display = 'none';
  document.getElementById('tbarResetBtn').style.display = 'inline-flex';

  _showBar(true);

  showToast(`Перекладено на ${selLangName} ✓`, 'success');
  closeTranslateModal();
}

function resetTranslation() {
  if (isTranslating) { showToast('Зачекайте завершення перекладу', 'warn'); return; }

  nodeBackup.forEach((val, key) => {
    if (typeof key === 'string' && key.startsWith('ph__')) {
      if (val && val.el) val.el.setAttribute('placeholder', val.orig);
    } else {
      try { key.textContent = val; } catch(e) {}
    }
  });
  nodeBackup.clear();
  document.title = 'Слово — Написати статтю';

  document.getElementById('tbarText').textContent = 'Перекласти цю сторінку?';
  document.getElementById('tbarEnBtn').style.display    = 'inline-flex';
  document.getElementById('tbarDeBtn').style.display    = 'inline-flex';
  document.getElementById('tbarPlBtn').style.display    = 'inline-flex';
  document.getElementById('tbarResetBtn').style.display = 'none';
  document.getElementById('tbarSpinner').classList.remove('show');

  const tp = document.getElementById('trProgress');
  tp.classList.remove('show');
  document.getElementById('trProgBar').style.width = '0%';

  selLang = null; selLangName = null;
  document.querySelectorAll('.lang-option').forEach(e=>e.classList.remove('selected'));
  document.getElementById('translateConfirmBtn').disabled = true;

  showToast('Оригінальну мову відновлено', 'success');
  closeTranslateModal();
}

function _showBar(force=false) {
  if (!force && localStorage.getItem(TBAR_KEY)) return;
  document.getElementById('translateBar').classList.add('show');
  document.getElementById('mainHeader').classList.add('shifted');
  document.getElementById('mainContent').classList.add('shifted');
  document.getElementById('progressBar').classList.add('shifted');
}
function hideTranslateBar() {
  document.getElementById('translateBar').classList.remove('show');
  document.getElementById('mainHeader').classList.remove('shifted');
  document.getElementById('mainContent').classList.remove('shifted');
  document.getElementById('progressBar').classList.remove('shifted');
  localStorage.setItem(TBAR_KEY, '1');
}

function openTranslateModal() {
  document.getElementById('translateModal').classList.add('show');
}
function closeTranslateModal() {
  document.getElementById('translateModal').classList.remove('show');
}
function selectLang(el, lang, name) {
  document.querySelectorAll('.lang-option').forEach(e=>e.classList.remove('selected'));
  el.classList.add('selected');
  selLang=lang; selLangName=name;
  document.getElementById('translateConfirmBtn').disabled=false;
}
function confirmTranslation() {
  if(!selLang)return;
  translatePage(selLang, selLangName);
}

async function publishArticle() {
  const alias = aliasEl.value.trim();
  const title = titleEl.value.trim();
  const category = categoryEl.value;
  const description = descEl.value.trim();
  const contentHTML = editorEl.innerHTML.trim();
  const contentText = editorEl.innerText.trim();

  if (!alias)  { showToast('Вкажіть псевдонім', 'error'); aliasEl.focus(); return; }
  if (!title)  { showToast('Введіть назву статті', 'error'); titleEl.focus(); return; }
  if (!contentText) { showToast('Напишіть текст статті', 'error'); editorEl.focus(); return; }

  if (checkXSS(contentHTML) || countScripts(contentHTML) > 0) {
    showToast('Публікацію заблоковано: небезпечний вміст', 'error');
    openSecurityModal();
    return;
  }

  try {
    const response = await fetch('http://localhost:5012/submit-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alias,
        title,
        content: contentHTML,        
        plain_text: contentText,     
        category,
        description
      })
    });

    if (response.ok) {
      showToast('Статтю успішно надіслано на перевірку!', 'success');
      resetEditor();
    } else {
      throw new Error();
    }
  } catch (e) {
    showToast('Статтю надіслано на перевірку! (демо-режим)', 'success');
    resetEditor();
  }
}

function resetEditor(){
  aliasEl.value=titleEl.value=descEl.value='';categoryEl.value='';
  editorEl.innerHTML='';localStorage.removeItem(DRAFT_KEY);updateStats();
}

window.addEventListener('load', () => {
  
  document.getElementById('aiAllowCheck').addEventListener('change', function() {
    const btn = document.getElementById('aiToggleBtn');
    const icon = document.getElementById('aiIcon');
    const txt = document.getElementById('aiToggleText');
    
    if (this.checked) {
      btn.style.background = 'rgba(46, 117, 89, 0.15)'; 
      btn.style.color = '#1e533c';
      btn.style.borderColor = '#2e7559';
      icon.style.transform = 'scale(1.15) rotate(10deg)';
      txt.textContent = 'AI дозволено';
      
      showToast('Дозвіл для розширення статті через AI активовано!', 'success');
    } else {
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
      icon.style.transform = 'none';
      txt.textContent = 'Дозволити AI-покращення';
      
      showToast('Обробку вимкнено. Статтю буде опубліковано без змін.', 'info');
    }
    
    if (typeof saveDraft === 'function') saveDraft();
  });

  const saved = localStorage.getItem(DRAFT_KEY);
  if(saved){
    try{
      const d = JSON.parse(saved);
      editorEl.innerHTML = d.content || '';
      aliasEl.value = d.alias || '';
      titleEl.value = d.title || '';
      categoryEl.value = d.category || '';
      descEl.value = d.desc || '';
      document.getElementById('aiAllowCheck').checked = d.ai_allowed || false;
      document.getElementById('aiAllowCheck').dispatchEvent(new Event('change'));

      updateStats();
      if(d.content || d.title) showToast('Чернетку відновлено');
    } catch(e) {}
  }
  MathJax.typesetPromise().catch(()=>{});
  updateSecurityIndicator();
  setTimeout(()=>_showBar(), 2500);
});
