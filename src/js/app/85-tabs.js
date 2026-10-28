/* =======================================================
     Tab 切换
     ======================================================= */
  function switchTab(name) {
    CUR_TAB = name;
    document.querySelectorAll('section.tab').forEach((s) => s.classList.toggle('on', s.id === 'tab-' + name));
    document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    if (name === 'stats') renderStats();
    if (name === 'grow') renderGrow();
    if (name === 'moves') renderMoves();
    if (name === 'body') renderBody();
    if (name === 'train') renderTrain();
  }

  