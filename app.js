/* CareLink SG — static GitHub Pages prototype
   Gemini API key is supplied at runtime and stored only in sessionStorage.
   No key is included in source control. */

const MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const DEFAULT_READINGS = [
  { id: 1, date: '2026-08-04T08:00', hr: 70, sys: 116, dia: 75, sleep: 7.0, steps: 7030 },
  { id: 2, date: '2026-08-05T08:10', hr: 71, sys: 117, dia: 75, sleep: 6.8, steps: 7640 },
  { id: 3, date: '2026-08-06T08:05', hr: 69, sys: 118, dia: 76, sleep: 7.4, steps: 8120 },
  { id: 4, date: '2026-08-07T08:15', hr: 73, sys: 119, dia: 77, sleep: 7.1, steps: 5940 },
  { id: 5, date: '2026-08-08T08:00', hr: 72, sys: 118, dia: 76, sleep: 7.3, steps: 6750 },
  { id: 6, date: '2026-08-09T08:10', hr: 71, sys: 117, dia: 75, sleep: 7.0, steps: 7290 },
  { id: 7, date: '2026-08-10T08:00', hr: 72, sys: 118, dia: 76, sleep: 7.2, steps: 6420 }
];

const RISING_BP_READINGS = [
  { id: 101, date: '2026-08-06T08:00', hr: 72, sys: 120, dia: 78, sleep: 7.2, steps: 7400 },
  { id: 102, date: '2026-08-07T08:00', hr: 74, sys: 126, dia: 81, sleep: 6.9, steps: 6800 },
  { id: 103, date: '2026-08-08T08:00', hr: 75, sys: 132, dia: 84, sleep: 6.7, steps: 5900 },
  { id: 104, date: '2026-08-09T08:00', hr: 76, sys: 138, dia: 87, sleep: 6.5, steps: 5200 },
  { id: 105, date: '2026-08-10T08:00', hr: 78, sys: 142, dia: 90, sleep: 6.4, steps: 4700 }
];

const DEFAULT_MEDS = [
  { id: 1, name: 'Metformin', dose: '500 mg · 1 tablet', time: '08:00', taken: true },
  { id: 2, name: 'Medication B', dose: '1 tablet', time: '20:00', taken: false }
];

const DEFAULT_CAREGIVERS = [
  { id: 1, name: 'Rachel Tan', relation: 'Daughter', initials: 'RT', alerts: true },
  { id: 2, name: 'Community Care Team', relation: 'Care coordinator', initials: 'CC', alerts: true }
];

const DEFAULT_BOUND_PATIENTS = [
  { id: 1, name: 'David Tan', initials: 'DT', status: 'green', label: 'Healthy' },
  { id: 2, name: 'Mdm Lee', initials: 'ML', status: 'yellow', label: 'Danger' },
  { id: 3, name: 'Mr Wong', initials: 'MW', status: 'red', label: 'Urgent' }
];

const DEFAULT_WEEK = [
  { day: 'Mon', state: 'done' }, { day: 'Tue', state: 'done' }, { day: 'Wed', state: 'done' },
  { day: 'Thu', state: 'missed' }, { day: 'Fri', state: 'done' }, { day: 'Sat', state: 'done' }, { day: 'Sun', state: 'done' }
];

const DEFAULT_CHECKINS = [
  {
    id: 1001,
    date: '2026-08-10T10:30',
    concern: 'Feeling dizzy after breakfast and unsure whether to keep monitoring or contact support.',
    outcome: 'Contact a healthcare professional',
    level: 'amber',
    confidence: 'Medium'
  }
];

const STORE = {
  readings: 'carelink_readings',
  meds: 'carelink_meds',
  caregivers: 'carelink_caregivers',
  week: 'carelink_week',
  sharing: 'carelink_sharing',
  wearable: 'carelink_wearable',
  largeText: 'carelink_large_text',
  profile: 'carelink_profile',
  credentials: 'carelink_credentials',
  auth: 'carelink_auth',
  checkins: 'carelink_checkins'
};

let bpChart = null;
let chatHistory = [];

const $ = (id) => document.getElementById(id);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function getJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? structuredClone(fallback); }
  catch { return structuredClone(fallback); }
}
function setJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function getReadings() { return getJSON(STORE.readings, DEFAULT_READINGS); }
function getMeds() { return getJSON(STORE.meds, DEFAULT_MEDS); }
function getCaregivers() {
  const caregivers = getJSON(STORE.caregivers, DEFAULT_CAREGIVERS);
  let changed = false;
  const updated = caregivers.map(person => {
    if (person.name === 'Emily Tan' || (person.relation === 'Daughter' && person.initials === 'ET')) {
      changed = true;
      return { ...person, name: 'Rachel Tan', initials: 'RT' };
    }
    return person;
  });
  if (changed) setJSON(STORE.caregivers, updated);
  return updated;
}
function getWeek() { return getJSON(STORE.week, DEFAULT_WEEK); }
function apiKey() { return sessionStorage.getItem('carelink_gemini_key') || ''; }

const DEFAULT_PROFILE = { name: 'David Tan', phone: '+65 9123 4567', initials: 'DT' };
const DEFAULT_CREDENTIALS = { phone: '+65 9123 4567', password: 'carelink123' };

function initialsFromName(name='David Tan') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || 'D') + (parts[1]?.[0] || 'T')).toUpperCase();
}

function getProfile() {
  const profile = getJSON(STORE.profile, DEFAULT_PROFILE);
  const name = profile?.name || DEFAULT_PROFILE.name;
  const phone = profile?.phone || DEFAULT_PROFILE.phone;
  return { name, phone, initials: initialsFromName(name) };
}

function setProfile(profile) {
  const name = (profile?.name || DEFAULT_PROFILE.name).trim() || DEFAULT_PROFILE.name;
  const phone = (profile?.phone || DEFAULT_PROFILE.phone).trim() || DEFAULT_PROFILE.phone;
  setJSON(STORE.profile, { name, phone, initials: initialsFromName(name) });
}

function normalisePhone(value='') {
  return String(value).replace(/[\s()-]/g, '');
}

function getCredentials() {
  const saved = getJSON(STORE.credentials, DEFAULT_CREDENTIALS);
  return {
    phone: saved?.phone || DEFAULT_CREDENTIALS.phone,
    password: saved?.password || DEFAULT_CREDENTIALS.password
  };
}

function setCredentials(phone, password) {
  setJSON(STORE.credentials, { phone, password });
}

function isAuthenticated() { return sessionStorage.getItem(STORE.auth) === 'true'; }

function updateProfileUI() {
  const profile = getProfile();
  if ($('profileName')) $('profileName').textContent = profile.name;
  if ($('profileAvatar')) $('profileAvatar').textContent = profile.initials;
  if ($('heroGreeting')) $('heroGreeting').textContent = `Good afternoon, ${profile.name.split(/\s+/)[0] || 'David'}.`;
}

function setAuthMode(mode='login') {
  const login = mode !== 'register';
  if ($('loginTab')) $('loginTab').classList.toggle('active', login);
  if ($('registerTab')) $('registerTab').classList.toggle('active', !login);
  if ($('loginForm')) $('loginForm').classList.toggle('active', login);
  if ($('registerForm')) $('registerForm').classList.toggle('active', !login);
}

function showAuth(mode='login') {
  setAuthMode(mode);
  if ($('authScreen')) $('authScreen').hidden = false;
  if ($('appShell')) $('appShell').hidden = true;
}

function showApp() {
  if ($('authScreen')) $('authScreen').hidden = true;
  if ($('appShell')) $('appShell').hidden = false;
  updateProfileUI();
}

function loginDemo(e) {
  e.preventDefault();
  const phone = $('loginPhone').value.trim();
  const password = $('loginPassword').value.trim();
  if (!phone || !password) { toast('Enter phone number and password.'); return; }

  const credentials = getCredentials();
  const phoneMatches = normalisePhone(phone) === normalisePhone(credentials.phone);
  const passwordMatches = password === credentials.password;

  if (!phoneMatches || !passwordMatches) {
    toast('Phone number or password is incorrect.');
    return;
  }

  const profile = getProfile();
  setProfile({ ...profile, phone: credentials.phone });
  sessionStorage.setItem(STORE.auth, 'true');
  showApp();
  renderAll();
  toast(`Logged in as ${getProfile().name}.`);
}

function registerDemo(e) {
  e.preventDefault();
  const name = $('registerName').value.trim() || DEFAULT_PROFILE.name;
  const phone = $('registerPhone').value.trim();
  const password = $('registerPassword').value;
  const confirm = $('registerConfirm').value;
  if (!phone || !password || !confirm) { toast('Complete the registration form.'); return; }
  if (password !== confirm) { toast('Passwords do not match.'); return; }
  setProfile({ name, phone });
  setCredentials(phone, password);
  sessionStorage.setItem(STORE.auth, 'true');
  showApp();
  renderAll();
  toast(`Registered and logged in as ${getProfile().name}.`);
}

function logoutDemo() {
  sessionStorage.removeItem(STORE.auth);
  if ($('loginPassword')) $('loginPassword').value = '';
  if ($('loginPhone')) $('loginPhone').value = '';
  setView('dashboard');
  showAuth('login');
}

function isLargeTextMode() { return localStorage.getItem(STORE.largeText) === 'true'; }
function syncLargeTextUI() {
  const enabled = isLargeTextMode();
  document.body.classList.toggle('large-text-mode', enabled);
  const btn = $('largeTextToggle');
  const status = $('largeTextStatus');
  if (btn) {
    btn.textContent = enabled ? 'Back to standard text' : 'Switch to large text';
    btn.setAttribute('aria-pressed', String(enabled));
  }
  if (status) status.textContent = enabled ? 'Large text mode enabled' : 'Standard text mode';
}
function toggleLargeTextMode() {
  localStorage.setItem(STORE.largeText, String(!isLargeTextMode()));
  syncLargeTextUI();
  toast(isLargeTextMode() ? 'Large text mode enabled.' : 'Standard text mode restored.');
}

function esc(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }

function inlineMarkdown(value='') {
  return esc(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>');
}

function markdownToHtml(markdown='') {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inList = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html += `<p>${inlineMarkdown(paragraph.join(' '))}</p>`;
    paragraph = [];
  };
  const closeList = () => {
    if (inList) {
      html += '</ul>';
      inList = false;
    }
  };

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(4, heading[1].length + 3);
      html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
      return;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inlineMarkdown(bullet[1])}</li>`;
      return;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      if (!inList) {
        html += '<ul>';
        inList = true;
      }
      html += `<li>${inlineMarkdown(numbered[1])}</li>`;
      return;
    }

    closeList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  closeList();
  return html || '<p></p>';
}

function setMarkdown(el, text) {
  if (!el) return;
  el.innerHTML = markdownToHtml(text);
}

function fmtDate(value) { return new Intl.DateTimeFormat('en-SG', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }).format(new Date(value)); }
function fmtShortDate(value) { return new Intl.DateTimeFormat('en-SG', { day:'2-digit', month:'short' }).format(new Date(value)); }
function toast(message) { const el=$('toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove('show'),2800); }

function openModal(title, html) { $('modalTitle').textContent=title; $('modalBody').innerHTML=html; $('modalBackdrop').hidden=false; }
function closeModal(){ $('modalBackdrop').hidden=true; $('modalBody').innerHTML=''; }

function setView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  const view = $(`view-${name}`);
  if (view) view.classList.add('active');
  const navBtn = document.querySelector(`.nav-item[data-view="${name}"]`);
  $('pageTitle').textContent = navBtn ? navBtn.textContent.trim().replace(/^[^A-Za-z]+/, '') : 'CareLink SG';
  $('sidebar').classList.remove('open');
  if(name==='checkin') renderCheckinHistory();
  if(name==='monitoring') renderMonitoring();
  if(name==='insights') renderInsightsMeta();
  if(name==='medication') renderMedication();
  if(name==='care') renderCaregivers();
  if(name==='caregiver') renderCaregiverPatients();
  if(name==='assistant') renderAssistantContext();
  if(name==='settings') syncApiUI();
  window.scrollTo({top:0, behavior:'smooth'});
}

function latestReading(){ const r=getReadings(); return r.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).at(-1) || DEFAULT_READINGS.at(-1); }

function trendSignal(readings=getReadings()) {
  const sorted = readings.slice().sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(sorted.length < 3) return { level:'stable', label:'Not enough trend data', detail:'Add more readings to demonstrate trend detection.' };
  const tail = sorted.slice(-5);
  const risingSys = tail.every((r,i)=> i===0 || r.sys >= tail[i-1].sys) && tail.at(-1).sys - tail[0].sys >= 10;
  const risingDia = tail.every((r,i)=> i===0 || r.dia >= tail[i-1].dia) && tail.at(-1).dia - tail[0].dia >= 6;
  if(risingSys || risingDia) return { level:'attention', label:'Sustained upward BP trend', detail:'Prototype rules detected a consistent increase across recent readings.' };
  return { level:'stable', label:'No sustained change detected', detail:'Prototype rules did not detect a strong continuous rise in recent readings.' };
}

function computeHealthScore(r) {
  let score = 90;
  if(r.sleep < 7) score -= Math.min(12, Math.round((7-r.sleep)*5));
  if(r.steps < 6000) score -= Math.min(10, Math.round((6000-r.steps)/600));
  const trend = trendSignal();
  if(trend.level==='attention') score -= 12;
  return Math.max(55, Math.min(96, score));
}

function renderDashboard(){
  const r=latestReading(); const score=computeHealthScore(r); const trend=trendSignal();
  $('dashHr').textContent=r.hr; $('dashBp').textContent=`${r.sys}/${r.dia}`; $('dashSleep').textContent=r.sleep.toFixed(1); $('dashSteps').textContent=r.steps.toLocaleString('en-SG');
  $('stepsProgress').style.width=`${Math.min(100,Math.round(r.steps/8000*100))}%`;
  $('healthScore').textContent=score; $('scoreRing').style.background=`radial-gradient(circle at center,#194f4e 56%,transparent 57%), conic-gradient(#8ee3d1 ${score}%,rgba(255,255,255,.18) 0)`;
  $('scoreLabel').textContent=trend.level==='attention'?'Review trend':'Stable';
  $('dashBpLabel').textContent=trend.level==='attention'?'Trend needs review':'Stable trend';
  $('todayDate').textContent=new Intl.DateTimeFormat('en-SG',{weekday:'short',day:'2-digit',month:'short'}).format(new Date());
  renderCarePlan(); renderWearable();
}

