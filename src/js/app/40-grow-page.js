/* =======================================================
     成长 + 灵兽
     ======================================================= */
  function renderGrow() {
    const s = GROW.summary(DB, Date.now());
    growBody.innerHTML =
      `<div class="spread"><span class="meta">总容量</span><span class="big-num">${s.tonnageText}</span></div>` +
      `<div class="spread"><span class="meta">境界</span><span class="big-num">${s.realm.icon} ${s.realm.name}</span></div>` +
      (s.realm.next
        ? `<div class="meta">距 ${s.realm.next} 还差 ${s.realm.remain} 吨</div><div class="bar-track"><div class="bar-fill" style="width:${s.realm.pct}%"></div></div>`
        : '<div class="meta">已达最高境界</div>') +
      `<div class="spread"><span class="meta">修为等级</span><span class="big-num">Lv.${s.level.level}</span></div>` +
      `<div class="spread"><span class="meta">连续训练</span><span>${s.streak.days} 天 · 本周 ${s.streak.thisWeek} 次</span></div>`;

    const pet = GROW.petMoodWith(DB, DB.pet, Date.now());
    petBody.innerHTML =
      `<div class="pet"><div class="face">${petFace(s.form.name)}</div>` +
      `<div class="pname">${s.form.name}</div>` +
      `<div class="pmood">${esc(s.form.desc)}</div>` +
      `<div class="pmood">心情：${esc(pet.mood)} · 今日陪伴 ${pet.bond || 0}</div></div>`;
  }

  