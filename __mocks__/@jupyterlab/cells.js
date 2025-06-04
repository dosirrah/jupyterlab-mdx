// __mocks__/@jupyterlab/cells.js
// Provide just the bare minimum so `import { MarkdownCell, isMarkdownCellModel }` won’t break.
class MarkdownCell {}
function isMarkdownCellModel() { return true; }
module.exports = { MarkdownCell, isMarkdownCellModel };

