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
  @([A-Za-z][A-Za-z0-9_]*)

Reference:
  #([A-Za-z][A-Za-z0-9_])

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

### Backward compatibility

Existing global-label behavior must remain unchanged:

- `@foo` continues to behave exactly as before
- Adding named enumerations must not alter:
  - existing numbering
  - existing reference resolution
  - existing tests or fixtures

Named enumerations are strictly additive.

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

When rendered, the label is replaced by an explicit LaTeX tag with parentheses:

    \tag{(n)}

where `n` is the equation number in the notebook-global `eq` enumeration.

For the first equation example above and assuming it is the first equation
in a notebook, the rendered result is:

    $$
    \int_{x=0}^t x^2 dx     \tag{(1)}
    $$

### Equation tag formatting

- The system must always emit equation tags with parentheses.
- Use `\tag{(n)}` where `n` is the equation number.
- Do not emit `\tag{n}`.

This ensures consistency with standard LaTeX equation numbering, which is conventionally displayed as `(1)`, `(2)`, etc.

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