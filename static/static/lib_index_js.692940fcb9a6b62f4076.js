"use strict";
(self["webpackChunkjupyterlab_mdx"] = self["webpackChunkjupyterlab_mdx"] || []).push([["lib_index_js"],{

/***/ "./lib/index.js":
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _xr__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./xr */ "./lib/xr.js");

 // Your main label processing logic
const plugin = {
    id: 'jupyterlab-mdx',
    autoStart: true,
    requires: [_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_0__.INotebookTracker],
    activate: (app, tracker) => {
        console.log('JupyterLab extension jupyterlab-mdx is activated!');
        const wireCell = (cell) => {
            var _a;
            if (((_a = cell.model) === null || _a === void 0 ? void 0 : _a.type) !== 'markdown' || cell._mdxWired)
                return;
            cell._mdxWired = true;
            // Only call processAll after user-initiated rendering
            cell.renderedChanged.connect(() => {
                if (cell.rendered) {
                    console.log("jupyterlab-mdx: Cell re-rendered → processAll()");
                    (0,_xr__WEBPACK_IMPORTED_MODULE_1__.processAll)(tracker);
                }
            });
        };
        const hookNotebook = (panel) => {
            var _a;
            console.log("jupyterlab-mdx: Notebook widget added");
            panel.content.widgets.forEach(wireCell);
            (_a = panel.content.model) === null || _a === void 0 ? void 0 : _a.cells.changed.connect(() => {
                panel.content.widgets.forEach(wireCell);
            });
            // Wait until all markdown cells are rendered before processing
            const promises = panel.content.widgets.map((cell) => {
                var _a;
                wireCell(cell);
                if (((_a = cell.model) === null || _a === void 0 ? void 0 : _a.type) !== 'markdown')
                    return Promise.resolve();
                const mdCell = cell;
                return mdCell.rendered
                    ? Promise.resolve()
                    : new Promise(resolve => {
                        const onRendered = () => {
                            mdCell.renderedChanged.disconnect(onRendered);
                            resolve();
                        };
                        mdCell.renderedChanged.connect(onRendered);
                    });
            });
            Promise.all(promises).then(() => {
                console.log("jupyterlab-mdx: All markdown cells rendered. Delaying to run processAll.");
                // HACK.  I need to find a better way to handle this.   Even though
                // this doesn't happen until all the promises have completed, there
                // is still a race condition if I call processAll immediately
                // wherein the DOM has not yet populated when processAll
                // is called and thus there are no text nodes to update markdown
                // so I wait a bit.  Arggg....
                setTimeout(() => {
                    console.log("jupyterlab-mdx: Delayed processAll running now");
                    (0,_xr__WEBPACK_IMPORTED_MODULE_1__.processAll)(tracker);
                }, 100); // You can increase to 50–100 ms if needed
            });
        };
        // Wire up already open notebook
        if (tracker.currentWidget) {
            hookNotebook(tracker.currentWidget);
        }
        // Wire up future notebooks
        tracker.widgetAdded.connect((_, panel) => {
            hookNotebook(panel);
        });
    }
};
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (plugin);


/***/ }),

/***/ "./lib/xr.js":
/*!*******************!*\
  !*** ./lib/xr.js ***!
  \*******************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   enumCounters: () => (/* binding */ enumCounters),
/* harmony export */   formatLabel: () => (/* binding */ formatLabel),
/* harmony export */   labelMap: () => (/* binding */ labelMap),
/* harmony export */   processAll: () => (/* binding */ processAll),
/* harmony export */   rewriteAll: () => (/* binding */ rewriteAll),
/* harmony export */   scanLabels: () => (/* binding */ scanLabels),
/* harmony export */   toId: () => (/* binding */ toId)
/* harmony export */ });
/* harmony import */ var _jupyterlab_cells__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/cells */ "webpack/sharing/consume/default/@jupyterlab/cells");
/* harmony import */ var _jupyterlab_cells__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_cells__WEBPACK_IMPORTED_MODULE_0__);
// xr.ts (inside src/ directory of your extension)

