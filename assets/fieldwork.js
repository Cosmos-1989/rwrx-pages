(() => {
  const root = document.querySelector('[data-fieldwork]');
  if (!root) return;
  const media = root.dataset.workbench === 'media';
  const storageKey = media ? 'rwrx.media.v1' : 'rwrx.fieldwork.v1';
  const reportName = media ? '媒介研习报告' : '家乡文化调查报告';
  const fields = ['project','question','scope','sampling','interview','observation','agreement','limits'];
  const kinds = media ? ['原始记录','报道转述','调查材料','个人推断'] : ['现场观察','访谈材料','文献材料','个人推断'];
  const status = root.querySelector('[data-fw-status]');
  let dirty = false, nextRecord = 1, nextClaim = 1;
  const say = text => { status.textContent = text; };
  const control = (label, name, value = '', options = null) => {
    const wrapper = document.createElement('label'); wrapper.append(document.createTextNode(label));
    const el = document.createElement(options ? 'select' : 'textarea');
    el.name = name;
    if (options) options.forEach(text => { const option = document.createElement('option'); option.textContent = text; el.append(option); });
    else { el.rows = 2; el.maxLength = 8000; }
    el.value = value; wrapper.append(el); return wrapper;
  };
  function addRow(type, data = {}) {
    const record = type === 'record';
    const id = data.id || (record ? `E${nextRecord++}` : `C${nextClaim++}`);
    if (record) nextRecord = Math.max(nextRecord, Number(id.slice(1)) + 1);
    else nextClaim = Math.max(nextClaim, Number(id.slice(1)) + 1);
    const box = document.createElement('fieldset'); box.dataset.row = type; box.dataset.id = id;
    const legend = document.createElement('legend'); legend.textContent = `${record ? '材料' : '判断'} ${id}`; box.append(legend);
    const specs = record ? [['类型','kind'],['出处与位置（时间、地点、对象代号或文献页码）','source'],['记录内容','content'],['记录条件与可靠性说明','context']] : [['拟作判断','claim'],['依据的材料编号','refs'],['推理过程','reason'],['反例与限定','boundary']];
    specs.forEach(([label,name]) => box.append(control(label,name,data[name] || (name === 'kind' ? kinds[0] : ''),name === 'kind' ? kinds : null)));
    const button = document.createElement('button'); button.type = 'button'; button.textContent = `删除 ${id}`;
    button.addEventListener('click', () => { box.remove(); changed(); }); box.append(button);
    root.querySelector(record ? '[data-fw-records]' : '[data-fw-claims]').append(box);
  }
  function snapshot() {
    const data = {version:1};
    fields.forEach(key => { data[key] = root.querySelector(`[name="${key}"]`).value; });
    ['record','claim'].forEach(type => { data[type + 's'] = Array.from(root.querySelectorAll(`[data-row="${type}"]`), box => {
      const row = {id:box.dataset.id}; box.querySelectorAll('[name]').forEach(el => { row[el.name] = el.value; }); return row;
    }); });
    return data;
  }
  function restore(data) {
    fields.forEach(key => { root.querySelector(`[name="${key}"]`).value = typeof data[key] === 'string' ? data[key] : ''; });
    root.querySelector('[data-fw-records]').replaceChildren(); root.querySelector('[data-fw-claims]').replaceChildren();
    nextRecord = nextClaim = 1;
    (data.records || []).forEach(row => addRow('record', row)); (data.claims || []).forEach(row => addRow('claim', row));
    if (!data.records?.length) addRow('record'); if (!data.claims?.length) addRow('claim');
    check();
  }
  const refs = value => [...new Set((value.toUpperCase().match(/E\d+/g) || []))];
  function check() {
    const data = snapshot(), messages = [];
    if (!data.question.trim() || !data.scope.trim()) messages.push('调查方案：请明确问题与范围。');
    for (const claim of data.claims) {
      if (!claim.claim.trim() && !claim.refs.trim() && !claim.reason.trim()) continue;
      const ids = refs(claim.refs);
      if (!ids.length) messages.push(`${claim.id}：尚未引用材料。`);
      ids.forEach(id => {
        const evidence = data.records.find(row => row.id === id);
        if (!evidence) messages.push(`${claim.id}：${id} 不存在，请核对或补充。`);
        else if (!evidence.content.trim() || !evidence.source.trim()) messages.push(`${claim.id}：${id} 缺少内容或出处。`);
        else if (evidence.kind === '个人推断') messages.push(`${claim.id}：${id} 属于个人推断，还需独立事实材料。`);
      });
      if (!claim.reason.trim()) messages.push(`${claim.id}：请解释材料如何支持判断。`);
      if (!claim.boundary.trim()) messages.push(`${claim.id}：请交代反例或结论范围。`);
    }
    if (!messages.length) messages.push('编号和必要字段已齐备；材料的真实性与推理有效性仍需逐项核查。');
    root.querySelector('[data-fw-check]').replaceChildren(...messages.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
  }
  function changed() { dirty = true; say('有未保存的修改'); check(); }
  root.addEventListener('input', changed); root.addEventListener('change', changed);
  function download(format) {
    const data = snapshot();
    let content;
    if (format === 'json') content = JSON.stringify(data,null,2);
    else {
      const labels = media ? ['项目名称','研究问题或传播任务','范围与时点','受众与材料选择','改写稿或访谈提纲','核查与比较方法','引文、图像与使用约定','未决问题与修订说明'] : ['项目名称','研究问题','调查范围','对象选择与比较','访谈提纲','观察与文献方案','知情与资料使用约定','仍需核实的问题'];
      const blocks = ['# ' + reportName, ...fields.map((key,i) => `## ${labels[i]}\n\n${data[key] || '（待填写）'}`), '## 材料记录'];
      data.records.forEach(r => blocks.push(`### ${r.id} · ${r.kind}\n\n出处：${r.source}\n\n记录：${r.content}\n\n条件与可靠性：${r.context}`));
      blocks.push('## 结论与证据');
      data.claims.forEach(c => blocks.push(`### ${c.id}\n\n判断：${c.claim}\n\n依据：${c.refs}\n\n推理：${c.reason}\n\n反例与限定：${c.boundary}`));
      content = blocks.join('\n\n') + '\n';
    }
    const url = URL.createObjectURL(new Blob([content],{type:format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = `${reportName}.${format === 'json' ? 'json' : 'md'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    say('已导出当前记录');
  }
  root.querySelectorAll('[data-fw-action]').forEach(button => button.addEventListener('click', () => {
    const action = button.dataset.fwAction;
    if (action === 'save') {
      try { localStorage.setItem(storageKey,JSON.stringify(snapshot())); dirty = false; say('已保存到本机浏览器'); } catch { say('浏览器未允许保存；请导出文件保留记录。'); }
    } else if (action === 'clear') {
      if (!window.confirm('清空工作台及本机保存的这份调查记录？请先导出需要保留的内容。')) return;
      try { localStorage.removeItem(storageKey); } catch { /* No stored data can be removed in restricted storage. */ }
      restore({}); dirty = false; say('已清空本次记录');
    } else if (action === 'add-record' || action === 'add-claim') { addRow(action.slice(4)); changed(); }
    else if (action === 'markdown' || action === 'json') download(action);
    else if (action === 'example') {
      const data = snapshot();
      if (fields.some(key => data[key].trim()) || data.records.some(r => r.source || r.content || r.context) || data.claims.some(c => c.claim || c.refs || c.reason || c.boundary)) { say('为保留当前记录，未载入示例；请先导出并清空工作台。'); return; }
      restore(media ? {project:'示例方案：同一招聘启事的两种改写（课堂模拟）',question:'怎样在广播和网络卡片中保持核心事实，并让目标受众明白报名条件？',scope:'仅使用教材第70页模拟招聘材料，尚未正式发布，也不填入真实邮箱。',sampling:'比较广播听众的一次性接收与网络读者的分区浏览；先请两名同学复述要点。',interview:'广播：开头说明岗位与对象，末尾重申截止时间和报名渠道。网络卡片：分列岗位、职责、条件、报名方式和截止时间。两版都保留人数与落款。',observation:'逐项对照原材料，记录复述中遗漏的信息；不把示例设计当成已经证明的传播效果。',agreement:'教材材料用于课堂模拟；使用图片时另核出处和可使用范围。',limits:'示例只提供设计，没有真实访谈数据和传播效果结论。'} : {project:'示例方案：老街早市的使用变化（尚未实施）',question:'不同年龄的居民如何使用老街早市，其说法与现场活动有何异同？',scope:'拟选一条街道、两个工作日和一个周末；仅讨论该场所，不外推至全城。',sampling:'拟邀请不同年龄的居民及店主，记录拒访与未覆盖群体。',interview:'请讲述最近一次来早市的经过。通常何时来？近几年有何变化？能举一个具体例子吗？',observation:'分时段记录活动类型及人流；先统一计数规则，再核对公开历史资料。',agreement:'开始前说明课堂研究用途；询问是否同意记录与匿名引用。',limits:'示例仅为研究设计，尚无实际观察、访谈或调查结论。'}); changed();
    }
  }));
  try {
    const raw = localStorage.getItem(storageKey), saved = raw ? JSON.parse(raw) : null;
    const valid = saved?.version === 1 && Array.isArray(saved.records) && Array.isArray(saved.claims) && saved.records.every(r => /^E\d+$/.test(r.id) && kinds.includes(r.kind)) && saved.claims.every(c => /^C\d+$/.test(c.id));
    restore(valid ? saved : {}); if (valid) say('已恢复本机保存的记录');
  } catch { restore({}); say('未能读取本机记录；仍可填写并导出。'); }
  window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
})();
