import { INotebookTracker } from '@jupyterlab/notebook';
import {
  Cell,
  MarkdownCell,
} from '@jupyterlab/cells';
import { ILatexTypesetter } from '@jupyterlab/rendermime';
import {
  MarkdownCellWithXR,
  preprocessLabels } from './xr';
import { preprocessCitations } from './bib';

/**
 * Rerenders cells that are affected by an update in labels,
 * references, or citations.
 */
export function rerenderAffected(
  allCells: MarkdownCellWithXR[],
  changedLabels: Set<string>,
  labelMap: Map<string, number>,
  duplicateLabels: Set<string>,
  citationMap: Map<string, number>,
  changedCitations: Set<string>,
  bibChanged : boolean,
  rendermime: IRenderMimeRegistry,
  latex: ILatexTypesetter
): void {
  for (const cell of allCells) {
    const xrmeta = cell.xrMeta;
    let needsUpdate = false;
    const bibmeta = cell.bibMeta;

    if (bibmeta?.bibCell && bibChanged) {
      needsUpdate = true;
    }
    
    if (!needsUpdate && xrmeta) {

      // 1) Check label changes (as before)
      needsUpdate = Array.from(changedLabels).some(label =>
        xrmeta.labelsReferenced.has(label) ||
        xrmeta.labelsDefined.has(label) ||
        duplicateLabels.has(label)
      );
    }

    if (!needsUpdate && changedCitations.size > 0) {
      // 2) Check citation changes
      //    (xrmeta.citationsReferenced was populated by updateCitationMap)
      if (!bibmeta) continue;
      
      const cites = bibmeta.citationsReferenced ?? new Set<string>();
      needsUpdate = Array.from(changedCitations).some(c =>
        cites.has(c)
      );

      if (bibmeta.bibCell) needsUpdate = true;
    }
    
    if (needsUpdate) {
      rerenderSingleMarkdownCell(cell, rendermime, latex, labelMap,
                                 duplicateLabels, citationMap);
    }
  }
}


/**
 * rerenders a single markdown cell for which we suspect the referneces
 * and labels may have changed.  
 */
function rerenderSingleMarkdownCell(
  cell: MarkdownCell,
  rendermime: IRenderMimeRegistry,
  latex: ILatexTypesetter,
  labelMap: Map<string, number>,
  duplicateLabels: Set<string>,
  citationMap: Map<string, number>
): void {

  // Interestingly chatGPT never suggested
  //
  //   app.commands.execute('notebook:run-cell', { notebook, index });
  //
  // I would have to make a few modifications so that invoking run-cell from within
  // rerenderSingleMarkdown doesn't trigger label reparsing since only the initally
  // edited markdown cell could possibly have changed its text.  This method may be
  // called when the underlying markdown hasn't changed but the numbers for labels
  // or references may have changed.  If there are issues with the method I use below
  // for rerendering a single markdown cell then I should try notebook:run-cell.

  if (!cell.isAttached) {
    console.warn("📭 Skipping rerender: cell is not attached to DOM");
    return;
  }

  let md = cell.model.sharedModel.getSource();
  const mimeType = 'text/markdown';
  //md = preprocessLabels(md, labelMap, duplicateLabels);
  //md = preprocessCitations(md, citationMap);

  const model = {
    data: { [mimeType]: md},
    metadata: {},
    trusted: true
  };

  const tryRender = () => {
    const renderTarget = cell.node.querySelector('.jp-RenderedMarkdown') as HTMLElement;
    if (!renderTarget) {
      console.log('⏳ Waiting for .jp-RenderedMarkdown...');
      requestAnimationFrame(tryRender);
      return;
    }

    console.log('Rendering single Markdown cell...');
    const renderer = rendermime.createRenderer(mimeType);
    renderTarget.innerHTML = '';

    renderer.renderModel(model as any).then(() => {
      renderTarget.appendChild(renderer.node);

      // 🧠 Defer MathJax/LaTeX rendering until DOM is ready
      requestAnimationFrame(() => {
        if (typeof latex?.typeset === 'function') {
          console.log("latex.typeset() triggered for single cell");
          latex.typeset(renderer.node);
        } else {
          console.warn("⚠️ latex.typeset is not available");
        }
      });
    });
  };

  requestAnimationFrame(tryRender);
}


