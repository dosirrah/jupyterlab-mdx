// xr.ts (inside src/ directory of your extension)

// A label comes in one of two forms.   It is either a member of the global
// enumeration or it is a membr of a named enumeration.   If it has the form
// @foo then it is the member "foo" of the global enumeration.   If it has the form
// @bar:foo then it is the member "foo" of the named enumeration with name "bar".
const labelMap = new Map<string, { name: string | null; id: string; n: number }>();
const enumCounters = new Map<string, number>();

// TAGGABLE is a reference to the \tag command in LaTex.  It is used to
// number equations.  Currently only do this for the 'eq' but we may
// add other predefined namespaces.
const TAGGABLE_NAMES = new Set(['eq']);

console.log("Loaded xr.ts module");

/**
 * Converts an optional enumeration name and ID to a fully qualified key.
 * @param name - The enumeration name (e.g. "eq", "fig"), or null for global.
 * @param id - The specific label ID.
 * @returns A composite string key like "eq:foo" or "foo".
 */
function toId(name: string | null, id: string): string {
  return name ? `${name}:${id}` : id;
}

function formatLabel(name: string | null, n: number | string, raw = false): string {
  if (name && TAGGABLE_NAMES.has(name.toLowerCase())) {
    return raw ? `${n}` : `(${n})`;
  }
  return raw ? `${n}` : name ? `${name} ${n}` : `${n}`;
}

/**
 * Walks the DOM looking for TEXT_NODEs and finding labels.
 * It increment and then assigns an integer to each label thereby
 * creating an enumeration.
 *
 * It also supports named enumerations.
 */
export function scanLabels(): void {
  labelMap.clear();
  enumCounters.clear();
  let count : number = 0;

  console.log("scanLabels");

  document.querySelectorAll('.text_cell_render, .jp-RenderedHTMLCommon').forEach(cell => {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      count++;
      console.log("walker processed " + count + " nodes.");
      const node = walker.currentNode;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node as Text).data;
        const re = /@([A-Za-z]+:)?([A-Za-z0-9:_\-]+)/g;
        let m;

        while ((m = re.exec(text)) !== null) {
          const enumName = m[1];
          const id = m[2];
          const name = enumName ? enumName.slice(0, -1) : null;
          const key = toId(name, id);

          if (!labelMap.has(key)) {
            const counterKey = name ?? '_global';
            const n = (enumCounters.get(counterKey) ?? 0) + 1;
            enumCounters.set(counterKey, n);
            labelMap.set(key, { name, id, n });
          }
        }
      }
    }
  });
}


function rewriteText(textNode: Text): void {
  const re = /(@|#)([A-Za-z]+:)?([A-Za-z0-9:_\-]+)(!?)/g;
  const data = textNode.data;
  const frag = document.createDocumentFragment();
  let last = 0, m;

  while ((m = re.exec(data)) !== null) {
    const [full, sym, enumName, id, bang] = m;
    const name = enumName ? enumName.slice(0, -1) : null;
    const key = toId(name, id);
    const entry = labelMap.get(key);

    frag.appendChild(document.createTextNode(data.slice(last, m.index)));
    last = m.index + full.length;

    if (sym === '@') {
      const n = entry?.n ?? '??';
      const span = document.createElement('span');
      span.innerHTML = `<a id="${toId(name, id)}">${n}</a>` +
        `<span style="display:none">\\label{${toId(name, id)}}</span>`;
      frag.appendChild(span);
    }

    if (sym === '#') {
      const n = entry?.n ?? '??';
      const label = formatLabel(entry?.name ?? name, n, bang === '!');
      const a = document.createElement('a');
      a.href = `#${toId(entry?.name ?? name, id)}`;
      a.textContent = label;
      frag.appendChild(a);
    }
  }

  frag.appendChild(document.createTextNode(data.slice(last)));
  textNode.parentNode?.replaceChild(frag, textNode);
}

function walk(node: Node): void {
  // recurisively finds the text nodes and calls rewriteText on them.
  if (node.nodeType === Node.TEXT_NODE) {
    rewriteText(node as Text);
  } else {
    node.childNodes.forEach(walk);
  }
}

export function rewriteAll(): void {

  // For jupyter classic, .text_cell_render refers to cells that are
  // <div class="text_cell_render">.  The div contains the renereded
  // HTML.
  //
  // jupyter lab. renders the markdown to a
  // <div class="jp-RenderedHTMLCommon jp-RenderedMarkdown">
  
  document.querySelectorAll('.text_cell_render, .jp-RenderedHTMLCommon').forEach(walk);

  if ((window as any).MathJax?.typesetPromise) { // MathJax v3.
    (window as any).MathJax.typesetPromise();
  } else if ((window as any).MathJax?.Hub?.Queue) {  // MathJax v2.
    (window as any).MathJax.Hub.Queue(['Typeset', (window as any).MathJax.Hub]);
  }
}

let isProcessing = false;

export function processAll(): void {
  console.log("processAll isProcessing=" + isProcessing);
  if (isProcessing) return;  // Prevent recursion

  isProcessing = true;
  try {
    scanLabels();
    rewriteAll();
  } finally {
    isProcessing = false;  // Ensure flag is cleared even if an error occurs
  }
}


export {
  labelMap,
  enumCounters,
  toId,
  formatLabel
};