import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
import { MarkdownCell } from '@jupyterlab/cells';
import { processAll } from './xr';  // Your main label processing logic
import { Cell } from '@jupyterlab/cells';

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-mdx',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('JupyterLab extension jupyterlab-mdx is activated!');

    const wireCell = (cell: any) => {
      if (cell.model?.type !== 'markdown' || cell._mdxWired) return;
      cell._mdxWired = true;

      // Only call processAll after user-initiated rendering
      cell.renderedChanged.connect(() => {
        if ((cell as MarkdownCell).rendered) {
          console.log("jupyterlab-mdx: Cell re-rendered → processAll()");
          processAll(tracker);
        }
      });
    };

    const hookNotebook = (panel: any) => {
      console.log("jupyterlab-mdx: Notebook widget added");

      panel.content.widgets.forEach(wireCell);
      panel.content.model?.cells.changed.connect(() => {
        panel.content.widgets.forEach(wireCell);
      });

      // Wait until all markdown cells are rendered before processing
      const promises = panel.content.widgets.map((cell: Cell) => {
        wireCell(cell);
        if (cell.model?.type !== 'markdown') return Promise.resolve();

        const mdCell = cell as MarkdownCell;
        return mdCell.rendered
          ? Promise.resolve()
          : new Promise<void>(resolve => {
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
          processAll(tracker);
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

export default plugin;
