import {
  normalize,
  scanLabels,
  scanCitations,
  scanBibliographyDirectives,
  BibliographyDirective
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

    expect(meta.labelsDefined).toEqual(['foo']);
    expect(meta.headings).toEqual([]);
  });

  it('finds multiple explicit labels in body text in first-appearance order', () => {
    const meta = scanLabels('First @foo then @bar and finally @baz.');

    expect(meta.labelsDefined).toEqual(['foo', 'bar', 'baz']);
    expect(meta.headings).toEqual([]);
  });

  it('includes repeated labels in order of appearance', () => {
    const meta = scanLabels('Step @foo then again @foo and then @bar.');

    expect(meta.labelsDefined).toEqual(['foo', 'foo', 'bar']);
    expect(meta.headings).toEqual([]);
  });

  it('recognizes a title as a level-1 heading', () => {
    const meta = scanLabels('# This is the title');

    expect(meta.labelsDefined.length).toBe(0);
    expect(meta.headings).toEqual([
      { level: 1, title: 'This is the title' }
    ]);
  });

  it('recognizes a section heading', () => {
    const meta = scanLabels('## About Dolphins');

    expect(meta.labelsDefined.length).toBe(0);
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

    expect(meta.labelsDefined.length).toBe(0);
    expect(meta.headings).toEqual([
      { level: 2, title: 'First Section' },
      { level: 3, title: 'First Subsection' },
      { level: 2, title: 'Second Section' },
      { level: 4, title: 'Deep Section' }
    ]);
  });

  it('recognizes an explicit label in a section heading', () => {
    const meta = scanLabels('## @QSelect Quick Select');

    expect(meta.labelsDefined).toEqual(['qselect']);
    expect(meta.headings).toEqual([
      { level: 2, title: 'Quick Select', explicitLabel: 'qselect' }
    ]);
  });

  it('recognizes an explicit label in a subsection heading', () => {
    const meta = scanLabels('### @Notation Complexity notation');

    expect(meta.labelsDefined).toEqual(['notation']);
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

    expect(meta.labelsDefined).toEqual(['alpha', 'qselect', 'beta', 'notation']);
    expect(meta.headings).toEqual([
      { level: 2, title: 'Quick Select', explicitLabel: 'qselect' },
      { level: 3, title: 'Complexity notation', explicitLabel: 'notation' }
    ]);
  });

  it('preserves heading text while extracting an explicit label', () => {
    const meta = scanLabels('## @vol GK Select Network Volume Across Cluster');

    expect(meta.labelsDefined).toEqual(['vol']);
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

    expect(meta.labelsDefined.length).toBe(0);
    expect(meta.headings).toEqual([]);
  });

  it('does not recognize labels inside fenced code blocks', () => {
    const meta = scanLabels(`
\`\`\`
Step @foo: not really a label
## @bar Not really a heading
\`\`\`
`);

    expect(meta.labelsDefined.length).toBe(0);
    expect(meta.headings).toEqual([]);
  });

  it('ignores labels inside HTML comments', () => {
    const meta = scanLabels(`
<!-- @foo should be ignored -->
Actual text here.
`);

    expect(meta.labelsDefined.length).toBe(0);
    expect(meta.headings).toEqual([]);
  });

  it('ignores headings inside HTML comments', () => {
    const meta = scanLabels(`
<!--
## Hidden Heading
-->
## Visible Heading
`);

    expect(meta.labelsDefined.length).toBe(0);
    expect(meta.headings).toEqual([
      { level: 2, title: 'Visible Heading' }
    ]);
  });

  it('returns empty analysis for empty input', () => {
    const meta = scanLabels('');

    expect(meta.labelsDefined.length).toBe(0);
    expect(meta.headings).toEqual([]);
  });

  it('returns empty analysis for input with no labels or headings', () => {
    const meta = scanLabels('Plain paragraph text with no mdx syntax.');

    expect(meta.labelsDefined.length).toBe(0);
    expect(meta.headings).toEqual([]);
  });
});