export function rerenderAllMarkdown(
  tracker: INotebookTracker,
  rendermime: IRenderMimeRegistry,
  latex: ILatexTypesetter,
  labelMap: Map<string, number>,
  duplicateLabels: Set<string>,
  citationMap: Map<string, number>
): void {
  console.log("rerenderAllMarkdown: re-rendering all markdown cells");

  const cells = tracker.currentWidget?.content.widgets ?? [];

  for (const cell of cells) {
    if (cell instanceof MarkdownCell) {
      rerenderSingleMarkdownCell(cell, rendermime, latex, labelMap,
                                 duplicateLabels, citationMap);
    }
  }
}

/* THIS VERSION APPEARS TO WORK!   But I separate out the rerenderSingeMarkdownCell
   from it above.
export function rerenderAllMarkdown(tracker: INotebookTracker,
                                    rendermime: IRenderMimeRegistry,
                                    latex: ILatexTypesetter)
{
  console.log("rerenderAllMarkdown: wait for .jp-RenderedMarkdown then patch");

  const cells = tracker.currentWidget?.content.widgets ?? [];

  for (const c of cells) {
    if (!(c instanceof MarkdownCell) || !c.isAttached) continue;

    const markdownSource = c.model.sharedModel.getSource();
    const mimeType = 'text/markdown';
    const updatedMarkdown = preprocessLabels(markdownSource);

    const model = {
      data: { [mimeType]: updatedMarkdown },
      metadata: {},
      trusted: true
    };

    const tryRender = () => {
      const renderTarget = c.node.querySelector('.jp-RenderedMarkdown') as HTMLElement;
      if (!renderTarget) {
        console.log('Still waiting for .jp-RenderedMarkdown...');
        requestAnimationFrame(tryRender);
        return;
      }

      console.log('✅ Found .jp-RenderedMarkdown, updating...');
      const renderer = rendermime.createRenderer(mimeType);
      renderTarget.innerHTML = '';

      renderer.renderModel(model as any).then(() => {
        renderTarget.appendChild(renderer.node);

        // 🧠 Delay latex rendering to next frame to ensure DOM attachment
        requestAnimationFrame(() => {
          if (typeof latex?.typeset === 'function') {
            console.log("🔢 latex.typeset() triggered");
            latex.typeset(renderer.node);
          } else {
            console.warn("⚠️ latex.typeset is not available");
          }
        });
      });
    };

    requestAnimationFrame(tryRender);
  }
}
*/

/* Still doesn't work! Outputs "❌ r15 MathJax never became available after 10 attempts."
export function rerenderAllMarkdown(tracker: INotebookTracker, rendermime: IRenderMimeRegistry) {
  console.log("r1 rerenderAllMarkdown: wait for .jp-RenderedMarkdown then patch");

  const cells = tracker.currentWidget?.content.widgets ?? [];

  for (const c of cells) {
    if (!(c instanceof MarkdownCell) || !c.isAttached) continue;

    const markdownSource = c.model.sharedModel.getSource();
    const mimeType = 'text/markdown';
    const updatedMarkdown = preprocessLabels(markdownSource);

    const model = {
      data: { [mimeType]: updatedMarkdown },
      metadata: {},
      trusted: true
    };

    const tryRender = () => {
      const renderTarget = c.node.querySelector('.jp-RenderedMarkdown') as HTMLElement;
      if (!renderTarget) {
        console.log('r2 rerenderAllMarkdown: till waiting for .jp-RenderedMarkdown...');
        requestAnimationFrame(tryRender);
        return;
      }

      console.log('✅ r3 rerenderAllMarkdown: Found .jp-RenderedMarkdown, updating...');
      const renderer = rendermime.createRenderer(mimeType);
      renderTarget.innerHTML = '';

      const renderMath = (attempt = 0) => {
        const nodeAttached = document.body.contains(renderer.node);
        if (!nodeAttached) {
          console.log("🕓 r5 Waiting for renderer.node to attach...");
          requestAnimationFrame(() => renderMath(attempt));
          return;
        }
        console.log("r6 MathJax global keys:", Object.keys(window.MathJax || {}));
        console.log("r7 typeof MathJax.typeset:", typeof window.MathJax?.typeset);
        console.log("r8 MathJax.startup:", window.MathJax?.startup);

      
        if (window.MathJax?.startup?.promise) {
          window.MathJax.startup.promise.then(() => {
            console.log("✅ r9 MathJax is ready, typesetting new content");
            window.MathJax!.typeset([renderer.node]);
          });
        } else if (window.MathJax?.typeset) {
          console.log("⚠️ r10 MathJax has no startup.promise, but trying typeset anyway");
          window.MathJax.typeset([renderer.node]);
        } else if (attempt < 10) {
          console.warn(`⚠️ r11 MathJax not available yet (attempt ${attempt}), retrying...`);
          console.log("r12 MathJax global keys:", Object.keys(window.MathJax || {}));
          console.log("r13 typeof MathJax.typeset:", typeof window.MathJax?.typeset);
          console.log("r14 MathJax.startup:", window.MathJax?.startup);
          setTimeout(() => renderMath(attempt + 1), 100);
        } else {
          console.error("❌ r15 MathJax never became available after 10 attempts.");
        }
      };
      
      // Call it after renderer is inserted:
      renderer.renderModel(model as any).then(() => {
        console.log('r4 rerenderAllMarkdown: appendingChild');
        renderTarget.appendChild(renderer.node);
        requestAnimationFrame(renderMath);
      });
    };

    requestAnimationFrame(tryRender);
  }
}
*/


