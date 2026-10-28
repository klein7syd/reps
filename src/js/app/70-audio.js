/* =======================================================
     音乐（导入本地音频，真实播放 + 真实陪伴值累计）
     ======================================================= */
  let actx = null;
  function beep() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const o = actx.createOscillator(), g = actx.createGain();
      o.connect(g); g.connect(actx.destination); o.type = 'square'; o.frequency.value = 880;
      const t0 = actx.currentTime;
      g.gain.setValueAtTime(0.001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
      o.start(); o.stop(t0 + 0.26);
    } catch (e) { /* 自动播放限制下静默失败，不影响主流程 */ }
  }
  function onAudioFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    audioMsg.innerHTML = '<div class="state-loading">加载中…正在读取文件</div>';
    if (audioObjURL) URL.revokeObjectURL(audioObjURL);
    audioObjURL = URL.createObjectURL(f);
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.addEventListener('timeupdate', onTime);
      audioEl.addEventListener('ended', onEnded);
      audioEl.addEventListener('error', () => {
        audioMsg.innerHTML = '<div class="state-error">无法播放该文件，请换一个音频格式（mp3/wav/ogg）</div>';
      });
    }
    audioEl.src = audioObjURL;
    audioName.textContent = f.name;
    audioBar.classList.add('on');
    audioEl.load();
    audioEl.addEventListener('loadedmetadata', () => {
      seek.max = Math.floor(audioEl.duration) || 100;
      audioMsg.innerHTML = '';
    }, { once: true });
  }
  function playPause() {
    if (!audioEl || !audioEl.src) { audioMsg.innerHTML = '<div class="state-error">请先导入一首本地音乐</div>'; return; }
    if (audioEl.paused) {
      audioEl.play().then(() => {
        playBtn.textContent = '❚❚ 暂停';
        if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
        if (actx && actx.state === 'suspended') actx.resume();
        startAccrue();
      }).catch(() => {
        audioMsg.innerHTML = '<div class="state-error">播放失败（浏览器可能限制了自动播放，请再点一次）</div>';
      });
    } else {
      pauseAccrue(); audioEl.pause(); playBtn.textContent = '▶ 播放';
    }
  }
  function startAccrue() {
    if (audioTimer) clearInterval(audioTimer);
    audioTimer = setInterval(() => {
      if (audioEl && !audioEl.paused) {
        const r = GROW.addMusicListen(DB, { seconds: 1, training: !!restRunning, now: Date.now() });
        if (r && r.wasted > 0) bondMsg.textContent = '今日陪伴已封顶（60 分钟），多听不再计入';
        else bondMsg.textContent = '陪伴值 +' + (r ? r.bond : 0) + ' · 今日已听 ' + GROW.musicToday(DB).sec + 's';
        save();
      }
    }, 1000);
  }
  function pauseAccrue() { if (audioTimer) { clearInterval(audioTimer); audioTimer = null; } }
  function onTime() {
    if (!audioEl || !audioEl.duration) return;
    seek.value = Math.floor(audioEl.currentTime);
    audioTime.textContent = fmt(audioEl.currentTime) + ' / ' + fmt(audioEl.duration);
  }
  function onSeek() { if (audioEl && audioEl.duration) audioEl.currentTime = +seek.value; }
  function onEnded() { playBtn.textContent = '▶ 播放'; pauseAccrue(); }

  