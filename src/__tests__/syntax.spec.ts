import {
  normalize,
  scanLabels
} from '../syntax';

describe('mdx syntax / normalize', () => {
  it('normalizes "Foo" to "foo"', () => {
    expect(normalize('Foo')).toEqual('foo');
  });

  it('leaves lowercase alphanumeric text unchanged except for case normalization', () => {
    expect(normalize('foo123')).toBe('foo123');
    expect(normalize('Foo123')).toBe('foo123');
  });

  it('removes underscores', () => {
    expect(normalize('about_dolphins')).toBe('aboutdolphins');
    expect(normalize('_About__Dolphins_')).toBe('aboutdolphins');
  });

  it('removes whitespace', () => {
    expect(normalize('About Dolphins')).toBe('aboutdolphins');
    expect(normalize('  About   Dolphins  ')).toBe('aboutdolphins');
    expect(normalize('About\tDolphins\nNow')).toBe('aboutdolphinsnow');
  });

  it('removes punctuation', () => {
    expect(normalize('About, Dolphins!')).toBe('aboutdolphins');
    expect(normalize('A.B.C.')).toBe('abc');
    expect(normalize('foo-bar:baz;qux')).toBe('foobarbazqux');
    expect(normalize('What? No. Really!')).toBe('whatnoreally');
  });

  it('applies all normalization rules together', () => {
    expect(normalize(' About_Dolphins, Inc. ')).toBe('aboutdolphinsinc');
    expect(normalize('Quick_Select: Executor-Time Complexity')).toBe(
      'quickselectexecutortimecomplexity'
    );
  });

  it('returns empty string for empty input', () => {
    expect(normalize('')).toBe('');
  });

  it('returns empty string for input containing only removable characters', () => {
    expect(normalize('   ___   ')).toBe('');
    expect(normalize('.,;:!?-_()[]{}')).toBe('');
    expect(normalize(' \t\n_.,!? ')).toBe('');
  });

  it('does not remove digits', () => {
    expect(normalize('Section_2')).toBe('section2');
    expect(normalize('3D Graphics')).toBe('3dgraphics');
    expect(normalize('RFC-1234')).toBe('rfc1234');
  });

  it('handles mixed internal separators consistently', () => {
    expect(normalize('about__the---dolphins')).toBe('aboutthedolphins');
    expect(normalize('A  B_C-D.E')).toBe('abcde');
  });

  it('is idempotent', () => {
    const once = normalize(' About_Dolphins, Inc. ');
    const twice = normalize(once);
    expect(twice).toBe(once);
  });
});

describe('mdx syntax / scanLabels', () => {
  it('finds an explicit label in body text', () => {
    const meta = scanLabels('Step @foo: Add green eggs.');

    expect(meta.labelsDefined).toEqual(new Set(['foo']));
    expect(meta.headings).toEqual([]);
  });

  it('finds multiple explicit labels in body text in first-appearance order', () => {
    const meta = scanLabels('First @foo then @bar and finally @baz.');

    expect([...meta.labelsDefined]).toEqual(['foo', 'bar', 'baz']);
    expect(meta.headings).toEqual([]);
  });

  it('deduplicates repeated labels within a cell while preserving first appearance order', () => {
    const meta = scanLabels('Step @foo then again @foo and then @bar.');

    expect([...meta.labelsDefined]).toEqual(['foo', 'bar']);
    expect(meta.headings).toEqual([]);
  });

  it('recognizes a title as a level-1 heading', () => {
    const meta = scanLabels('# This is the title');

    expect(meta.labelsDefined.size).toBe(0);
    expect(meta.headings).toEqual([
      { level: 1, title: 'This is the title' }
    ]);
  });

  it('recognizes a section heading', () => {
    const meta = scanLabels('## About Dolphins');

    expect(meta.labelsDefined.size).toBe(0);
    expect(meta.headings).toEqual([
      { level: 2, title: 'About Dolphins' }
    ]);
  });

  it('recognizes multiple headings in one cell in appearance order', () => {
    const meta = scanLabels(`
## First Section
### First Subsection
## Second Section
#### Deep Section
`);

    expect(meta.labelsDefined.size).toBe(0);
    expect(meta.headings).toEqual([
      { level: 2, title: 'First Section' },
      { level: 3, title: 'First Subsection' },
      { level: 2, title: 'Second Section' },
      { level: 4, title: 'Deep Section' }
    ]);
  });

  it('recognizes an explicit label in a section heading', () => {
    const meta = scanLabels('## @QSelect Quick Select');

    expect(meta.labelsDefined).toEqual(new Set(['qselect']));
    expect(meta.headings).toEqual([
      { level: 2, title: 'Quick Select', explicitLabel: 'qselect' }
    ]);
  });

  it('recognizes an explicit label in a subsection heading', () => {
    const meta = scanLabels('### @Notation Complexity notation');

    expect(meta.labelsDefined).toEqual(new Set(['notation']));
    expect(meta.headings).toEqual([
      { level: 3, title: 'Complexity notation', explicitLabel: 'notation' }
    ]);
  });

  it('recognizes multiple explicit labels in headings and body text', () => {
    const meta = scanLabels(`
Intro @alpha.

## @QSelect Quick Select

Text @beta here.

### @Notation Complexity notation
`);

    expect([...meta.labelsDefined]).toEqual(['alpha', 'qselect', 'beta', 'notation']);
    expect(meta.headings).toEqual([
      { level: 2, title: 'Quick Select', explicitLabel: 'qselect' },
      { level: 3, title: 'Complexity notation', explicitLabel: 'notation' }
    ]);
  });

  it('preserves heading text while extracting an explicit label', () => {
    const meta = scanLabels('## @vol GK Select Network Volume Across Cluster');

    expect(meta.labelsDefined).toEqual(new Set(['vol']));
    expect(meta.headings).toEqual([
      {
        level: 2,
        title: 'GK Select Network Volume Across Cluster',
        explicitLabel: 'vol'
      }
    ]);
  });

  it('does not recognize labels inside inline code', () => {
    const meta = scanLabels('Use `@foo` literally.');

    expect(meta.labelsDefined.size).toBe(0);
    expect(meta.headings).toEqual([]);
  });

  it('does not recognize labels inside fenced code blocks', () => {
    const meta = scanLabels(`
\`\`\`
Step @foo: not really a label
## @bar Not really a heading
\`\`\`
`);

    expect(meta.labelsDefined.size).toBe(0);
    expect(meta.headings).toEqual([]);
  });

  it('ignores labels inside HTML comments', () => {
    const meta = scanLabels(`
<!-- @foo should be ignored -->
Actual text here.
`);

    expect(meta.labelsDefined.size).toBe(0);
    expect(meta.headings).toEqual([]);
  });

  it('ignores headings inside HTML comments', () => {
    const meta = scanLabels(`
<!--
## Hidden Heading
-->
## Visible Heading
`);

    expect(meta.labelsDefined.size).toBe(0);
    expect(meta.headings).toEqual([
      { level: 2, title: 'Visible Heading' }
    ]);
  });

  it('returns empty analysis for empty input', () => {
    const meta = scanLabels('');

    expect(meta.labelsDefined.size).toBe(0);
    expect(meta.headings).toEqual([]);
  });

  it('returns empty analysis for input with no labels or headings', () => {
    const meta = scanLabels('Plain paragraph text with no mdx syntax.');

    expect(meta.labelsDefined.size).toBe(0);
    expect(meta.headings).toEqual([]);
  });
});