import { IRenderMimeRegistry } from '@jupyterlab/rendermime';

/* Prints to console "MathJax is not ready" and leaves math unrendered.
export function rerenderAllMarkdown(tracker: INotebookTracker, rendermime: IRenderMimeRegistry) {
  console.log("rerenderAllMarkdown: wait for .jp-RenderedMarkdown then patch");

  const cells = tracker.currentWidget?.content.widgets ?? [];

  for (const c of cells) {
    if (!(c instanceof MarkdownCell) || !c.isAttached) continue;

    const markdownSource = c.model.sharedModel.getSource();
    const mimeType = 'text/markdown';
    const updatedMarkdown = preprocessLabels(markdownSource);

    const model = {
      data: { [mimeType]: updatedMarkdown },
      metadata: {},
      trusted: true
    };

    const tryRender = () => {
      const renderTarget = c.node.querySelector('.jp-RenderedMarkdown') as HTMLElement;
      if (!renderTarget) {
        console.log('Still waiting for .jp-RenderedMarkdown...');
        requestAnimationFrame(tryRender);
        return;
      }

      console.log('✅ Found .jp-RenderedMarkdown, updating...');
      const renderer = rendermime.createRenderer(mimeType);
      renderTarget.innerHTML = '';

      renderer.renderModel(model as any).then(() => {
        renderTarget.appendChild(renderer.node);

        // 🧠 Delay MathJax rendering to next frame to ensure DOM attachment
        requestAnimationFrame(() => {
          if (window.MathJax?.typeset) {
            console.log("🔢 MathJax.typeset() triggered");
            window.MathJax.typeset([renderer.node]);
          } else {
            console.warn("⚠️ MathJax is not ready");
          }
        });
      });
    };

    requestAnimationFrame(tryRender);
  }
}
*/

/*
Works except that it doesn't render math properly.
import { renderMathInElement } from 'katex/contrib/auto-render';  // or however you inject MathJax
function renderMathInElement(node: HTMLElement): void {
  // For JupyterLab 3.x / 4.x using MathJax v2
  if ((window as any).MathJax?.Hub?.Queue) {
    (window as any).MathJax.Hub.Queue(['Typeset', (window as any).MathJax.Hub, node]);
  } else {
    console.warn('⚠️ MathJax not available for typesetting.');
  }
}

export function rerenderAllMarkdown(tracker: INotebookTracker, rendermime: IRenderMimeRegistry) {
  console.log("rerenderAllMarkdown: wait for .jp-RenderedMarkdown then patch");

  const cells = tracker.currentWidget?.content.widgets ?? [];

  for (const c of cells) {
    if (!(c instanceof MarkdownCell) || !c.isAttached) continue;

    const markdownSource = c.model.sharedModel.getSource();
    const mimeType = 'text/markdown';
    const updatedMarkdown = preprocessLabels(markdownSource);

    const model = {
      data: { [mimeType]: updatedMarkdown },
      metadata: {},
      trusted: true
    };

    const tryRender = () => {
      const renderTarget = c.node.querySelector('.jp-RenderedMarkdown') as HTMLElement;
      if (!renderTarget) {
        console.log('Still waiting for .jp-RenderedMarkdown...');
        requestAnimationFrame(tryRender); // Retry next frame
        return;
      }

      // Once found, render and inject
      console.log('✅ Found .jp-RenderedMarkdown, updating...');
      const renderer = rendermime.createRenderer(mimeType);
      renderTarget.innerHTML = ''; // Clear existing content
      renderer.renderModel(model as any).then(() => {
        renderTarget.appendChild(renderer.node);
        //renderMathInElement(renderer.node);  // Fixes math rendering on re-renders
      });
    };

    requestAnimationFrame(tryRender);
  }
}
*/