describe('mdx syntax / scanCitations', () => {
  it('finds a single citation in body text', () => {
    expect(scanCitations('See ^lamport1994 for details.')).toEqual([
      'lamport1994'
    ]);
  });

  it('finds multiple citations in first-appearance order', () => {
    expect(
      scanCitations('See ^lamport1994 and ^knuth1984 and then ^turing1936.')
    ).toEqual(['lamport1994', 'knuth1984', 'turing1936']);
  });

  it('preserves repeated citations', () => {
    expect(
      scanCitations('See ^lamport1994 and later ^knuth1984 and ^lamport1994 again.')
    ).toEqual(['lamport1994', 'knuth1984', 'lamport1994']);
  });

  it('returns an empty array when there are no citations', () => {
    expect(scanCitations('Plain paragraph text only.')).toEqual([]);
  });

  it('does not recognize citations inside inline code', () => {
    expect(scanCitations('Use `^lamport1994` literally.')).toEqual([]);
  });

  it('does not recognize citations inside fenced code blocks', () => {
    expect(
      scanCitations(`
\`\`\`
^lamport1994
^knuth1984
\`\`\`
`)
    ).toEqual([]);
  });

  it('does not recognize citations inside HTML comments', () => {
    expect(
      scanCitations(`
<!-- ^lamport1994 should be ignored -->
Actual text here.
`)
    ).toEqual([]);
  });
  
  it('does not recognize citations inside LaTeX equation block', () => {

    // this block has ^t, which could be interpreted as a citation if
    // it weren't in an equation block.
    expect(
      scanCitations(
      `
$$
\int_{x=0}^t x^2 dx   @eq:foo
$$
`)
    ).toEqual([]);
  });

  it('recognizes citations outside comments when comments are present', () => {
    expect(
      scanCitations(`
<!-- ^lamport1994 should be ignored -->
See ^knuth1984 here.
`)
    ).toEqual(['knuth1984']);
  });

  it('recognizes citations across multiple lines in appearance order', () => {
    expect(
      scanCitations(`
First cite ^lamport1994.

Then ^knuth1984.
Then ^turing1936.
`)
    ).toEqual(['lamport1994', 'knuth1984', 'turing1936']);
  });

  it('allows underscores and digits in citation keys', () => {
    expect(
      scanCitations('See ^foo_2 and ^bar99.')
    ).toEqual(['foo_2', 'bar99']);
  });

  it('does not treat a bare caret as a citation', () => {
    expect(scanCitations('2 ^ 3 is exponent notation.')).toEqual([]);
  });
});

describe('mdx syntax / scanBibliographyDirectives', () => {
  it('returns an empty array when no bibliography directive is present', () => {
    expect(scanBibliographyDirectives('Plain paragraph text only.')).toEqual([]);
  });

  it('recognizes a bibliography directive with a src field', () => {
    expect(
      scanBibliographyDirectives(`
::: bibliography
src: refs.bib
:::
`)
    ).toEqual([
      { src: 'refs.bib' }
    ]);
  });

  it('recognizes a bibliography directive with a relative path src', () => {
    expect(
      scanBibliographyDirectives(`
::: bibliography
src: papers/refs.bib
:::
`)
    ).toEqual([
      { src: 'papers/refs.bib' }
    ]);
  });

  it('recognizes a bibliography directive with a remote src', () => {
    expect(
      scanBibliographyDirectives(`
::: bibliography
src: https://example.com/refs.bib
:::
`)
    ).toEqual([
      { src: 'https://example.com/refs.bib' }
    ]);
  });

  it('recognizes multiple bibliography directives in appearance order', () => {
    expect(
      scanBibliographyDirectives(`
::: bibliography
src: a.bib
:::

Text here.

::: bibliography
src: b.bib
:::
`)
    ).toEqual([
      { src: 'a.bib' },
      { src: 'b.bib' }
    ]);
  });

  it('returns a directive with null src when src is omitted', () => {
    expect(
      scanBibliographyDirectives(`
::: bibliography
:::
`)
    ).toEqual([
      { src: null }
    ]);
  });

  it('does not recognize bibliography directives inside fenced code blocks', () => {
    expect(
      scanBibliographyDirectives(`
\`\`\`
::: bibliography
src: refs.bib
:::
\`\`\`
`)
    ).toEqual([]);
  });

  it('does not recognize bibliography directives inside HTML comments', () => {
    expect(
      scanBibliographyDirectives(`
<!--
::: bibliography
src: refs.bib
:::
-->
`)
    ).toEqual([]);
  });

  it('recognizes a bibliography directive outside comments when comments are present', () => {
    expect(
      scanBibliographyDirectives(`
<!--
::: bibliography
src: ignored.bib
:::
-->

::: bibliography
src: used.bib
:::
`)
    ).toEqual([
      { src: 'used.bib' }
    ]);
  });
});