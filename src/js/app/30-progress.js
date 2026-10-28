/* =======================================================
     进度
     ======================================================= */
  function renderStats() {
    if (!DB.sessions.length) {
      statsBody.innerHTML = '<div class="state-empty">还没有记录，去「训练」页练一组吧</div>';
      return;
    }
    const map = {};
    let weekVol = 0;
    const now = Date.now(), weekAgo = now - 7 * 864e5;
    for (const s of DB.sessions) {
      const sd = new Date(s.date).getTime();
      if (!isNaN(sd) && sd >= weekAgo) weekVol += GROW.sessionVolume(s);
      for (const e of s.exercises) {
        const m = map[e.name] || (map[e.name] = { name: e.name, sets: 0, lastW: 0, lastR: 0, vol: 0 });
        m.sets += e.sets.length;
        const last = e.sets[e.sets.length - 1];
        if (last) { m.lastW = last.w; m.lastR = last.r; }
        m.vol += e.sets.reduce((a, x) => a + GROW.setVolume(x.w, x.r), 0);
      }
    }
    let html = `<div class="spread"><span class="meta">已完成训练</span><span class="big-num">${DB.sessions.length}</span></div>`;
    html += `<div class="spread"><span class="meta">近 7 天容量</span><span class="big-num">${weekVol} kg</span></div>`;
    const names = Object.keys(map);
    if (!names.length) { html += '<div class="state-empty">动作记录为空</div>'; }
    for (const k of names) {
      const m = map[k];
      const adv = m.lastW ? `上次 ${m.lastW}×${m.lastR}，下次试试加 2.5–5kg 或 +1 次` : '开始你的第一次';
      html += `<div class="excard"><div class="nm">${esc(m.name)}</div>` +
        `<div class="meta">累计 ${m.sets} 组 · 容量 ${m.vol} kg</div>` +
        `<div class="adv">建议：${esc(adv)}</div></div>`;
    }
    statsBody.innerHTML = html;
  }

  