import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, Notebook, NotebookActions, NotebookPanel } from '@jupyterlab/notebook';
import { MarkdownCell } from '@jupyterlab/cells';
import { scanLabels, preprocessLabels, updateLabelMap } from './xr';
import { rerenderAffected, rerenderAllMarkdown } from './render';
import { MarkdownCellWithXR } from './xr';
import { scanCitations, preprocessCitations, updateCitationMap,
         injectIfNoBibliography, updateBibliography, generateBibliography } from './bib';
import { IRenderMimeRegistry, IRenderMime } from '@jupyterlab/rendermime';
import { ILatexTypesetter } from '@jupyterlab/rendermime';
import { ISessionContext } from '@jupyterlab/apputils';
import { ContentsManager } from '@jupyterlab/services';
import { PathExt } from '@jupyterlab/coreutils';
import { XRState } from './state';
import { showErrorMessage } from '@jupyterlab/apputils'

// We only want to ever inject a bibliography once per document.  If it is
// deleted then we accept the user's decision.
//const MDX_META_KEY = 'jupyterlab-mdx';
//interface IMdxMeta {
//  bibInjected?: boolean;
//}



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

      const editedCell = activeCell instanceof MarkdownCell
                           ? (activeCell as MarkdownCell) : null;
      //console.log("a3 instanceof MarkdownCell?", activeCell instanceof MarkdownCell);
        
      let changedLabels: Set<string> = new Set<string>();
      let changedCitations = new Set<string>();
      let bibChanged = false;   // underlying .bibtex file changed or was it previously unloaded?

      // find the NotebookPanel that owns this Notebook
      let panel: NotebookPanel | undefined;
      tracker.forEach(p => {
        if (p.content === notebook) {
          panel = p;
        }
      });
      //console.log("a4 found panel:", panel);
      
      if (!panel) {
        console.warn('Couldn’t locate NotebookPanel for this Notebook');
        return await orig.call(this, notebook, session);
      }
  
      // grab panel's XRState
      let xrState = (panel as any).xrState as XRState | undefined;
      //console.log("a5 xrState", xrState);
      if (!xrState) {
        console.warn('No xrState found on the panel');
        xrState = new XRState(panel);
        panel.xrState = xrState;
      }

      //console.log("a6 editedCell", editedCell);
      if (editedCell) {

        const mdcell = editedCell as MarkdownCellWithXR;
        
        //console.log("a7 updateLabelMap", editedCell);
        let duplicateLabels : Set<string>;
        [changedLabels, duplicateLabels] = updateLabelMap(
          mdcell,
          allCells as MarkdownCellWithXR[],
          xrState.labelMap
        );
        xrState.duplicateLabels = duplicateLabels;

        //console.log("a8 changedLabels ", changedLabels);
        changedCitations = updateCitationMap(
          mdcell,
          allCells as MarkdownCellWithXR[],
          xrState.citationMap
        );
        //console.log("a9 changedCitations ", changedCitations);
        try {
          if (xrState.citationMap.size > 0) {
          
            /* Attempting to only inject a bibliography cell but once by saving
            * the state in the ipynb file using the notebook's metadata field.
            * It seems to be quite difficult to use this field.  For now,
            * I will only remember within a single session to inject a
            * bibliography but once.
            *
            * if (!panel.model) {
            *   console.warn('No notebook model; skipping bib injection');
            * } else {
            *   const model = panel.model!;   // The ! asserts that model is defined.
            * 
            *    
            *   // FAIL. Conversion of type 'INotebookMetadata' to type 'IObservableJSON' may be
            *   // a mistake because neither type sufficiently overlaps with the other.
            *   // If this was intentional, convert the expression to 'unknown' first.
            *   //const metadata = panel.model!.metadata as IObservableJSON;
            * 
            *   // FAIL. Uncaught (in promise) TypeError: e.get is not a function
            *   //const metadata = panel.model!.metadata as unknown as IObservableJSON;
            *   //const raw = metadata.get(MDX_META_KEY) as { bibInjected?: boolean } | undefined;
            * 
            *   // FAIL. Conversion of type 'INotebookMetadata' to type 'IObservableJSON'
            *   // may be a mistake because neither type sufficiently overlaps with the other.
            *   // If this was intentional, convert the expression to 'unknown' first.
            *   //const metadata = panel.context.model.metadata as IObservableJSON;
            *   
            *   // FAIL. Cannot invoke an object which is possibly 'null' or 'undefined'.
            *   //const notebookModel = panel.context.model as INotebookModel;
            *   //const metadata      = notebookModel.metadata;
            *   //const raw = metadata.get(MDX_META_KEY) as { bibInjected?: boolean } | undefined;
            * 
            *   // FAIL. Cannot invoke an object which is possibly 'null' or 'undefined'.
            *   //const metadata = panel.model!.metadata;     // IObservableJSON
            *   //const raw       = metadata?.get(MDX_META_KEY) as IMdxMeta | undefined;
            * 
            *   // FAIL!
            *   //const metadata = panel.model!.metadata;     // IObservableJSON
            *   //if (metadata) {
            *   //  // FAIL This expression is not callable.
            *   //  // No constituent of type 'string | number | boolean | PartialJSONObject |
            *   //  // PartialJSONArray' is callable.
            *   //  const raw       = metadata.get!(MDX_META_KEY) as IMdxMeta | undefined;
            * 
            *   // FAIL! Uncaught (in promise) TypeError: e.get is not a function
            *   //const metadata = (panel.model!.metadata as any) as IObservableJSON;
            *   //
            *   //if  (metadata) {
            *   //  const raw        = metadata.get(MDX_META_KEY) as IMdxMeta | undefined;
            * 
            *   // FAIL!
            *   //const notebookModel = panel.content.model! as INotebookModel;
            *   //const metadata     = notebookModel.metadata;   // this *is* an IObservableJSON
            *   //if (metadata) {
            *   //  const raw       = metadata.get(MDX_META_KEY) as IMdxMeta | undefined;
            * 
            *   // FAIL! Uncaught (in promise) TypeError: e.get is not a function
            *   //const notebookModel = panel.context.model;
            *   //const metadata = notebookModel.metadata as unknown as IObservableJSON;
            *   //const raw = metadata.get(MDX_META_KEY) as { bibInjected?: boolean } | undefined;
            * 
            *   // FAIL~ Uncaught (in promise) TypeError: e.get is not a function.
            *   // It seems waiting for it to be ready is immaterial. It may already
            *   // have been ready every time we reached this part of the code.
            *   //await panel.context.ready;                        // make sure it’s loaded
            *   //const notebookModel = panel.context.model;
            *   ////const notebookMeta = notebookModel.metadata;   // no cast needed here
            *   //const metadata = notebookModel.metadata as unknown as IObservableJSON;
            *   //const raw = metadata.get(MDX_META_KEY) as { bibInjected?: boolean } | undefined;
            * 
            *   // FAIL! Cannot invoke an object which is possibly 'null' or 'undefined'.
            *   //await panel.context.ready  
            *   //const nbModel = panel.content.model!;   
            *   //const notebookMeta = nbModel.metadata;   // <-- THIS is an IObservableJSON?
            *   //const raw = notebookMeta.get(MDX_META_KEY) as { bibInjected?: boolean } | undefined;
            * 
            *   // FAIL!  Cannot invoke an object which is possibly 'null' or 'undefined'.
            *   //const nbModel = panel.model as INotebookModel;
            *   //const meta    = nbModel.metadata;             // <-- IObservableJSON?
            *   //const raw     = meta.get(MDX_META_KEY) as { bibInjected?: boolean } | undefined;
            *   
            *   // FAIL!
            *   //const raw = (model.metadata as any)[MDX_META_KEY];
            *   //const metadata: IMdxMeta = raw && typeof raw === 'object'
            *   //  ? (raw as IMdxMeta)
            *   //  : {};
            * 
            *   // FAIL!
            *   //const metadata = model.metadata as any;  
            *   //const raw = metadata.get(MDX_META_KEY) as IMdxMeta | undefined;
            *   
            *   //const bibInjected = raw?.bibInjected ?? false;
            * 
            *   // only inject a bibliography once
            *   if (!bibInjected) {
            *     // create a bib markdown cell if one doesn't already exist add one.
            *     // HERE: find nearest .bib file recursively from current notebook directory
            *     const notebookPath = panel.context.path;
            *     const notebookDir = PathExt.dirname(notebookPath);
            *     
            *     // Try to locate the first .bib under that directory:
            *     const bibSrc = await findBib(notebookDir);
            *   
            *     injectIfNoBibliography(tracker, panel, bibSrc);
            *     
            *     //metadata.bibInjected = true;
            *     //(model.metadata as any)[MDX_META_KEY] = meta;
            *     //panel.model!.metadata.set(MDX_META_KEY, { bibInjected: true });
            *     metadata.set(MDX_META_KEY, { bibInjected: true });
            *   
            *     const widgets = panel.content.widgets;
            *     const newCell = widgets[widgets.length - 1] as MarkdownCellWithXR;
            *     bibChanged = await updateBibliography(newCell, notebookPath, xrState.bibInfo);
            *   }
            * }
            */

            // PARTIAL SUCCESS. Save state in xrState.bibInjected rather than in
            // the NotebookPanel object's metadata.  If I had figured out how
            // to use the NotebookPanel's metdata, it would have saved the fact that
            // I had injected a bibliography with the ipynb file, and thus if the
            // user had deleted the bibliography intentionally, it would honor
            // the user's choice forever for that document.  Now I save bibInjected
            // within xrState which only persists for a single session. Thus,
            // it will only try to insert a bibliography once per document per session.

            //console.log("a10 xrState.bibinjected:", xrState.bibInjected);
            if (!xrState.bibInjected) {
              const notebookPath = panel.context.path;
              const notebookDir = PathExt.dirname(notebookPath);
              
              // Try to locate the first .bib under that directory:
              const bibSrc = await findBib(notebookDir);
              //console.log("a11 calling injectIfNoBibliography bibSrc:", bibSrc);
            
              injectIfNoBibliography(tracker, panel, bibSrc);
              xrState.bibInjected = true;
              const widgets = panel.content.widgets;
              const newCell = widgets[widgets.length - 1] as MarkdownCellWithXR;
              //console.log("a12 calling updateBibliography");
              bibChanged = await updateBibliography(newCell, notebookPath, xrState.bibInfo);
            }
          }   

          const notebookPath = session?.path ?? '';
          if (mdcell.bibMeta?.bibCell) {
            bibChanged = await updateBibliography(mdcell, notebookPath, xrState.bibInfo);
          }
        } catch (error) {
          console.error("Error updating bibliography:", error);
          await showErrorMessage("Error updating bibliography", 
            String(error), 
            );
        }
      }
      //console.log("a13 bibChanged ", bibChanged);

      // Execute the action
      const result = await orig.call(this, notebook, session);

      // Run optimized logic if the active cell was Markdown
      if (changedLabels.size || changedCitations.size || bibChanged) {

        //console.log("a14 Calling rerenderAffected");
        rerenderAffected(
          allCells,
          changedLabels,
          xrState.labelMap,
          xrState.duplicateLabels,
          xrState.citationMap,
          changedCitations,
          bibChanged,
          rendermime,
          latex
        );

      } else {
        //console.log("⚠️ No label changes detected or not a Markdown cell. Skipping rerender.");
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
        //console.log("r1 jupyterlab-mdx: render markdown cell");
        let md = model.data['text/markdown'] as string;
        //console.log("r2 jupyterlab-mdx: render markdown cell source_markdown: " + md);
        const panel = tracker.currentWidget;

        if (!panel) {
           //console.log("r3 jupyterlab-mdx: render no panel. Returning origRenderModel");
           return origRenderModel(model);
        }

        let xrState = panel.xrState;
          
        if (!xrState) {
          console.warn('No xrState found on the panel');
          xrState = new XRState(panel);
          panel.xrState = xrState;
        }
        //console.log("r4 jupterlab-mdex: render xrState: labelMap.size=",
        //  xrState.labelMap.size, "duplicateLabels.size", xrState.duplicateLabels.size,
        //  " citationMap.size", xrState.citationMap.size );
        
        // Modify labels in markdown string here
        md = preprocessLabels(md, xrState.labelMap, xrState.duplicateLabels);
        //console.log("r5 jupterlab-mdex: render markdown after preprocessLabels: " + md);
        
        // Process citations (^KEY)
        md = preprocessCitations(md, xrState.citationMap);
        //console.log("r6 jupterlab-mdex: render markdown after preprocessCitations: " + md);

        if (/^::: *bibliography/m.test(md)) {
           //console.log("r7 jupterlab-mdex: render markdown calling generateBibliography");
           md = generateBibliography(md, Array.from(xrState.citationMap.keys()),
                                     xrState.bibInfo.entries);
        }

        // Replace the string before rendering
        const newModel: IRenderMime.IMimeModel = {
          ...model,
          data: {
            ...model.data,
            'text/markdown': md
          },
          metadata: model.metadata ?? {}   // The ?? operator returns the rhs if the lhs is null.
        };
        //console.log("r8 jupyterlab-mex: render markdown cell calling original renderer.");

        return origRenderModel(newModel);
      };
      return renderer;
    }
  }, 0);  // Priority = highest
}

