(() => {
  const citeMap = new Map();
  let nextCite = 1;
  let bibEntries = [];

  async function fetchBib(url) {
    const res = await fetch(url);
    const text = await res.text();
    return parseBib(text);
  }

  function parseBib(src) {
    const entries = [];
    const items = src.split('@').slice(1);
    for (const entry of items) {
      const [typeAndKey, ...rest] = entry.split('\n');
      const [type, key] = typeAndKey.split('{');
      const fields = {};
      const body = rest.join('\n').split('}')[0];
      for (const line of body.split('\n')) {
        const m = line.match(/^\s*(\w+)\s*=\s*[{"](.+)[}"],?\s*$/);
        if (m) fields[m[1].toLowerCase()] = m[2];
      }
      entries.push({ key: key.trim(), type: type.trim(), fields });
    }
    return entries;
  }

  function formatIEEE(entry, n) {
    const f = entry.fields;
    const authors = f.author?.replace(/ and /g, ', ') ?? 'Unknown';
    const title = f.title ? `“${f.title}”` : '';
    const journal = f.journal ?? f.booktitle ?? '';
    const year = f.year ?? '';
    return `[${n}] ${authors}, ${title}, ${journal}, ${year}.`;
  }

  async function processBibCell(cell) {
    const m = cell.textContent.match(/@bibliography\s+url="([^"]+)"/);
    if (!m) return;
    const url = m[1];
    bibEntries = await fetchBib(url);
    const bibMap = Object.fromEntries(bibEntries.map(e => [e.key, e]));
    const bibDiv = document.createElement('div');
    bibEntries.forEach(entry => {
      const key = entry.key;
      const n = citeMap.get(key);
      if (!n) return;
      const p = document.createElement('p');
      p.id = `bib-${key}`;
      p.innerHTML = formatIEEE(entry, n);
      bibDiv.appendChild(p);
    });
    cell.innerHTML = '';
    cell.appendChild(bibDiv);
  }

  function processCitations() {
    document.querySelectorAll('.text_cell_render, .jp-RenderedHTMLCommon').forEach(cell => {
      const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, null, false);
      const changes = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.textContent;
        const re = /#cite:([A-Za-z0-9:_\-]+)(!?)/g;
        let m, last = 0;
        const frag = document.createDocumentFragment();
        while ((m = re.exec(text)) !== null) {
          const [full, key, bang] = m;
          const n = citeMap.has(key) ? citeMap.get(key) : (() => {
            citeMap.set(key, nextCite);
            return nextCite++;
          })();
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
          const a = document.createElement('a');
          a.href = `#bib-${key}`;
          a.textContent = bang === '!' ? `${n}` : `[${n}]`;
          frag.appendChild(a);
          last = m.index + full.length;
        }
        if (last > 0) {
          frag.appendChild(document.createTextNode(text.slice(last)));
          changes.push([node, frag]);
        }
      }
      changes.forEach(([n, f]) => n.parentNode.replaceChild(f, n));
    });
  }

  function refresh() {
    processCitations();
    const bibCell = [...document.querySelectorAll('.text_cell_render, .jp-RenderedHTMLCommon')]
      .find(cell => /@bibliography\s+url=/.test(cell.textContent));
    if (bibCell) processBibCell(bibCell);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refresh);
  } else {
    refresh();
  }

  if (typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(() => refresh());
    obs.observe(document.body, { childList: true, subtree: true });
  }
})();
