/* =======================================================
     身体数据（真实 BMI / BMR / 每日消耗）
     ======================================================= */
  function renderBody() {
    const p = DB.profile || {};
    if (p.sex) sexSel.value = p.sex;
    if (p.age) ageInput.value = p.age;
    if (p.h) hInput.value = p.h;
    if (p.w) wBodyInput.value = p.w;
    if (p.act) actSel.value = String(p.act);
    if (p.h && p.w) computeBody(true);
  }
  function computeBody(silent) {
    const sex = sexSel.value, age = +ageInput.value, h = +hInput.value, w = +wBodyInput.value, act = +actSel.value;
    [hInput, wBodyInput, ageInput].forEach((i) => i.classList.remove('invalid'));
    let bad = false;
    if (!(h >= 100 && h <= 250)) { hInput.classList.add('invalid'); bad = true; }
    if (!(w >= 30 && w <= 300)) { wBodyInput.classList.add('invalid'); bad = true; }
    if (!(age >= 10 && age <= 120)) { ageInput.classList.add('invalid'); bad = true; }
    if (bad) {
      bodyMsg.innerHTML = '<div class="state-error">身高需在 100–250cm、体重 30–300kg、年龄 10–120 之间</div>';
      bodyMetrics.innerHTML = '';
      return;
    }
    const bmi = w / Math.pow(h / 100, 2);
    const lo = 18.5 * Math.pow(h / 100, 2), hi = 24 * Math.pow(h / 100, 2);
    const bmr = sex === 'm' ? (10 * w + 6.25 * h - 5 * age + 5) : (10 * w + 6.25 * h - 5 * age - 161);
    const tdee = bmr * act;
    const cat = bmi < 18.5 ? '偏瘦' : (bmi < 24 ? '正常' : (bmi < 28 ? '超重' : '肥胖'));
    const advice = cat === '偏瘦' ? '热量盈余 +300 kcal' : (cat === '正常' ? '维持当前' : '先控体脂再谈增肌');
    DB.profile = { sex, age, h, w, act };
    save();
    if (!silent) toast('已保存并计算');
    bodyMsg.innerHTML = '<div class="state-empty" style="border-color:#7CFC00;color:#d6ffb0">已保存 · ' + cat + '（' + advice + '）</div>';
    bodyMetrics.innerHTML =
      `<div class="metric"><div class="k">BMI</div><div class="v">${bmi.toFixed(1)} ${cat}</div></div>` +
      `<div class="metric"><div class="k">理想体重</div><div class="v">${lo.toFixed(0)}–${hi.toFixed(0)}kg</div></div>` +
      `<div class="metric"><div class="k">基础代谢 BMR</div><div class="v">${Math.round(bmr)} kcal</div></div>` +
      `<div class="metric"><div class="k">每日消耗</div><div class="v">${Math.round(tdee)} kcal</div></div>`;
  }

  