function renderCarePlan(){
  const meds=getMeds();
  const items=[
    {time:'8:00 AM',title:'Morning health check',sub:'Blood pressure + heart rate',done:true},
    ...meds.map(m=>({time:to12h(m.time),title:m.name,sub:m.dose,done:m.taken})),
    {time:'6:00 PM',title:'Evening walk',sub:'Daily activity goal',done:false}
  ].slice(0,4);
  $('carePlanList').innerHTML=items.map(x=>`<div class="timeline-item"><span class="timeline-time">${esc(x.time)}</span><span class="timeline-dot ${x.done?'done':''}"></span><div class="timeline-copy"><strong>${esc(x.title)}</strong><span>${esc(x.sub)}</span></div><span class="timeline-state">${x.done?'Done':'Upcoming'}</span></div>`).join('');
}

function to12h(time){ const [h,m]=time.split(':').map(Number); const d=new Date(); d.setHours(h,m,0,0); return d.toLocaleTimeString('en-SG',{hour:'numeric',minute:'2-digit'}); }

function renderWearable(){
  const connected=localStorage.getItem(STORE.wearable)==='true';
  $('wearableName').textContent=connected?'Demo Smartwatch connected':'No device connected';
  $('wearableStatus').textContent=connected?'Last synced just now · simulated':'Manual readings only';
  $('wearableInlineBtn').textContent=connected?'Disconnect':'Connect';
}
function toggleWearable(){ const now=localStorage.getItem(STORE.wearable)==='true'; localStorage.setItem(STORE.wearable,String(!now)); renderWearable(); toast(!now?'Smartwatch connection simulated.':'Wearable disconnected.'); }

function setDefaultReadingTime(){ const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); $('readingDate').value=d.toISOString().slice(0,16); }

function renderMonitoring(){
  const readings=getReadings().slice().sort((a,b)=>new Date(a.date)-new Date(b.date)); const latest=readings.at(-1)||latestReading(); const trend=trendSignal(readings);
  $('latestBp').textContent=`${latest.sys}/${latest.dia}`; $('readingCount').textContent=`${readings.length} entries`;
  const chip=$('latestRiskChip'); chip.textContent=trend.level==='attention'?'Demo status: review trend':'Demo status: stable'; chip.className=`status-chip ${trend.level==='attention'?'amber':'green'}`;
  $('readingsTable').innerHTML=readings.slice().reverse().map(r=>`<tr><td>${fmtDate(r.date)}</td><td><strong>${r.sys}/${r.dia}</strong></td><td>${r.hr} bpm</td><td>${r.sleep.toFixed(1)} h</td><td>${r.steps.toLocaleString('en-SG')}</td><td><button class="table-action" data-delete-reading="${r.id}">Delete</button></td></tr>`).join('');
  renderBPChart(readings);
  renderDashboard(); renderAssistantContext(); renderInsightsMeta();
}

function renderBPChart(readings){
  if(typeof Chart==='undefined') return;
  const ctx=$('bpChart'); if(!ctx) return;
  if(bpChart) bpChart.destroy();
  const recent=readings.slice(-7);
  bpChart=new Chart(ctx,{type:'line',data:{labels:recent.map(r=>fmtShortDate(r.date)),datasets:[{label:'Systolic',data:recent.map(r=>r.sys),borderWidth:2.5,tension:.32,pointRadius:4},{label:'Diastolic',data:recent.map(r=>r.dia),borderWidth:2.5,tension:.32,pointRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:7,padding:18,font:{size:11}}}},scales:{y:{suggestedMin:60,suggestedMax:160,grid:{color:'#edf2f2'},ticks:{font:{size:10}}},x:{grid:{display:false},ticks:{font:{size:10}}}}}});
}

function addHealthReading(e){
  e.preventDefault();
  const r={ id:Date.now(), date:$('readingDate').value, hr:+$('heartRate').value, sys:+$('systolic').value, dia:+$('diastolic').value, sleep:+$('sleepHours').value, steps:+$('steps').value };
  const readings=getReadings(); readings.push(r); setJSON(STORE.readings,readings); renderMonitoring(); toast('Health reading saved locally.');
}

function deleteReading(id){ const arr=getReadings().filter(r=>String(r.id)!==String(id)); setJSON(STORE.readings,arr.length?arr:DEFAULT_READINGS); renderMonitoring(); toast('Reading removed.'); }


function getCheckins() { return getJSON(STORE.checkins, DEFAULT_CHECKINS); }
function setCheckins(value) { setJSON(STORE.checkins, value); }

function setCheckinMode(mode='voice') {
  $$('.mode-chip').forEach(btn => btn.classList.toggle('active', btn.dataset.checkinMode === mode));
  const statusText = {
    voice: 'Voice-first mode selected. In this prototype, voice input is simulated with the text box below.',
    text: 'Text mode selected. Type what feels different in your own words.',
    guided: 'Guided mode selected. Use the simple choices and safety-screening options below.'
  }[mode] || 'Choose an input method to continue.';
  if ($('voiceStatus')) $('voiceStatus').textContent = statusText;
}

function getCheckinData() {
  return {
    concern: ($('concernText')?.value || '').trim(),
    duration: $('durationSelect')?.value || 'not provided',
    worse: $('worseSelect')?.value || 'not provided',
    severity: $('severitySelect')?.value || 'mild',
    redFlags: $$('[data-red-flag]').filter(x => x.checked).map(x => x.dataset.redFlag)
  };
}

function classifyCheckin(data) {
  const text = `${data.concern} ${data.redFlags.join(' ')}`.toLowerCase();
  const urgentTerms = ['chest', 'breath', 'faint', 'confusion', 'confused', 'severe weakness', 'urgent'];
  const hasUrgent = data.redFlags.length > 0 || urgentTerms.some(term => text.includes(term));
  if (hasUrgent || data.severity === 'severe') {
    return {
      level: 'red',
      chip: 'Urgent support suggested',
      title: 'Seek urgent medical attention',
      nextStep: 'This may need urgent professional help. Use local emergency services or ask a nearby trusted person to help you get medical support now.',
      confidence: hasUrgent ? 'High' : 'Medium',
      why: [
        data.redFlags.length ? `Urgent warning sign selected: ${data.redFlags.join(', ')}` : 'The concern includes wording that may indicate an urgent warning sign.',
        `Severity selected: ${data.severity}`,
        'CareLink SG prioritises safety before normal follow-up questions.'
      ],
      action: 'Open dashboard emergency contact flow'
    };
  }
  const shouldContact = data.severity === 'moderate' || data.worse !== 'not worse' || data.duration === 'more than 1 day' || /higher|blood pressure|dizzy|pain|fever|vomit|weak/i.test(data.concern);
  if (shouldContact) {
    return {
      level: 'amber',
      chip: 'Professional support recommended',
      title: 'Contact a healthcare professional',
      nextStep: 'Contact a clinic, telehealth service, community care team, or trusted caregiver for advice. Keep monitoring and share the summary if the concern continues or gets worse.',
      confidence: data.concern.length > 25 ? 'Medium' : 'Low',
      why: [
        `Concern described: ${data.concern || 'not provided'}`,
        `Duration: ${data.duration}; getting worse: ${data.worse}`,
        'No urgent red flag was selected, but the symptom context may need professional review.'
      ],
      action: 'Open Community Care or Care Network'
    };
  }
  return {
    level: 'green',
    chip: 'Monitor at home',
    title: 'Continue monitoring',
    nextStep: 'Keep observing the change, record any new symptoms or readings, and set a follow-up reminder. Contact professional support if it gets worse or does not improve.',
    confidence: data.concern.length > 15 ? 'Medium' : 'Low',
    why: [
      'No urgent warning sign was selected.',
      `Severity selected: ${data.severity}`,
      'The available information supports a lower-risk demo pathway, but this is not a diagnosis.'
    ],
    action: 'Set a follow-up reminder'
  };
}

function renderDecision(result, data) {
  const cls = result.level === 'red' ? 'red' : result.level === 'amber' ? 'amber' : 'green';
  const icon = result.level === 'red' ? '!' : result.level === 'amber' ? '↗' : '✓';
  const html = `
    <div class="decision-top">
      <span class="decision-icon ${cls}">${icon}</span>
      <div><span class="status-chip ${cls}">${esc(result.chip)}</span><h3>${esc(result.title)}</h3></div>
    </div>
    <p>${esc(result.nextStep)}</p>
    <div class="confidence-box"><strong>Confidence: ${esc(result.confidence)}</strong><span>Based on the information provided in this prototype check-in.</span></div>
    <details class="why-box" open>
      <summary>Why this recommendation?</summary>
      <ul>${result.why.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
    </details>
    <div class="decision-pathway"><span class="${result.level==='green'?'active':''}">Monitor</span><b>→</b><span class="${result.level==='amber'?'active':''}">Contact professional</span><b>→</b><span class="${result.level==='red'?'active':''}">Urgent help</span></div>
    <div class="ai-disclaimer">This is decision support only. It does not diagnose conditions or replace qualified healthcare professionals.</div>`;
  if ($('decisionResult')) $('decisionResult').innerHTML = html;
  renderHealthSummary(result, data);
}

function renderHealthSummary(result, data) {
  const profile = getProfile();
  const summary = `
    <div class="summary-line"><strong>User</strong><span>${esc(profile.name)}</span></div>
    <div class="summary-line"><strong>Main concern</strong><span>${esc(data.concern || 'Not provided')}</span></div>
    <div class="summary-line"><strong>Follow-up answers</strong><span>${esc(data.duration)} · ${esc(data.worse)} · ${esc(data.severity)}</span></div>
    <div class="summary-line"><strong>Safety flags</strong><span>${esc(data.redFlags.length ? data.redFlags.join(', ') : 'None selected')}</span></div>
    <div class="summary-line"><strong>Suggested next step</strong><span>${esc(result.title)}</span></div>
    <div class="summary-line"><strong>Confidence</strong><span>${esc(result.confidence)}</span></div>`;
  if ($('healthSummary')) $('healthSummary').innerHTML = summary;
}

function saveCheckin(result, data) {
  const next = [{ id: Date.now(), date: new Date().toISOString(), concern: data.concern || 'Check-in completed', outcome: result.title, level: result.level, confidence: result.confidence }, ...getCheckins()].slice(0, 8);
  setCheckins(next);
  renderCheckinHistory();
}

function runCheckinDecision(e) {
  if (e) e.preventDefault();
  const data = getCheckinData();
  if (!data.concern) { toast('Describe what feels different first.'); return; }
  const result = classifyCheckin(data);
  renderDecision(result, data);
  saveCheckin(result, data);
  toast('Next-step guidance generated.');
}

function loadCheckinDemo() {
  if ($('concernText')) $('concernText').value = 'I feel dizzy today and my blood pressure seems higher than usual. I am not sure whether I should wait or contact someone.';
  if ($('durationSelect')) $('durationSelect').value = '1-4 hours';
  if ($('worseSelect')) $('worseSelect').value = 'slightly worse';
  if ($('severitySelect')) $('severitySelect').value = 'moderate';
  $$('[data-red-flag]').forEach(x => x.checked = false);
  setCheckinMode('voice');
  toast('Loaded a non-urgent dizziness sample.');
}

function clearCheckinForm() {
  if ($('concernText')) $('concernText').value = '';
  if ($('durationSelect')) $('durationSelect').value = 'less than 1 hour';
  if ($('worseSelect')) $('worseSelect').value = 'not worse';
  if ($('severitySelect')) $('severitySelect').value = 'mild';
  $$('[data-red-flag]').forEach(x => x.checked = false);
  if ($('decisionResult')) $('decisionResult').innerHTML = '<span class="status-chip blue">Ready</span><h3>Describe what feels different</h3><p>CareLink SG will screen for urgent warning signs first, then suggest whether to monitor, contact professional support, or seek urgent help.</p><div class="decision-pathway mini-pathway"><span>Monitor</span><b>→</b><span>Contact professional</span><b>→</b><span>Urgent help</span></div>';
  if ($('healthSummary')) $('healthSummary').textContent = 'Complete a check-in to generate a clear summary for a healthcare professional or trusted contact.';
  toast('Check-in form cleared.');
}

