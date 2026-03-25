import {
  scanNotebook,
  resolveReference,
  transformMarkdown,
  DuplicateLabelError,
  SectionInfo,
  EnumerationInfo
} from '../references';

function sectionEntries(state: ReturnType<typeof scanNotebook>) {
  return state.sections.map(label => {
    const info = state.labels.get(label);
    if (!info || info.kind !== 'section') {
      throw new Error(`Expected section for label ${label}`);
    }
    return { label, ...info };
  });
}

function enumerationEntries(state: ReturnType<typeof scanNotebook>) {
  return state.enumeration.map(label => {
    const info = state.labels.get(label);
    if (!info || info.kind !== 'enumeration') {
      throw new Error(`Expected enumeration for label ${label}`);
    }
    return { label, ...info };
  });
}

describe('mdx references / scanNotebook', () => {
  it('returns no sections for an empty notebook', () => {
    const state = scanNotebook([]);
    expect(state.sections).toEqual([]);
  });

  it('returns no sections for cells without headings', () => {
    const state = scanNotebook([
      'Plain text only.',
      'More plain text with @foo but no section heading.'
    ]);

    expect(state.sections).toEqual([]);
  });

  it('numbers a single label', () => {
    const state = scanNotebook([
      'Step @foo'
    ]);

    expect(state.enumeration).toEqual(['foo']);
    expect(state.labels.get('foo')).toEqual({
      kind: 'enumeration',
      number: '1'
    });
    expect(enumerationEntries(state)).toEqual([
      { label: 'foo', kind: 'enumeration', number: '1' }
    ]);
  });

  it('numbers multiple global-enumeration labels in first appearance order', () => {
    const state = scanNotebook([
      'Step @foo',
      'Step @bar',
      'Step @baz'
    ]);

    expect(enumerationEntries(state)).toEqual([
      { label: 'foo', kind: 'enumeration', number: '1' },
      { label: 'bar', kind: 'enumeration', number: '2' },
      { label: 'baz', kind: 'enumeration', number: '3' }
    ]);
  });

  it('numbers a single section as 1', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(sectionEntries(state)).toEqual([
      {
        label: 'aboutdolphins',
        kind: 'section',
        level: 2,
        title: 'About Dolphins',
        number: '1',
        isExplicit: false
      }
    ]);
  });

  it('does not number a level-1 title as a section', () => {
    const state = scanNotebook([
      '# Notebook Title',
      '## First Section'
    ]);

    expect(sectionEntries(state)).toEqual([
      {
        label: 'firstsection',
        kind: 'section',
        level: 2,
        title: 'First Section',
        number: '1',
        isExplicit: false
      }
    ]);
  });

  it('numbers sections globally across notebook cells', () => {
    const state = scanNotebook([
      '## First Section',
      '## Second Section',
      '## Third Section'
    ]);

    expect(sectionEntries(state).map(s => s.number)).toEqual(['1', '2', '3']);
    expect(sectionEntries(state).map(s => s.title)).toEqual([
      'First Section',
      'Second Section',
      'Third Section'
    ]);
  });

  it('numbers headings in appearance order within a single cell', () => {
    const state = scanNotebook([
      `
## First Section
### First Subsection
## Second Section
### Second Subection
`
    ]);

    expect(sectionEntries(state).map(s => s.number)).toEqual([
      '1',
      '1.1',
      '2',
      '2.1'
    ]);
  });

  it('uses forgiving numbering when a heading level is skipped within a cell', () => {
    const state = scanNotebook([
      `
## Second
#### Deep Section
`
    ]);

    expect(sectionEntries(state).map(s => ({
      level: s.level,
      number: s.number,
      title: s.title
    }))).toEqual([
      { level: 2, number: '1', title: 'Second' },
      { level: 4, number: '1.1', title: 'Deep Section' }
    ]);
  });

  it('uses forgiving numbering when a heading level is skipped across cell boundaries', () => {
    const state = scanNotebook([
      '## Second',
      '#### Deep Section'
    ]);

    expect(sectionEntries(state).map(s => ({
      level: s.level,
      number: s.number,
      title: s.title
    }))).toEqual([
      { level: 2, number: '1', title: 'Second' },
      { level: 4, number: '1.1', title: 'Deep Section' }
    ]);
  });

  it('numbers subsections under their enclosing section', () => {
    const state = scanNotebook([
      `
## First
### A
### B
## Second
### C
`
    ]);

    expect(sectionEntries(state).map(s => s.number)).toEqual([
      '1',
      '1.1',
      '1.2',
      '2',
      '2.1'
    ]);
  });

  it('restarts subsection numbering when a new section begins', () => {
    const state = scanNotebook([
      `
## Alpha
### One
### Two
## Beta
### Foo
`
    ]);

    expect(sectionEntries(state).map(s => s.number)).toEqual([
      '1',
      '1.1',
      '1.2',
      '2',
      '2.1'
    ]);
  });

  it('numbers deeply nested headings hierarchically', () => {
    const state = scanNotebook([
      `
## A
### B
#### C
##### D
`
    ]);

    expect(sectionEntries(state).map(s => s.number)).toEqual([
      '1',
      '1.1',
      '1.1.1',
      '1.1.1.1'
    ]);
  });

  it('creates labels from section titles for implicit sections', () => {
    const state = scanNotebook([
      `
## About Dolphins
### Executor Time Complexity
`
    ]);

    expect(sectionEntries(state).map(s => s.label)).toEqual([
      'aboutdolphins',
      'executortimecomplexity'
    ]);

    expect(sectionEntries(state).map(s => s.isExplicit)).toEqual([
      false,
      false
    ]);
  });

  it('normalizes implicit section labels by lowercasing and removing spaces, punctuation, and underscores', () => {
    const state = scanNotebook([
      `
## About_Dolphins, Inc.
### Executor-Time Complexity
`
    ]);

    expect(sectionEntries(state).map(s => s.label)).toEqual([
      'aboutdolphinsinc',
      'executortimecomplexity'
    ]);
  });

  it('records an explicit label on a section heading', () => {
    const state = scanNotebook([
      '## @QSelect Quick Select'
    ]);

    expect(sectionEntries(state)).toEqual([
      {
        label: 'qselect',
        kind: 'section',
        level: 2,
        title: 'Quick Select',
        number: '1',
        isExplicit: true
      }
    ]);
  });

  it('records explicit labels on nested section headings', () => {
    const state = scanNotebook([
      `
## @QSelect Quick Select
### @Notation Complexity notation
### @T_exec GK Select Executor Time Complexity
`
    ]);

    expect(sectionEntries(state)).toEqual([
      {
        label: 'qselect',
        kind: 'section',
        level: 2,
        title: 'Quick Select',
        number: '1',
        isExplicit: true
      },
      {
        label: 'notation',
        kind: 'section',
        level: 3,
        title: 'Complexity notation',
        number: '1.1',
        isExplicit: true
      },
      {
        label: 'texec',
        kind: 'section',
        level: 3,
        title: 'GK Select Executor Time Complexity',
        number: '1.2',
        isExplicit: true
      }
    ]);
  });

  it('preserves notebook-global numbering across cells with multiple headings', () => {
    const state = scanNotebook([
      `
## First
### First.A
`,
      `
## Second
### Second.A
### Second.B
`,
      `
## Third
`
    ]);

    expect(sectionEntries(state).map(s => s.number)).toEqual([
      '1',
      '1.1',
      '2',
      '2.1',
      '2.2',
      '3'
    ]);
  });

  it('ignores headings inside fenced code blocks', () => {
    const state = scanNotebook([
      `
\`\`\`
## Not a real heading
### Also not a heading
\`\`\`

## Real Heading
`
    ]);

    expect(sectionEntries(state)).toEqual([
      {
        label: 'realheading',
        kind: 'section',
        level: 2,
        title: 'Real Heading',
        number: '1',
        isExplicit: false
      }
    ]);
  });

  it('ignores headings inside HTML comments', () => {
    const state = scanNotebook([
      `
<!--
## Hidden Heading
-->
## Visible Heading
`
    ]);

    expect(sectionEntries(state)).toEqual([
      {
        label: 'visibleheading',
        kind: 'section',
        level: 2,
        title: 'Visible Heading',
        number: '1',
        isExplicit: false
      }
    ]);
  });

  it('numbers sections the same regardless of how markdown is split across cells', () => {
    const state1 = scanNotebook([
      `
## First
### First.A
## Second
### Second.A
`
    ]);

    const state2 = scanNotebook([
      '## First',
      '### First.A',
      '## Second',
      '### Second.A'
    ]);

    expect(sectionEntries(state1).map(s => s.number)).toEqual(['1', '1.1', '2', '2.1']);
    expect(sectionEntries(state2).map(s => s.number)).toEqual(['1', '1.1', '2', '2.1']);

    expect(sectionEntries(state1).map(s => ({
      level: s.level,
      title: s.title,
      number: s.number
    }))).toEqual(
      sectionEntries(state2).map(s => ({
        level: s.level,
        title: s.title,
        number: s.number
      }))
    );
  });

  it('ignores level-1 titles when numbering sections', () => {
    const state1 = scanNotebook([
      `
# Title
## First
### First.A
## Second
### Second.A
`
    ]);

    const state2 = scanNotebook([
      '# Title',
      '## First',
      '### First.A',
      '## Second',
      '### Second.A'
    ]);

    expect(sectionEntries(state1).map(s => s.number)).toEqual(['1', '1.1', '2', '2.1']);
    expect(sectionEntries(state2).map(s => s.number)).toEqual(['1', '1.1', '2', '2.1']);

    expect(sectionEntries(state1).map(s => ({
      level: s.level,
      title: s.title,
      number: s.number
    }))).toEqual(
      sectionEntries(state2).map(s => ({
        level: s.level,
        title: s.title,
        number: s.number
      }))
    );
  });

  it('uses notebook order rather than cell boundaries for numbering', () => {
    const state = scanNotebook([
      `
## First
### First.A
`,
      `
### First.B
## Second
`,
      `
### Second.A
`
    ]);

    expect(sectionEntries(state).map(s => s.number)).toEqual([
      '1',
      '1.1',
      '1.2',
      '2',
      '2.1'
    ]);
  });

  it('numbers explicitly labelled and implicitly labelled sections the same way', () => {
    const implicit = scanNotebook([
      `
## First Section
### Subsection
## Second Section
`
    ]);

    const explicit = scanNotebook([
      `
## @first First Section
### @sub Subsection
## @second Second Section
`
    ]);

    expect(sectionEntries(implicit).map(s => s.number)).toEqual(['1', '1.1', '2']);
    expect(sectionEntries(explicit).map(s => s.number)).toEqual(['1', '1.1', '2']);

    expect(sectionEntries(implicit).map(s => ({
      level: s.level,
      title: s.title,
      number: s.number
    }))).toEqual([
      { level: 2, title: 'First Section', number: '1' },
      { level: 3, title: 'Subsection', number: '1.1' },
      { level: 2, title: 'Second Section', number: '2' }
    ]);

    expect(sectionEntries(explicit).map(s => ({
      level: s.level,
      title: s.title,
      number: s.number
    }))).toEqual([
      { level: 2, title: 'First Section', number: '1' },
      { level: 3, title: 'Subsection', number: '1.1' },
      { level: 2, title: 'Second Section', number: '2' }
    ]);
  });

  it('does not let explicit labels change numbering across cell boundaries', () => {
    const state = scanNotebook([
      '## @first First Section',
      '### Subsection',
      '## @second Second Section',
      '### @detail Detail'
    ]);

    expect(sectionEntries(state).map(s => ({
      title: s.title,
      number: s.number,
      label: s.label,
      isExplicit: s.isExplicit
    }))).toEqual([
      { title: 'First Section', number: '1', label: 'first', isExplicit: true },
      { title: 'Subsection', number: '1.1', label: 'subsection', isExplicit: false },
      { title: 'Second Section', number: '2', label: 'second', isExplicit: true },
      { title: 'Detail', number: '2.1', label: 'detail', isExplicit: true }
    ]);
  });

  it('continues numbering correctly when explicit and implicit sections are mixed across cells', () => {
    const state = scanNotebook([
      '## @intro Introduction',
      '### Background',
      '## Methods',
      '### @impl Implementation',
      '## Results'
    ]);

    expect(sectionEntries(state).map(s => s.number)).toEqual([
      '1',
      '1.1',
      '2',
      '2.1',
      '3'
    ]);
  });
});