/* Fails to rerender with the output "Could not find .jp-RenderedMarkdown in cell: ..."
export function rerenderAllMarkdown(tracker: INotebookTracker, rendermime: IRenderMimeRegistry) {
  console.log("rerenderAllMarkdown: using explicit renderModel() call");

  const cells = tracker.currentWidget?.content.widgets ?? [];

  for (const c of cells) {
    if (!(c instanceof MarkdownCell) || !c.isAttached) continue;

    const markdownSource = c.model.sharedModel.getSource();
    const mimeType = 'text/markdown';

    const renderer = rendermime.createRenderer(mimeType);

    // Force your preprocessing logic here:
    const updatedMarkdown = preprocessLabels(markdownSource);

    const model = {
      data: {
        [mimeType]: updatedMarkdown
      },
      metadata: {},
      trusted: true
    };

    // Clear node and re-render explicitly
    const renderTarget = c.node.querySelector('.jp-RenderedMarkdown') as HTMLElement;
    if (renderTarget) {
      renderTarget.innerHTML = ''; // wipe it
      renderer.renderModel(model as any).then(() => {
        renderTarget.appendChild(renderer.node);
      });
    } else {
      console.warn('Could not find .jp-RenderedMarkdown in cell:', c);
    }
  }
}
*/

/* Removing node fails with an error.
export function rerenderAllMarkdown(tracker: INotebookTracker) {
  console.log("r1 rerenderAllMarkdown: brute force toggle using input node teardown.");

  const cells = tracker.currentWidget?.content.widgets ?? [];

  for (const c of cells) {
    if (!(c instanceof MarkdownCell) || !c.isAttached || !c.rendered) continue;

    console.log("r2 Querying cell for .jp-RenderedMarkdown:", c.model.sharedModel.getSource());

    // 1. Remove the current rendered node
    const node = c.node.querySelector('.jp-RenderedMarkdown') as HTMLElement;
    if (node) {
      console.log("r3 removing .jp-RenderedMarkdown:", c.model.sharedModel.getSource());
      node.remove();  // Remove the current output node manually
    }

    // 2. Toggle to unrendered
    console.log("r4 c.rendered=false:", c.model.sharedModel.getSource());
    c.rendered = false;

    // 3. Re-render after teardown settles
    requestAnimationFrame(() => {
      console.log("r5 c.rendered=true:", c.model.sharedModel.getSource());
      c.rendered = true;
    });
  }
}
*/

/* Even a substantive change to the source does not trigger a re-render.
export function rerenderAllMarkdown(tracker: INotebookTracker) {
  console.log("rerenderAllMarkdown: Using newline trick to force model change.");

  const cells = tracker.currentWidget?.content.widgets ?? [];

  for (const c of cells) {
    if (c instanceof MarkdownCell && c.isAttached) {
      const original = c.model.sharedModel.getSource();

      // Only proceed if cell is rendered
      if (c.rendered) {
        //const modified = original.endsWith('\n') ? original + ' ' : original + '\n';
        const modified = original + ' blah!';

        // Force re-render by making a reversible change
        console.log("r1 requestAnimationFrame callback: Forcing render by appending::", original);
        c.model.sharedModel.setSource(modified);
        console.log("r2 requestAnimationFrame callback: new source:", c.model.sharedModel.getSource());

        // Defer setting it back
        requestAnimationFrame(() => {
          console.log("r3 requestAnimationFrame 2nd callback: Restoring:", original);

          c.model.sharedModel.setSource(original);
        });
      }
    }
  }
}*/