function renderCheckinHistory() {
  const box = $('checkinHistory');
  if (!box) return;
  const items = getCheckins();
  if (!items.length) {
    box.innerHTML = '<div class="empty-state">No check-ins saved yet.</div>';
    return;
  }
  box.innerHTML = items.map(item => `<div class="history-item ${esc(item.level)}"><div><strong>${esc(item.outcome)}</strong><span>${esc(item.concern)}</span></div><small>${fmtDate(item.date)} · ${esc(item.confidence)} confidence</small></div>`).join('');
}

function shareSummaryDemo() {
  const targets = [];
  if ($('shareTrusted')?.checked) targets.push('trusted contact');
  if ($('shareProfessional')?.checked) targets.push('healthcare professional');
  if (!targets.length) { toast('Choose at least one sharing recipient.'); return; }
  toast(`Summary shared with ${targets.join(' and ')} in this demo.`);
}

function setFollowupReminder(label) {
  if ($('followupStatus')) $('followupStatus').textContent = `Demo reminder set: check again ${label}.`;
  toast(`Follow-up reminder set for ${label}.`);
}

function renderInsightsMeta(){ const t=trendSignal(); if($('trendStatus')) $('trendStatus').textContent=t.label; if($('dataWindow')) $('dataWindow').textContent=`${Math.min(7,getReadings().length)} readings`; if($('insightApiState')) $('insightApiState').textContent=apiKey()?'Connected':'API not connected'; }

function buildHealthContext(){
  const readings=getReadings().slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).slice(-7);
  const meds=getMeds(); const trend=trendSignal(readings);
  return {
    readings: readings.map(r=>({date:r.date,heart_rate_bpm:r.hr,blood_pressure:`${r.sys}/${r.dia}`,sleep_hours:r.sleep,steps:r.steps})),
    prototype_trend_signal: trend,
    medications: meds.map(m=>({name:m.name,dose:m.dose,time:m.time,taken_today:m.taken})),
    recent_checkins: getCheckins().slice(0,3).map(c=>({date:c.date, concern:c.concern, outcome:c.outcome, level:c.level, confidence:c.confidence}))
  };
}

async function callGemini(userText, history=[]){
  const key=apiKey(); if(!key) throw new Error('No API key connected. Open Settings and connect Gemini first.');
  const systemText=`You are CareLink SG, an AI assistant inside a student healthcare prototype. Your role is to explain user-provided home health tracking data in plain language and support preventive-care awareness. Do not diagnose diseases, claim certainty, prescribe medication, recommend changing doses, or replace a qualified healthcare professional. Do not invent missing measurements. If the user describes urgent or severe symptoms, advise them to seek urgent professional help using appropriate local emergency services rather than attempting to manage it through this prototype. Keep responses concise, calm, transparent, and clearly identify that the data and trend rules come from a demo prototype. When discussing medication, only summarize the schedule provided; do not give dosing changes. Use bullet points when helpful.`;
  const contents=[...history.map(h=>({role:h.role,parts:[{text:h.text}]})),{role:'user',parts:[{text:userText}]}];
  const res=await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({system_instruction:{parts:[{text:systemText}]},contents,generationConfig:{temperature:.35,maxOutputTokens:900}})
  });
  let data={}; try{ data=await res.json(); }catch{}
  if(!res.ok){ const msg=data?.error?.message||`Gemini API request failed (${res.status}).`; throw new Error(msg); }
  const text=(data.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('').trim();
  if(!text) throw new Error('Gemini returned no text response.');
  return text;
}

async function analyzeHealth(target='insights'){
  if(!apiKey()){ setView('settings'); toast('Connect a Gemini API key first.'); return; }
  const context=buildHealthContext(); const prompt=`Analyze the following CareLink SG prototype data for a presentation demo. Explain any visible patterns without diagnosing. State what the local prototype trend rule detected, summarize activity/sleep/medication context, and give 2–4 cautious next-step suggestions focused on continued monitoring or contacting a qualified healthcare professional if a concerning trend persists. Make clear this is not a diagnosis.\n\nDATA:\n${JSON.stringify(context,null,2)}`;
  const out=target==='dashboard'?$('dashboardInsight'):$('aiInsightResult');
  if(target==='dashboard') out.innerHTML='<div class="insight-icon">✦</div><div><strong class="loading">Generating with Gemini 2.5 Flash</strong><p>Analyzing the current demo snapshot…</p></div>';
  else { out.classList.remove('placeholder-output'); out.innerHTML='<span class="loading">Generating insight with Gemini 2.5 Flash</span>'; }
  try{
    const text=await callGemini(prompt);
    if(target==='dashboard') out.innerHTML=`<div class="insight-icon">✦</div><div><strong>Gemini summary</strong><div class="markdown-body compact">${markdownToHtml(text)}</div></div>`;
    else setMarkdown(out, text);
  }catch(err){
    if(target==='dashboard') out.innerHTML=`<div class="insight-icon">!</div><div><strong>AI request failed</strong><p>${esc(err.message)}</p></div>`;
    else out.innerHTML=`<p>Could not generate insight: ${esc(err.message)}</p>`;
    toast('Gemini request failed. Check the API key/quota.');
  }
}

function renderMedication(){
  const meds=getMeds(); const week=getWeek(); const done=week.filter(x=>x.state==='done').length; const pct=Math.round(done/week.length*100);
  $('adherencePct').textContent=pct; $('adherenceRingText').textContent=`${done}/${week.length}`;
  const ring=document.querySelector('.adherence-ring'); if(ring) ring.style.background=`radial-gradient(circle,#fff 58%,transparent 59%),conic-gradient(var(--primary) ${pct}%,#e5eeee 0)`;
  const upcoming=meds.find(m=>!m.taken)||meds[0];
  if(upcoming){$('nextMedName').textContent=upcoming.name;$('nextMedTime').textContent=to12h(upcoming.time);$('nextMedDose').textContent=upcoming.dose;}
  $('medicationList').innerHTML=meds.map(m=>`<article class="med-card"><div class="med-icon">Rx</div><div><h3>${esc(m.name)}</h3><p>${esc(m.dose)} · ${to12h(m.time)}</p></div><div class="med-actions"><span class="status-chip ${m.taken?'green':'amber'}">${m.taken?'Taken':'Upcoming'}</span><button class="button secondary small" data-toggle-med="${m.id}">${m.taken?'Undo':'Mark taken'}</button><button class="text-button danger" data-delete-med="${m.id}">Delete</button></div></article>`).join('');
  $('weekStrip').innerHTML=week.map(d=>`<div class="day-pill ${d.state}"><strong>${d.day}</strong><span>${d.state==='done'?'✓':d.state==='missed'?'×':'·'}</span></div>`).join('');
  renderCarePlan(); renderAssistantContext();
}

function addMedicationModal(){
  openModal('Add medication',`<form id="medForm"><label>Medication name<input id="medName" required placeholder="e.g. Medication C"></label><label>Dose / instruction<input id="medDose" required placeholder="e.g. 1 tablet"></label><label>Reminder time<input id="medTime" type="time" value="20:00" required></label><div class="modal-actions"><button type="button" class="button secondary" id="cancelModal">Cancel</button><button class="button primary" type="submit">Add medication</button></div></form>`);
  $('cancelModal').onclick=closeModal;
  $('medForm').onsubmit=e=>{e.preventDefault();const meds=getMeds();meds.push({id:Date.now(),name:$('medName').value.trim(),dose:$('medDose').value.trim(),time:$('medTime').value,taken:false});setJSON(STORE.meds,meds);closeModal();renderMedication();toast('Medication added to the demo schedule.');};
}

function renderCaregivers(){
  const people=getCaregivers();
  $('caregiverList').innerHTML=people.map(p=>`<article class="caregiver-card"><div class="person-avatar">${esc(p.initials)}</div><div><strong>${esc(p.name)}</strong><span>${esc(p.relation)} · ${p.alerts?'Health alerts enabled':'Alerts off'}</span></div><button class="text-button danger" data-delete-care="${p.id}">Remove</button></article>`).join('');
  const share=getJSON(STORE.sharing,{bp:true,hr:true,meds:true,sleep:false});
  $$('[data-share]').forEach(i=>i.checked=Boolean(share[i.dataset.share]));
}

function addCaregiverModal(){
  openModal('Add caregiver',`<form id="careForm"><label>Name<input id="careName" required placeholder="e.g. Family member"></label><label>Relationship / role<input id="careRole" required placeholder="e.g. Son, caregiver, care coordinator"></label><div class="modal-actions"><button type="button" class="button secondary" id="cancelModal">Cancel</button><button class="button primary" type="submit">Add caregiver</button></div></form>`);
  $('cancelModal').onclick=closeModal;
  $('careForm').onsubmit=e=>{e.preventDefault();const name=$('careName').value.trim();const words=name.split(/\s+/);const initials=(words[0]?.[0]||'C')+(words[1]?.[0]||'');const arr=getCaregivers();arr.push({id:Date.now(),name,relation:$('careRole').value.trim(),initials:initials.toUpperCase(),alerts:true});setJSON(STORE.caregivers,arr);closeModal();renderCaregivers();toast('Caregiver added locally.');};
}

function renderAssistantContext(){
  const c=$('assistantContext'); if(!c) return; const r=latestReading(); const t=trendSignal(); const meds=getMeds();
  c.innerHTML=`<div class="context-list"><div class="context-item"><span>Blood pressure</span><strong>${r.sys}/${r.dia}</strong></div><div class="context-item"><span>Heart rate</span><strong>${r.hr} bpm</strong></div><div class="context-item"><span>Sleep</span><strong>${r.sleep.toFixed(1)} h</strong></div><div class="context-item"><span>Steps</span><strong>${r.steps.toLocaleString('en-SG')}</strong></div><div class="context-item"><span>Trend signal</span><strong>${esc(t.level)}</strong></div><div class="context-item"><span>Medications</span><strong>${meds.length}</strong></div></div>`;
}

function addChatMessage(role,text,loading=false){
  const wrap=document.createElement('div'); wrap.className=`message ${role==='user'?'user':'ai'}`;
  const body = loading
    ? `<p class="loading">${esc(text)}</p>`
    : role === 'ai'
      ? `<div class="message-markdown markdown-body compact">${markdownToHtml(text)}</div>`
      : `<p>${esc(text)}</p>`;
  const profile = getProfile();
  wrap.innerHTML=`<span class="message-avatar">${role==='user'?profile.initials:'✦'}</span><div><strong>${role==='user'?profile.name:'CareLink AI'}</strong>${body}</div>`;
  $('chatMessages').appendChild(wrap); $('chatMessages').scrollTop=$('chatMessages').scrollHeight; return wrap;
}

async function sendChat(text){
  const clean=(text||'').trim(); if(!clean) return;
  if(!apiKey()){ setView('settings'); toast('Connect Gemini before using AI Assistant.'); return; }
  addChatMessage('user',clean); const loader=addChatMessage('ai','Thinking…',true); $('chatInput').value='';
  const ctx=JSON.stringify(buildHealthContext());
  const prompt=`The user is asking about this CareLink SG prototype. Current demo context: ${ctx}\n\nUser question: ${clean}`;
  try{
    const response=await callGemini(prompt,chatHistory.slice(-8));
    loader.remove(); addChatMessage('ai',response);
    chatHistory.push({role:'user',text:clean},{role:'model',text:response});
  }catch(err){ loader.remove(); addChatMessage('ai',`I couldn't reach Gemini: ${err.message}`); toast('AI request failed.'); }
}

async function testApiKey(candidate){
  const res=await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(candidate)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:'Reply with exactly: CARELINK_CONNECTED'}]}],generationConfig:{temperature:0,maxOutputTokens:20}})});
  let data={}; try{data=await res.json();}catch{}
  if(!res.ok) throw new Error(data?.error?.message||`API test failed (${res.status}).`);
  return true;
}

function syncApiUI(){
  const connected=Boolean(apiKey());
  $('apiPill').classList.toggle('connected',connected); $('apiPill').classList.toggle('disconnected',!connected);
  $('apiStatusText').textContent=connected?`${MODEL} connected`:'Gemini disconnected'; $('apiTopBtn').textContent=connected?'API Settings':'Connect API';
  if($('settingsApiChip')){ $('settingsApiChip').textContent=connected?'Connected':'Disconnected'; $('settingsApiChip').className=`status-chip ${connected?'green':''}`; }
  if($('chatApiChip')){ $('chatApiChip').textContent=connected?'Online':'Offline'; $('chatApiChip').className=`status-chip ${connected?'green':''}`; }
  if($('connectionDetail')) $('connectionDetail').textContent=connected?'API key is stored in this browser session only.':'No API key is stored.';
  if($('insightApiState')) $('insightApiState').textContent=connected?'Connected':'API not connected';
}

async function connectApi(){
  const candidate=$('apiKeyInput').value.trim(); if(!candidate){toast('Paste an API key first.');return;}
  const btn=$('connectApiBtn'); const old=btn.textContent; btn.textContent='Testing…'; btn.disabled=true;
  try{ await testApiKey(candidate); sessionStorage.setItem('carelink_gemini_key',candidate); $('apiKeyInput').value=''; syncApiUI(); toast('Gemini 2.5 Flash connected successfully.'); }
  catch(err){ toast(`Connection failed: ${err.message}`); }
  finally{ btn.textContent=old; btn.disabled=false; }
}
function disconnectApi(){ sessionStorage.removeItem('carelink_gemini_key'); if($('apiKeyInput')) $('apiKeyInput').value=''; syncApiUI(); toast('Gemini API key cleared and disconnected.'); }

