# Agent notes for jupyterlab-mdx

## Project
`jupyterlab-mdx` is a JupyterLab extension for markdown cross-references and citations.

## Current goal
This branch is a non-reactive reboot of the extension.

## Test oracle
Use Playwright tests as the truth source.

## Commands
- `npm run test:smoke` — verify JupyterLab and mdx load
- `npm run test:ui` — run all Playwright tests
- `npm run lab:start` — start JupyterLab
- `npm run lab:stop` — stop JupyterLab

## Design constraints
- Keep behavior non-reactive
- Update mappings on notebook open and explicit markdown cell run
- Do not globally rerender the notebook
- Surface user-facing errors at top level

## Architectural preference

Even in the reboot:
- preserve familiar module boundaries when practical
- keep top-level orchestration in `index.ts`
- keep bibliography-specific logic in `bib.ts`
- keep cross-reference-specific logic in `xr.ts`
- keep rendering helpers in a rendering-focused module if needed
- do not collapse everything into one file unless the code is truly trivial

The old code can be found in src-old-reactive

## Markdown syntax supported by jupyterlab-mdx

jupyterlab-mdx adds markdown with analogous behavior to LaTeX
\label, \ref, and \cite to jupyter notebooks, but do it in a way
that is lighweight and more aligned with the design principles of
markup languages.  Due to the popularization of hashtags on Twitter/X,
I believe most people would find hash as an intuitive analog to
\ref.  

In a markdown document references are denoted by a hash `#`
For example:

```
  This is a reference to #foo.
```

