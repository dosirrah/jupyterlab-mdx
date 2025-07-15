/**
 * @jest-environment jsdom
 */

import {
  scanLabels,
  preprocessLabels,
} from '../xr';

import { __testExports__ } from '../xr';
const { toId, formatLabel, analyzeMarkdown } = __testExports__;
import { MarkdownCell } from '@jupyterlab/cells';
import { NotebookPanel } from '@jupyterlab/notebook';
import { INotebookTracker } from '@jupyterlab/notebook';
import { CellModel } from '@jupyterlab/cells';
import { Notebook } from '@jupyterlab/notebook';
import { NotebookModel } from '@jupyterlab/notebook';
import { UUID } from '@lumino/coreutils';


// A bare‐bones “cell” that looks enough like a MarkdownCell
class DummyCell {
  model: { sharedModel: { getSource: () => string } }
  constructor(text: string) {
    this.model = {
      sharedModel: { getSource: () => text }
    };
  }
}
// And pretend it’s a MarkdownCell:
Object.setPrototypeOf(DummyCell.prototype, MarkdownCell.prototype);


/**
 * Creates a mock INotebookTracker with dummy MarkdownCells.
 * @param texts - An array of strings, each representing a cell’s source text.
 */
function makeMockTracker(texts: string[]): INotebookTracker {
  const cells = texts.map(t => new DummyCell(t));
  const tracker = {
    currentWidget: {
      content: {
        widgets: cells
      }
    }
  };
  return tracker as unknown as INotebookTracker;
}


