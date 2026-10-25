/* The static outline remains available if data or browser storage is unavailable. */
(() => {
  'use strict';

  function initialize() {
    const root = document.getElementById('literary-types-map');
    const source = document.getElementById('literary-types-data');
    if (!root || !source || root.dataset.typeMapReady === 'true') return;

    const ui = {};
    for (const name of ['diagram', 'root', 'branches', 'children', 'connectors',
      'current', 'detail-title', 'definition', 'tags', 'examples', 'relations']) {
      ui[name] = root.querySelector(`.type-${name}`);
      if (!ui[name]) return;
    }

    let data;
    try { data = JSON.parse(source.textContent); } catch { return; }
    if (!Array.isArray(data.branches) || !data.branches.length) return;

    const index = new Map();
    const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
    function addNode(node, parent, branch, path) {
      if (!node || typeof node.id !== 'string' || !idPattern.test(node.id) ||
          typeof node.name !== 'string' || index.has(node.id)) throw new Error('Invalid type node');
      const entry = { node, parent, branch, path: [...path, node.name] };
      index.set(node.id, entry);
      if (node.children !== undefined && !Array.isArray(node.children)) throw new Error('Invalid children');
      (node.children || []).forEach(child => addNode(child, node.id, branch, entry.path));
    }
    try {
      data.branches.forEach(node => addNode(node, null, node.id, []));
    } catch { return; }

    const storageKey = 'rwrx.literary-types-map.v1';
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(storageKey)); } catch { /* Optional state. */ }
    const validId = id => typeof id === 'string' && index.has(id);
    function hashId() {
      if (!location.hash.startsWith('#type-')) return null;
      try {
        const id = decodeURIComponent(location.hash.slice(6));
        return validId(id) ? id : null;
      } catch { return null; }
    }

    const initialHash = hashId();
    let selectedId = initialHash || (validId(saved?.selectedId) ? saved.selectedId : null) ||
      (validId(data.defaultNode) ? data.defaultNode : data.branches[0].id);
    let branchId = index.get(selectedId).branch;
    const initialOpen = Array.isArray(saved?.openIds) ? saved.openIds :
      (Array.isArray(data.defaultOpen) ? data.defaultOpen : []);
    const openIds = new Set(initialOpen.filter(id => validId(id) && index.get(id).node.children?.length));
    const elements = new Map();
    let renderedBranch = null;
    let frame = 0;
    let printing = false;

    function element(tag, className, text) {
      const el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = String(text);
      return el;
    }

    function safeLink(value, text) {
      if (typeof value !== 'string' || !value.trim()) return element('span', '', text);
      try {
        const url = new URL(value, document.baseURI);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') return element('span', '', text);
        const link = element('a', '', text);
        link.href = url.href;
        return link;
      } catch { return element('span', '', text); }
    }

    function remember() {
      if (printing) return;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          selectedId, branchId, openIds: [...openIds]
        }));
      } catch { /* Reading and navigation do not require storage. */ }
    }

    function replaceHash() {
      const hash = `#type-${encodeURIComponent(selectedId)}`;
      if (location.hash === hash) return;
      try {
        history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
      } catch { /* Embedded or sandboxed readers may restrict history. */ }
    }

    function revealAncestors(id) {
      let parent = index.get(id)?.parent;
      while (parent) {
        if (parent !== branchId) openIds.add(parent);
        parent = index.get(parent)?.parent;
      }
    }

    function renderDetail() {
      const entry = index.get(selectedId);
      const node = entry.node;
      ui.current.textContent = entry.path.join(' › ');
      ui['detail-title'].textContent = node.name;
      ui.definition.textContent = node.definition || '';
      const tasks = Array.isArray(node.tasks) ? node.tasks.filter(value => typeof value === 'string') : [];
      ui.tags.textContent = tasks.length ? `作答任务　${tasks.join(' · ')}` : '';
      ui.tags.hidden = !tasks.length;
      ui.examples.replaceChildren();
      (Array.isArray(node.examples) ? node.examples : []).forEach(example => {
        if (!example || typeof example !== 'object') return;
        const card = element('div', 'type-example');
        const links = element('div', 'type-example-links');
        const title = example.title ? `《${example.title}》` : '例题';
        const label = example.questionLabel ? ` · ${example.questionLabel}` : '';
        links.append(safeLink(example.url, `${title}${label}`));
        if (example.answerUrl) {
          links.append(safeLink(example.answerUrl, '题解'));
        }
        card.append(links);
        if (example.prompt) card.append(element('blockquote', 'type-prompt', example.prompt));
        if (example.note) card.append(element('p', 'type-example-note', example.note));
        ui.examples.append(card);
      });
      ui.relations.replaceChildren();
      const related = Array.isArray(node.related) ? node.related : [];
      if (related.length) {
        ui.relations.append(element('span', '', '关联题型　'));
        related.forEach((value, position) => {
          if (position) ui.relations.append(document.createTextNode(' · '));
          const id = typeof value === 'object' && value ? value.id : value;
          const entry = validId(id) ? index.get(id) : null;
          if (entry) {
            const link = element('a', '', entry.node.name);
            link.href = `#type-${encodeURIComponent(id)}`;
            link.addEventListener('click', event => {
              if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              select(id, { focus: true, scroll: true });
            });
            ui.relations.append(link);
          } else {
            const text = typeof value === 'string' ? value : value?.name;
            if (text) ui.relations.append(document.createTextNode(text));
          }
        });
      }
      ui.relations.hidden = !related.length;
      for (const [id, target] of elements) {
        // Site anchor navigation temporarily makes targets programmatically focusable.
        // Native controls already support focus and must stay in the Tab sequence.
        target.removeAttribute('tabindex');
        const isBranch = target.hasAttribute('data-branch');
        const active = isBranch ? id === branchId : id === selectedId;
        target.dataset.selected = String(active);
        if (target.tagName === 'BUTTON') target.setAttribute('aria-pressed', String(active));
        else if (id === selectedId) target.setAttribute('aria-current', 'true');
        else target.removeAttribute('aria-current');
      }
    }

    function renderNode(node, depth = 0) {
      const wrapper = element('div', depth ? 'type-descendant' : 'type-child');
      if (!depth) wrapper.dataset.connector = node.id;
      const hasChildren = Boolean(node.children?.length);
      const control = element(hasChildren ? 'summary' : 'button', 'type-node', node.name);
      control.id = `type-${node.id}`;
      control.dataset.typeNode = node.id;
      elements.set(node.id, control);
      if (hasChildren) {
        const details = element('details', 'type-disclosure');
        details.dataset.typeDisclosure = node.id;
        details.open = openIds.has(node.id);
        const group = element('div', 'type-grandchildren');
        node.children.forEach(child => group.append(renderNode(child, depth + 1)));
        details.append(control, group);
        control.addEventListener('click', () => select(node.id));
        details.addEventListener('toggle', () => {
          if (!details.isConnected || printing) return;
          if (details.open) openIds.add(node.id);
          else openIds.delete(node.id);
          remember();
          scheduleDraw();
        });
        wrapper.append(details);
      } else {
        control.type = 'button';
        control.addEventListener('click', () => select(node.id));
        wrapper.append(control);
      }
      return wrapper;
    }

    function renderBranch() {
      if (renderedBranch !== branchId) {
        for (const [id, target] of elements) {
          if (!target.hasAttribute('data-branch')) elements.delete(id);
        }
        ui.children.replaceChildren();
        (index.get(branchId).node.children || []).forEach(node => ui.children.append(renderNode(node)));
        renderedBranch = branchId;
      }
      ui.children.setAttribute('aria-label', `${index.get(branchId).node.name}的细分题型`);
      ui.children.querySelectorAll('details[data-type-disclosure]').forEach(details => {
        details.open = openIds.has(details.dataset.typeDisclosure);
      });
      renderDetail();
      scheduleDraw();
    }

    function select(id, { save = true, hash = true, focus = false, scroll = false } = {}) {
      if (!validId(id)) return;
      selectedId = id;
      branchId = index.get(id).branch;
      revealAncestors(id);
      renderBranch();
      if (save) remember();
      if (hash) replaceHash();
      if (focus || scroll) requestAnimationFrame(() => {
        const target = elements.get(id);
        if (!target) return;
        if (focus) target.focus({ preventScroll: true });
        if (scroll) target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    }

    function scheduleDraw() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    }

    function draw() {
      const bounds = ui.diagram.getBoundingClientRect();
      if (!bounds.width || !bounds.height || printing) return;
      ui.connectors.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
      ui.connectors.replaceChildren();
      const box = el => {
        const rect = el.getBoundingClientRect();
        return { l: rect.left - bounds.left, r: rect.right - bounds.left,
          t: rect.top - bounds.top, b: rect.bottom - bounds.top,
          x: (rect.left + rect.right) / 2 - bounds.left,
          y: (rect.top + rect.bottom) / 2 - bounds.top };
      };
      const path = value => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('d', value);
        ui.connectors.append(line);
      };
      const origin = box(ui.root);
      const buttons = [...ui.branches.querySelectorAll('button[data-branch]')];
      if (!buttons.length) return;
      const first = box(buttons[0]);
      const stacked = origin.b <= first.t;
      if (stacked) {
        const bus = Math.max(2, first.l - 10);
        buttons.forEach(button => {
          const to = box(button);
          path(`M ${origin.x} ${origin.b} V ${origin.b + 12} H ${bus} V ${to.y} H ${to.l}`);
        });
      } else {
        const bus = (origin.r + first.l) / 2;
        buttons.forEach(button => {
          const to = box(button);
          path(`M ${origin.r} ${origin.y} H ${bus} V ${to.y} H ${to.l}`);
        });
      }
      const from = box(elements.get(branchId));
      for (const child of ui.children.children) {
        const target = child.querySelector('summary, button');
        if (!target) continue;
        const to = box(target);
        const bus = (from.r + to.l) / 2;
        path(`M ${from.r} ${from.y} H ${bus} V ${to.y} H ${to.l}`);
      }
    }

    ui.branches.replaceChildren();
    data.branches.forEach(node => {
      const button = element('button', 'type-branch', node.name);
      button.type = 'button';
      button.id = `type-${node.id}`;
      button.dataset.branch = node.id;
      button.dataset.typeNode = node.id;
      button.addEventListener('click', () => select(node.id));
      ui.branches.append(button);
      elements.set(node.id, button);
    });
    ui.branches.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...ui.branches.querySelectorAll('button')];
      const position = buttons.indexOf(event.target);
      if (position < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 :
        (position + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
    });

    select(selectedId, { save: false, hash: false });
    root.querySelectorAll('.type-interactive').forEach(el => { el.hidden = false; });
    if (root.classList.contains('type-interactive')) root.hidden = false;
    root.dataset.typeMapReady = 'true';
    const outline = root.querySelector('details.type-full-outline');
    if (outline && !location.hash.startsWith('#outline-')) outline.open = false;
    remember();
    scheduleDraw();
    if (initialHash) requestAnimationFrame(() => elements.get(initialHash)?.scrollIntoView({ block: 'nearest' }));
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(scheduleDraw).observe(ui.diagram);
    window.addEventListener('resize', scheduleDraw);
    document.fonts?.ready.then(scheduleDraw);
    window.addEventListener('hashchange', () => {
      const id = hashId();
      if (id) select(id, { hash: false, scroll: true });
    });
    // site.js expands native details for printing. Do not save that temporary state.
    window.addEventListener('beforeprint', () => { printing = true; });
    window.addEventListener('afterprint', () => {
      ui.children.querySelectorAll('details[data-type-disclosure]').forEach(details => {
        details.open = openIds.has(details.dataset.typeDisclosure);
      });
      printing = false;
      scheduleDraw();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