/* Doesn't force re-render.  In fact it generates a TypeError.
import { Widget } from '@lumino/widgets';

export function rerenderAllMarkdown(tracker: INotebookTracker) {
  console.log("rerenderAllMarkdown (force widget refresh).");

  const cells = tracker.currentWidget?.content.widgets ?? [];

  requestAnimationFrame(() => {
    for (const c of cells) {
      if (!(c instanceof MarkdownCell) || !c.isAttached) continue;

      const old = (c as any).inputArea;
      const placeholder = new Widget();
      placeholder.node.style.display = 'none';

      try {
        console.log("Replacing input area for rerender:", c.model.sharedModel.getSource());

        (c as any).inputArea = placeholder;
        (c as any).inputArea = old;
      } catch (err) {
        console.warn("Widget replacement failed:", err);
      }
    }
  });
}*/

/* deferring the rendered=true does NOT force a rerernder.
export function rerenderAllMarkdown(tracker: INotebookTracker) {
  console.log("rerenderAllMarkdown.");
  const cells = tracker.currentWidget?.content.widgets ?? [];

  requestAnimationFrame(() => {
    for (const c of cells) {
      if (c instanceof MarkdownCell && c.isAttached && c.rendered) {
        console.log("requestAnimationFrame callback: c.rendered=false for:", c.model.sharedModel.getSource());

        c.rendered = false;

        // Defer re-enabling rendering to allow DOM teardown
        requestAnimationFrame(() => {
          console.log("requestAnimationFrame 2nd callback: c.rendered=true for:", c.model.sharedModel.getSource());
          c.rendered = true;
        });
      }
    }
  });
}
*/

/* adding and removing a space does not force a rerender!
export function rerenderAllMarkdown(tracker: INotebookTracker) {
  console.log("rerenderAllMarkdown.");
  const cells = tracker.currentWidget?.content.widgets ?? [];

  requestAnimationFrame(() => {
    console.log(`requestAnimationFrame callback:`);

    for (const c of cells) {
      if (c instanceof MarkdownCell && (c as any).isAttached) {
        const src = c.model.sharedModel.getSource();
        console.log("requestAnimationFrame callback: Adding space to: ", src);
        c.model.sharedModel.setSource(src + ' ');
        c.model.sharedModel.setSource(src);  // Re-set to same value
      }
    }
  });
}
*/


/* setting the source without changing it does not force a rerender.
export function rerenderAllMarkdown(tracker: INotebookTracker) {
  console.log("rerenderAllMarkdown.");
  const cells = tracker.currentWidget?.content.widgets ?? [];

  requestAnimationFrame(() => {
    console.log(`requestAnimationFrame callback:`);

    for (const c of cells) {
      if (c instanceof MarkdownCell && (c as any).isAttached) {
        const src = c.model.sharedModel.getSource();
        console.log("requestAnimationFrame callback: Forcing model update for cell:", src);
        c.model.sharedModel.setSource(src);  // Re-set to same value
      }
    }
  });
}
*/

/* This doesn't seem to force rerenders.
export function rerenderAllMarkdown(tracker: INotebookTracker) {
  console.log("rerenderAllMarkdown.");
  const cells = tracker.currentWidget?.content.widgets ?? [];

  requestAnimationFrame(() => {
    for (const c of cells) {
      if (c instanceof MarkdownCell && (c as any).isAttached) {
        console.log("Deferred re-rendering cell:", c.model.sharedModel.getSource());
        c.rendered = false;
        c.rendered = true;
      }
    }
  });
}
*/
  
/* This generates TypeError exceptions.

export function rerenderAllMarkdown(tracker: INotebookTracker) {
  console.log("rerenderAllMarkdown.");
  const cells = tracker.currentWidget?.content.widgets ?? [];

  requestAnimationFrame(() => {
    for (const c of cells) {
      console.log(`requestAnimationFrame callback: Cell is attached: ${(c as any).isAttached}`);
      console.log(`requestAnimationFrame callback: Cell parent:`, c.parent);
      console.log(`requestAnimationFrame callback: Cell layout:`, (c as any).layout);
      if (c instanceof MarkdownCell && (c as any).isAttached) {
        console.log("requestAnimationFrame callback: Re-rendering cell:", c.model.sharedModel.getSource());
        try {
          (c as any).renderInput();
        } catch (err) {
          console.error("requestAnimationFrame callback: Render failed for cell:", err);
        }
      }
    }
  });
}
*/

