/**
 * @jest-environment jsdom
 */

import {
  scanCitations,
  preprocessCitations,
  updateCitationMap,
  updateBibliography,
} from '../bib';
import { __testExports__ } from '../bib';
import { BibInfo } from '../state';
const {
  analyzeCitations,
  loadBibEntries
} = __testExports__;

import { MarkdownCell } from '@jupyterlab/cells';
import { ContentsManager, Contents } from '@jupyterlab/services';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

// Polyfill Request, Response, and Headers in test environment for
// @jupyterlab/services. I was unfamiliar with `global`.  In Node or
// JSDOM, `global` is the name of the root‐level object that holds
// all globals.
;(global as any).Request = class {};
;(global as any).Response = class { constructor(public body: any) {} };
;(global as any).Headers = class {};


// Minimal dummy cell implementing MarkdownCell enough for tests
class DummyCell {
  // hold the text internally
  private _text: string;

  // expose sharedModel with getSource/setSource
  model: {
    sharedModel: {
      getSource: () => string;
      setSource: (newSrc: string) => void;
    };
  };

  constructor(text: string) {
    this._text = text;
    this.model = {
      sharedModel: {
        getSource: () => this._text,
        setSource: src => { this._text = src; }
      }
    };
  }
}
Object.setPrototypeOf(DummyCell.prototype, MarkdownCell.prototype);

// Helper to create a bibliography cell with a given src
function makeCell(src: string): MarkdownCell {
  const md = `::: bibliography
src: ${src}
:::`;
  return new DummyCell(md) as unknown as MarkdownCell;
}


/**
 * Create a mock INotebookTracker with given cell texts
 */
function makeMockTracker(texts: string[]): INotebookTracker {
  const cells = texts.map(t => new DummyCell(t));
  const tracker = {
    currentWidget: {
      content: { widgets: cells }
    }
  };
  return tracker as unknown as INotebookTracker;
}

describe('mdx citations', () => {

  it('analyzeCitations finds simple keys', () => {
    const src = 'See ^foo and ^bar.';
    const cites = analyzeCitations(src);
    expect(cites.has('foo')).toBe(true);
    expect(cites.has('bar')).toBe(true);
    expect(cites.size).toBe(2);
  });

  it('analyzeCitations ignores math spans', () => {
    const src = '$x^2 + y^b$ and ^qux';
    const citesSet = analyzeCitations(src);
    expect(citesSet.has('2')).toBe(false);
    expect(citesSet.has('b')).toBe(false);
    expect(citesSet.has('qux')).toBe(true);
  });

  it('scanCitations collects citations in order', () => {
    const tracker = makeMockTracker([
      'First ^a then ^b',
      'Then ^c and repeat ^a'
    ]);
    const cites = scanCitations(tracker);
    expect(cites).toEqual(['a', 'b', 'c']);
  });

  it('preprocessCitations replaces keys with numbers', () => {
    const tracker = makeMockTracker(['^x ^y']);
    const cites = scanCitations(tracker);
    const citationMap = new Map<string, number>();
    cites.forEach((value, idx) => {
      citationMap.set(value, idx+1);
    });

    const md = preprocessCitations('prefix ^x and ^y and ^z',
                                   citationMap);
    // x->[1], y->[2], z undefined->[?]
    expect(md).toBe('prefix [1] and [2] and [?]');
  });

  it('scanCitations handles text with no citations', () => {
    const texts = ['Hi there', 'The world', 'is great'];
    const tracker = makeMockTracker(texts);
    const cites = scanCitations(tracker);
    expect(cites.length).toBe(0);
  });
  
  it('scanCitations across multiple cells updates citationMap', () => {
    const texts = ['^foo', '^bar', '^baz'];
    const tracker = makeMockTracker(texts);
    const cites = scanCitations(tracker);
    expect(cites).toEqual(['foo', 'bar', 'baz']);
    const citationMap = new Map<string, number>();
    cites.forEach((value, idx) => {
      citationMap.set(value, idx+1);
    });

    expect(preprocessCitations('^bar', citationMap)).toBe('[2]');
  });

  it('updateCitationMap detects added citations', () => {
    const tracker = makeMockTracker(['^a']);
    const cites = scanCitations(tracker);
    const citationMap = new Map<string, number>();
    cites.forEach((value, idx) => {
      citationMap.set(value, idx+1);
    });
    const cells = (tracker.currentWidget!.content.widgets as MarkdownCell[]);
    // Pretend editing the source to add ^b
    cells[0].model.sharedModel.setSource('^a ^b');

    const changed = updateCitationMap(
      cells[0] as any,
      cells as any,
      citationMap
    );
    expect(Array.from(changed)).toContain('b');
    expect([...citationMap.keys()]).toEqual(['a','b']);
  });

  it('updateCitationMap detects removed citations', () => {
    const tracker = makeMockTracker(['^x ^y']);
    const cites = scanCitations(tracker);
    const citationMap = new Map<string, number>();
    cites.forEach((value, idx) => {
      citationMap.set(value, idx+1);
    });

    const cells = (tracker.currentWidget!.content.widgets as MarkdownCell[]);
    // old cites x,y -> now just x
    cells[0].model.sharedModel.setSource('^x');

    const changed = updateCitationMap(
      cells[0] as any,
      cells as any,
      citationMap
    );
    expect(Array.from(changed)).toContain('y');
    expect([...citationMap.keys()]).toEqual(['x']);
  });
});


