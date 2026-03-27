import { scanLabels, normalize, HeadingLabelError } from './syntax';

export interface SectionInfo {
  kind: 'section';
  level: number;      // literal markdown heading level
  title: string;
  number: string;     // derived section number, e.g. "2.1"
  isExplicit: boolean;
}

// @foo is in the global enumeration.  @fig:foo is label `foo`
// in the enumeration `fig`.
export interface EnumerationInfo {
  kind: 'enumeration';
  name: string;       // 'global', 'fig', 'eq', ...
  number: string;     // derived enumeration number within that enumeration
}

export type LabelInfo = SectionInfo | EnumerationInfo;

export interface NotebookState {
  labels: Map<string, LabelInfo>;
  sections: string[];                      // ordered canonical labels of sections
  enumerations: Map<string, string[]>;     // ordered canonical labels per enumeration
  duplicates: Set<string>;                 // canonical labels that appeared more than once
  duplicateSecondaries: Map<string, number[]>;
  primaryCellIndices: Map<string, number>; // canonical label → cell index of primary occurrence
}

export class DuplicateLabelError extends Error {
  label: string;
  partialState?: NotebookState;

  constructor(label: string) {
    super(`Duplicate canonical label: ${label}`);
    this.name = 'DuplicateLabelError';
    this.label = label;
  }
}

export class EnumerationContextError extends Error {
  enumerationName: string;
  label: string;
  context: string;

  constructor(enumerationName: string, label: string, context: string) {
    super(
      `Label @${enumerationName}:${label} is not allowed in ${context}`
    );
    this.name = 'EnumerationContextError';
    this.enumerationName = enumerationName;
    this.label = label;
    this.context = context;
  }
}

export class ReservedEnumerationMisuseError extends Error {
  enumerationName: string;
  label: string;

  constructor(enumerationName: string, label: string, message?: string) {
    super(message ?? `Reserved enumeration ${enumerationName} misused: ${label}`);
    this.name = 'ReservedEnumerationMisuseError';
    this.enumerationName = enumerationName;
    this.label = label;
  }
}

interface StackEntry { level: number; counter: number; }

/**
 * First pass over the notebook.
 *
 * `cells` contains only markdown cells, in notebook order.
 * Throws `DuplicateLabelError` if two labels normalize to the same canonical label.
 * Throws `ReservedEnumerationMisuseError` if an eq label appears outside a display math block,
 * or if a named-enum label of the form @eq:x appears in a section heading.
 * Throws `EnumerationContextError` if any other named-enum label appears in a section heading.
 */
