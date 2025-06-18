import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, Notebook, NotebookActions } from '@jupyterlab/notebook';
import { MarkdownCell } from '@jupyterlab/cells';
import { scanLabels, preprocessLabels, updateLabelMap } from './xr';
import { rerenderAffected, rerenderAllMarkdown, MarkdownCellWithXR } from './xr'; 
import { IRenderMimeRegistry, IRenderMime } from '@jupyterlab/rendermime';
import { ILatexTypesetter } from '@jupyterlab/rendermime';
import { ISessionContext } from '@jupyterlab/apputils';

function wrapNotebookActions(tracker: INotebookTracker,
                             rendermime: IRenderMimeRegistry,
                             latex: ILatexTypesetter
) {
  function wrap(
    orig: (
      notebook: Notebook,
      sessionContext?: ISessionContext
    ) => Promise<boolean>
  ) {
    return async function (
      this: typeof NotebookActions,
      notebook: Notebook,
      session: ISessionContext | undefined
    ) {
      //console.log("a1 action filter out all but markdown cells");

      // Get all cells and find the active one (before the action mutates state)
      const allCells = notebook.widgets.filter(
        (cell): cell is MarkdownCell => cell instanceof MarkdownCell
      );

      const activeCell = notebook.activeCell;
      //console.log("a2 activeCell", activeCell);
      //console.log("a3 instanceof MarkdownCell?", activeCell instanceof MarkdownCell);

      const editedCell = activeCell instanceof MarkdownCell
                           ? (activeCell as MarkdownCell) : null;
        
      let changedLabels: Set<string> | undefined;

      //console.log("a4 editedCell", editedCell);
      if (editedCell) {
        //console.log("a5 updateLabelMap", editedCell);
        changedLabels = updateLabelMap(editedCell as MarkdownCellWithXR, allCells);
        //console.log("a6 changedLabels ", changedLabels);
      }

      // Execute the action
      const result = await orig.call(this, notebook, session);

      // Run optimized logic if the active cell was Markdown
      if (changedLabels && changedLabels.size !== 0) {
        console.log("Calling rerenderAffected");
        rerenderAffected(allCells, changedLabels, rendermime, latex);
      } else {
        console.log("a8 ⚠️ No label changes detected or not a Markdown cell. Skipping rerender.");
      }

      return result;
    };
  }

  // 1) Run a single cell
  NotebookActions.run = wrap(NotebookActions.run);

  // 2) Run & advance to next
  NotebookActions.runAndAdvance = wrap(NotebookActions.runAndAdvance);

  // 3) Run all below
  NotebookActions.runAllBelow = wrap(NotebookActions.runAllBelow);

  // 4) Run all above (nothing below to re‐render)
  NotebookActions.runAllAbove = wrap(NotebookActions.runAllAbove);

  // 5) Run all
  NotebookActions.runAll = wrap(NotebookActions.runAll);
}


function installMarkdownRenderer(tracker: INotebookTracker,
                                          rendermime: IRenderMimeRegistry 
) {

    const original = rendermime.getFactory('text/markdown')!;
    if (!original) {
      console.warn('⚠️ Could not find the original Markdown renderer');
      return;
    }
    rendermime.removeMimeType('text/markdown');
    
    rendermime.addFactory({
      safe: true,
      mimeTypes: ['text/markdown'],
      createRenderer: options => {
        const renderer = original.createRenderer(options);
        const origRenderModel = renderer.renderModel.bind(renderer);
        renderer.renderModel = async (model: IRenderMime.IMimeModel) => {
          console.log("jupyterlab-mdx: render markdown cell");
          const source_markdown = model.data['text/markdown'] as string;
          //console.log("2 jupyterlab-mdx: render markdown cell source_markdown: " + source_markdown);

          // Modify labels in markdown string here
          const updated = preprocessLabels(source_markdown);  // Your label logic
          //console.log("3 jupterlab-mdex: render markdown updated: " + updated);
    
          // Replace the string before rendering
          const newModel: IRenderMime.IMimeModel = {
            ...model,
            data: {
              ...model.data,
              'text/markdown': updated
            },
            metadata: model.metadata ?? {}   // The ?? operator returns the rhs if the lhs is null.
          };
          //console.log("4 jupyterlab-mex: render markdown cell calling original renderer.");

          return origRenderModel(newModel);
        };
        return renderer;
      }
    }, 0);  // Priority = highest
};

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-mdx',
  autoStart: true,
  requires: [INotebookTracker, IRenderMimeRegistry, ILatexTypesetter],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    rendermime: IRenderMimeRegistry,
    latex: ILatexTypesetter
  ) => {
    console.log('jupterlab-mdx plugin activate');

    // 1) Patch the notebook actions so we always scan+rerender downstream
    wrapNotebookActions(tracker, rendermime, latex);

    // 2) Hijack markdown rendering for label injection
    console.log("jupyterlab-mdx installing text/markdown renderer");
    installMarkdownRenderer(tracker, rendermime); 

    // 3) Wait for the first notebook to load before scanning/rendering
    tracker.currentChanged.connect(async (_, notebookPanel) => {
      if (!notebookPanel) {
        return;
      }

      const notebook = notebookPanel.content;

      // Ensure we only attach our observer once per notebook instance
      if ((notebook as any)._xrObserverAttached) {
        //console.log("ac4.1 skipping already-attached observer");
        return;
      }
      (notebook as any)._xrObserverAttached = true;

      // this await guarantees notebookPanel.content.widgets is populated
      await notebookPanel.context.ready;
      console.log("ac4  notebook loaded.");

      // Initial full scan and render
      scanLabels(tracker);
      //console.log("ac5 jupyterlab-mdx rerenderAllMarkdown");
      await rerenderAllMarkdown(tracker, rendermime, latex);

      // Avoid duplicate reactions during a burst of changes
      let rerenderScheduled = false;

      // React to reorder or deletion
      notebook.model?.cells.changed.connect((_, change) => {
        if (['add', 'remove'].includes(change.type)) {
          if (!rerenderScheduled) {
            rerenderScheduled = true;
            // A move is handled by a remove folllwed by an add. This delays to
            // allow the second change to occur before calling scanLabels and rerenderAllMarkdown.
            // If there is only a remove, requestAnimationFrame() will still be called back
            // triggering just the removal to be handled.
            requestAnimationFrame(() => {
              rerenderScheduled = false;
              console.log("🔄 Detected cell add/remove — rescanning & rerendering...");
              scanLabels(tracker);
              rerenderAllMarkdown(tracker, rendermime, latex);
            });
          }
        }
      });
  
    });

    //console.log("ac3 Finished activate");
  } 
}


export default plugin;