describe('mdx references / DuplicateLabelError', () => {
  it('throws when two explicit body labels normalize to the same canonical label', () => {
    expect(() =>
      scanNotebook([
        '@foo something',
        '@Foo something else'
      ])
    ).toThrow(DuplicateLabelError);
  });

  it('throws when two implicit section labels normalize to the same canonical label', () => {
    expect(() =>
      scanNotebook([
        '## About Dolphins',
        '## About_Dolphins'
      ])
    ).toThrow(DuplicateLabelError);
  });

  it('throws when an explicit section label collides with an implicit section label', () => {
    expect(() =>
      scanNotebook([
        '## About Dolphins',
        '## @aboutdolphins Another Section'
      ])
    ).toThrow(DuplicateLabelError);
  });

  it('throws when an explicit body label collides with an implicit section label', () => {
    expect(() =>
      scanNotebook([
        '## About Dolphins',
        '@aboutdolphins body label'
      ])
    ).toThrow(DuplicateLabelError);
  });

  it('throws when two explicit section labels normalize to the same canonical label', () => {
    expect(() =>
      scanNotebook([
        '## @QSelect Quick Select',
        '## @qselect Another Section'
      ])
    ).toThrow(DuplicateLabelError);
  });

  it('throws when an explicit section label collides with an explicit body label', () => {
    expect(() =>
      scanNotebook([
        '## @foo First Section',
        '@foo body label'
      ])
    ).toThrow(DuplicateLabelError);
  });

  it('throws when two sections with the same title would produce the same implicit label', () => {
    expect(() =>
      scanNotebook([
        '### Analysis',
        '### Analysis'
      ])
    ).toThrow(DuplicateLabelError);
  });

  it('allows repeated section titles when they have distinct explicit labels', () => {
    const state = scanNotebook([
      '### @gkanalysis Analysis',
      '### @monsteranalysis Analysis'
    ]);

    expect(sectionEntries(state).map(s => ({
      title: s.title,
      number: s.number,
      label: s.label,
      isExplicit: s.isExplicit
    }))).toEqual([
      { title: 'Analysis', number: '1', label: 'gkanalysis', isExplicit: true },
      { title: 'Analysis', number: '2', label: 'monsteranalysis', isExplicit: true }
    ]);
  });

  it('throws when only one of two otherwise-duplicate sections has an explicit label', () => {
    expect(() =>
      scanNotebook([
        '### @gkanalysis Analysis',
        '### Analysis'
      ])
    ).toThrow(DuplicateLabelError);
  });

  it('does not throw when labels are distinct after normalization', () => {
    expect(() =>
      scanNotebook([
        '## About Dolphins',
        '## About Sharks',
        '@foo body label'
      ])
    ).not.toThrow();
  });
});