export function scanNotebook(cells: string[]): NotebookState {
  const labels = new Map<string, LabelInfo>();
  const sections: string[] = [];
  const enumerations = new Map<string, string[]>();
  const duplicates = new Set<string>();
  const duplicateSecondaries = new Map<string, number[]>();
  const primaryCellIndices = new Map<string, number>();
  const stack: StackEntry[] = [];
  const reservedTitles = new Set<string>();
  let currentCellIndex = 0;

  function sectionNumber(): string {
    return stack.map(e => e.counter).join('.');
  }

  function pushHeading(level: number): string {
    if (stack.length === 0) {
      stack.push({ level, counter: 1 });
    } else if (level > stack[stack.length - 1].level) {
      stack.push({ level, counter: 1 });
    } else if (level === stack[stack.length - 1].level) {
      stack[stack.length - 1].counter++;
    } else {
      while (stack.length > 0 && stack[stack.length - 1].level > level) {
        stack.pop();
      }
      if (stack.length > 0 && stack[stack.length - 1].level === level) {
        stack[stack.length - 1].counter++;
      } else {
        stack.push({ level, counter: 1 });
      }
    }
    return sectionNumber();
  }

  function registerLabel(canonicalLabel: string, info: LabelInfo, state: NotebookState): void {
    if (labels.has(canonicalLabel)) {
      duplicates.add(canonicalLabel);
      const arr = duplicateSecondaries.get(canonicalLabel) ?? [];
      arr.push(currentCellIndex);
      duplicateSecondaries.set(canonicalLabel, arr);
      const err = new DuplicateLabelError(canonicalLabel);
      err.partialState = state;
      throw err;
    }
    labels.set(canonicalLabel, info);
    primaryCellIndices.set(canonicalLabel, currentCellIndex);
  }

  function addToEnumeration(name: string, label: string, info: EnumerationInfo, state: NotebookState): void {
    if (!enumerations.has(name)) enumerations.set(name, []);
    const enumList = enumerations.get(name)!;
    const enumNumber = String(enumList.length + 1);
    (info as any).number = enumNumber;
    registerLabel(label, info, state);
    enumList.push(label);
  }

  for (let ci = 0; ci < cells.length; ci++) {
    currentCellIndex = ci;
    const cellSource = cells[ci];

    let analysis;
    try {
      analysis = scanLabels(cellSource);
    } catch (err) {
      if (err instanceof HeadingLabelError) {
        if (err.enumerationName.toLowerCase() === 'eq') {
          throw new ReservedEnumerationMisuseError(err.enumerationName, err.member);
        }
        throw new EnumerationContextError(err.enumerationName, err.member, 'section heading');
      }
      throw err;
    }

    // Track which labels came from headings in this cell
    const headingLabelSet = new Set(
      analysis.headings.filter(h => h.explicitLabel).map(h => h.explicitLabel!)
    );

    for (const heading of analysis.headings) {
      if (heading.level === 1) continue;

      const number = pushHeading(heading.level);
      const canonicalLabel = heading.explicitLabel ?? normalize(heading.title);
      const normalizedTitle = normalize(heading.title);

      const info: SectionInfo = {
        kind: 'section',
        level: heading.level,
        title: heading.title,
        number,
        isExplicit: !!heading.explicitLabel,
      };

      const state: NotebookState = { labels, sections, enumerations, duplicates, duplicateSecondaries, primaryCellIndices };

      if (!heading.explicitLabel && reservedTitles.has(normalizedTitle)) {
        duplicates.add(normalizedTitle);
        const arr = duplicateSecondaries.get(normalizedTitle) ?? [];
        arr.push(currentCellIndex);
        duplicateSecondaries.set(normalizedTitle, arr);
        const err = new DuplicateLabelError(normalizedTitle);
        err.partialState = state;
        throw err;
      }

      reservedTitles.add(normalizedTitle);
      registerLabel(canonicalLabel, info, state);
      sections.push(canonicalLabel);
    }

    // Body labels
    for (const label of analysis.labelsDefined) {
      if (headingLabelSet.has(label)) continue;

      const state: NotebookState = { labels, sections, enumerations, duplicates, duplicateSecondaries, primaryCellIndices };

      if (label.includes(':')) {
        const colonIdx = label.indexOf(':');
        const name = label.slice(0, colonIdx);
        const member = label.slice(colonIdx + 1);

        if (name === 'eq') {
          throw new ReservedEnumerationMisuseError('eq', member);
        }

        const info: EnumerationInfo = { kind: 'enumeration', name, number: '' };
        addToEnumeration(name, label, info, state);
      } else {
        const info: EnumerationInfo = { kind: 'enumeration', name: 'global', number: '' };
        addToEnumeration('global', label, info, state);
      }
    }

    // Equation labels from display math
    for (const label of analysis.eqLabels) {
      const state: NotebookState = { labels, sections, enumerations, duplicates, duplicateSecondaries, primaryCellIndices };
      const info: EnumerationInfo = { kind: 'enumeration', name: 'eq', number: '' };
      addToEnumeration('eq', label, info, state);
    }
  }

  return { labels, sections, enumerations, duplicates, duplicateSecondaries, primaryCellIndices };
}

/**
 * Resolves a user-facing reference to a canonical label.
 *
 * Precedence:
 *   1. Exact match in labels map (explicit or implicit)
 *   2. Unique prefix match against implicit section labels only
 */