To avoid confusion with hashes appearing at the beginning of a line,
which in markdown denotes title or section headings, a reference
(#foo) must not be at the beginning of a line.  Furthermore, a
reference must be preceded by whitespace or punctuation.

In a markdown document, an ampresand denotes a label.  As such there
if there is a #foo then there whould an ampresand followed by the word
`foo`.  For example,

```
  Step @foo: Add green eggs to the ham.
```

In addition, automatic labels should exist for sections.  The labels
should be based on the text of a section heading.  

```
## About Dolphins
```

For example, the section titled "About Dolphins" can be referenced as

```
In Section #About we talk about dolphins.
```

or

```
In Section #about we talk about dolphins.
```

or

```
In Section #aboutdol we talk about dolphins.
```

or

```
In Section #about_dolphins we talk about dolphins.
```

or

```
In Section #aboutdolphins we talk about dolphins.
```

A single hash mark at the beginning of a line is considered
a title and not a section heading.

```
# This is the title

## This is a section

### This is a subsection

## This is another section

```


The tool replaces all sections, subsections, subsubections, etc with
numbers.  Numbering starts with 1 for the first section and increments
with each section in order.  Subsections inherit the enclosing section
number and have a subnumber that restarts at 1.  For example, the
quoted text above when the cell is rendered is first parsed and
changed to

```
# This is the title

## 1. This is a section

### 1.1 This is a subsection

## 2. This is another section.
```

The body of the cell itself remains unchanged.   It is only changed at
render time.  If I click on the cell for editing, it appears as

```
# This is the title

## This is a section

### This is a subsection

## This is another section.
```

If the writer prefers to create named labels for sections then that
is also supported using the ampresand in a section heading.  For example,
if the section "QuickSelect" is the 1st section in the document then

```
## @QSelect Quick Select
[...]
## GK Select
[...]
### @Notation Complexity notation
[...]
### @T_exec GK Select Executor Time Complexity
[...]
### @vol GK Select Network Volume Across Cluster
[...]
#### Analysis
[...]
## @Monster Monster Select
```

becomes

```
## 1. Quick Select
[...]
## 2. GK Select
[...]
### 2.1 Complexity notation
[...]
### 2.2 GK Select Executor Time Complexity
[...]
### 2.3 GK Select Network Volume Across Cluster
[...]
#### 2.3.1 Analysis
[...]
## 3. Monster Select
```

If a section defines an explicit label:

  ## @foo My Section

Then:
- implicit label matching is disabled for this section
- only #foo resolves to this section


### Formal rules

Label:
    @([A-Za-z0-9][A-Za-z0-9_]*(?::[A-Za-z0-9][A-Za-z0-9_]*)?)

Reference:
    #([A-Za-z0-9][A-Za-z0-9_]*(?::[A-Za-z0-9][A-Za-z0-9_]*)?)


A reference must:
  - not be at the beginning of a line
  - be preceded by whitespace or a non-alphanumeric character

normalize(s):
  - convert to lowercase
  - remove whitespace
  - remove punctuation
  - remove underscores

A reference #foo matches a label @foo if:
  normalize(foo) == normalize(foo)

## Reference resolution and numbering semantics

A reference `#r` is resolved in priority order. Resolution determines both
what object is being referenced and which numbering system supplies the
rendered number.

## Named enumerations

In addition to the global enumeration, jupyterlab-mdx supports **named enumerations**, which behave like independent numbering namespaces.

### Syntax

A label may appear in one of two forms:

- `@foo`  
  Declares label `foo` in the **global enumeration**

- `@name:foo`  
  Declares label `foo` in the **named enumeration** `name`

Examples:

    Step @foo: preprocess data.

    Figure @fig:architecture shows the system.

    Equation @eq:maxwell defines the relationship.

### Semantics

Each enumeration maintains its own independent numbering sequence:

- The **global enumeration** is one sequence
- Each **named enumeration** (`fig`, `eq`, etc.) is its own sequence

Therefore:

- `@foo` → global numbering
- `@fig:one` → numbering within `fig`
- `@eq:one` → numbering within `eq`

Example:

    @fig:first
    @eq:energy
    @fig:second

Numbering:

- `@fig:first` → 1  
- `@eq:energy` → 1  
- `@fig:second` → 2  

### Canonical identity

The canonical identity of a label is:

- `foo` for global labels
- `name:foo` for named labels

The enumeration name is part of the identity.

Therefore:

- `@foo` ≠ `@fig:foo`
- `@fig:one` ≠ `@eq:one`

### Duplicate rules

Duplicates are determined by canonical identity:

- `@foo` and `@foo` → duplicate
- `@fig:one` and `@fig:one` → duplicate
- `@fig:one` and `@eq:one` → not duplicate
- `@foo` and `@bar:foo` → not duplicate

### Reference resolution

References must resolve within the same enumeration.

- A reference to a global label resolves only to the global enumeration
- A reference to a named label resolves only within that named enumeration
- Resolution must **not fall back across enumerations**

Examples:

- `fig:one` must not resolve to `eq:one`
- `foo` must not resolve to `bar:foo`

When a reference resolves to a named-enumeration label, the rendered number comes from that enumeration.

### Interaction with sections

- Section numbering remains separate from enumerations
- If a section has an explicit label (global or named), that label is authoritative
- If a label is defined using a named enumeration, the rendered reference uses that enumeration’s numbering rather than section numbering

### Explicit labels in headings

A section heading may have an explicit label only in the global label space:

- `## @label Title`

Named-enumeration labels are not allowed in section headings:

- invalid: `## @fig:overview Overview`
- invalid: `## @eq:energy Methods`

Reason:
- section headings are always numbered by section hierarchy
- named enumerations such as `fig` and `eq` have their own numbering systems
- allowing named-enumeration syntax in headings would suggest conflicting numbering semantics

If a named-enumeration label appears in a heading, scanning should throw an exception.

### Reserved namespace: `eq`

The namespace `eq` is reserved for displayed LaTeX equation blocks.

Labels of the form `@eq:name` are valid only inside display math.

Supported display-math delimiters are:

- `$$ ... $$`
- `$begin:math:display$ \.\.\. $end:math:display$`

Examples:

    $$
    \int_{x=0}^t x^2 dx   @eq:foo
    $$

and

    \[
    \int_{x=0}^t x^2 dx   @eq:foo
    \]

A label `@eq:name` must not appear in ordinary text, headings, list items, or inline math.

When rendered, the label is replaced by an explicit LaTeX tag:

    \tag{n}

where `n` is the equation number in the notebook-global `eq` enumeration.
KaTeX automatically wraps the tag content in parentheses, so `\tag{1}` renders as `(1)`.

For the first equation example above and assuming it is the first equation
in a notebook, the rendered result is:

    $$
    \int_{x=0}^t x^2 dx     \tag{1}
    $$

### Equation tag formatting

- Emit `\tag{n}` where `n` is the equation number (no parentheses in the argument).
- Do not emit `\tag{(n)}` — KaTeX adds parentheses automatically, so that would produce `((n))`.

This ensures the rendered output displays as `(1)`, `(2)`, etc.

### Semantics of the `eq` enumeration

- The `eq` enumeration is distinct from the global enumeration and from other named enumerations.
- Equation numbering is notebook-global.
- Equation numbering is assigned in notebook order.
- References to equation labels may appear anywhere markdown references are allowed.
- An equation reference resolves to the numbering of the `eq` enumeration.

Examples:

    See #eq:foo.

is allowed outside the equation block and should render using the equation number assigned to `@eq:foo`.        

### Priority order

1. **Exact match against an explicit label**
   - If `#r` exactly matches an explicit label, that match is authoritative.
   - The rendered number comes from the context where that explicit label was defined:
     - if the label was defined on a section heading, render the **section number**
     - if the label was defined in ordinary text, render the **global-enumeration number**
     - later, if the label was defined in a named enumeration, render that enumeration’s number

2. **Exact match against an implicit section label**
   - Implicit labels apply only to sections.
   - An exact match against a section’s implicit label resolves to that section.

3. **Unique prefix match against an implicit section label**
   - If no exact match is found, a reference may match a section by unique prefix.
   - Prefix matching applies only to implicit section labels.
   - If a prefix matches more than one implicit section label, the reference is ambiguous.

4. **Otherwise unresolved**
   - An unresolved reference renders visibly as:
     `⚠ unresolved: #r`

### Important consequences

- Explicit labels are authoritative.
- Implicit labels exist only for sections.
- Exact implicit section matches take precedence over prefix matches.
- Section numbering and global-enumeration numbering are distinct, but the
  reference syntax `#r` is shared. The numbering used in the rendered output
  comes from the kind of object that was resolved.

### Examples

#### Explicit label on a section

```md
## @foo Methods

See #foo.
```

### Scope

Section numbering is global within a notebook.
It is not reset per markdown cell.

### Consistency model

Section numbering and reference resolution are global within a notebook,
but the system is non-reactive.

This means:

  - numbering may become temporarily inconsistent if cells are moved,
    inserted, or deleted without rerendering affected cells
    
  - numbering and references should become consistent again after a
    notebook-wide execution action such as "Run All" (or any
    equivalent action that rerenders all relevant markdown cells)
    
The source markdown is never rewritten; only rendered output is updated.


## Implementation preference:

  - maintain notebook-global numbering state
  - refresh that state on notebook-open and notebook-wide run actions
  - do not attempt full reactive maintenance during arbitrary editing or reordering


## Heading numbering policy

Section numbering is derived from markdown heading structure in notebook order.

Forgiving rule for skipped heading levels:
- If a heading jumps by more than one level relative to the previous numbered heading,
  numbering compresses the gap instead of inserting zeros.

Example:

```md
## Second
#### Deep Section
```

renders with numbering equivalent to:

```md
## 2. Second
#### 2.1 Deep Section
```


## Duplicate implicit section labels are not allowed.

If two or more sections would normalize to the same implicit label,
all such sections must be given distinct explicit labels.
It is not sufficient to label only one of them.

Example:

```md
### @gkanalysis Analysis
### @monsteranalysis Analysis
```


## Citation Design and Consistency Model

Citations are designed to be **non-reactive**, favoring simplicity and robustness over immediate
global consistency.   I tried a reactive design and it proved to be complex, fragile, and racy.

### Key Principles

- Citation numbering is **not updated incrementally**
- Citation state is treated as a **derived artifact** of the notebook
- A **full notebook scan** is used to rebuild citation state when needed
- The system avoids reference counting, mutation tracking, and reactive updates.
- A rebuild occurs when a cell containing the bibliography is re-executed (see
  Bibliography Blocks, i.e., section @bib) .

### Citation Syntax

Citations use the caret (`^`) syntax:

    ^lamport1994

This refers to a BibTeX entry with key `lamport1994`.

### Bibliography Blocks

A bibliography is defined using a fenced directive:

    ::: bibliography
    src: path/to/file.bib
    :::

- `src` may be:
  - a local file (e.g., `refs.bib`)
  - a relative path (e.g., `papers/refs.bib`)
  - a remote URL

- When a bibliograph block is executed, the entire document
  is scanned  (see Synchornization Point, i.e., Section @syn).
  
- A bibliography block can be found anywhere in the notebook.
  When a document is opened, every cell must be scanned
  for citations and a list of citations is built spanning
  all cells.  The ordering follows the order of first appearance.
  Global state should be implemented with a Map<string, number>, 
  which maps from the citation label to a number denoting
  the order of insertion into the map starting from 1
  for the first citation encountered in the sweep of the
  entire notebook.

- If citations are found, but no bibliography block is found
  after a sweep of the entire document then a cell is appeneded
  to the end of the document containing a bibliography
  block is created with instructions on how to reference
  a .bib file. 


### Rendering Behavior

- Citations are replaced at render time (non-destructively)
- The original Markdown source is not modified
- Each citation resolves to a formatted reference derived from the BibTeX entry

    @article{lamport1994,
      author  = {Leslie Lamport},
      title   = {LaTeX: A Document Preparation System},
      journal = {Software: Practice and Experience},
      year    = {1994}
    }

  which results in this example output:

    [1] Leslie Lamport, “LaTeX: A Document Preparation System,” Software: Practice and Experience, 1994.

### Bibliography Formatting (IEEE-Style)

Bibliography entries are rendered using a simplified IEEE-style
format. The goal is to produce output that is clear, consistent, and
recognizable, without implementing the full IEEE specification.

Each entry is formatted as:

    [n] Author(s), “Title,” Venue, Year.

Where:

- `[n]` is the citation number
- `Author(s)` are taken from the `author` field (joined by commas)
- `Title` is taken from the `title` field and enclosed in quotation marks
- `Venue` is taken from `journal` or `booktitle`
- `Year` is taken from the `year` field

Example:

- Given the following entry in the associated .bib file

    @article{lamport1994,
      author  = {Leslie Lamport},
      title   = {LaTeX: A Document Preparation System},
      journal = {Software: Practice and Experience},
      year    = {1994}
    }

  and the first markdown cell containing

    ^lamport1994
    
  we would see this output in the rendered output of the cell containing the bibliography directive:

    [1] Leslie Lamport, “LaTeX: A Document Preparation System,” Software: Practice and Experience, 1994.

### Formatting Notes

- If a field is missing, it is omitted or replaced with a reasonable fallback (e.g., `"Unknown"` for authors)
- No strict formatting of author initials is performed
- Should include support for volume, number, and pages when present in the .bib file.
- The emphasis is on simplicity, readability, and deterministic output

### Resolution Rules

- All citations are resolved against the active bibliography sources
- Missing keys produce [?] in the rendered output
- Duplicate keys across sources also produce warnings
- Only citations outside of code blocks, inline code, and HTML comments are processed

### Global Citation State

Citation numbering is **not maintained continuously**. Instead:

- A notebook-wide citation map is rebuilt from scratch
- Keys are collected in notebook order
- Each unique key is assigned a number
- All occurrences of a key share the same number

### Synchronization Point

The bibliography cell acts as the **explicit synchronization point**.

When the bibliography cell is executed:

1. All markdown cells are scanned
2. Citation keys are collected and deduplicated
3. Citation numbers are assigned
4. The global citation state is replaced
5. The `.bib` file is reloaded if needed
6. The bibliography is rendered using the updated state

### Rendering Behavior

- After execution of the bibliography cell, the bibliography cell reflects
  the **current global citation state**
- Other markdown cells are **not automatically rerendered**
- Citation displays in those cells may be temporarily stale
- Cells become consistent when they are **individually rerendered**
- Thus the objective is eventual consistency.

This results in **eventual consistency** across the notebook.

### Bibliography Loading

- Bibliography files are cached
- On bibliography render, the system checks whether the `.bib` source has changed
- If changed, the file is reloaded and reparsed
- Otherwise, the cached version is reused

### Design Rationale

This approach avoids:

- incremental state updates
- reference counting for citation usage
- complexity from cell insertion, deletion, or reordering
- global rerendering of the notebook as citations are added or removed.
- fragile reactive behavior tied to DOM or execution timing

Instead, it relies on:

- explicit recomputation
- clear synchronization points
- simple, predictable state transitions

This trade-off favors correctness, maintainability, and resilience over
immediate visual consistency.

### Design Notes

- Citation handling is implemented separately from cross-references
- parsing individual cells looking for citations may appear in `syntax.ts`
  in `scanCitations`.
- Bibliography logic resides in `bib.ts`
- Rendering integrates both citation and reference transforms at display time

## Hyperlinking cross-references and citations

Rendered references and citations should become hyperlinks.
Hyperlinks from hash tag referencdes should link to the appropriate
label or section.  Citations should link to the appropriate entry
in the bibliography.  The HTML markup for hyperlinks and anchors
should ONLY be added when rendering the markdown.

However, do **not** implement hyperlinking by blindly injecting raw HTML into
markdown source text. That approach can corrupt markdown or produce incorrect
rendering when a label or reference appears inside syntax regions that should be
treated as literal or otherwise protected content.

### Safe placement rules

- Hyperlinks should be applied where it is unlikely to interfere with
  rendering markdown.

- Anchors should use the explicit or canonical names that are used for
  labels, but for named enumerations, some browsers migth take issue
  with a colon appearing in an anchor or hyperlink.  In the hyperlink
  and anchor, replace the colon in a named enumeration with a dash.
  For example, @fig:foo would appear as fig-foo in an anchor.

- A blank line should appear between an anchor and the Mardown that contains
  a label.
  
- For math blocks, place hyperlink anchors **immediately before the math block**
  rather than inside it.

  Example:
  
  Instead of modifying:
  $$
  E = mc^2   @eq:energy
  $$
  
  Prefer:
  
  <a id="eq-energy"></a>
  
  $$
  E = mc^2   \tag{1}
  $$

- Anchors should be placed in the line ABOVE a heading.

```
## Introduction
```

during rendering becomes

```
<a id="introduction"></a>

1. Introduction
```

- Anchors should placed in the line above a paragraph containing a label.

```
Figure @fig:foo displays the shape of the warp field bubble in a practical low-energy configuration.
```

would transform during rendering to

```

<a id="fig-foo"></a>

Figure 1 displays the shape of the warp field bubble in a practical low-energy configuration.
```

- Explicit labels are used as the anchor.  For example if the section below is the second
section the jupyter notebook,

```
## @boo The Greatness of Boo
```

would transform during rendering to

```

<a id="boo"></a>

## 2. The Greatness of Boo
```

If there is more than one label in a paragraph, the anchors may appear
consecutively above the paragraph in the order that the labels
appeared in the paragraph.

```
In the Age of Arlis (@age), the drunk Arlis (@arlis) learned how to control minds, and like
Asimov's Mule, became Emperor of the World only to die at a young age by accidentally
stumbling off the balcony to his palace bedroom.
```

becomes

```

<a id="age"></a>
<a id="arlis"></a>

In the Age of Arlis (1), the drunk Arlis (2) learned how to control minds, and like
Asimov's Mule, became Emperor of the World only to die at a young age by accidentally
stumbling off the balcony to his palace bedroom.
```

Hash tags also must be updated to include hyperlinks to the appropirate anchor.
In the markdown cell containing a heading, might appear as

```
## Introduction
```

This is transformed during rendering to

```
<a id="introduction"></a>                                                                                            
                                                                                                                       
1. Introduction</h
```
                                                                                                                       
In the cell containing the reference See #introduction, as markdown it appear as

```
See #introduction
```

which is transformed during rendering to 

```
See <a href="#introduction">1</a>.
```

### Forbidden contexts for HTML injection

Do not inject hyperlinks or anchors inside:
- inline code spans
- fenced code blocks
- HTML comments
- raw HTML regions or attributes
- LaTeX math content (inline or block)
- any other markdown sublanguage or protected environment

### Implementation guidance

- Treat math environments similarly to code blocks: they are structurally opaque.
- Use syntax-aware parsing or tokenization rather than regex-based substitution.
- If a label is associated with math, emit the anchor immediately before the
  math block during rendering rather than rewriting the math itself.
- If safety is uncertain, render the reference without a hyperlink rather than
  risking malformed markdown or broken rendering.
  
## Test oracle

There are two test layers:

1. `npm run test:unit`
   - This is the primary semantic oracle.
   - These tests verify parsing, label/reference resolution, section numbering,
     and markdown-to-markdown transformation.
   - Prefer satisfying these tests first.

2. `npm run test:smoke` / `npm run test:ui`
   - These are integration tests.
   - They verify that the extension is loaded and wired into JupyterLab.
   - They should not be the main oracle for syntax semantics.


## Error handling in `scanNotebook`

`scanNotebook` must not stop processing when it encounters parse or
labeling errors. It should continue scanning the full notebook,
collect all recoverable errors, and log them rather than throwing
exceptions.

### Required behavior

- Do not throw for recoverable scan-time problems such as duplicate labels or other malformed label/reference situations.
- Report each error through an injected logger interface.
- In browser/runtime use, the logger should write to the console.
- In tests, the logger should be injectable so tests can assert that an error was reported.
- `scanNotebook` should still return a complete notebook state for as much of the notebook as can be analyzed.

### State returned from scanning

The returned notebook state should include enough information to
render warnings later. This should work similarly to how duplicates
are tracked now.

In particular:

- labels or references that participated in an error should be recorded in returned state
- duplicate labels should continue to be returned as duplicates
- other scan-time problems should also be represented in returned state, likely as an `errors` or `issues` collection
- this returned state becomes part of the global render-time state

### Render-time goal

Render-time transformation should use collected scan errors to
annotate markdown output with visible warnings instead of failing
early.

Examples of existing or desired warning forms:

- `⚠ unresolved: ${match}`
- `⚠ duplicate: @${raw}`

The guiding principle is: scan broadly, log errors, return structured
error state, and let rendering surface warnings inline to the user.


## Test execution order

When implementing or modifying features, do not start with Playwright tests.

Follow this order:
1. Run unit tests and other non-Playwright tests first.
2. Make the non-Playwright test suite pass before touching Playwright tests.
3. Only run Playwright tests after the underlying parsing, transformation, and model logic is stable.

Reason:
- Playwright tests are slower and should be used only after core logic is validated.
- Prefer isolating failures in pure logic tests before checking UI behavior.


## Protected test files

Tests were passing for these files.   Do not change these tests:

  * playwright-tests/mdx_explicit_label.spec.ts
  * playwright-tests/mdx_implicit_label.spec.ts
  * playwright-tests/mdx_smoke.spec.ts
  * playwright-tests/smoke.spec.ts

Other test files are newer and may contain inconsistencies.  Please point out
discovered consistencies.
