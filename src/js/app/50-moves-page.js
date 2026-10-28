/* =======================================================
     动作库
     ======================================================= */
  function renderMoves() {
    movesBody.innerHTML = '<div class="state-loading">加载中…加载动作库</div>';
    setTimeout(() => {
      const all = (window.MOVES && window.MOVES.moves) || [];
      const list = all.filter((m) => {
        if (mvGroup !== '全部' && m.g !== mvGroup) return false;
        if (mvQuery) {
          const q = mvQuery.toLowerCase();
          return (m.n + (m.en || '') + m.g + m.eq + m.p + (m.mus || '')).toLowerCase().includes(q);
        }
        return true;
      });
      if (!list.length) {
        movesBody.innerHTML = `<div class="state-empty">没有匹配「${esc(mvQuery)}」的动作</div>`;
        return;
      }
      let html = '';
      for (const m of list) {
        const cue = (m.cue || []).slice(0, 1).join('；');
        html += `<div class="mcard"><div class="mn">${esc(m.n)}</div>` +
          `<div class="men">${esc(m.en || '')}</div>` +
          `<div class="mtags">${esc(m.g)} · ${esc(m.eq)} · ${esc(m.p)}</div>` +
          (cue ? `<div class="mcue">要点：${esc(cue)}</div>` : '') +
          `<button class="pickBtn" data-move="${esc(m.n)}">练这个</button></div>`;
      }
      movesBody.innerHTML = html;
      movesBody.querySelectorAll('.pickBtn').forEach((b) => b.addEventListener('click', () => {
        pickExercise(b.dataset.move);
        switchTab('train');
        toast('已选 ' + b.dataset.move);
      }));
    }, 30);
  }

  