function resetDemoData(){
  setJSON(STORE.readings,DEFAULT_READINGS); setJSON(STORE.meds,DEFAULT_MEDS); setJSON(STORE.caregivers,DEFAULT_CAREGIVERS); setJSON(STORE.week,DEFAULT_WEEK); setJSON(STORE.sharing,{bp:true,hr:true,meds:true,sleep:false}); setJSON(STORE.checkins, DEFAULT_CHECKINS); localStorage.setItem(STORE.wearable,'false'); chatHistory=[]; renderAll(); toast('Demo data restored.');
}


let emergencyHoldTimer = null;
let emergencyProgressTimer = null;
let emergencyHoldStarted = 0;

function resetEmergencyHold() {
  clearTimeout(emergencyHoldTimer);
  clearInterval(emergencyProgressTimer);
  emergencyHoldTimer = null;
  emergencyProgressTimer = null;
  const btn = $('holdEmergencyBtn');
  const progress = $('holdProgress');
  if (btn) btn.classList.remove('holding');
  if (progress) progress.style.width = '0%';
  if ($('emergencyStatus')) $('emergencyStatus').textContent = 'Ready for long-press action.';
}

function startEmergencyHold(event) {
  if (event) event.preventDefault();
  const btn = $('holdEmergencyBtn');
  const progress = $('holdProgress');
  if (!btn || !progress || btn.classList.contains('activated')) return;
  clearTimeout(emergencyHoldTimer);
  clearInterval(emergencyProgressTimer);
  emergencyHoldStarted = Date.now();
  btn.classList.add('holding');
  if ($('emergencyStatus')) $('emergencyStatus').textContent = 'Keep holding to call Rachel Tan...';
  emergencyProgressTimer = setInterval(() => {
    const elapsed = Date.now() - emergencyHoldStarted;
    progress.style.width = `${Math.min(100, elapsed / 3000 * 100)}%`;
  }, 40);
  emergencyHoldTimer = setTimeout(triggerEmergencyContact, 3000);
}

function cancelEmergencyHold(event) {
  if (event) event.preventDefault();
  const btn = $('holdEmergencyBtn');
  if (btn && btn.classList.contains('activated')) return;
  resetEmergencyHold();
}

function triggerEmergencyContact() {
  clearTimeout(emergencyHoldTimer);
  clearInterval(emergencyProgressTimer);
  const btn = $('holdEmergencyBtn');
  const progress = $('holdProgress');
  if (progress) progress.style.width = '100%';
  if (btn) {
    btn.classList.remove('holding');
    btn.classList.add('activated');
  }
  if ($('emergencyStatus')) $('emergencyStatus').textContent = 'Emergency contact call activated: Rachel Tan.';
  toast('Emergency contact call activated in this demo.');
  openModal('Emergency contact', `<div class="insight-summary"><div class="insight-icon">!</div><div><strong>Calling Rachel Tan</strong><p>This classroom prototype has activated the emergency contact flow. A production version would connect to the approved local calling or emergency workflow.</p></div></div><div class="modal-actions"><button class="button secondary" id="resetEmergencyDemo">Reset demo call</button><button class="button primary" id="closeEmergencyModal">Done</button></div>`);
  $('resetEmergencyDemo').onclick = () => { if (btn) btn.classList.remove('activated'); closeModal(); resetEmergencyHold(); };
  $('closeEmergencyModal').onclick = closeModal;
}

function setupEmergencyHold() {
  const btn = $('holdEmergencyBtn');
  if (!btn) return;
  btn.addEventListener('pointerdown', startEmergencyHold);
  btn.addEventListener('pointerup', cancelEmergencyHold);
  btn.addEventListener('pointerleave', cancelEmergencyHold);
  btn.addEventListener('pointercancel', cancelEmergencyHold);
  btn.addEventListener('contextmenu', e => e.preventDefault());
}


const EXERCISE_GUIDES = {
  shoulder: {
    title: 'Shoulder & Neck Release',
    image: 'images/shoulder-release.svg',
    alt: 'Illustration showing a shoulder and neck release exercise',
    steps: ['Sit or stand comfortably with your back relaxed.', 'Slowly lift both shoulders towards your ears.', 'Roll your shoulders backwards in a small circle.', 'Relax your shoulders and repeat at a comfortable pace.'],
    safety: 'Stop if you feel pain, dizziness, numbness, or unusual discomfort. This is a classroom prototype, not medical advice.'
  },
  breathing: {
    title: 'Breathing Reset',
    image: 'images/breathing-reset.svg',
    alt: 'Illustration showing a calm breathing reset exercise',
    steps: ['Sit comfortably and place one hand on your chest or stomach.', 'Breathe in slowly through your nose.', 'Breathe out gently through your mouth.', 'Repeat slowly for one to two minutes.'],
    safety: 'Keep the breathing gentle. Stop and seek professional support if breathing feels difficult or symptoms worsen.'
  },
  walk: {
    title: 'Gentle Walk',
    image: 'images/gentle-walk.svg',
    alt: 'Illustration showing a gentle walking exercise',
    steps: ['Choose a safe, flat walking area.', 'Walk slowly at a pace that feels easy.', 'Keep breathing naturally and avoid rushing.', 'Pause or stop if you feel unwell.'],
    safety: 'Do not continue if you feel dizzy, painful, unusually weak, or unsafe. Follow your actual recovery plan.'
  }
};

function openExerciseGuide(id) {
  const guide = EXERCISE_GUIDES[id] || EXERCISE_GUIDES.shoulder;
  openModal(guide.title, `
    <img class="exercise-modal-image" src="${esc(guide.image)}" alt="${esc(guide.alt)}" />
    <p class="subtle">Follow the image and simple steps below. Move slowly and stay within a comfortable range.</p>
    <ol class="exercise-modal-list">${guide.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>
    <div class="exercise-modal-safety"><strong>Safety note:</strong> ${esc(guide.safety)}</div>
    <div class="modal-actions"><button class="button primary" id="closeExerciseGuide" type="button">Got it</button></div>
  `);
  $('closeExerciseGuide').onclick = closeModal;
}

function renderCaregiverPatients(){
  const list = $('caregiverPatientList');
  if (!list) return;
  list.innerHTML = DEFAULT_BOUND_PATIENTS.map(patient => `
    <article class="patient-status-card ${esc(patient.status)}">
      <div class="patient-status-avatar">${esc(patient.initials)}</div>
      <div class="patient-status-name"><strong>${esc(patient.name)}</strong><span>Bound patient</span></div>
      <span class="patient-status-badge ${esc(patient.status)}">${esc(patient.label)}</span>
    </article>
  `).join('');
}

function demoBooking(service){ openModal(service,`<div class="insight-summary"><div class="insight-icon">✓</div><div><strong>Demo request created</strong><p>This prototype does not connect to a real healthcare provider. In a production system, this step would hand off to an approved provider workflow.</p></div></div><button class="button primary" id="closeDemoBooking">Done</button>`); $('closeDemoBooking').onclick=closeModal; }

function renderAll(){ updateProfileUI(); renderDashboard(); renderMonitoring(); renderMedication(); renderCaregivers(); renderCaregiverPatients(); renderCheckinHistory(); renderAssistantContext(); renderInsightsMeta(); syncApiUI(); syncLargeTextUI(); }



/* v20 two-role account and binding update
   Patient and caregiver views are separated by login account.
   Caregiver can only see colour status for bound patients. */
const V20_ACCOUNTS = [
  { id: 'patient-david', role: 'patient', patientId: 'david', name: 'David Tan', phone: '+65 9123 4567', password: 'carelink123', initials: 'DT' },
  { id: 'patient-mdm-tan', role: 'patient', patientId: 'mdm-tan', name: 'Mdm Tan', phone: '+65 12345678', password: 'carelink456', initials: 'MT', relation: "Rachel Tan's mother" },
  { id: 'caregiver-rachel', role: 'caregiver', caregiverId: 'rachel', name: 'Rachel Tan', phone: '+65 98765432', password: 'carelink789', initials: 'RT' }
];

const V20_PATIENTS = [
  { id: 'david', accountId: 'patient-david', name: 'David Tan', initials: 'DT', relationship: "Rachel Tan's father", status: 'green', label: 'Healthy' },
  { id: 'mdm-tan', accountId: 'patient-mdm-tan', name: 'Mdm Tan', initials: 'MT', relationship: "Rachel Tan's mother", status: 'yellow', label: 'Danger' }
];

const V20_CAREGIVER = { id: 'rachel', accountId: 'caregiver-rachel', name: 'Rachel Tan', initials: 'RT', relation: 'Daughter · Primary caregiver' };
const V20_DEFAULT_BINDINGS = [
  { patientId: 'david', caregiverId: 'rachel' },
  { patientId: 'mdm-tan', caregiverId: 'rachel' }
];
const V20_REGISTERED_ACCOUNTS_KEY = 'carelink_registered_accounts_v20';
const V20_BINDINGS_KEY = 'carelink_bindings_v20';

function getRegisteredAccountsV20() { return getJSON(V20_REGISTERED_ACCOUNTS_KEY, []); }
function setRegisteredAccountsV20(accounts) { setJSON(V20_REGISTERED_ACCOUNTS_KEY, accounts); }
function getAllAccountsV20() { return [...V20_ACCOUNTS, ...getRegisteredAccountsV20()]; }
function accountByIdV20(id) { return getAllAccountsV20().find(a => a.id === id) || null; }
function currentAccountV20() {
  const stored = sessionStorage.getItem(STORE.auth);
  if (!stored) return null;
  if (stored === 'true') return accountByIdV20('patient-david');
  return accountByIdV20(stored) || null;
}
function currentRoleV20() { return currentAccountV20()?.role || 'patient'; }
function currentPatientIdV20() { return currentAccountV20()?.patientId || 'david'; }
function getPatientV20(patientId) {
  const patient = V20_PATIENTS.find(p => p.id === patientId);
  if (patient) return patient;
  const account = getRegisteredAccountsV20().find(a => a.patientId === patientId);
  return account ? { id: account.patientId, accountId: account.id, name: account.name, initials: initialsFromName(account.name), relationship: 'Registered patient', status: 'green', label: 'Healthy' } : null;
}
function allPatientsV20() {
  const registered = getRegisteredAccountsV20()
    .filter(a => a.role === 'patient')
    .map(a => ({ id: a.patientId, accountId: a.id, name: a.name, initials: initialsFromName(a.name), relationship: 'Registered patient', status: 'green', label: 'Healthy' }));
  return [...V20_PATIENTS, ...registered];
}
function getBindingsV20() { return getJSON(V20_BINDINGS_KEY, V20_DEFAULT_BINDINGS); }
function setBindingsV20(bindings) { setJSON(V20_BINDINGS_KEY, bindings); }
function isBoundV20(patientId, caregiverId='rachel') { return getBindingsV20().some(b => b.patientId === patientId && b.caregiverId === caregiverId); }
function bindPatientV20(patientId, caregiverId='rachel') {
  const bindings = getBindingsV20();
  if (!bindings.some(b => b.patientId === patientId && b.caregiverId === caregiverId)) {
    bindings.push({ patientId, caregiverId });
    setBindingsV20(bindings);
  }
}
function unbindPatientV20(patientId, caregiverId='rachel') {
  setBindingsV20(getBindingsV20().filter(b => !(b.patientId === patientId && b.caregiverId === caregiverId)));
}
function setPatientBindingV20(patientId, bound) { bound ? bindPatientV20(patientId) : unbindPatientV20(patientId); }



/* v24 Rachel parents pre-bound migration
   Ensures Rachel Tan's father and mother appear in the caregiver dashboard by default.
   Runs once per v25 browser state so older cached/unbound demo data is repaired, while users can still unbind/rebind during the demo after this migration. */
const V24_RACHEL_PARENTS_BOUND_KEY = 'carelink_rachel_parents_bound_v25';
function ensureRachelParentsBoundV24() {
  if (localStorage.getItem(V24_RACHEL_PARENTS_BOUND_KEY) === 'true') return;
  const required = [
    { patientId: 'david', caregiverId: V20_CAREGIVER.id },
    { patientId: 'mdm-tan', caregiverId: V20_CAREGIVER.id }
  ];
  const bindings = getBindingsV20();
  let changed = false;
  required.forEach(binding => {
    const exists = bindings.some(item => item.patientId === binding.patientId && item.caregiverId === binding.caregiverId);
    if (!exists) {
      bindings.push(binding);
      changed = true;
    }
  });
  if (changed) setBindingsV20(bindings);
  localStorage.setItem(V24_RACHEL_PARENTS_BOUND_KEY, 'true');
}

function isAuthenticated() { return Boolean(currentAccountV20()); }
function getProfile() {
  const account = currentAccountV20();
  if (account) return { name: account.name, phone: account.phone, initials: account.initials || initialsFromName(account.name), role: account.role };
  const fallback = getJSON(STORE.profile, DEFAULT_PROFILE);
  const name = fallback?.name || DEFAULT_PROFILE.name;
  return { name, phone: fallback?.phone || DEFAULT_PROFILE.phone, initials: initialsFromName(name), role: 'patient' };
}

function showApp() {
  if ($('authScreen')) $('authScreen').hidden = true;
  if ($('appShell')) $('appShell').hidden = false;
  applyRoleShellV20();
  updateProfileUI();
  setView(currentRoleV20() === 'caregiver' ? 'caregiver' : 'dashboard');
}