/**
 * search the directory tree rooted at dirPath for a .bib file.
 * stop on the first .bib file you find and return it a path relative
 * to dirPath.
 */
async function findBib(dirPath: string): Promise<string | null> {
  const cm = new ContentsManager();
  try {
    const listing = await cm.get(dirPath, { content: true });
    for (const item of (listing.content as any[])) {
      if (item.type === 'file' && item.name.endsWith('.bib')) {
        return item.name;
      }
    }
    for (const item of (listing.content as any[])) {
          if (item.type === 'directory') {
        const subDir = PathExt.join(dirPath, item.name);
        const found = await findBib(subDir);
        if (found) {
          // prefix the sub‐folder name to make it relative to dirPath
          return PathExt.join(item.name, found);
        }
      }
    }
  } catch (e) {
    console.warn(`Error searching for .bib in ${dirPath}:`, e);
  }
  return null;
}

/**
 * Scan the entire document for labels, references, and citations.
 * If no bibliography cell exists then append one to the end.
 */
async function scanAll(tracker: INotebookTracker, notebookPanel: NotebookPanel) {
  //console.log("s1 ScanAll bibSrc:", bibSrc);
  const xrState = (notebookPanel as any).xrState;
  //console.log("s2 ScanAll calling scanLabels");
  const [labelMap, duplicateLabels] = scanLabels(tracker);
  xrState.labelMap = labelMap;
  xrState.duplicateLabels = duplicateLabels;

  //console.log("s3 ScanAll calling scanCitations");

  const cites = scanCitations(tracker);
  const citationMap = xrState.citationMap;
  citationMap.clear();
  cites.forEach((value, idx) => {
    citationMap.set(value, idx+1);
  });

  if (!xrState.bibInjected) {
    const notebookPath = notebookPanel.context.path;
    const notebookDir = PathExt.dirname(notebookPath);
    
    // Try to locate the first .bib under that directory:
    const bibSrc = await findBib(notebookDir);
  
    injectIfNoBibliography(tracker, notebookPanel, bibSrc);
    xrState.bibInjected = true;
    const widgets = notebookPanel.content.widgets;
    const newCell = widgets[widgets.length - 1] as MarkdownCellWithXR;
    try {
      await updateBibliography(newCell, notebookPath, xrState.bibInfo);
    } catch (err) {
      console.error('jupyterlab-mdx: failed to load initial bibliography', err);
      void showErrorMessage(
        'Bibliography Error',
        `Failed to parse initial bibliography "${bibSrc ?? 'unknown'}".\n\n${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  //console.log("s4 ScanAll cites.length", cites.length);
  //console.log("s5 scanAll citationMap.size", citationMap.size);
}

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
    //console.log("jupyterlab-mdx installing text/markdown renderer");
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
      //console.log("ac4  notebook loaded.");

      const xrState = new XRState(notebookPanel);
      (notebookPanel as any).xrState = xrState;

      // perform an initial pass to scan for labels, references, and citations.
      await scanAll(tracker, notebookPanel);
      const m = xrState.citationMap;
      console.log(`ac5 jupyterlab-mdx after scanAll. citationMap ` +
        `key-values: ${Array.from(m.entries())}` );

      await rerenderAllMarkdown(tracker, rendermime, latex, xrState.labelMap,
                                xrState.duplicateLabels, xrState.citationMap);

      // Avoid duplicate reactions during a burst of changes
      let rerenderScheduled = false;

      // React to reorder or deletion
      notebook.model?.cells.changed.connect( (_, change) => {
        if (['add', 'remove'].includes(change.type)) {
          if (!rerenderScheduled) {
            rerenderScheduled = true;
            // A move is handled by a remove folllwed by an add. This delays to
            // allow the second change to occur before calling scanLabels and rerenderAllMarkdown.
            // If there is only a remove, requestAnimationFrame() will still be called back
            // triggering just the removal to be handled.
            requestAnimationFrame(async () => {
              rerenderScheduled = false;
              console.log("🔄 Detected cell add/remove — rescanning & rerendering...");
              await scanAll(tracker, notebookPanel);
              rerenderAllMarkdown(tracker, rendermime, latex, xrState.labelMap,
                                  xrState.duplicateLabels, xrState.citationMap);
            });
          }
        }
      });
  
    });

    //console.log("jupterlab-mdx plugin Finished activate");
  } 
}


export default plugin;