export function resolveReference(ref: string, state: NotebookState): string | null {
  if (ref.includes(':')) {
    const colonIdx = ref.indexOf(':');
    const canonical = normalize(ref.slice(0, colonIdx)) + ':' + normalize(ref.slice(colonIdx + 1));
    return state.labels.has(canonical) ? canonical : null;
  }

  const normalizedRef = normalize(ref);

  if (state.labels.has(normalizedRef)) {
    return normalizedRef;
  }

  // Prefix match only for implicit section labels
  const prefixMatches = state.sections.filter(label => {
    const info = state.labels.get(label) as SectionInfo;
    return !info.isExplicit && label.startsWith(normalizedRef);
  });

  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

// ---------------------------------------------------------------------------
// Internal helpers for transformMarkdown
// ---------------------------------------------------------------------------

function headingSeparator(number: string): string {
  return number.includes('.') ? ' ' : '. ';
}

function transformActiveParts(line: string, fn: (text: string) => string): string {
  const parts: string[] = [];
  const codePattern = /`[^`]*`/g;
  let lastEnd = 0;
  let m: RegExpExecArray | null;

  while ((m = codePattern.exec(line)) !== null) {
    parts.push(fn(line.slice(lastEnd, m.index)));
    parts.push(m[0]);
    lastEnd = m.index + m[0].length;
  }
  parts.push(fn(line.slice(lastEnd)));
  return parts.join('');
}

function transformBodyText(text: string, state: NotebookState, cellIndex?: number, cellOccurrences?: Map<string, number>): string {
  // Replace @label (including @name:member) with its number
  let result = text.replace(/@(\w+(?::\w+)?)/g, (match, raw) => {
    const canonical = raw.includes(':')
      ? normalize(raw.slice(0, raw.indexOf(':'))) + ':' + normalize(raw.slice(raw.indexOf(':') + 1))
      : normalize(raw);
    let isSecondary: boolean;
    if (typeof cellIndex === 'number' && cellOccurrences) {
      const count = (cellOccurrences.get(canonical) ?? 0) + 1;
      cellOccurrences.set(canonical, count);
      const primCell = state.primaryCellIndices?.get(canonical);
      const inSecondaries = (state.duplicateSecondaries?.get(canonical) ?? []).includes(cellIndex);
      isSecondary = inSecondaries && (primCell !== cellIndex || count > 1);
    } else {
      isSecondary = state.duplicates.has(canonical);
    }
    if (isSecondary) return `⚠ duplicate: @${raw}`;
    const info = state.labels.get(canonical);
    return info ? info.number : match;
  });

  // Replace #ref (including #name:member) with resolved number or warning
  result = result.replace(/#(\w+(?::\w+)?)/g, (match, ref) => {
    const canonical = resolveReference(ref, state);
    if (!canonical) return `⚠ unresolved: ${match}`;
    const info = state.labels.get(canonical);
    return info ? info.number : `⚠ unresolved: ${match}`;
  });

  return result;
}

/**
 * Render-time transform for a single markdown cell.
 * `cellIndex` is the markdown-cell index (0-based) within the notebook.
 * When provided, duplicate warnings are shown only for secondary occurrences;
 * the primary (first) occurrence is numbered normally.
 */
export function transformMarkdown(md: string, state: NotebookState, cellIndex?: number): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let inFencedBlock = false;
  let inHtmlComment = false;
  let inDisplayMath = false;
  let pendingEqDuplicates: string[] = [];
  const cellOccurrences = new Map<string, number>();

  for (const line of lines) {
    // HTML comment tracking
    if (inHtmlComment) {
      result.push(line);
      if (line.includes('-->')) inHtmlComment = false;
      continue;
    }

    // Fenced code block tracking
    if (inFencedBlock) {
      result.push(line);
      if (/^(`{3,}|~{3,})\s*$/.test(line)) inFencedBlock = false;
      continue;
    }

    if (/^(`{3,}|~{3,})/.test(line)) {
      inFencedBlock = true;
      result.push(line);
      continue;
    }

    if (line.trimStart().startsWith('<!--')) {
      if (!line.includes('-->')) inHtmlComment = true;
      result.push(line);
      continue;
    }

    // Helper: replace @eq:label within a display-math string
    const replaceEqLabels = (s: string): string =>
      s.replace(/@eq:(\w+)/g, (match, member) => {
        const canonical = 'eq:' + normalize(member);
        let isSecondary: boolean;
        if (typeof cellIndex === 'number') {
          const count = (cellOccurrences.get(canonical) ?? 0) + 1;
          cellOccurrences.set(canonical, count);
          const primCell = state.primaryCellIndices?.get(canonical);
          const inSecondaries = (state.duplicateSecondaries?.get(canonical) ?? []).includes(cellIndex);
          isSecondary = inSecondaries && (primCell !== cellIndex || count > 1);
        } else {
          isSecondary = state.duplicates.has(canonical);
        }
        if (isSecondary) { pendingEqDuplicates.push(`⚠ duplicate: @eq:${member}`); return ''; }
        const info = state.labels.get(canonical);
        return info ? `\\tag{${info.number}}` : match;
      });

    // Display math delimiters
    const trimmed = line.trim();
    if (trimmed === '$$') {
      if (inDisplayMath) {
        inDisplayMath = false;
        result.push(line);
        for (const dup of pendingEqDuplicates) result.push(dup);
        pendingEqDuplicates = [];
      } else {
        inDisplayMath = true;
        result.push(line);
      }
      continue;
    }
    if (trimmed === '\\[') { inDisplayMath = true; result.push(line.replace('\\[', '$$')); continue; }
    if (trimmed === '\\]') {
      inDisplayMath = false;
      result.push(line.replace('\\]', '$$'));
      for (const dup of pendingEqDuplicates) result.push(dup);
      pendingEqDuplicates = [];
      continue;
    }

    // Single-line $$...$$ block
    if (!inDisplayMath && trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      result.push(replaceEqLabels(line));
      continue;
    }
    // Opening $$ with inline content
    if (!inDisplayMath && trimmed.startsWith('$$') && trimmed.length > 2) {
      inDisplayMath = true;
      result.push(replaceEqLabels(line));
      continue;
    }
    // Closing $$ with inline content
    if (inDisplayMath && trimmed.endsWith('$$') && !trimmed.startsWith('$$')) {
      inDisplayMath = false;
      result.push(replaceEqLabels(line));
      for (const dup of pendingEqDuplicates) result.push(dup);
      pendingEqDuplicates = [];
      continue;
    }

    // Inside display math
    if (inDisplayMath) {
      result.push(replaceEqLabels(line));
      continue;
    }

    // ATX heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const hashes = headingMatch[1];
      const level = hashes.length;
      const headingText = headingMatch[2].trim();

      // Level-1 headings are not numbered sections — pass through as-is
      if (level === 1) {
        result.push(line);
        continue;
      }

      const labelMatch = headingText.match(/^@(\w+)\s+(.*)/);
      const rawLabel = labelMatch ? labelMatch[1] : null;
      const title = labelMatch ? labelMatch[2].trim() : headingText;
      const canonicalLabel = rawLabel ? normalize(rawLabel) : normalize(headingText);

      const isSecondary =
        typeof cellIndex === 'number'
          ? (state.duplicateSecondaries?.get(canonicalLabel) ?? []).includes(cellIndex)
          : state.duplicates.has(canonicalLabel);

      if (isSecondary) {
        result.push(`${hashes} ${title}`);
        result.push('');
        result.push(`⚠ duplicate: @${rawLabel ?? canonicalLabel}`);
      } else {
        const info = state.labels.get(canonicalLabel);
        if (info && info.kind === 'section') {
          const sep = headingSeparator(info.number);
          result.push(`${hashes} ${info.number}${sep}${title}`);
        } else {
          // Label not in state — output as-is with @label stripped
          result.push(`${hashes} ${title}`);
        }
      }
      continue;
    }

    // Body text
    result.push(transformActiveParts(line, text => transformBodyText(text, state, cellIndex, cellOccurrences)));
  }

  return result.join('\n');
}