function showAuth(mode='login') {
  setAuthMode(mode);
  if ($('authScreen')) $('authScreen').hidden = false;
  if ($('appShell')) $('appShell').hidden = true;
  document.body.classList.remove('caregiver-mode');
}

function updateProfileUI() {
  const profile = getProfile();
  if ($('profileName')) $('profileName').textContent = profile.name;
  if ($('profileAvatar')) $('profileAvatar').textContent = profile.initials;
  if ($('heroGreeting')) $('heroGreeting').textContent = `Good afternoon, ${profile.name.split(/\s+/)[0] || 'David'}.`;
  document.body.classList.toggle('caregiver-mode', profile.role === 'caregiver');
}

function applyRoleShellV20() {
  const role = currentRoleV20();
  document.body.classList.toggle('caregiver-mode', role === 'caregiver');
  $$('[data-role-nav]').forEach(btn => {
    const scope = btn.dataset.roleNav;
    const visible = scope === role || scope === 'all';
    btn.hidden = !visible;
    btn.classList.toggle('active', false);
  });
  if (role === 'caregiver') {
    $$('.view').forEach(v => v.classList.remove('active'));
    const caregiverView = $('view-caregiver');
    if (caregiverView) caregiverView.classList.add('active');
  }
}

function setView(name) {
  const role = currentRoleV20();
  const target = role === 'caregiver' ? 'caregiver' : (name === 'caregiver' ? 'dashboard' : name);
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-item').forEach(n => {
    const scope = n.dataset.roleNav || 'patient';
    const visible = scope === role || scope === 'all';
    n.hidden = !visible;
    n.classList.toggle('active', visible && n.dataset.view === target);
  });
  const view = $(`view-${target}`);
  if (view) view.classList.add('active');
  const navBtn = document.querySelector(`.nav-item[data-view="${target}"]`);
  const titles = { caregiver: 'Caregiver Dashboard' };
  if ($('pageTitle')) $('pageTitle').textContent = titles[target] || (navBtn ? navBtn.textContent.trim().replace(/^[^A-Za-z]+/, '') : 'CareLink SG');
  if ($('sidebar')) $('sidebar').classList.remove('open');
  if(target==='checkin') renderCheckinHistory();
  if(target==='monitoring') renderMonitoring();
  if(target==='insights') renderInsightsMeta();
  if(target==='medication') renderMedication();
  if(target==='care') renderCaregivers();
  if(target==='caregiver') renderCaregiverPatients();
  if(target==='assistant') renderAssistantContext();
  if(target==='settings') syncApiUI();
  window.scrollTo({top:0, behavior:'smooth'});
}

function loginDemo(e) {
  e.preventDefault();
  const phone = $('loginPhone').value.trim();
  const password = $('loginPassword').value.trim();
  if (!phone || !password) { toast('Enter phone number and password.'); return; }
  const account = getAllAccountsV20().find(a => normalisePhone(a.phone) === normalisePhone(phone) && a.password === password);
  if (!account) { toast('Phone number or password is incorrect.'); return; }
  sessionStorage.setItem(STORE.auth, account.id);
  setProfile({ name: account.name, phone: account.phone });
  showApp();
  renderAll();
  toast(`Logged in as ${account.name}.`);
}

function registerDemo(e) {
  e.preventDefault();
  const name = $('registerName').value.trim() || DEFAULT_PROFILE.name;
  const phone = $('registerPhone').value.trim();
  const password = $('registerPassword').value;
  const confirm = $('registerConfirm').value;
  if (!phone || !password || !confirm) { toast('Complete the registration form.'); return; }
  if (password !== confirm) { toast('Passwords do not match.'); return; }
  if (getAllAccountsV20().some(a => normalisePhone(a.phone) === normalisePhone(phone))) { toast('This phone number is already registered in the demo.'); return; }
  const patientId = `custom-${Date.now()}`;
  const account = { id: `patient-${patientId}`, role: 'patient', patientId, name, phone, password, initials: initialsFromName(name) };
  const accounts = getRegisteredAccountsV20();
  accounts.push(account);
  setRegisteredAccountsV20(accounts);
  sessionStorage.setItem(STORE.auth, account.id);
  setProfile({ name, phone });
  showApp();
  renderAll();
  toast(`Registered and logged in as ${name}.`);
}

function logoutDemo() {
  sessionStorage.removeItem(STORE.auth);
  if ($('loginPassword')) $('loginPassword').value = '';
  if ($('loginPhone')) $('loginPhone').value = '';
  setAuthMode('login');
  showAuth('login');
}

function renderCaregivers() {
  const list = $('caregiverList');
  if (!list) return;
  const patientId = currentPatientIdV20();
  const bound = isBoundV20(patientId);
  const patient = getPatientV20(patientId) || V20_PATIENTS[0];
  if ($('addCaregiverBtn')) $('addCaregiverBtn').textContent = bound ? 'Unbind caregiver' : 'Bind caregiver';
  list.innerHTML = `
    <article class="caregiver-card binding-card ${bound ? 'bound' : 'unbound'}">
      <div class="person-avatar">${esc(V20_CAREGIVER.initials)}</div>
      <div>
        <strong>${esc(V20_CAREGIVER.name)}</strong>
        <span>${esc(V20_CAREGIVER.relation)} · ${bound ? `Bound to ${esc(patient.name)}` : 'Not bound to this patient'}</span>
      </div>
      <button class="button ${bound ? 'danger-outline' : 'secondary'} small" id="togglePatientCaregiverBtn" type="button">${bound ? 'Unbind' : 'Bind'}</button>
    </article>
  `;
  const btn = $('togglePatientCaregiverBtn');
  if (btn) btn.onclick = () => toggleCurrentPatientBindingV20();
  updatePatientCaregiverUIV20();
}

function addCaregiverModal() { toggleCurrentPatientBindingV20(); }
function toggleCurrentPatientBindingV20() {
  const patientId = currentPatientIdV20();
  const bound = isBoundV20(patientId);
  setPatientBindingV20(patientId, !bound);
  renderCaregivers();
  renderCaregiverPatients();
  updatePatientCaregiverUIV20();
  toast(!bound ? 'Rachel Tan has been bound to this patient.' : 'Rachel Tan has been unbound from this patient.');
}

function updatePatientCaregiverUIV20() {
  const patientId = currentPatientIdV20();
  const bound = isBoundV20(patientId);
  const name = bound ? V20_CAREGIVER.name : 'No caregiver bound';
  const initials = bound ? V20_CAREGIVER.initials : '—';
  const relation = bound ? 'Daughter · Primary emergency contact' : 'Bind Rachel Tan in Care Network first';
  if ($('homeCaregiverName')) $('homeCaregiverName').textContent = name;
  if ($('homeCaregiverInitials')) $('homeCaregiverInitials').textContent = initials;
  if ($('homeCaregiverRelation')) $('homeCaregiverRelation').textContent = relation;
  const hold = $('holdEmergencyBtn');
  if (hold) {
    hold.disabled = !bound;
    hold.classList.toggle('disabled', !bound);
    const content = hold.querySelector('.hold-button-content');
    if (content) content.innerHTML = bound ? '<strong>Hold 3 seconds</strong><small>Call emergency contact</small>' : '<strong>Bind caregiver first</strong><small>Emergency call disabled</small>';
  }
  if ($('emergencyStatus')) $('emergencyStatus').textContent = bound ? 'Ready for long-press action.' : 'No emergency caregiver is currently bound.';
}

function renderCaregiverPatients() {
  const list = $('caregiverPatientList');
  if (!list) return;
  const boundPatients = allPatientsV20().filter(patient => isBoundV20(patient.id));
  if (!boundPatients.length) {
    list.innerHTML = '<div class="empty-state">No patients are currently bound to Rachel Tan.</div>';
  } else {
    list.innerHTML = boundPatients.map(patient => `
      <article class="patient-status-card ${esc(patient.status)}">
        <div class="patient-status-avatar">${esc(patient.initials)}</div>
        <div class="patient-status-name"><strong>${esc(patient.name)}</strong><span>${esc(patient.relationship)}</span></div>
        <span class="patient-status-badge ${esc(patient.status)}">${esc(patient.label)}</span>
        <button class="button danger-outline small" data-unbind-patient="${esc(patient.id)}" type="button">Unbind</button>
      </article>
    `).join('');
  }
  renderCaregiverBindListV20();
}

function renderCaregiverBindListV20() {
  const el = $('caregiverBindList');
  if (!el) return;
  const patients = allPatientsV20();
  el.innerHTML = patients.map(patient => {
    const bound = isBoundV20(patient.id);
    return `
      <div class="bind-row">
        <span><strong>${esc(patient.name)}</strong><small>${esc(patient.relationship)}</small></span>
        <button class="button ${bound ? 'danger-outline' : 'secondary'} small" data-${bound ? 'unbind' : 'bind'}-patient="${esc(patient.id)}" type="button">${bound ? 'Unbind' : 'Bind'}</button>
      </div>
    `;
  }).join('');
  $$('[data-bind-patient], [data-unbind-patient]').forEach(btn => {
    btn.onclick = () => {
      const patientId = btn.dataset.bindPatient || btn.dataset.unbindPatient;
      const shouldBind = Boolean(btn.dataset.bindPatient);
      setPatientBindingV20(patientId, shouldBind);
      renderCaregiverPatients();
      if (currentRoleV20() === 'patient') renderCaregivers();
      toast(shouldBind ? 'Patient bound to Rachel Tan.' : 'Patient unbound from Rachel Tan.');
    };
  });
}

function startEmergencyHold(event) {
  if (event) event.preventDefault();
  if (!isBoundV20(currentPatientIdV20())) { toast('Bind Rachel Tan in Care Network before using the emergency contact demo.'); return; }
  const btn = $('holdEmergencyBtn');
  const progress = $('holdProgress');
  if (!btn || !progress || btn.disabled || btn.classList.contains('activated')) return;
  clearTimeout(emergencyHoldTimer);
  clearInterval(emergencyProgressTimer);
  emergencyHoldStarted = Date.now();
  btn.classList.add('holding');
  if ($('emergencyStatus')) $('emergencyStatus').textContent = `Keep holding to call ${V20_CAREGIVER.name}...`;
  emergencyProgressTimer = setInterval(() => {
    const elapsed = Date.now() - emergencyHoldStarted;
    progress.style.width = `${Math.min(100, elapsed / 3000 * 100)}%`;
  }, 40);
  emergencyHoldTimer = setTimeout(triggerEmergencyContact, 3000);
}

function triggerEmergencyContact() {
  clearTimeout(emergencyHoldTimer);
  clearInterval(emergencyProgressTimer);
  const btn = $('holdEmergencyBtn');
  const progress = $('holdProgress');
  if (progress) progress.style.width = '100%';
  if (btn) {
    btn.classList.remove('holding');
    btn.classList.add('activated');
  }
  if ($('emergencyStatus')) $('emergencyStatus').textContent = `Emergency contact call activated: ${V20_CAREGIVER.name}.`;
  toast('Emergency contact call activated in this demo.');
  openModal('Emergency contact', `<div class="insight-summary"><div class="insight-icon">!</div><div><strong>Calling ${esc(V20_CAREGIVER.name)}</strong><p>This classroom prototype has activated the emergency contact flow. A production version would connect to the approved local calling or emergency workflow.</p></div></div><div class="modal-actions"><button class="button secondary" id="resetEmergencyDemo">Reset demo call</button><button class="button primary" id="closeEmergencyModal">Done</button></div>`);
  $('resetEmergencyDemo').onclick = () => { if (btn) btn.classList.remove('activated'); closeModal(); resetEmergencyHold(); updatePatientCaregiverUIV20(); };
  $('closeEmergencyModal').onclick = closeModal;
}

function resetDemoData(){
  setJSON(STORE.readings,DEFAULT_READINGS);
  setJSON(STORE.meds,DEFAULT_MEDS);
  setJSON(STORE.caregivers,DEFAULT_CAREGIVERS);
  setJSON(STORE.week,DEFAULT_WEEK);
  setJSON(STORE.sharing,{bp:true,hr:true,meds:true,sleep:false});
  setJSON(STORE.checkins, DEFAULT_CHECKINS);
  setJSON(V20_BINDINGS_KEY, V20_DEFAULT_BINDINGS);
  localStorage.setItem(STORE.wearable,'false');
  chatHistory=[];
  renderAll();
  toast('Demo data restored.');
}

function renderAll(){
  applyRoleShellV20();
  updateProfileUI();
  if (currentRoleV20() === 'caregiver') {
    renderCaregiverPatients();
    return;
  }
  renderDashboard();
  renderMonitoring();
  renderMedication();
  renderCaregivers();
  renderCheckinHistory();
  renderAssistantContext();
  renderInsightsMeta();
  syncApiUI();
  syncLargeTextUI();
  updatePatientCaregiverUIV20();
}


/* v21 caregiver alert + add-patient update
   - Patient Essential long-press creates a caregiver-side alert.
   - Rachel Tan's caregiver account can add demo patients and bind/unbind them.
   - Avatar initials are visually centred through CSS overrides. */
const V21_CUSTOM_PATIENTS_KEY = 'carelink_custom_patients_v21';
const V21_ALERTS_KEY = 'carelink_emergency_alerts_v21';
const V21_ALERT_SIGNAL_KEY = 'carelink_emergency_alert_signal_v21';

