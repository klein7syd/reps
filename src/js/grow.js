<script>/* =========================================================
   REPS 成长系统  ——  修为 / 境界 / 灵气 / 宠物
   ---------------------------------------------------------
   设计原则（跟着项目铁律走）：
   1. 所有数值从真实训练记录算出来，不编造
   2. 只升不降：断更不会掉级、宠物不会饿死
      —— 这是陪伴型养成，不是绑架型的每日签到
   3. 纯函数，不依赖 DOM，方便单测
   ========================================================= */

const GROW = (() => {

  /* ---------- 基础换算 ---------- */

  // 单组容量：重量 × 次数
  const setVolume = (w, r) => (Number(w) || 0) * (Number(r) || 0);

  // 一次训练的容量
  function sessionVolume(s) {
    if (!s || !Array.isArray(s.exercises)) return 0;
    return s.exercises.reduce((sum, e) => {
      if (!Array.isArray(e.sets)) return sum;
      return sum + e.sets.reduce((a, x) => a + setVolume(x.w, x.r), 0);
    }, 0);
  }

  // 累计总容量（吨），只算已完成训练
  function totalTonnage(DB) {
    const list = (DB && DB.sessions) || [];
    const kg = list.reduce((a, s) => a + sessionVolume(s), 0);
    return kg / 1000;
  }

  /* ---------- 境界 ----------
     参考修仙体系，但门槛按真实训练量定：
     一个认真练的人一年大约 150-300 吨，
     所以最高境界留到多年以后才够得着，不让人一个月就"毕业"。
  */
  const REALMS = [
    { name: '凡人',   need: 0,    icon: '·' },
    { name: '练气',   need: 20,   icon: '气' },
    { name: '筑基',   need: 60,   icon: '基' },
    { name: '金丹',   need: 150,  icon: '丹' },
    { name: '元婴',   need: 300,  icon: '婴' },
    { name: '化神',   need: 550,  icon: '神' },
    { name: '炼虚',   need: 900,  icon: '虚' },
    { name: '合体',   need: 1400, icon: '合' },
    { name: '大乘',   need: 2100, icon: '乘' },
    { name: '渡劫',   need: 3000, icon: '劫' }
  ];

  function realmOf(tonnage) {
    let idx = 0;
    for (let i = 0; i < REALMS.length; i++) {
      if (tonnage >= REALMS[i].need) idx = i;
    }
    const cur = REALMS[idx];
    const next = REALMS[idx + 1] || null;
    const span = next ? (next.need - cur.need) : 0;
    const done = next ? (tonnage - cur.need) : 1;
    const pct = next ? Math.max(0, Math.min(100, (done / span) * 100)) : 100;

    return {
      index: idx,
      name: cur.name,
      icon: cur.icon,
      next: next ? next.name : null,
      nextNeed: next ? next.need : null,
      // 到下一个境界还差多少吨
      remain: next ? Math.max(0, next.need - tonnage) : 0,
      pct
    };
  }

  /* ---------- 修为等级 ----------
     每 5 吨一级，不封顶。境界有尽头，修为没有，
     这样练到后面仍然能看到数字在涨。
  */
  const LEVEL_STEP = 5;

  function levelOf(tonnage) {
    const level = Math.floor(tonnage / LEVEL_STEP) + 1;
    const into = tonnage % LEVEL_STEP;
    return {
      level,
      into,
      need: LEVEL_STEP,
      pct: (into / LEVEL_STEP) * 100,
      remain: LEVEL_STEP - into
    };
  }

  /* ---------- 灵气 ----------
     灵气由"这次训练的相对表现"产出：
     基础 10 点 + 容量折算，一次高质量训练约 30-60 点。
     灵气是消耗品，用来养宠物。
  */
  function qiFromSession(s) {
    const vol = sessionVolume(s);
    if (vol <= 0) return 0;
    return Math.round(10 + vol / 150);
  }

  /* ---------- 连续训练 ----------
     只用于展示，不参与惩罚。断更不清零宠物。
  */
  function streak(DB) {
    const list = ((DB && DB.sessions) || [])
      .map(s => new Date(s.date).setHours(0, 0, 0, 0))
      .filter(t => !isNaN(t));
    if (!list.length) return { days: 0, thisWeek: 0 };

    const uniq = [...new Set(list)].sort((a, b) => b - a);
    const day = 864e5;
    const today = new Date().setHours(0, 0, 0, 0);

    // 今天或昨天有训练才开始算连续
    if (today - uniq[0] > day * 1.5) {
      return { days: 0, thisWeek: countThisWeek(uniq, today) };
    }

    let days = 1;
    for (let i = 1; i < uniq.length; i++) {
      if (uniq[i - 1] - uniq[i] <= day * 1.5) days++;
      else break;
    }
    return { days, thisWeek: countThisWeek(uniq, today) };
  }

  function countThisWeek(tsList, today) {
    // 从本周一起算 7 天
    const d = new Date(today);
    const dow = (d.getDay() + 6) % 7;       // 周一=0
    const monday = today - dow * 864e5;
    return tsList.filter(t => t >= monday && t <= today).length;
  }

  /* ---------- 宠物 ----------
     形态随"修为等级"进化，吃的灵气来自由训练兑换。
     关键：饿了只是状态差，不会死、不会掉形态。
  */
  const PET_FORMS = [
    { minLevel: 1,  name: '石灵',   desc: '一块会跟着你喘气的小石头' },
    { minLevel: 5,  name: '炭精',   desc: '吸收了些热量，开始发光' },
    { minLevel: 12, name: '火尾狐', desc: '尾巴上有火苗，跑得很快' },
    { minLevel: 22, name: '雷纹豹', desc: '身上有电纹，蹲下会噼啪响' },
    { minLevel: 35, name: '墨麒麟', desc: '据说只认练得狠的人' },
    { minLevel: 50, name: '金乌',   desc: '它已经不需要你喂了，只是还想待着' }
  ];

  function petFormOf(level) {
    let f = PET_FORMS[0];
    for (const x of PET_FORMS) if (level >= x.minLevel) f = x;
    return f;
  }

  // 宠物状态：由"当前灵气 / 上次喂食至今"决定，但永不为负
  function petState(pet, now) {
    const p = pet || { qi: 0, fed: 0, exp: 0 };
    const qi = Math.max(0, p.qi || 0);
    const daysSinceFed = p.fed ? Math.floor((now - p.fed) / 864e5) : 999;

    let mood = '平静';
    if (qi >= 100) mood = '亢奋';
    else if (qi >= 40) mood = '有精神';
    else if (qi <= 5) mood = '有点闷';

    return {
      qi,
      mood,
      hungry: qi < 20,
      daysSinceFed,
      // 永远不会低于 0，也不会因为饿而降形态
      exp: Math.max(0, p.exp || 0)
    };
  }

  /* ---------- 汇总 ---------- */
  function summary(DB, now) {
    const t = totalTonnage(DB);
    const realm = realmOf(t);
    const level = levelOf(t);
    const st = streak(DB);
    const pet = petState(DB && DB.pet, now || Date.now());
    const form = petFormOf(level.level);

    return {
      tonnage: t,
      tonnageText: t >= 1000 ? (t / 1000).toFixed(2) + ' 千吨' : t.toFixed(1) + ' 吨',
      realm, level, streak: st, pet, form,
      totalSessions: ((DB && DB.sessions) || []).length
    };
  }
  /* =========================================================
     音乐通感  ——  听歌也能养灵兽
     ---------------------------------------------------------
     规则（和用户定过的）：
     1. **只进宠物，不进修为**。修为/境界只能靠真实吨位，
        练出来的是身体，听歌换不来。这条不能松。
     2. **每日封顶 60 分钟**。超过的部分只记录时长、不产资源，
        放一晚循环不会把数值刷爆。
     3. 训练中听比平时听值钱（3 倍）—— 边练边听本来就该更值。
     4. 产出的是「陪伴值」，不是灵气。灵气是训练专用的货币，
        两种来源混在一个池子里会让"灵气不够就少练点"变成
        "灵气不够就多听点歌"，那就本末倒置了。
     ========================================================= */

  const MUSIC_DAILY_CAP_SEC = 60 * 60;   // 每日计入的播放时长上限
  const MUSIC_QI_PER_MIN    = 1.2;       // 每分钟基础陪伴值
  const MUSIC_TRAIN_MULT    = 3;         // 训练中听的倍率

  // yyyy-mm-dd（本地时区），当作每日封顶的桶
  function dayKey(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  /* 算这一批播放该给多少陪伴值。
     entry = { day, seconds, training }   seconds 是「本次新增的秒数」
     usedToday = 这一天已经计入过的秒数（不含本次）
     返回 { counted, wasted, bond } —— wasted 是被日封顶吃掉的部分 */
  function musicBond(entry, usedToday) {
    const sec = Math.max(0, Number(entry && entry.seconds) || 0);
    const used = Math.max(0, Number(usedToday) || 0);
    const room = Math.max(0, MUSIC_DAILY_CAP_SEC - used);
    const counted = Math.min(sec, room);
    const wasted = sec - counted;

    const mult = (entry && entry.training) ? MUSIC_TRAIN_MULT : 1;
    // 先乘倍率再按分钟折算；不足一分钟也按比例给，别把小段丢掉
    const bond = (counted / 60) * MUSIC_QI_PER_MIN * mult;

    return {
      counted,
      wasted,
      bond: Math.round(bond * 10) / 10      // 保留一位小数，前端好显示
    };
  }

  /* 这一天还能听多久才封顶 */
  function musicRoomLeft(usedToday) {
    return Math.max(0, MUSIC_DAILY_CAP_SEC - Math.max(0, Number(usedToday) || 0));
  }

  /* 把一次播放写进 DB（就地修改）。返回本次结算结果，
     前端拿它弹提示：「+2.4 陪伴值 · 今日还剩 41 分钟」 */
  function addMusicListen(DB, opts) {
    if (!DB) return null;
    const now = (opts && opts.now) || Date.now();
    const key = dayKey(now);

    if (!DB.musicBond) DB.musicBond = { total: 0, days: {}, lifetimeSec: 0 };
    if (!DB.musicBond.days) DB.musicBond.days = {};

    const days = DB.musicBond.days;
    const day = days[key] || (days[key] = { sec: 0, bond: 0, trainSec: 0 });

    const r = musicBond(
      { seconds: opts && opts.seconds, training: opts && opts.training },
      day.sec
    );

    day.sec += r.counted;
    day.bond += r.bond;
    if (opts && opts.training) day.trainSec += r.counted;

    DB.musicBond.total = Math.round((DB.musicBond.total + r.bond) * 10) / 10;
    DB.musicBond.lifetimeSec += r.counted;

    return Object.assign({ day: key, usedToday: day.sec, roomLeft: musicRoomLeft(day.sec) }, r);
  }

  /* 某一天的播放统计，给界面用 */
  function musicToday(DB, now) {
    const key = dayKey(now || Date.now());
    const day = (DB && DB.musicBond && DB.musicBond.days && DB.musicBond.days[key]) || null;
    const total = (DB && DB.musicBond && DB.musicBond.total) || 0;
    return {
      day: key,
      sec: day ? day.sec : 0,
      bond: day ? Math.round(day.bond * 10) / 10 : 0,
      trainSec: day ? day.trainSec : 0,
      total: Math.round(total * 10) / 10,
      capSec: MUSIC_DAILY_CAP_SEC,
      roomLeft: musicRoomLeft(day ? day.sec : 0),
      capped: !!day && day.sec >= MUSIC_DAILY_CAP_SEC
    };
  }

  /* 陪伴值参与宠物状态：影响心情，但不改形态。
     形态仍然只由修为等级决定 —— 不然听歌能进化，训练就没意义了。 */
  function petMoodWith(DB, pet, now) {
    const base = petState(pet, now);
    const m = musicToday(DB, now);

    /* 心情四档：亢奋 > 有精神 > 平静 > 有点闷。
       陪伴值越高，心情下限越高 —— 而不是只在「平静」上做加法。
       原来的写法只处理平静/有精神，导致灵气为 0 的宠物即使
       听满一小时也还是「有点闷」，那听歌就白听了。 */
    const LEVELS = ['有点闷', '平静', '有精神', '亢奋'];
    const bondFloor = m.bond >= 40 ? 2      // 听得多，至少「有精神」
                    : m.bond >= 12 ? 1      // 听了一会儿，至少「平静」
                    : 0;
    const baseIdx = Math.max(0, LEVELS.indexOf(base.mood));
    const idx = Math.min(LEVELS.length - 1, Math.max(baseIdx, bondFloor));

    base.mood = LEVELS[idx];
    base.bond = m.bond;
    base.bondTotal = m.total;
    return base;
  }

  return {
    setVolume, sessionVolume, totalTonnage,
    REALMS, LEVEL_STEP, PET_FORMS,
    realmOf, levelOf, qiFromSession, streak, petFormOf, petState, summary,
    MUSIC_DAILY_CAP_SEC, MUSIC_QI_PER_MIN, MUSIC_TRAIN_MULT,
    dayKey, musicBond, musicRoomLeft, addMusicListen, musicToday, petMoodWith
  };
})();

// Node 单测用；浏览器里 module 未定义，跳过
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = GROW;
} else if (typeof window !== 'undefined') {
  window.GROW = GROW;   // 同时挂到 window，便于外部访问与调试
}
</script>
