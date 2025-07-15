// --- state.ts -----------------------------------------------------
import { NotebookPanel } from '@jupyterlab/notebook';


declare module '@jupyterlab/notebook' {
  interface NotebookPanel {
    xrState?: XRState;
  }
}

export interface BibInfo {
  src: string;
  etag?: string;
  lastModified?: string;
  entries: Map<string, any>;  // .bib entries.
}

// define a little container for all your per-doc maps & arrays
export class XRState {
  public citationMap = new Map<string, number>();
  public bibInfo : BibInfo = {
    src: '',
    entries: new Map<string, any>()
  };

  // A label comes in one of two forms.   It is either a member of the global
  // enumeration or it is a membr of a named enumeration.   If it has the form
  // @foo then it is the member "foo" of the global enumeration.   If it has the form
  // @bar:foo then it is the member "foo" of the named enumeration with name "bar".
  public labelMap = new Map<string, number>();
  public duplicateLabels = new Set<string>();

  // have injected a bibliography before?
  public bibInjected = false;

  constructor(public panel: NotebookPanel) {
    // you can subscribe to panel events here, e.g. panel.context.pathChanged, 
    // or clean up on panel.disposed:
    panel.disposed.connect(() => this.dispose());
  }

  dispose() {
    // any teardown you need
    this.citationMap.clear();
    this.bibInfo.entries.clear();
    this.labelMap.clear();
    this.duplicateLabels.clear();
  }
}