describe('mdx references / resolveReference', () => {
  it('returns null for an unresolved reference in an empty notebook', () => {
    const state = scanNotebook([]);
    expect(resolveReference('foo', state)).toBeNull();
  });

  it('returns null for an unresolved reference when no matching label exists', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(resolveReference('sharks', state)).toBeNull();
  });

  it('resolves an explicit global-enumeration label by exact match', () => {
    const state = scanNotebook([
      'Step @foo'
    ]);

    expect(resolveReference('foo', state)).toBe('foo');
  });

  it('matches explicit labels case-insensitively after normalization', () => {
    const state = scanNotebook([
      'Step @Foo_Bar'
    ]);

    expect(resolveReference('foobar', state)).toBe('foobar');
    expect(resolveReference('FOO_BAR', state)).toBe('foobar');
  });

  it('does not prefix-match explicit global-enumeration labels', () => {
    const state = scanNotebook([
      'Step @foobar'
    ]);

    expect(resolveReference('foo', state)).toBeNull();
  });

  it('resolves an explicit section label by exact match', () => {
    const state = scanNotebook([
      '## @qselect Quick Select'
    ]);

    expect(resolveReference('qselect', state)).toBe('qselect');
  });

  it('does not use implicit title matching for a section with an explicit label', () => {
    const state = scanNotebook([
      '## @qselect Quick Select'
    ]);

    expect(resolveReference('quick', state)).toBeNull();
    expect(resolveReference('quickselect', state)).toBeNull();
  });

  it('resolves an implicit section label by exact canonical match', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(resolveReference('aboutdolphins', state)).toBe('aboutdolphins');
  });

  it('resolves an implicit section label by normalized prefix match', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(resolveReference('about', state)).toBe('aboutdolphins');
    expect(resolveReference('aboutdol', state)).toBe('aboutdolphins');
    expect(resolveReference('about_dol', state)).toBe('aboutdolphins');
  });

  it('matches implicit section labels case-insensitively', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(resolveReference('ABOUT', state)).toBe('aboutdolphins');
    expect(resolveReference('AboutDol', state)).toBe('aboutdolphins');
  });

  it('does not match a non-prefix substring for an implicit section label', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(resolveReference('dolphins', state)).toBeNull();
    expect(resolveReference('bout', state)).toBeNull();
  });

  it('prefers exact explicit-label matches over implicit section-prefix matches', () => {
    const state = scanNotebook([
      '## About Dolphins',
      '@about label in body text'
    ]);

    expect(resolveReference('about', state)).toBe('about');
  });

  it('prefers exact implicit section matches over implicit prefix matches', () => {
    const state = scanNotebook([
      '## Some Section',
      '## Some Section Part 2'
    ]);

    expect(resolveReference('somesection', state)).toBe('somesection');
  });

  it('uses unique prefix matching for implicit section labels', () => {
    const state = scanNotebook([
      '## Some Section',
      '## Some Section Part 2'
    ]);

    expect(resolveReference('somesectionp', state)).toBe('somesectionpart2');
  });

  it('returns null for ambiguous implicit prefixes', () => {
    const state = scanNotebook([
      '## Some Section',
      '## Some Section Part 2'
    ]);

    expect(resolveReference('some', state)).toBeNull();
  });

  it('resolves notebook-global labels across multiple cells', () => {
    const state = scanNotebook([
      'Step @foo',
      '## First Section',
      'Step @bar',
      '## Second Section'
    ]);

    expect(resolveReference('foo', state)).toBe('foo');
    expect(resolveReference('first', state)).toBe('firstsection');
    expect(resolveReference('bar', state)).toBe('bar');
    expect(resolveReference('second', state)).toBe('secondsection');
  });

  it('resolves sections with forgiving numbering by label rather than by depth', () => {
    const state = scanNotebook([
      '## Second',
      '#### Deep Section'
    ]);

    expect(resolveReference('second', state)).toBe('second');
    expect(resolveReference('deep', state)).toBe('deepsection');
    expect(resolveReference('deepsection', state)).toBe('deepsection');
  });

  it('normalizes punctuation, whitespace, and underscores before matching implicit labels', () => {
    const state = scanNotebook([
      '## About_Dolphins, Inc.'
    ]);

    expect(resolveReference('aboutdolphinsinc', state)).toBe('aboutdolphinsinc');
    expect(resolveReference('about_dolphins_inc', state)).toBe('aboutdolphinsinc');
    expect(resolveReference('about dolphins inc', state)).toBe('aboutdolphinsinc');
  });
});

