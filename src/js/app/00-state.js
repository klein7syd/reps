const KEY = 'reps.v2';
  const $ = (id) => document.getElementById(id);

  /* ---------- 状态 ---------- */
  let DB, CUR_TAB = 'train';
  let restTimer = null, restRemaining = 0, restTotal = 0, restRunning = false, curEx = null;
  let mvGroup = '全部', mvQuery = '';
  let audioEl = null, audioObjURL = null, audioTimer = null;

  // 消除浏览器自动请求 /favicon.ico 导致的 404（内联空图标，不产生网络请求）
  (function () {
    var l = document.createElement('link');
    l.rel = 'icon'; l.href = 'data:,';
    document.head.appendChild(l);
  })();

  // DOM 句柄（init 时赋值）
  let moveSel, exName, restChips, wInput, rInput, addSetBtn, skipRestBtn,
      restBox, restTime, restState, setList, trainMsg,
      statsBody, growBody, petBody, dataMsg, exportBtn, importBtn, importFile,
      movesBody, groupFilter, moveSearch,
      sexSel, ageInput, hInput, wBodyInput, actSel, saveBodyBtn, bodyMsg, bodyMetrics,
      audioBar, audioName, playBtn, seek, audioTime, bondMsg, audioFile, audioMsg, today;

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  let toastTimer = null;
  function toast(msg, err) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'toast' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 2600);
  }
  function fmt(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  }
  function petFace(name) {
    return ({ '石灵': '🪨', '炭精': '🔥', '火尾狐': '🦊', '雷纹豹': '⚡', '墨麒麟': '🐉', '金乌': '🦅' })[name] || '🪨';
  }

  /* ---------- 存储（逐字段校验，坏字段单独回退，不丢整份） ---------- */
  function defDB() { return { sessions: [], cur: null, pet: { qi: 0, fed: 0, exp: 0 }, musicBond: {}, profile: {} }; }
  function validSession(s) {
    return s && typeof s === 'object' && Array.isArray(s.exercises) &&
      s.exercises.every((e) => e && typeof e === 'object' && Array.isArray(e.sets));
  }
  function sanitizeSession(s) {
    const ex = (s.exercises || []).filter((e) => e && Array.isArray(e.sets))
      .map((e) => ({ name: e.name, sets: e.sets.filter((x) => x && (x.w > 0 || x.r > 0)).map((x) => ({ w: +x.w || 0, r: +x.r || 0 })) }));
    return { date: s.date || new Date().toISOString(), exercises: ex };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defDB();
      const d = JSON.parse(raw);
      const db = defDB();
      if (d && Array.isArray(d.sessions)) db.sessions = d.sessions.filter(validSession).map(sanitizeSession);
      if (d && d.cur && typeof d.cur === 'object') db.cur = sanitizeSession(d.cur);
      if (d && d.pet && typeof d.pet === 'object') db.pet = Object.assign({ qi: 0, fed: 0, exp: 0 }, d.pet);
      if (d && d.musicBond && typeof d.musicBond === 'object') db.musicBond = d.musicBond;
      if (d && d.profile && typeof d.profile === 'object') db.profile = Object.assign({}, d.profile);
      return db;
    } catch (e) { return defDB(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(DB)); }
    catch (e) { toast('浏览器不让存数据，请用「导出数据」备份', true); }
  }

  /* ---------- 组间休息档位（按动作真实定档） ---------- */
  function restFor(name) {
    if (/深蹲/.test(name)) return 180;
    if (/卧推/.test(name)) return 120;
    if (/侧平举/.test(name)) return 90;
    if (/弯举/.test(name)) return 60;
    return 120;
  }

  