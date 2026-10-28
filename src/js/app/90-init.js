/* =======================================================
     初始化
     ======================================================= */
  function init() {
    DB = load();

    // 动作下拉
    moveSel = $('moveSel');
    const opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '— 选择动作 —';
    moveSel.appendChild(opt0);
    const allMoves = (window.MOVES && window.MOVES.moves) || [];
    for (const m of allMoves) {
      const o = document.createElement('option'); o.value = m.n; o.textContent = m.n;
      moveSel.appendChild(o);
    }

    // 部位筛选
    groupFilter = $('groupFilter');
    const groups = ['全部'].concat((window.MOVES && window.MOVES.groups) || []);
    groupFilter.innerHTML = groups.map((g) =>
      `<button class="chip ${g === '全部' ? 'on' : ''}" data-g="${esc(g)}">${esc(g)}</button>`).join('');
    groupFilter.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
      mvGroup = c.dataset.g;
      groupFilter.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c));
      renderMoves();
    }));

    // 其余句柄
    exName = $('exName'); restChips = $('restChips');
    wInput = $('wInput'); rInput = $('rInput');
    addSetBtn = $('addSetBtn'); skipRestBtn = $('skipRestBtn');
    restBox = $('restBox'); restTime = $('restTime'); restState = $('restState');
    setList = $('setList'); trainMsg = $('trainMsg');
    statsBody = $('statsBody'); growBody = $('growBody'); petBody = $('petBody');
    dataMsg = $('dataMsg'); exportBtn = $('exportBtn'); importBtn = $('importBtn'); importFile = $('importFile');
    movesBody = $('movesBody'); moveSearch = $('moveSearch');
    sexSel = $('sexSel'); ageInput = $('ageInput'); hInput = $('hInput');
    wBodyInput = $('wBodyInput'); actSel = $('actSel'); saveBodyBtn = $('saveBodyBtn');
    bodyMsg = $('bodyMsg'); bodyMetrics = $('bodyMetrics');
    audioBar = $('audioBar'); audioName = $('audioName'); playBtn = $('playBtn');
    seek = $('seek'); audioTime = $('audioTime'); bondMsg = $('bondMsg');
    audioFile = $('audioFile'); audioMsg = $('audioMsg'); today = $('today');

    today.textContent = new Date().toLocaleDateString('zh-CN');

    // 事件
    moveSel.addEventListener('change', () => { if (moveSel.value) pickExercise(moveSel.value); });
    addSetBtn.addEventListener('click', addSet);
    skipRestBtn.addEventListener('click', skipRest);
    finishBtn0().addEventListener('click', finishSession);
    playBtn.addEventListener('click', playPause);
    audioFile.addEventListener('change', onAudioFile);
    seek.addEventListener('input', onSeek);
    saveBodyBtn.addEventListener('click', () => computeBody(false));
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', onImportFile);
    moveSearch.addEventListener('input', () => { mvQuery = moveSearch.value.trim(); renderMoves(); });
    document.querySelectorAll('nav.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && restRunning) skipRest(); });

    switchTab('train');
    renderTrain();
  }
  function finishBtn0() { return $('finishBtn'); }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