describe('mdx cross-references', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const empty = new Set<string>();
  
  it('toId assembles (name, id) into "name:id".', () => {
    const assembled : string = toId("foo", "bar");
    expect(assembled).toEqual("foo:bar");
  });

  it('toId assembles (null, id) to "id".', () => {
    const assembled : string = toId(null, "bar");
    expect(assembled).toEqual("bar");
  });

  it('formats labels in "eq" named enumeration inside parentheses', () => {
    const reformatted : string = formatLabel("eq", 5);
    expect(reformatted).toEqual('(5)');
  });
  
  it('registers labels from text nodes', () => {
    const tracker = makeMockTracker(['See @foo and @bar.']);  
    const [ labelMap, duplicateLabels ] = scanLabels(tracker);
    
    expect(labelMap.has('foo')).toBe(true);
    expect(labelMap.get('foo')).toEqual(1);
    expect(labelMap.get('bar')).toEqual(2);
    expect(duplicateLabels.size).toEqual(0);
  });


  it('registers labels with named enumeration "eq"', () => {
    const tracker = makeMockTracker([
          'Equation @eq:alpha and again @eq:beta.',
          'And also @eq:beta and @fig:gamma']);
    const [ labelMap, duplicateLabels ] = scanLabels(tracker);
    
    expect(labelMap.has('eq:alpha')).toBe(true);
    expect(labelMap.get('eq:alpha')).toEqual(1);
    expect(labelMap.get('eq:beta')).toEqual(2);
    expect(duplicateLabels.size).toEqual(1);

  });

  it('does not double-count repeated labels', () => {
    const tracker = makeMockTracker(['@foo and again @foo']);

    const [ labelMap, duplicateLabels ] = scanLabels(tracker);

    expect(labelMap.get('foo')).toEqual(1);
    expect(duplicateLabels.size).toEqual(1);
    expect(duplicateLabels.has('foo')).toBe(true);
  });


  it('renders references to labels defined later in the file.', () => {
    const markdown = `In section #life we discuss life, love, and paydays.

## @life. Life`
    const tracker = makeMockTracker([markdown]);

    const [ labelMap, duplicateLabels ] = scanLabels(tracker);

    const result = preprocessLabels(markdown, labelMap, duplicateLabels);
    expect(result).toContain('section 1');
    expect(result).toContain('## 1. Life');
  });
  
  it('renders references to undefined labels with warning', () => {

    const noLabels = new Map<string, number>();
    const noDups = new Set<string>();
    const result = preprocessLabels('In section #foo', noLabels, noDups);

    expect(result).toEqual("In section ⚠️ {undefined: foo}");
  });

  it('renders references to labels in different cells', () => {

    const markdown = ['In section #foo', '## @foo Foo'];
    const tracker = makeMockTracker(markdown);

    const [ labelMap, duplicateLabels ] = scanLabels(tracker);
    let result = preprocessLabels(markdown[0], labelMap, duplicateLabels);

    expect(result).toEqual('In section 1');
    
    result = preprocessLabels(markdown[1], labelMap, duplicateLabels);
    expect(result).toEqual('## 1 Foo');

  });

  it('renders equations with tags.', () => {
    const markdown = '$$\int_0^10 x^2 dx \tag{@eq:one}'
    const tracker = makeMockTracker([markdown]);

    const [ labelMap, duplicateLabels ] = scanLabels(tracker);

    expect(labelMap.has('eq:one')).toBe(true);
    expect(labelMap.get('eq:one')).toEqual(1);

    const result = preprocessLabels(markdown, labelMap, duplicateLabels);
    expect(result).toEqual('$$\int_0^10 x^2 dx \tag{1}');
  });

  it('keeps enumerations independent from each other.', () => {
    const markdown = [`
       Reference #bar
       Reference before labelled #ex:foo
       @foo Foo

       @ex:bar ex:bar
       @foo foo
       @a:foo a:foo

      `, `@bar bar
       @ex:foo foo
      `];
    const tracker = makeMockTracker(markdown);

    const [ labelMap, duplicateLabels ] = scanLabels(tracker);
    
    expect(labelMap.has('bar')).toBe(true);
    expect(labelMap.get('bar')).toEqual(2);
    
    expect(labelMap.has('ex:bar')).toBe(true);
    expect(labelMap.get('ex:bar')).toEqual(1);
    
    expect(labelMap.has('foo')).toBe(true);
    expect(labelMap.get('foo')).toEqual(1);
    
    expect(labelMap.has('a:foo')).toBe(true);
    expect(labelMap.get('a:foo')).toEqual(1);
    
    expect(labelMap.has('ex:foo')).toBe(true);
    expect(labelMap.get('ex:foo')).toEqual(2);
    
    expect(labelMap.size).toEqual(5);
    expect(duplicateLabels.size).toEqual(1);
    expect(duplicateLabels.has('foo'));
  });

  it('finds labels.', () => {
    const markdown = `
      @foo Foo
      `;

    const meta = analyzeMarkdown(markdown);

    expect(meta.labelsDefined.has("foo")).toBe(true);
    expect(meta.labelsReferenced.size).toEqual(0);

  });

  it('finds labels in equations.', () => {
    const markdown = `
      $$x \tax{@eq:one}$$
      `;

    const meta = analyzeMarkdown(markdown);

    expect(meta.labelsDefined.has("eq:one")).toBe(true);
    expect(meta.labelsReferenced.size).toEqual(0);

  });

  it('finds labels in references.', () => {
    const markdown = `
      In section #bar we explain.
      `;

    const meta = analyzeMarkdown(markdown);

    expect(meta.labelsDefined.size).toEqual(0);
    expect(meta.labelsReferenced.size).toEqual(1);
    expect(meta.labelsReferenced.has("bar")).toBe(true);
  });

  it('finds labels when referenced and defined', () => {
    const markdown = `
      In section #bar we explain.

      # Section @bar
      `;

    const meta = analyzeMarkdown(markdown);

    expect(meta.labelsDefined.size).toEqual(1);
    expect(meta.labelsReferenced.size).toEqual(1);
    expect(meta.labelsDefined.has("bar")).toBe(true);
    expect(meta.labelsReferenced.has("bar")).toBe(true);
  });


});