function getCustomPatientsV21() { return getJSON(V21_CUSTOM_PATIENTS_KEY, []); }
function setCustomPatientsV21(patients) { setJSON(V21_CUSTOM_PATIENTS_KEY, patients); }

function statusLabelV21(status) {
  return status === 'red' ? 'Urgent' : status === 'yellow' ? 'Danger' : 'Healthy';
}

function getPatientV20(patientId) {
  return allPatientsV20().find(p => p.id === patientId) || null;
}

function allPatientsV20() {
  const base = V20_PATIENTS.map(p => ({ ...p, source: 'default' }));
  const registered = getRegisteredAccountsV20()
    .filter(a => a.role === 'patient')
    .map(a => ({
      id: a.patientId,
      accountId: a.id,
      name: a.name,
      initials: initialsFromName(a.name),
      relationship: a.relation || 'Registered patient',
      status: a.status || 'green',
      label: statusLabelV21(a.status || 'green'),
      source: 'registered'
    }));
  const custom = getCustomPatientsV21().map(p => ({
    ...p,
    initials: p.initials || initialsFromName(p.name),
    label: p.label || statusLabelV21(p.status),
    source: 'custom'
  }));
  const seen = new Set();
  return [...base, ...registered, ...custom].filter(patient => {
    if (!patient?.id || seen.has(patient.id)) return false;
    seen.add(patient.id);
    return true;
  });
}

function addPatientModalV21() {
  openModal('Add patient', `
    <form id="addPatientForm" class="add-patient-form">
      <label>Patient name
        <input id="newPatientName" required placeholder="e.g. Mr Lim" />
      </label>
      <label>Relationship / context
        <input id="newPatientRelation" required placeholder="e.g. Neighbour, parent, post-discharge patient" />
      </label>
      <label>Current status
        <select id="newPatientStatus">
          <option value="green">Healthy / Green</option>
          <option value="yellow">Danger / Yellow</option>
          <option value="red">Urgent / Red</option>
        </select>
      </label>
      <p class="subtle">This adds a local classroom-demo patient and binds the patient to Rachel Tan automatically.</p>
      <div class="modal-actions">
        <button type="button" class="button secondary" id="cancelModal">Cancel</button>
        <button class="button primary" type="submit">Add and bind</button>
      </div>
    </form>
  `);
  $('cancelModal').onclick = closeModal;
  $('addPatientForm').onsubmit = (e) => {
    e.preventDefault();
    const name = $('newPatientName').value.trim();
    const relationship = $('newPatientRelation').value.trim();
    const status = $('newPatientStatus').value;
    if (!name || !relationship) { toast('Enter patient name and relationship.'); return; }
    const patient = {
      id: `custom-patient-${Date.now()}`,
      accountId: null,
      name,
      initials: initialsFromName(name),
      relationship,
      status,
      label: statusLabelV21(status),
      source: 'custom'
    };
    const custom = getCustomPatientsV21();
    custom.push(patient);
    setCustomPatientsV21(custom);
    bindPatientV20(patient.id);
    closeModal();
    renderCaregiverPatients();
    toast(`${name} added and bound to Rachel Tan.`);
  };
}

function removeCustomPatientV21(patientId) {
  setCustomPatientsV21(getCustomPatientsV21().filter(p => p.id !== patientId));
  setBindingsV20(getBindingsV20().filter(b => b.patientId !== patientId));
  renderCaregiverPatients();
  toast('Demo patient removed.');
}

function getEmergencyAlertsV21() { return getJSON(V21_ALERTS_KEY, []); }
function setEmergencyAlertsV21(alerts) { setJSON(V21_ALERTS_KEY, alerts); }
function pendingEmergencyAlertsV21() { return getEmergencyAlertsV21().filter(a => a.caregiverId === V20_CAREGIVER.id && !a.acknowledged); }

function createEmergencyAlertV21(patientId) {
  const patient = getPatientV20(patientId) || V20_PATIENTS[0];
  const alerts = getEmergencyAlertsV21();
  const alert = {
    id: `alert-${Date.now()}`,
    patientId,
    patientName: patient.name,
    patientInitials: patient.initials,
    caregiverId: V20_CAREGIVER.id,
    type: 'Essential long-press',
    createdAt: new Date().toISOString(),
    acknowledged: false
  };
  alerts.push(alert);
  setEmergencyAlertsV21(alerts);
  localStorage.setItem(V21_ALERT_SIGNAL_KEY, String(Date.now()));
  return alert;
}

function acknowledgeEmergencyAlertV21(alertId) {
  const alerts = getEmergencyAlertsV21().map(a => a.id === alertId ? { ...a, acknowledged: true, acknowledgedAt: new Date().toISOString() } : a);
  setEmergencyAlertsV21(alerts);
}

function showPendingCaregiverAlertV21() {
  if (currentRoleV20() !== 'caregiver') return;
  const modal = $('modalBackdrop');
  if (modal && !modal.hidden) return;
  const alert = pendingEmergencyAlertsV21()[0];
  if (!alert) return;
  openModal('Emergency caregiver alert', `
    <div class="caregiver-alert-modal">
      <div class="insight-summary urgent-alert-summary">
        <div class="insight-icon danger-icon">!</div>
        <div>
          <strong>${esc(alert.patientName)} activated Essential support</strong>
          <p>${esc(alert.patientName)} used the patient-side Essential button. This demo alert appears in Rachel Tan's caregiver account.</p>
        </div>
      </div>
      <div class="alert-detail-grid">
        <div><span>Alert type</span><strong>${esc(alert.type)}</strong></div>
        <div><span>Time</span><strong>${esc(fmtDate(alert.createdAt))}</strong></div>
        <div><span>Suggested action</span><strong>Check the patient and follow the support pathway.</strong></div>
      </div>
      <p class="subtle">Demo only: this is not a real emergency service or clinical monitoring system.</p>
      <div class="modal-actions">
        <button class="button secondary" id="viewAlertPatientsBtn" type="button">View patients</button>
        <button class="button primary" id="ackCaregiverAlertBtn" type="button">Acknowledge alert</button>
      </div>
    </div>
  `);
  $('viewAlertPatientsBtn').onclick = () => { closeModal(); setView('caregiver'); };
  $('ackCaregiverAlertBtn').onclick = () => {
    acknowledgeEmergencyAlertV21(alert.id);
    closeModal();
    renderCaregiverPatients();
    toast('Caregiver alert acknowledged.');
  };
}

function renderCaregiverPatients() {
  const list = $('caregiverPatientList');
  if (!list) return;
  const alerts = pendingEmergencyAlertsV21();
  const alertPatientIds = new Set(alerts.map(a => a.patientId));
  const boundPatients = allPatientsV20().filter(patient => isBoundV20(patient.id));
  if (!boundPatients.length) {
    list.innerHTML = '<div class="empty-state">No patients are currently bound to Rachel Tan.</div>';
  } else {
    list.innerHTML = boundPatients.map(patient => {
      const hasAlert = alertPatientIds.has(patient.id);
      return `
        <article class="patient-status-card ${esc(patient.status)} ${hasAlert ? 'has-alert' : ''}">
          <div class="patient-status-avatar">${esc(patient.initials)}</div>
          <div class="patient-status-name"><strong>${esc(patient.name)}</strong><span>${esc(patient.relationship)}</span></div>
          <span class="patient-status-badge ${esc(patient.status)}">${esc(patient.label)}</span>
          ${hasAlert ? '<span class="patient-alert-pill">Essential alert</span>' : ''}
          <button class="button danger-outline small" data-unbind-patient="${esc(patient.id)}" type="button">Unbind</button>
        </article>
      `;
    }).join('');
  }
  renderCaregiverBindListV20();
  showPendingCaregiverAlertV21();
}

