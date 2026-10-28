/* =======================================================
     训练
     ======================================================= */
  function ensureCur(name) {
    if (!DB.cur) DB.cur = { date: new Date().toISOString(), exercises: [] };
    let ex = DB.cur.exercises[DB.cur.exercises.length - 1];
    if (!ex || ex.name !== name) { ex = { name, sets: [] }; DB.cur.exercises.push(ex); }
    curEx = ex;
    return ex;
  }
  function pickExercise(name) {
    moveSel.value = name;
    ensureCur(name);
    renderTrain();
  }
  function addSet() {
    const name = moveSel.value;
    if (!name) { showTrainMsg('先选一个动作', 'err'); return; }
    const w = parseFloat(wInput.value), r = parseFloat(rInput.value);
    wInput.classList.toggle('invalid', !(w > 0));
    rInput.classList.toggle('invalid', !(r > 0));
    if (!(w > 0) || !(r > 0)) { showTrainMsg('重量和次数都要大于 0', 'err'); return; }
    const ex = ensureCur(name);
    ex.sets.push({ w, r });
    save();
    startRest(restFor(name));
    renderTrain();
    showTrainMsg(`已加第 ${ex.sets.length} 组 · ${w}×${r}`, 'ok');
    // 修复(2026-10-28)：保留本次重量/次数，连续同重量加组无需重填
    wInput.value = String(w); rInput.value = String(r);
    wInput.focus();
  }
  function startRest(sec) {
    restTotal = sec; restRemaining = sec; restRunning = true;
    restBox.hidden = false; skipRestBtn.disabled = false;
    renderRest();
    if (restTimer) clearInterval(restTimer);
    restTimer = setInterval(() => {
      restRemaining--;
      if (restRemaining <= 0) {
        clearInterval(restTimer); restTimer = null; restRunning = false;
        restState.textContent = '休息结束，开始下一组';
        skipRestBtn.disabled = true;
        beep();
        toast('休息结束，开始下一组');
      }
      renderRest();
    }, 1000);
  }
  function skipRest() {
    if (!restRunning) return;
    if (restTimer) { clearInterval(restTimer); restTimer = null; }
    restRunning = false; restBox.hidden = true; skipRestBtn.disabled = true;
    toast('已跳过休息');
  }
  function finishSession() {
    if (!DB.cur || !DB.cur.exercises.length ||
        DB.cur.exercises.every((e) => !e.sets.length)) {
      showTrainMsg('还没有记录，先练一组', 'err'); return;
    }
    const totalSets = DB.cur.exercises.reduce((a, e) => a + e.sets.length, 0);
    DB.sessions.push(DB.cur);
    DB.cur = null; curEx = null;
    if (restTimer) { clearInterval(restTimer); restTimer = null; }
    restRunning = false; restBox.hidden = true; skipRestBtn.disabled = true;
    save();
    renderTrain();
    toast(`已保存 ${totalSets} 组训练`);
    switchTab('stats');
  }
  function showTrainMsg(msg, type) {
    trainMsg.innerHTML = type === 'err'
      ? `<div class="state-error">${esc(msg)}</div>`
      : `<div class="state-empty" style="border-color:#7CFC00;color:#d6ffb0">${esc(msg)}</div>`;
  }
  function renderRest() {
    if (!restRunning) {
      restTime.textContent = '0';
      restState.textContent = restTotal ? `上次休息 ${restTotal}s` : '未开始休息';
      return;
    }
    restTime.textContent = restRemaining;
    restState.textContent = `休息中 · 剩 ${restRemaining}s / 共 ${restTotal}s`;
  }
  function renderTrain() {
    const name = moveSel.value;
    exName.textContent = name ||
      (DB.cur && DB.cur.exercises.length ? DB.cur.exercises[DB.cur.exercises.length - 1].name : '未选择');
    if (name) {
      const rec = restFor(name);
      const opts = [60, 90, 120, 180];
      restChips.innerHTML = opts.map((s) =>
        `<button class="chip ${s === rec ? 'on' : ''}" data-rest="${s}">${s}s</button>`).join('');
      restChips.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
        restChips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c));
        if (restRunning) startRest(+c.dataset.rest);
        else restTotal = +c.dataset.rest;
      }));
    } else { restChips.innerHTML = ''; }

    if (!DB.cur || !DB.cur.exercises.length) {
      setList.innerHTML = '<li class="state-empty" style="border:none">还没有组，录入重量和次数后点「加一组」</li>';
    } else {
      let html = '';
      for (const e of DB.cur.exercises) {
        html += `<li style="border:none;font-size:12px;color:#9a9ab0">${esc(e.name)} · ${e.sets.length} 组</li>`;
        e.sets.forEach((s, i) => { html += `<li><span>#${i + 1}</span><span>${s.w} kg × ${s.r}</span></li>`; });
      }
      setList.innerHTML = html;
    }
    renderRest();
  }

  