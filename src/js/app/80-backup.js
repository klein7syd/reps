/* =======================================================
     数据备份（导出 / 导入 JSON）
     ======================================================= */
  function exportData() {
    dataMsg.innerHTML = '<div class="state-loading">导出中…</div>';
    setTimeout(() => {
      const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'reps-data.json';
      a.click();
      URL.revokeObjectURL(a.href);
      dataMsg.innerHTML = '<div class="state-empty" style="border-color:#7CFC00;color:#d6ffb0">已导出 reps-data.json</div>';
    }, 30);
  }
  function onImportFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    dataMsg.innerHTML = '<div class="state-loading">导入中…正在解析</div>';
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.sessions)) throw new Error('缺少 sessions 字段');
        DB = Object.assign(defDB(), d);
        save();
        renderGrow(); renderStats();
        dataMsg.innerHTML = `<div class="state-empty" style="border-color:#7CFC00;color:#d6ffb0">已导入 ${DB.sessions.length} 次训练</div>`;
      } catch (err) {
        dataMsg.innerHTML = '<div class="state-error">导入失败：' + esc(err.message) + '</div>';
      }
    };
    rd.onerror = () => { dataMsg.innerHTML = '<div class="state-error">读取文件失败</div>'; };
    rd.readAsText(f);
  }

  