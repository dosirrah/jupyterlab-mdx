import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker } from '@jupyterlab/notebook';
//import { MarkdownCell } from '@jupyterlab/cells';
import { attachHooks, preprocessLabels } from './xr';  // Your main label processing logic
//import { Cell } from '@jupyterlab/cells';
import { IRenderMimeRegistry, IRenderMime } from '@jupyterlab/rendermime';


const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab-mdx',
  autoStart: true,
  requires: [INotebookTracker, IRenderMimeRegistry],
  activate: (
    app: JupyterFrontEnd,
    tracker: INotebookTracker,
    rendermime: IRenderMimeRegistry 
  ) => {
    console.log('JupyterLab extension jupyterlab-mdx is activated!');

    tracker.currentChanged.connect(() => {
      const notebook = tracker.currentWidget;
      if (!notebook) return;
    
      const panel = notebook.content;
    
      // Handle existing cells
      panel.widgets.forEach(cell => attachHooks(cell, tracker));
    
      // Handle future cells
      panel.model?.cells.changed.connect((_, change) => {
        if (change.type === 'add') {
          for (let i = 0; i < change.newValues.length; i++) {
            const newCell = panel.widgets[change.newIndex + i];
            attachHooks(newCell, tracker);
          }
        }
      });
    });


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
          const source = model.data['text/markdown'] as string;
    
          // Modify labels in markdown string here
          const updated = preprocessLabels(source);  // Your label logic
    
          // Replace the string before rendering
          const newModel = {
            ...model,
            data: {
              ...model.data,
              'text/markdown': updated
            }
          };
          return origRenderModel(newModel);
        };
        return renderer;
      }
    }, 0);  // Priority = highest
    
  } 

};

export default plugin;