// A label comes in one of two forms.   It is either a member of the global
// enumeration or it is a membr of a named enumeration.   If it has the form
// @foo then it is the member "foo" of the global enumeration.   If it has the form
// @bar:foo then it is the member "foo" of the named enumeration with name "bar".
const labelMap = new Map();
const enumCounters = new Map();
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
function toId(name, id) {
    return name ? `${name}:${id}` : id;
}
function formatLabel(name, n, raw = false) {
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
function scanLabels(tracker) {
    var _a, _b, _c;
    labelMap.clear();
    enumCounters.clear();
    let count = 0;
    console.log("scanLabels");
    // walk every Markdown cell
    for (const cell of (_b = (_a = tracker.currentWidget) === null || _a === void 0 ? void 0 : _a.content.widgets) !== null && _b !== void 0 ? _b : []) {
        if (!(cell instanceof _jupyterlab_cells__WEBPACK_IMPORTED_MODULE_0__.MarkdownCell)) {
            continue;
        }
        // narrow the model to IMarkdownCellModel so TS knows about .value
        const model = cell.model;
        if (!(0,_jupyterlab_cells__WEBPACK_IMPORTED_MODULE_0__.isMarkdownCellModel)(model)) {
            // if for some reason it isn’t, move on.
            continue;
        }
        const text = model.sharedModel.getSource();
        count++;
        console.log("scanLabels markdown node " + count + " text: " + text);
        const re = /@([A-Za-z]+:)?([A-Za-z0-9:_\-]+)/g;
        let m;
        while ((m = re.exec(text)) !== null) {
            const enumName = m[1];
            const id = m[2];
            const name = enumName ? enumName.slice(0, -1) : null;
            const key = toId(name, id);
            if (!labelMap.has(key)) {
                const counterKey = name !== null && name !== void 0 ? name : '_global';
                const n = ((_c = enumCounters.get(counterKey)) !== null && _c !== void 0 ? _c : 0) + 1;
                enumCounters.set(counterKey, n);
                labelMap.set(key, { name, id, n });
            }
        }
    }
}
function rewriteText(textNode) {
    var _a, _b, _c, _d, _e;
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
            const n = (_a = entry === null || entry === void 0 ? void 0 : entry.n) !== null && _a !== void 0 ? _a : '??';
            const span = document.createElement('span');
            span.innerHTML = `<a id="${toId(name, id)}">${n}</a>` +
                `<span style="display:none">\\label{${toId(name, id)}}</span>`;
            frag.appendChild(span);
        }
        if (sym === '#') {
            const n = (_b = entry === null || entry === void 0 ? void 0 : entry.n) !== null && _b !== void 0 ? _b : '??';
            const label = formatLabel((_c = entry === null || entry === void 0 ? void 0 : entry.name) !== null && _c !== void 0 ? _c : name, n, bang === '!');
            const a = document.createElement('a');
            a.href = `#${toId((_d = entry === null || entry === void 0 ? void 0 : entry.name) !== null && _d !== void 0 ? _d : name, id)}`;
            a.textContent = label;
            frag.appendChild(a);
        }
    }
    frag.appendChild(document.createTextNode(data.slice(last)));
    (_e = textNode.parentNode) === null || _e === void 0 ? void 0 : _e.replaceChild(frag, textNode);
}
function walk(node) {
    // recurisively finds the text nodes and calls rewriteText on them.
    if (node.nodeType === Node.TEXT_NODE) {
        rewriteText(node);
    }
    else {
        node.childNodes.forEach(walk);
    }
}
function rewriteAll() {
    // For jupyter classic, .text_cell_render refers to cells that are
    // <div class="text_cell_render">.  The div contains the renereded
    // HTML.
    //
    // jupyter lab. renders the markdown to a
    // <div class="jp-RenderedHTMLCommon jp-RenderedMarkdown">
    var _a, _b, _c;
    document.querySelectorAll('.text_cell_render, .jp-RenderedHTMLCommon').forEach(walk);
    if ((_a = window.MathJax) === null || _a === void 0 ? void 0 : _a.typesetPromise) { // MathJax v3.
        window.MathJax.typesetPromise();
    }
    else if ((_c = (_b = window.MathJax) === null || _b === void 0 ? void 0 : _b.Hub) === null || _c === void 0 ? void 0 : _c.Queue) { // MathJax v2.
        window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub]);
    }
}
let isProcessing = false;
function processAll(tracker) {
    console.log("processAll isProcessing=" + isProcessing);
    if (isProcessing)
        return; // Prevent recursion
    isProcessing = true;
    try {
        scanLabels(tracker);
        rewriteAll();
    }
    finally {
        isProcessing = false; // Ensure flag is cleared even if an error occurs
    }
}



/***/ })

}]);
//# sourceMappingURL=lib_index_js.692940fcb9a6b62f4076.js.map