describe('mdx references / transformMarkdown', () => {
  it('returns unchanged text for a cell with no headings or references', () => {
    const state = scanNotebook([
      'Plain text only.'
    ]);

    expect(transformMarkdown('Plain text only.', state)).toBe('Plain text only.');
  });

  it('numbers a single implicit section heading', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(transformMarkdown('## About Dolphins', state)).toBe('## 1. About Dolphins');
  });

  it('numbers an explicitly labelled section heading the same way as an implicit one', () => {
    const state = scanNotebook([
      '## @qselect Quick Select'
    ]);

    expect(transformMarkdown('## @qselect Quick Select', state)).toBe('## 1. Quick Select');
  });

  it('numbers a single global-enumeration label', () => {
    const state = scanNotebook([
      'Step @foo. Add green eggs.'
    ]);

    expect(transformMarkdown('Step @foo. Add green eggs.', state)).toBe('Step 1. Add green eggs.');
  });

  it('numbers multiple global-enumeration labels in one cell', () => {
    const md = `
Step @foo. Add green eggs.
Step @bar. Add ham.
`;
    const state = scanNotebook([md]);

    expect(transformMarkdown(md, state)).toBe(`
Step 1. Add green eggs.
Step 2. Add ham.
`);
  });

  it('numbers multiple headings within one cell', () => {
    const cells = [`
## First Section
### First Subsection
## Second Section
### Second Subsection
`];
    const state = scanNotebook(cells);

    expect(transformMarkdown(cells[0], state)).toBe(`
## 1. First Section
### 1.1 First Subsection
## 2. Second Section
### 2.1 Second Subsection
`);
  });

  it('uses forgiving numbering when heading levels are skipped', () => {
    const cells = [`
## Second
#### Deep Section
`];
    const state = scanNotebook(cells);

    expect(transformMarkdown(cells[0], state)).toBe(`
## 1. Second
#### 1.1 Deep Section
`);
  });

  it('resolves an implicit section reference by prefix', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(transformMarkdown('See #about.', state)).toBe('See 1.');
    expect(transformMarkdown('See #aboutdol for details.', state)).toBe('See 1 for details.');
  });

  it('resolves an explicit section reference by exact label', () => {
    const state = scanNotebook([
      '## @qselect Quick Select'
    ]);

    expect(transformMarkdown('See #qselect.', state)).toBe('See 1.');
  });

  it('resolves an explicit global-enumeration reference by exact label', () => {
    const state = scanNotebook([
      'Step @foo. Add green eggs.'
    ]);

    expect(transformMarkdown('See #foo.', state)).toBe('See 1.');
  });

  it('does not use implicit title matching for explicitly labelled sections', () => {
    const state = scanNotebook([
      '## @qselect Quick Select'
    ]);

    expect(transformMarkdown('See #quick.', state)).toBe('See ⚠ unresolved: #quick.');
    expect(transformMarkdown('See #quickselect.', state)).toBe('See ⚠ unresolved: #quickselect.');
  });

  it('prefers exact explicit-label matches over implicit prefix matches', () => {
    const state = scanNotebook([
      '## About Dolphins',
      '@about label in body text'
    ]);

    expect(transformMarkdown('See #about.', state)).toBe('See 1.');
  });

  it('renders unresolved references visibly', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(transformMarkdown('See #sharks.', state)).toBe('See ⚠ unresolved: #sharks.');
  });

  it('renders multiple unresolved references visibly', () => {
    const state = scanNotebook([]);

    expect(transformMarkdown('See #foo and #bar.', state)).toBe(
      'See ⚠ unresolved: #foo and ⚠ unresolved: #bar.'
    );
  });

  it('resolves references across cell boundaries using notebook-global state', () => {
    const state = scanNotebook([
      '## First Section',
      '### Subsection',
      '## Second Section'
    ]);

    expect(transformMarkdown('See #first.', state)).toBe('See 1.');
    expect(transformMarkdown('See #subsection.', state)).toBe('See 1.1.');
    expect(transformMarkdown('See #second.', state)).toBe('See 2.');
  });

  it('numbers sections globally regardless of how markdown is split across cells', () => {
    const state1 = scanNotebook([`
## First
### First.A
## Second
### Second.A
`]);

    const state2 = scanNotebook([
      '## First',
      '### First.A',
      '## Second',
      '### Second.A'
    ]);

    expect(transformMarkdown('See #first.', state1)).toBe('See 1.');
    expect(transformMarkdown('See #seconda.', state1)).toBe('See 2.1.');

    expect(transformMarkdown('See #first.', state2)).toBe('See 1.');
    expect(transformMarkdown('See #seconda.', state2)).toBe('See 2.1.');
  });

  it('removes explicit labels from headings when rendering', () => {
    const state = scanNotebook([
      '### @impl Implementation'
    ]);

    expect(transformMarkdown('### @impl Implementation', state)).toBe('### 1. Implementation');
  });

  it('does not recognize references inside inline code', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    expect(transformMarkdown('Use `#about` literally.', state)).toBe('Use `#about` literally.');
  });

  it('does not recognize references inside fenced code blocks', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    const md = `
\`\`\`
See #about
\`\`\`
`;

    expect(transformMarkdown(md, state)).toBe(md);
  });

  it('does not recognize headings inside fenced code blocks', () => {
    const state = scanNotebook([
      `
\`\`\`
## Not a heading
\`\`\`
## Real Heading
`
    ]);

    expect(transformMarkdown(`
\`\`\`
## Not a heading
\`\`\`
## Real Heading
`, state)).toBe(`
\`\`\`
## Not a heading
\`\`\`
## 1. Real Heading
`);
  });

  it('does not recognize references inside HTML comments', () => {
    const state = scanNotebook([
      '## About Dolphins'
    ]);

    const md = `
<!-- See #about -->
See #about.
`;

    expect(transformMarkdown(md, state)).toBe(`
<!-- See #about -->
See 1.
`);
  });

  it('preserves literal heading level while applying derived numbering', () => {
    const state = scanNotebook([
      '#### Deep Section'
    ]);

    expect(transformMarkdown('#### Deep Section', state)).toBe('#### 1. Deep Section');
  });
});
