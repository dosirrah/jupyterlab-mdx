/**
 * @jest-environment jsdom
 */

import {
  scanLabels,
  rewriteAll,
  labelMap,
  enumCounters,
  toId,
  formatLabel,
  processAll
} from '../xr';

describe('mdx cross-references', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    labelMap.clear();
    enumCounters.clear();
  });

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
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
  
    const para = document.createElement('p');
    para.appendChild(document.createTextNode('See @foo and @bar.'));
  
    container.appendChild(para);
    document.body.appendChild(container);
  
    scanLabels();
  
    expect(labelMap.has('foo')).toBe(true);
    expect(labelMap.get('foo')).toEqual({ name: null, id: 'foo', n: 1 });
    expect(labelMap.get('bar')).toEqual({ name: null, id: 'bar', n: 2 });
  });


  it('registers labels with named enumeration "eq"', () => {
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
  
    const para = document.createElement('p');
    para.appendChild(document.createTextNode(
      'Equation @eq:alpha and again @eq:beta.'));
  
    container.appendChild(para);
    document.body.appendChild(container);
  
    scanLabels();
  
    expect(labelMap.has('eq:alpha')).toBe(true);
    expect(labelMap.get('eq:alpha')).toEqual({ name: 'eq', id: 'alpha', n: 1 });
    expect(labelMap.get('eq:beta')).toEqual({ name: 'eq', id: 'beta', n: 2 });

  });

  it('does not double-count repeated labels', () => {
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
  
    const para = document.createElement('p');
    para.appendChild(document.createTextNode(
      '@foo and again @foo'));
  
    container.appendChild(para);
    document.body.appendChild(container);

    scanLabels();

    expect(labelMap.get('foo')?.n).toBe(1);
    expect(enumCounters.get('_global')).toBe(1);
  });

  it('rewrites refs into links and labels', () => {
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
  
    const para = document.createElement('p');
    para.appendChild(document.createTextNode(
      'This is @foo and #foo.'));
  
    container.appendChild(para);
    document.body.appendChild(container);

    processAll();

    const anchor = container.querySelector('a[id="foo"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.textContent).toBe('1');

    const href = container.querySelector('a[href="#foo"]');
    expect(href).not.toBeNull();
    expect(href?.textContent).toBe('1');
  });

  it('renders TAGGABLE names with parentheses', () => {
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
  
    const para = document.createElement('p');
    para.appendChild(document.createTextNode(
      'Equation: @eq:one and reference: #eq:one.'));
  
    container.appendChild(para);
    document.body.appendChild(container);
  
    processAll();
  
    const anchor = container.querySelector('a[id="eq:one"]');
    expect(anchor?.textContent).toBe('1');
  
    const href = container.querySelector('a[href="#eq:one"]');
    expect(href?.textContent).toBe('(1)');
  });

  it('renders references to labels defined later in the file.', () => {
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
  
    const para = document.createElement('p');
    para.appendChild(document.createTextNode(
      `In section #life we discuss life, love, and paydays.

## @life. Life`));

    container.appendChild(para);
    document.body.appendChild(container);

    scanLabels();

    expect(labelMap.get('life')?.n).toBe(1);
    expect(enumCounters.get('_global')).toBe(1);

    rewriteAll();

    const anchor = container.querySelector('a[id="life"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.textContent).toBe('1');

    const href = container.querySelector('a[href="#life"]');
    expect(href).not.toBeNull();
    expect(href?.textContent).toBe('1');
  
  });
  
  it('renders references to undefined labels with ??', () => {
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
  
    const para = document.createElement('p');
    para.appendChild(document.createTextNode(
      'In section #foo'));

    container.appendChild(para);
    document.body.appendChild(container);

    processAll();

    const href = container.querySelector('a[href="#foo"]');
    expect(href).not.toBeNull();
    expect(href?.textContent).toBe('??');
  });

  it('renders references to labels in different cells', () => {
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
    
    const para = document.createElement('p');
    para.appendChild(document.createTextNode(
      'In section #foo'));
    
    container.appendChild(para);
    document.body.appendChild(container);

    const container2 = document.createElement('div');
    container2.className = 'jp-RenderedHTMLCommon';
  
    const para2 = document.createElement('p');
    para2.appendChild(document.createTextNode(
      '## @foo Foo'));

    container2.appendChild(para2);
    document.body.appendChild(container2);

    processAll();

    const href = container.querySelector('a[href="#foo"]');
    expect(href).not.toBeNull();
    expect(href?.textContent).toBe('1');

    const anchor = container2.querySelector('a[id="foo"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.textContent).toBe('1');

  });
  

  it('renders equations with tags.', () => {
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
  
    const para = document.createElement('p');
    para.appendChild(document.createTextNode(
      '$$\int_0^10 x^2 dx \tag{@eq:one}'));

    container.appendChild(para);
    document.body.appendChild(container);

    scanLabels();

    expect(labelMap.has('eq:one')).toBe(true);
    expect(labelMap.get('eq:one')).toEqual({ name: 'eq', id: 'one', n: 1 });

    rewriteAll();

    const anchor = container.querySelector('a[id="eq:one"]');
    expect(anchor).not.toBeNull();
    expect(anchor?.textContent).toBe('1');


  });

  it('keeps enumerations independent from each other.', () => {
    const container = document.createElement('div');
    container.className = 'jp-RenderedHTMLCommon';
  
    const para = document.createElement('p');

    para.appendChild(document.createTextNode(
      `
       Reference #bar
       Reference before labelled #ex:foo
       @foo Foo

       @ex:bar ex:bar
       @foo foo
       @a:foo a:foo

      `));


    container.appendChild(para);
    document.body.appendChild(container);
    
    const container2 = document.createElement('div');
    container2.className = 'jp-RenderedHTMLCommon';
    
    const para2 = document.createElement('p');
    para2.appendChild(document.createTextNode(
      `@bar bar
       @ex:foo foo
      `));

    container2.appendChild(para2);
    document.body.appendChild(container2);

    scanLabels();

    expect(labelMap.has('bar')).toBe(true);
    expect(labelMap.get('bar')).toEqual({ name: null, id: 'bar', n: 2 });
    
    expect(labelMap.has('ex:bar')).toBe(true);
    expect(labelMap.get('ex:bar')).toEqual({ name: 'ex', id: 'bar', n: 1 });
    
    expect(labelMap.has('foo')).toBe(true);
    expect(labelMap.get('foo')).toEqual({ name: null, id: 'foo', n: 1 });
    
    expect(labelMap.has('a:foo')).toBe(true);
    expect(labelMap.get('a:foo')).toEqual({ name: 'a', id: 'foo', n: 1 });
    
    expect(labelMap.has('ex:foo')).toBe(true);
    expect(labelMap.get('ex:foo')).toEqual({ name: 'ex', id: 'foo', n: 2 });
    
    expect(labelMap.has('a:foo')).toBe(true);
    expect(labelMap.get('a:foo')).toEqual({ name: 'a', id: 'foo', n: 1 });
  });


});