// A trivial sample .bib for parsing:

const sampleBib = `
@article{smith2020,
  author = {John Smith},
  title  = {An Example Article},
  year   = {2020}
}
`;

const sampleBibA = `
@article{smith2020,
  author = {John Smith},
  title  = {Article A},
  year   = {2020}
}
`;
const sampleBibB = `
@article{jones2021,
  author = {Alice Jones},
  title  = {Article B},
  year   = {2021}
}
`;


describe('loadBibEntries()', () => {
  const notebookPath = 'notebooks/mydoc.ipynb';
  const localSrc = 'refs/test.bib';
  const remoteSrc = 'https://example.com/test.bib';

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches a remote .bib via global.fetch and parses it', async () => {
    // mock fetch to return both text() and a headers.get()
    const fakeHeaders = {
      get: jest.fn()
        .mockImplementationOnce((k: string) => 'W/"etag-value"')    // first call: etag
        .mockImplementationOnce((k: string) => 'Wed, 01 Jan 2020')  // second: last-modified
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok:         true,
      statusText: 'OK',
      text:       () => Promise.resolve(sampleBib),
      headers:    fakeHeaders
    } as any);

    const { entries, etag, lastModified } = await loadBibEntries(remoteSrc, notebookPath);


    // bibtexParse.toJSON should have run
    expect(entries.has("smith2020")).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(remoteSrc);

    // And we captured the headers
    expect(etag).toBe('W/"etag-value"');
    expect(lastModified).toBe('Wed, 01 Jan 2020');
  });

  it('throws if remote fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    } as any);

    await expect(loadBibEntries(remoteSrc, notebookPath))
      .rejects
      .toThrow(/Failed to fetch/);
  });
  
  it('uses the Jupyter ContentsManager for local paths', async () => {
    // spy on ContentsManager.get
    const cmGet = jest
      .spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValue({
        content:       sampleBib,
        last_modified: '2025-07-09T12:00:00Z',
        type:          'file',
        format:        'text'
      } as any as Contents.IModel);

    const { entries, etag, lastModified } = await loadBibEntries(localSrc, notebookPath);

    expect(cmGet).toHaveBeenCalledWith(
      // fullPath === "notebooks/refs/test.bib"
      'notebooks/refs/test.bib',
      { content: true, type: 'file', format: 'text' }
    );
    expect(entries.has("smith2020")).toBe(true);

    // Local loads have no HTTP-ETag, but do get lastModified from the model
    expect(etag).toBeUndefined();
    expect(lastModified).toBe('2025-07-09T12:00:00Z');

  });

});