function renderCaregiverBindListV20() {
  const el = $('caregiverBindList');
  if (!el) return;
  const patients = allPatientsV20();
  el.innerHTML = patients.map(patient => {
    const bound = isBoundV20(patient.id);
    const isCustom = patient.source === 'custom';
    return `
      <div class="bind-row ${isCustom ? 'custom-patient-row' : ''}">
        <span><strong>${esc(patient.name)}</strong><small>${esc(patient.relationship)} · ${esc(patient.label)}</small></span>
        <div class="bind-row-actions">
          <button class="button ${bound ? 'danger-outline' : 'secondary'} small" data-${bound ? 'unbind' : 'bind'}-patient="${esc(patient.id)}" type="button">${bound ? 'Unbind' : 'Bind'}</button>
          ${isCustom ? `<button class="text-button danger" data-remove-custom-patient="${esc(patient.id)}" type="button">Remove</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  $$('[data-bind-patient], [data-unbind-patient]').forEach(btn => {
    btn.onclick = () => {
      const patientId = btn.dataset.bindPatient || btn.dataset.unbindPatient;
      const shouldBind = Boolean(btn.dataset.bindPatient);
      setPatientBindingV20(patientId, shouldBind);
      renderCaregiverPatients();
      if (currentRoleV20() === 'patient') renderCaregivers();
      toast(shouldBind ? 'Patient bound to Rachel Tan.' : 'Patient unbound from Rachel Tan.');
    };
  });
  $$('[data-remove-custom-patient]').forEach(btn => {
    btn.onclick = () => removeCustomPatientV21(btn.dataset.removeCustomPatient);
  });
}

function triggerEmergencyContact() {
  clearTimeout(emergencyHoldTimer);
  clearInterval(emergencyProgressTimer);
  const btn = $('holdEmergencyBtn');
  const progress = $('holdProgress');
  if (progress) progress.style.width = '100%';
  if (btn) {
    btn.classList.remove('holding');
    btn.classList.add('activated');
  }
  const alert = createEmergencyAlertV21(currentPatientIdV20());
  if ($('emergencyStatus')) $('emergencyStatus').textContent = `Emergency contact call activated: ${V20_CAREGIVER.name}.`;
  toast('Emergency alert sent to Rachel Tan in this demo.');
  openModal('Emergency contact', `<div class="insight-summary"><div class="insight-icon">!</div><div><strong>Calling ${esc(V20_CAREGIVER.name)}</strong><p>This classroom prototype has activated the emergency contact flow. Rachel Tan will see an emergency alert popup when logged in as caregiver.</p></div></div><div class="alert-detail-grid"><div><span>Patient</span><strong>${esc(alert.patientName)}</strong></div><div><span>Alert</span><strong>Essential long-press</strong></div></div><div class="modal-actions"><button class="button secondary" id="resetEmergencyDemo">Reset demo call</button><button class="button primary" id="closeEmergencyModal">Done</button></div>`);
  $('resetEmergencyDemo').onclick = () => { if (btn) btn.classList.remove('activated'); closeModal(); resetEmergencyHold(); updatePatientCaregiverUIV20(); };
  $('closeEmergencyModal').onclick = closeModal;
}

function resetDemoData(){
  setJSON(STORE.readings,DEFAULT_READINGS);
  setJSON(STORE.meds,DEFAULT_MEDS);
  setJSON(STORE.caregivers,DEFAULT_CAREGIVERS);
  setJSON(STORE.week,DEFAULT_WEEK);
  setJSON(STORE.sharing,{bp:true,hr:true,meds:true,sleep:false});
  setJSON(STORE.checkins, DEFAULT_CHECKINS);
  setJSON(V20_BINDINGS_KEY, V20_DEFAULT_BINDINGS);
  setJSON(V21_CUSTOM_PATIENTS_KEY, []);
  setJSON(V21_ALERTS_KEY, []);
  localStorage.setItem(STORE.wearable,'false');
  chatHistory=[];
  renderAll();
  toast('Demo data restored.');
}

function onCaregiverAlertStorageV21(event) {
  if (event.key === V21_ALERTS_KEY || event.key === V21_ALERT_SIGNAL_KEY) {
    renderCaregiverPatients();
  }
}


/* v22 registration role + patient location alert update
   - Register form can create either a patient account or a caregiver account.
   - Essential alerts show a demo patient location for the caregiver side.
   - Default demo location: JCU, 149 Sim Dr, Singapore 387380. */
const V22_PATIENT_LOCATION = {
  label: 'JCU',
  address: '149 Sim Dr, Singapore 387380'
};

function locationTextV22(location = V22_PATIENT_LOCATION) {
  return `${location.label} · ${location.address}`;
}

function withDefaultLocationV22(patient) {
  if (!patient) return patient;
  return { ...patient, location: patient.location || V22_PATIENT_LOCATION };
}

const getPatientV20BaseV22 = getPatientV20;
function getPatientV20(patientId) {
  const patient = getPatientV20BaseV22(patientId);
  return withDefaultLocationV22(patient);
}

const allPatientsV20BaseV22 = allPatientsV20;
function allPatientsV20() {
  return allPatientsV20BaseV22().map(withDefaultLocationV22);
}

function currentCaregiverV22() {
  const account = currentAccountV20();
  if (account && account.role === 'caregiver') {
    return {
      id: account.caregiverId || V20_CAREGIVER.id,
      accountId: account.id,
      name: account.name,
      initials: account.initials || initialsFromName(account.name),
      relation: account.id === V20_CAREGIVER.accountId ? V20_CAREGIVER.relation : 'Registered caregiver account'
    };
  }
  return V20_CAREGIVER;
}

function registerDemo(e) {
  e.preventDefault();
  const roleInput = document.querySelector('input[name="registerRole"]:checked');
  const role = roleInput ? roleInput.value : 'patient';
  const name = $('registerName').value.trim() || (role === 'caregiver' ? 'Caregiver User' : DEFAULT_PROFILE.name);
  const phone = $('registerPhone').value.trim();
  const password = $('registerPassword').value;
  const confirm = $('registerConfirm').value;
  if (!phone || !password || !confirm) { toast('Complete the registration form.'); return; }
  if (password !== confirm) { toast('Passwords do not match.'); return; }
  if (getAllAccountsV20().some(a => normalisePhone(a.phone) === normalisePhone(phone))) { toast('This phone number is already registered in the demo.'); return; }

  const stamp = Date.now();
  const account = role === 'caregiver'
    ? {
        id: `caregiver-custom-${stamp}`,
        role: 'caregiver',
        caregiverId: `custom-caregiver-${stamp}`,
        name,
        phone,
        password,
        initials: initialsFromName(name)
      }
    : {
        id: `patient-custom-${stamp}`,
        role: 'patient',
        patientId: `custom-patient-${stamp}`,
        name,
        phone,
        password,
        initials: initialsFromName(name),
        location: V22_PATIENT_LOCATION
      };

  const accounts = getRegisteredAccountsV20();
  accounts.push(account);
  setRegisteredAccountsV20(accounts);
  if (role === 'patient') bindPatientV20(account.patientId, V20_CAREGIVER.id);
  sessionStorage.setItem(STORE.auth, account.id);
  setProfile({ name, phone });
  showApp();
  renderAll();
  toast(`Registered and logged in as ${name} (${role}).`);
}

function updateRegisterRoleCardsV22() {
  $$('.role-option').forEach(option => {
    const input = option.querySelector('input');
    option.classList.toggle('selected', Boolean(input && input.checked));
  });
}

function caregiverIdForCurrentViewV22() {
  return currentCaregiverV22().id;
}

function createEmergencyAlertV21(patientId) {
  const patient = getPatientV20(patientId) || withDefaultLocationV22(V20_PATIENTS[0]);
  const alerts = getEmergencyAlertsV21();
  const alert = {
    id: `alert-${Date.now()}`,
    patientId,
    patientName: patient.name,
    patientInitials: patient.initials,
    patientLocation: patient.location || V22_PATIENT_LOCATION,
    caregiverId: V20_CAREGIVER.id,
    type: 'Essential long-press',
    createdAt: new Date().toISOString(),
    acknowledged: false
  };
  alerts.push(alert);
  setEmergencyAlertsV21(alerts);
  localStorage.setItem(V21_ALERT_SIGNAL_KEY, String(Date.now()));
  return alert;
}

function pendingEmergencyAlertsV21() {
  const caregiverId = caregiverIdForCurrentViewV22();
  return getEmergencyAlertsV21().filter(a => a.caregiverId === caregiverId && !a.acknowledged);
}

function showPendingCaregiverAlertV21() {
  if (currentRoleV20() !== 'caregiver') return;
  const modal = $('modalBackdrop');
  if (modal && !modal.hidden) return;
  const alert = pendingEmergencyAlertsV21()[0];
  if (!alert) return;
  const loc = alert.patientLocation || V22_PATIENT_LOCATION;
  openModal('Emergency caregiver alert', `
    <div class="caregiver-alert-modal">
      <div class="insight-summary urgent-alert-summary">
        <div class="insight-icon danger-icon">!</div>
        <div>
          <strong>${esc(alert.patientName)} activated Essential support</strong>
          <p>${esc(alert.patientName)} used the patient-side Essential button. This demo alert appears in the caregiver account.</p>
        </div>
      </div>
      <div class="alert-detail-grid">
        <div><span>Alert type</span><strong>${esc(alert.type)}</strong></div>
        <div><span>Time</span><strong>${esc(fmtDate(alert.createdAt))}</strong></div>
        <div><span>Patient location</span><strong>${esc(locationTextV22(loc))}</strong></div>
        <div><span>Suggested action</span><strong>Check the patient and follow the support pathway.</strong></div>
      </div>
      <p class="subtle">Demo only: this is not a real emergency service, GPS tracker, or clinical monitoring system. The location is a classroom-demo value.</p>
      <div class="modal-actions">
        <button class="button secondary" id="viewAlertPatientsBtn" type="button">View patients</button>
        <button class="button primary" id="ackCaregiverAlertBtn" type="button">Acknowledge alert</button>
      </div>
    </div>
  `);
  $('viewAlertPatientsBtn').onclick = () => { closeModal(); setView('caregiver'); };
  $('ackCaregiverAlertBtn').onclick = () => {
    acknowledgeEmergencyAlertV21(alert.id);
    closeModal();
    renderCaregiverPatients();
    toast('Caregiver alert acknowledged.');
  };
}

function renderCaregiverPatients() {
  const list = $('caregiverPatientList');
  if (!list) return;
  const caregiver = currentCaregiverV22();
  const alerts = pendingEmergencyAlertsV21();
  const alertByPatientId = new Map(alerts.map(a => [a.patientId, a]));
  const boundPatients = allPatientsV20().filter(patient => isBoundV20(patient.id, caregiver.id));
  if (!boundPatients.length) {
    list.innerHTML = `<div class="empty-state">No patients are currently bound to ${esc(caregiver.name)}.</div>`;
  } else {
    list.innerHTML = boundPatients.map(patient => {
      const alert = alertByPatientId.get(patient.id);
      const location = (alert && alert.patientLocation) || patient.location || V22_PATIENT_LOCATION;
      return `
        <article class="patient-status-card ${esc(patient.status)} ${alert ? 'has-alert' : ''}">
          <div class="patient-status-avatar">${esc(patient.initials)}</div>
          <div class="patient-status-name">
            <strong>${esc(patient.name)}</strong>
            <span>${esc(patient.relationship)}</span>
            ${alert ? `<small class="patient-location-line">Location: ${esc(locationTextV22(location))}</small>` : ''}
          </div>
          <span class="patient-status-badge ${esc(patient.status)}">${esc(patient.label)}</span>
          ${alert ? '<span class="patient-alert-pill">Essential alert</span>' : ''}
          <button class="button danger-outline small" data-unbind-patient="${esc(patient.id)}" type="button">Unbind</button>
        </article>
      `;
    }).join('');
  }
  renderCaregiverBindListV20();
  showPendingCaregiverAlertV21();
}

function renderCaregiverBindListV20() {
  const el = $('caregiverBindList');
  if (!el) return;
  const caregiver = currentCaregiverV22();
  const patients = allPatientsV20();
  el.innerHTML = patients.map(patient => {
    const bound = isBoundV20(patient.id, caregiver.id);
    const isCustom = patient.source === 'custom';
    return `
      <div class="bind-row ${isCustom ? 'custom-patient-row' : ''}">
        <span><strong>${esc(patient.name)}</strong><small>${esc(patient.relationship)} · ${esc(patient.label)}</small></span>
        <div class="bind-row-actions">
          <button class="button ${bound ? 'danger-outline' : 'secondary'} small" data-${bound ? 'unbind' : 'bind'}-patient="${esc(patient.id)}" type="button">${bound ? 'Unbind' : 'Bind'}</button>
          ${isCustom ? `<button class="text-button danger" data-remove-custom-patient="${esc(patient.id)}" type="button">Remove</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  $$('[data-bind-patient], [data-unbind-patient]').forEach(btn => {
    btn.onclick = () => {
      const patientId = btn.dataset.bindPatient || btn.dataset.unbindPatient;
      const shouldBind = Boolean(btn.dataset.bindPatient);
      setPatientBindingV20(patientId, shouldBind, caregiver.id);
      renderCaregiverPatients();
      if (currentRoleV20() === 'patient') renderCaregivers();
      toast(shouldBind ? `Patient bound to ${caregiver.name}.` : `Patient unbound from ${caregiver.name}.`);
    };
  });
  $$('[data-remove-custom-patient]').forEach(btn => {
    btn.onclick = () => removeCustomPatientV21(btn.dataset.removeCustomPatient);
  });
}

function addPatientModalV21() {
  const caregiver = currentCaregiverV22();
  openModal('Add patient', `
    <form id="addPatientForm" class="add-patient-form">
      <label>Patient name
        <input id="newPatientName" required placeholder="e.g. Mr Lim" />
      </label>
      <label>Relationship / context
        <input id="newPatientRelation" required placeholder="e.g. Neighbour, parent, post-discharge patient" />
      </label>
      <label>Current status
        <select id="newPatientStatus">
          <option value="green">Healthy / Green</option>
          <option value="yellow">Danger / Yellow</option>
          <option value="red">Urgent / Red</option>
        </select>
      </label>
      <label>Patient location
        <input id="newPatientLocation" value="${esc(locationTextV22())}" />
      </label>
      <p class="subtle">This adds a local classroom-demo patient and binds the patient to ${esc(caregiver.name)} automatically.</p>
      <div class="modal-actions">
        <button type="button" class="button secondary" id="cancelModal">Cancel</button>
        <button class="button primary" type="submit">Add and bind</button>
      </div>
    </form>
  `);
  $('cancelModal').onclick = closeModal;
  $('addPatientForm').onsubmit = (e) => {
    e.preventDefault();
    const name = $('newPatientName').value.trim();
    const relationship = $('newPatientRelation').value.trim();
    const status = $('newPatientStatus').value;
    const locationRaw = $('newPatientLocation').value.trim();
    if (!name || !relationship) { toast('Enter patient name and relationship.'); return; }
    const patient = {
      id: `custom-patient-${Date.now()}`,
      accountId: null,
      name,
      initials: initialsFromName(name),
      relationship,
      status,
      label: statusLabelV21(status),
      source: 'custom',
      location: locationRaw ? { label: locationRaw.split('·')[0]?.trim() || 'Location', address: locationRaw.split('·').slice(1).join('·').trim() || locationRaw } : V22_PATIENT_LOCATION
    };
    const custom = getCustomPatientsV21();
    custom.push(patient);
    setCustomPatientsV21(custom);
    bindPatientV20(patient.id, caregiver.id);
    closeModal();
    renderCaregiverPatients();
    toast(`${name} added and bound to ${caregiver.name}.`);
  };
}

function triggerEmergencyContact() {
  clearTimeout(emergencyHoldTimer);
  clearInterval(emergencyProgressTimer);
  const btn = $('holdEmergencyBtn');
  const progress = $('holdProgress');
  if (progress) progress.style.width = '100%';
  if (btn) {
    btn.classList.remove('holding');
    btn.classList.add('activated');
  }
  const alert = createEmergencyAlertV21(currentPatientIdV20());
  const loc = alert.patientLocation || V22_PATIENT_LOCATION;
  if ($('emergencyStatus')) $('emergencyStatus').textContent = `Emergency contact call activated: ${V20_CAREGIVER.name}.`;
  toast('Emergency alert sent to Rachel Tan in this demo.');
  openModal('Emergency contact', `<div class="insight-summary"><div class="insight-icon">!</div><div><strong>Calling ${esc(V20_CAREGIVER.name)}</strong><p>This classroom prototype has activated the emergency contact flow. Rachel Tan will see an emergency alert popup with the patient location when logged in as caregiver.</p></div></div><div class="alert-detail-grid"><div><span>Patient</span><strong>${esc(alert.patientName)}</strong></div><div><span>Alert</span><strong>Essential long-press</strong></div><div><span>Patient location</span><strong>${esc(locationTextV22(loc))}</strong></div></div><div class="modal-actions"><button class="button secondary" id="resetEmergencyDemo">Reset demo call</button><button class="button primary" id="closeEmergencyModal">Done</button></div>`);
  $('resetEmergencyDemo').onclick = () => { if (btn) btn.classList.remove('activated'); closeModal(); resetEmergencyHold(); updatePatientCaregiverUIV20(); };
  $('closeEmergencyModal').onclick = closeModal;
}

function init(){
  if(!localStorage.getItem(STORE.readings)) setJSON(STORE.readings,DEFAULT_READINGS);
  if(!localStorage.getItem(STORE.meds)) setJSON(STORE.meds,DEFAULT_MEDS);
  if(!localStorage.getItem(STORE.caregivers)) setJSON(STORE.caregivers,DEFAULT_CAREGIVERS);
  if(!localStorage.getItem(STORE.week)) setJSON(STORE.week,DEFAULT_WEEK);
  if(!localStorage.getItem(STORE.sharing)) setJSON(STORE.sharing,{bp:true,hr:true,meds:true,sleep:false});
  if(!localStorage.getItem(STORE.wearable)) localStorage.setItem(STORE.wearable,'false');
  if(!localStorage.getItem(STORE.largeText)) localStorage.setItem(STORE.largeText,'false');
  if(!localStorage.getItem(STORE.profile)) setProfile(DEFAULT_PROFILE);
  if(!localStorage.getItem(STORE.checkins)) setJSON(STORE.checkins, DEFAULT_CHECKINS);
  ensureRachelParentsBoundV24();
  syncLargeTextUI();
  setDefaultReadingTime();

  if ($('loginTab')) $('loginTab').onclick = () => setAuthMode('login');
  if ($('registerTab')) $('registerTab').onclick = () => setAuthMode('register');
  $$('input[name="registerRole"]').forEach(input => input.addEventListener('change', updateRegisterRoleCardsV22));
  updateRegisterRoleCardsV22();
  if ($('loginForm')) $('loginForm').addEventListener('submit', loginDemo);
  if ($('registerForm')) $('registerForm').addEventListener('submit', registerDemo);

  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $$('[data-go]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.go)));
  $$('[data-checkin-mode]').forEach(b=>b.addEventListener('click',()=>setCheckinMode(b.dataset.checkinMode)));
  if ($('checkinForm')) $('checkinForm').addEventListener('submit', runCheckinDecision);
  if ($('loadCheckinDemo')) $('loadCheckinDemo').onclick = loadCheckinDemo;
  if ($('clearCheckinBtn')) $('clearCheckinBtn').onclick = clearCheckinForm;
  if ($('shareSummaryBtn')) $('shareSummaryBtn').onclick = shareSummaryDemo;
  if ($('clearCheckinHistoryBtn')) $('clearCheckinHistoryBtn').onclick = () => { setCheckins([]); renderCheckinHistory(); toast('Check-in history cleared.'); };
  $$('[data-reminder]').forEach(b=>b.addEventListener('click',()=>setFollowupReminder(b.dataset.reminder)));
  $('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');
  $('apiTopBtn').onclick=()=>setView('settings');
  if ($('logoutBtn')) $('logoutBtn').onclick=logoutDemo;
  $('healthForm').addEventListener('submit',addHealthReading);
  $('wearableBtn').onclick=toggleWearable; $('wearableInlineBtn').onclick=toggleWearable;
  $('dashboardAnalyzeBtn').onclick=()=>analyzeHealth('dashboard'); $('analyzeBtn').onclick=()=>analyzeHealth('insights');
  $('seedTrendBtn').onclick=()=>{setJSON(STORE.readings,RISING_BP_READINGS);renderMonitoring();toast('Loaded rising blood-pressure demo scenario.');};
  $('clearReadingsBtn').onclick=()=>{setJSON(STORE.readings,DEFAULT_READINGS);renderMonitoring();toast('Default readings restored.');};
  $('readingsTable').addEventListener('click',e=>{const id=e.target.dataset.deleteReading;if(id)deleteReading(id);});
  $('addMedicationBtn').onclick=addMedicationModal;
  $('medicationList').addEventListener('click',e=>{const tid=e.target.dataset.toggleMed, did=e.target.dataset.deleteMed; if(tid){const meds=getMeds();const m=meds.find(x=>String(x.id)===String(tid));if(m)m.taken=!m.taken;setJSON(STORE.meds,meds);renderMedication();toast('Medication status updated.');} if(did){setJSON(STORE.meds,getMeds().filter(x=>String(x.id)!==String(did)));renderMedication();toast('Medication removed.');}});
  $('addCaregiverBtn').onclick=addCaregiverModal;
  $('caregiverList').addEventListener('click',e=>{const id=e.target.dataset.deleteCare;if(id){setJSON(STORE.caregivers,getCaregivers().filter(x=>String(x.id)!==String(id)));renderCaregivers();toast('Caregiver removed.');}});
  $$('[data-share]').forEach(i=>i.addEventListener('change',()=>{const share={};$$('[data-share]').forEach(x=>share[x.dataset.share]=x.checked);setJSON(STORE.sharing,share);toast('Sharing preferences saved locally.');}));
  $('notifyCaregiverBtn').onclick=()=>toast('Demo alert sent to enabled caregivers.');
  $$('[data-exercise-open]').forEach(b=>b.addEventListener('click',()=>openExerciseGuide(b.dataset.exerciseOpen)));
  $$('.book-demo').forEach(b=>b.onclick=()=>demoBooking(b.dataset.service));
  $('quickPrompts').addEventListener('click',e=>{if(e.target.tagName==='BUTTON')sendChat(e.target.textContent);});
  $('chatForm').addEventListener('submit',e=>{e.preventDefault();sendChat($('chatInput').value);});
  $('connectApiBtn').onclick=connectApi; $('disconnectApiBtn').onclick=disconnectApi;
  $('toggleKeyBtn').onclick=()=>{const input=$('apiKeyInput');const show=input.type==='password';input.type=show?'text':'password';$('toggleKeyBtn').textContent=show?'Hide':'Show';};
  $('resetAllBtn').onclick=resetDemoData;
  if($('largeTextToggle')) $('largeTextToggle').onclick=toggleLargeTextMode;
  setupEmergencyHold();
  if ($('addPatientBtn')) $('addPatientBtn').onclick = addPatientModalV21;
  window.addEventListener('storage', onCaregiverAlertStorageV21);
  $('modalClose').onclick=closeModal; $('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  if (isAuthenticated()) {
    showApp();
    renderAll();
  } else {
    showAuth('login');
  }
}

document.addEventListener('DOMContentLoaded', init);

/* v23 restore patient Care Network layout
   - Patient side returns to the original Care Network style with Rachel Tan and Community Care Team cards.
   - Rachel Tan card still controls the real patient-caregiver binding for the two-role demo.
   - Community Care Team and added supporters remain local demo contacts.
*/
function renderCaregivers() {
  const list = $('caregiverList');
  if (!list) return;
  const patientId = currentPatientIdV20();
  const patient = getPatientV20(patientId) || V20_PATIENTS[0];
  const bound = isBoundV20(patientId, V20_CAREGIVER.id);
  const people = getCaregivers();
  const supportPeople = people.filter(p => String(p.name).toLowerCase() !== 'rachel tan');
  if ($('addCaregiverBtn')) $('addCaregiverBtn').textContent = '+ Add caregiver';
  list.innerHTML = `
    <article class="caregiver-card binding-card ${bound ? 'bound' : 'unbound'}">
      <div class="person-avatar">${esc(V20_CAREGIVER.initials)}</div>
      <div>
        <strong>${esc(V20_CAREGIVER.name)}</strong>
        <span>Daughter · Primary emergency contact · ${bound ? `Bound to ${esc(patient.name)}` : 'Not currently bound'}</span>
      </div>
      <button class="button ${bound ? 'danger-outline' : 'secondary'} small" id="togglePatientCaregiverBtn" type="button">${bound ? 'Unbind' : 'Bind'}</button>
    </article>
    ${supportPeople.map(p => `
      <article class="caregiver-card">
        <div class="person-avatar">${esc(p.initials)}</div>
        <div>
          <strong>${esc(p.name)}</strong>
          <span>${esc(p.relation)} · ${p.alerts ? 'Health alerts enabled' : 'Alerts off'}</span>
        </div>
        <button class="text-button danger" data-delete-care="${esc(p.id)}" type="button">Remove</button>
      </article>
    `).join('')}
  `;
  const toggleBtn = $('togglePatientCaregiverBtn');
  if (toggleBtn) toggleBtn.onclick = () => toggleCurrentPatientBindingV23();
  const share = getJSON(STORE.sharing, { bp: true, hr: true, meds: true, sleep: false });
  $$('[data-share]').forEach(i => i.checked = Boolean(share[i.dataset.share]));
  updatePatientCaregiverUIV20();
}

function toggleCurrentPatientBindingV23() {
  const patientId = currentPatientIdV20();
  const bound = isBoundV20(patientId, V20_CAREGIVER.id);
  setPatientBindingV20(patientId, !bound, V20_CAREGIVER.id);
  renderCaregivers();
  renderCaregiverPatients();
  updatePatientCaregiverUIV20();
  toast(!bound ? 'Rachel Tan has been bound to this patient.' : 'Rachel Tan has been unbound from this patient.');
}

function addCaregiverModal() {
  openModal('Add caregiver', `
    <form id="careForm">
      <label>Name<input id="careName" required placeholder="e.g. Family member"></label>
      <label>Relationship / role<input id="careRole" required placeholder="e.g. Son, caregiver, care coordinator"></label>
      <div class="modal-actions">
        <button type="button" class="button secondary" id="cancelModal">Cancel</button>
        <button class="button primary" type="submit">Add caregiver</button>
      </div>
    </form>
  `);
  $('cancelModal').onclick = closeModal;
  $('careForm').onsubmit = e => {
    e.preventDefault();
    const name = $('careName').value.trim();
    const words = name.split(/\s+/);
    const initials = ((words[0]?.[0] || 'C') + (words[1]?.[0] || '')).toUpperCase();
    const arr = getCaregivers();
    arr.push({ id: Date.now(), name, relation: $('careRole').value.trim(), initials, alerts: true });
    setJSON(STORE.caregivers, arr);
    closeModal();
    renderCaregivers();
    toast('Caregiver added locally.');
  };
}

/* v26 robust Rachel parents binding repair
   Some browsers may keep an old localStorage state where Rachel's parents were unbound
   while the previous migration flag was already marked as complete. This version repairs
   the default binding at render time, while preserving any unbind action made after v26. */
const V26_RACHEL_PARENT_IDS = ['david', 'mdm-tan'];
const V26_PARENT_OPT_OUT_KEY = 'carelink_rachel_parent_opt_out_v26';

function getParentOptOutV26() {
  return getJSON(V26_PARENT_OPT_OUT_KEY, {});
}

function setParentOptOutV26(value) {
  setJSON(V26_PARENT_OPT_OUT_KEY, value || {});
}

function ensureRachelParentsBoundV26() {
  const optOut = getParentOptOutV26();
  const bindings = getBindingsV20();
  let changed = false;
  V26_RACHEL_PARENT_IDS.forEach(patientId => {
    if (optOut[patientId]) return;
    const exists = bindings.some(item => item.patientId === patientId && item.caregiverId === V20_CAREGIVER.id);
    if (!exists) {
      bindings.push({ patientId, caregiverId: V20_CAREGIVER.id });
      changed = true;
    }
  });
  if (changed) setBindingsV20(bindings);
}

function ensureRachelParentsBoundV24() {
  ensureRachelParentsBoundV26();
}

function setPatientBindingV20(patientId, bound, caregiverId = V20_CAREGIVER.id) {
  const optOut = getParentOptOutV26();
  if (caregiverId === V20_CAREGIVER.id && V26_RACHEL_PARENT_IDS.includes(patientId)) {
    if (bound) delete optOut[patientId];
    else optOut[patientId] = true;
    setParentOptOutV26(optOut);
  }
  bound ? bindPatientV20(patientId, caregiverId) : unbindPatientV20(patientId, caregiverId);
}

function renderCaregiverPatients() {
  const list = $('caregiverPatientList');
  if (!list) return;
  const caregiver = currentCaregiverV22();
  if (caregiver.id === V20_CAREGIVER.id) ensureRachelParentsBoundV26();
  const alerts = pendingEmergencyAlertsV21();
  const alertByPatientId = new Map(alerts.map(a => [a.patientId, a]));
  const boundPatients = allPatientsV20().filter(patient => isBoundV20(patient.id, caregiver.id));
  if (!boundPatients.length) {
    list.innerHTML = `<div class="empty-state">No patients are currently bound to ${esc(caregiver.name)}.</div>`;
  } else {
    list.innerHTML = boundPatients.map(patient => {
      const alert = alertByPatientId.get(patient.id);
      const location = (alert && alert.patientLocation) || patient.location || V22_PATIENT_LOCATION;
      return `
        <article class="patient-status-card ${esc(patient.status)} ${alert ? 'has-alert' : ''}">
          <div class="patient-status-avatar">${esc(patient.initials)}</div>
          <div class="patient-status-name">
            <strong>${esc(patient.name)}</strong>
            <span>${esc(patient.relationship)}</span>
            ${alert ? `<small class="patient-location-line">Location: ${esc(locationTextV22(location))}</small>` : ''}
          </div>
          <span class="patient-status-badge ${esc(patient.status)}">${esc(patient.label)}</span>
          ${alert ? '<span class="patient-alert-pill">Essential alert</span>' : ''}
          <button class="button danger-outline small" data-unbind-patient="${esc(patient.id)}" type="button">Unbind</button>
        </article>
      `;
    }).join('');
  }
  renderCaregiverBindListV20();
  showPendingCaregiverAlertV21();
}

function renderCaregiverBindListV20() {
  const el = $('caregiverBindList');
  if (!el) return;
  const caregiver = currentCaregiverV22();
  if (caregiver.id === V20_CAREGIVER.id) ensureRachelParentsBoundV26();
  const patients = allPatientsV20();
  el.innerHTML = patients.map(patient => {
    const bound = isBoundV20(patient.id, caregiver.id);
    const isCustom = patient.source === 'custom';
    return `
      <div class="bind-row ${isCustom ? 'custom-patient-row' : ''}">
        <span><strong>${esc(patient.name)}</strong><small>${esc(patient.relationship)} · ${esc(patient.label)}</small></span>
        <div class="bind-row-actions">
          <button class="button ${bound ? 'danger-outline' : 'secondary'} small" data-${bound ? 'unbind' : 'bind'}-patient="${esc(patient.id)}" type="button">${bound ? 'Unbind' : 'Bind'}</button>
          ${isCustom ? `<button class="text-button danger" data-remove-custom-patient="${esc(patient.id)}" type="button">Remove</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
  $$('[data-bind-patient], [data-unbind-patient]').forEach(btn => {
    btn.onclick = () => {
      const patientId = btn.dataset.bindPatient || btn.dataset.unbindPatient;
      const shouldBind = Boolean(btn.dataset.bindPatient);
      setPatientBindingV20(patientId, shouldBind, caregiver.id);
      renderCaregiverPatients();
      if (currentRoleV20() === 'patient') renderCaregivers();
      toast(shouldBind ? `Patient bound to ${caregiver.name}.` : `Patient unbound from ${caregiver.name}.`);
    };
  });
  $$('[data-remove-custom-patient]').forEach(btn => {
    btn.onclick = () => removeCustomPatientV21(btn.dataset.removeCustomPatient);
  });
}