describe('updateBibliography()', () => {
  const notebookPath = 'notebooks/mydoc.ipynb';
  const remoteA = 'https://example.com/a.bib';
  const remoteB = 'https://example.com/b.bib';
  const localA  = 'refs/a.bib';
  const localB  = 'refs/b.bib';

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('initial GET captures ETag and Last-Modified', async () => {
    const hdrs = {
      // `get: jest.fn()` replaces the `get` function on `headResp.headers.get`
      // with a mock function.
      get: jest.fn()
        // `mockImplementationOnce` says return the associated result
        // 'W/"v1"' the first time this mock function is called regardless
        // of any arguments passed to the mock function.
        .mockImplementationOnce(() => 'W/"v1"')            // ETag
        // on the second call to `get` return 'Tue, 01 Jan 2025'.
        .mockImplementationOnce(() => 'Tue, 01 Jan 2025')  // Last-Modified
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok:      true,
      text:    () => Promise.resolve(sampleBibA),
      headers: hdrs
    } as any);

    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };
    
    const cell = makeCell(remoteA);
    const changed = await updateBibliography(cell as any, notebookPath,
                                             bibInfo);
    expect(changed).toBe(true);

    expect(bibInfo.etag).toBe('W/"v1"');
    expect(bibInfo.lastModified).toBe('Tue, 01 Jan 2025');
    expect(bibInfo.entries.has('smith2020')).toBe(true);  // from sampleBibA.
    expect(global.fetch).toHaveBeenCalledWith(remoteA);
  });

  it('HEAD returns same ETag → no reload (false)', async () => {
    // 1) initial GET
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok:      true,
        text:    () => Promise.resolve(sampleBibA),
        headers: { get: () => 'W/"v1"' }
      } as any)
      // 2) HEAD same ETag
      .mockResolvedValueOnce({
        ok:      true,
        headers: { get: () => 'W/"v1"' }
      } as any);

    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };
    
    const cell = makeCell(remoteA);
    await updateBibliography(cell as any, notebookPath, bibInfo);

    // 3) second call: HEAD only
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok:      true,
      headers: { get: () => 'W/"v1"' }
    } as any);

    const changed2 = await updateBibliography(cell as any,
                                              notebookPath, bibInfo);
    expect(changed2).toBe(false);
    // fetch called: 1×GET, 1×HEAD
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
  });

  it('initial GET with only Last-Modified (no ETag)', async () => {
    const hdrs = {
      get: jest.fn()
        .mockImplementationOnce(() => null)               // ETag
        .mockImplementationOnce(() => 'Wed, 02 Feb 2025') // Last-Modified
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok:      true,
      text:    () => Promise.resolve(sampleBibA),
      headers: hdrs
    } as any);

    const cell = makeCell(remoteA);
    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };

    const changed = await updateBibliography(cell as any, notebookPath,
                                             bibInfo);
    expect(changed).toBe(true);

    expect(bibInfo.etag).toBeUndefined();
    expect(bibInfo.lastModified).toBe('Wed, 02 Feb 2025');
  });

  it('HEAD same Last-Modified → false', async () => {
    global.fetch = jest.fn()
      // initial GET
      .mockResolvedValueOnce({
        ok:      true,
        text:    () => Promise.resolve(sampleBibA),
        headers: { get: () => 'Thu, 03 Mar 2025' }
      } as any)
      // HEAD same LM
      .mockResolvedValueOnce({
        ok:      true,
        headers: { get: () => 'Thu, 03 Mar 2025' }
      } as any);

    const cell = makeCell(remoteA);
    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };
    await updateBibliography(cell as any, notebookPath, bibInfo);

    const changed2 = await updateBibliography(cell as any,
                                              notebookPath,
                                              bibInfo);
    expect(changed2).toBe(false);
  });

  it('srcChanged forces load', async () => {
    global.fetch = jest.fn()
      // 1) initial GET for remoteA
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(sampleBibA),
        headers: { get: () => 'E1' }
      } as any)
      // 2) GET-B (new src)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(sampleBibB),
        headers: { get: () => 'E2' }
      } as any);

    const cell = makeCell(remoteA);
    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };
    await updateBibliography(cell as any, notebookPath, bibInfo);

    // user edited the cell to a different URL textually
    cell.model.sharedModel.setSource(`::: bibliography\nsrc: ${remoteB}\n:::`);

    const changed = await updateBibliography(cell as any,
                                             notebookPath,
                                             bibInfo);
    expect(changed).toBe(true);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
  });


  it('HEAD 404 throws an error', async () => {
    global.fetch = jest
      .fn()
      // 1) Initial GET for a fresh bibInfo.src === ''
      .mockResolvedValueOnce({
        ok:      true,
        text:    () => Promise.resolve(sampleBibA),
        headers: { get: () => null }
      } as any)
      // 2) HEAD failure on the second call
      .mockResolvedValueOnce({
        ok:          false,
        status:      404,
        statusText: 'Not Found'
      } as any);
  
    const cell = makeCell(remoteA);
    const bibInfo: BibInfo = {
      src:     '',
      entries: new Map()
    };
  
    // 1st call does the GET & populates bibInfo.src → returns true
    await expect(
      updateBibliography(cell as any, notebookPath, bibInfo)
    ).resolves.toBe(true);
  
    // Now bibInfo.src === remoteA, so the next invocation will do the HEAD
    await expect(
      updateBibliography(cell as any, notebookPath, bibInfo)
    ).rejects.toThrow(
      /Could not fetch bibliography at https:\/\/example\.com\/a\.bib: HEAD request failed with 404 Not Found/
    );
  });

  it('initial local GET captures last_modified', async () => {
    const cmGet = jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        content:       sampleBibA,
        last_modified: 'L1',
        type:          'file',
        format:        'text'
      } as any);

    const cell = makeCell(localA);
    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };

    const changed = await updateBibliography(cell as any,
                                             notebookPath,
                                             bibInfo);
    expect(changed).toBe(true);
    expect(bibInfo.entries.has('smith2020')).toBe(true);
    expect(bibInfo.lastModified).toBe('L1');
  });

  it('local metadata same → false', async () => {
    // initial load
    jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        content:       sampleBibA,
        last_modified: 'L1',
        type:          'file',
        format:        'text'
      } as any);

    const cell = makeCell(localA);
    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };
    await updateBibliography(cell as any, notebookPath, bibInfo);

    // metadata-only same
    const cmGet2 = jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        last_modified: 'L1',
        type:          'file',
        format:        'text'
      } as any);

    const changed = await updateBibliography(cell as any,
                       notebookPath, bibInfo);
    expect(changed).toBe(false);
  });

  it('local metadata changed → reload & true', async () => {
    // initial load
    jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        content:       sampleBibA,
        last_modified: 'L1',
        type:          'file',
        format:        'text'
      } as any);

    const cell = makeCell(localA);
    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };
    await updateBibliography(cell as any, notebookPath, bibInfo);

    // metadata-only changed, then full reload
    const spy = jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        last_modified: 'L2',
        type:          'file',
        format:        'text'
      } as any)
      .mockResolvedValueOnce({
        content:       sampleBibB,
        last_modified: 'L2',
        type:          'file',
        format:        'text'
      } as any);

    const changed = await updateBibliography(cell as any,
                       notebookPath, bibInfo);
    expect(changed).toBe(true);
    expect(bibInfo.entries.has('jones2021')).toBe(true);
  });


  it('handles local get error by throwing', async () => {
    // 1) initial load succeeds
    jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        content:       sampleBibA,
        last_modified: 'L1',
        type:          'file',
        format:        'text'
      } as any);
  
    const cell = makeCell(localA);
    const bibInfo: BibInfo = {
      src:     '',
      entries: new Map<string, any>()
    };
    // Perform the initial load
    await updateBibliography(cell as any, notebookPath, bibInfo);
    // Confirm we have that entry
    expect(bibInfo.entries.has('smith2020')).toBe(true);
  
    // 2) Now simulate a metadata‐only error
    jest.spyOn(ContentsManager.prototype, 'get')
      .mockRejectedValueOnce(new Error('No such file'));
  
    // Because the local metadata check throws, updateBibliography should reject
    await expect(
      updateBibliography(cell as any, notebookPath, bibInfo)
    ).rejects.toThrow('No such file');
  
    // And since we threw, the existing entries should remain untouched
    expect(bibInfo.entries.has('smith2020')).toBe(true);
  });


  it('local initial GET no last_modified then metadata-same → false', async () => {
    jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        content: sampleBibA,
        type:    'file',
        format:  'text'
        // no last_modified field
      } as any);

    const cell = makeCell(localA);
    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };
    await updateBibliography(cell as any, notebookPath, bibInfo);

    const cm2 = jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        type:   'file',
        format: 'text'
        // still no last_modified
      } as any);

    const changed = await updateBibliography(cell as any,
                       notebookPath, bibInfo);
    expect(changed).toBe(false);
  });

  it('local srcChanged forces reload', async () => {
    // initial load
    jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        content:       sampleBibA,
        last_modified: 'L1',
        type:          'file',
        format:        'text'
      } as any);

    const cell = makeCell(localA);
    const bibInfo : BibInfo = {
      src: '',
      entries: new Map<string, any>()
    };
    await updateBibliography(cell as any, notebookPath, bibInfo);

    // metadata-only same
    jest.spyOn(ContentsManager.prototype, 'get')
      .mockResolvedValueOnce({
        content:       sampleBibB,
        last_modified: 'L2',
        type:          'file',
        format:        'text'
      } as any);

    // user edits src line but to different path
    cell.model.sharedModel.setSource(`::: bibliography\nsrc: ${localB}\n:::`);

    const changed = await updateBibliography(cell as any,
                       notebookPath, bibInfo);
    expect(changed).toBe(true);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);

  });
});
