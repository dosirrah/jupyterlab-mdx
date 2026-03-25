import { scanLabels, normalize } from './syntax';

export interface SectionInfo {
  kind: 'section';
  level: number;      // literal markdown heading level
  title: string;
  number: string;     // derived section number, e.g. "2.1"
  isExplicit: boolean;
}

export interface EnumerationInfo {
  kind: 'enumeration';
  number: string;     // derived global-enumeration number, e.g. "3"
}

export type LabelInfo = SectionInfo | EnumerationInfo;

export interface NotebookState {
  labels: Map<string, LabelInfo>;
  sections: string[];      // ordered canonical labels of sections
  enumeration: string[];   // ordered canonical labels in the global enumeration
  duplicates: Set<string>; // canonical labels that appeared more than once
  // Maps canonical label → markdown-cell indices that are secondary occurrences.
  // The primary (first) occurrence is NOT listed here.  Used by transformMarkdown
  // when a cell index is available so that only the secondary gets the warning.
  duplicateSecondaries: Map<string, number[]>;
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

interface StackEntry { level: number; counter: number; }

/**
 * First pass over the notebook.
 *
 * `cells` contains only markdown cells, in notebook order.
 * Throws `DuplicateLabelError` if two labels normalize to the same canonical label.
 */
export function scanNotebook(cells: string[]): NotebookState {
  const labels = new Map<string, LabelInfo>();
  const sections: string[] = [];
  const enumeration: string[] = [];
  const duplicates = new Set<string>();
  const duplicateSecondaries = new Map<string, number[]>();
  const stack: StackEntry[] = [];
  // Tracks normalized titles of ALL sections so that an implicit section
  // cannot share a title with an existing explicitly-labelled section.
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
  }

  for (let ci = 0; ci < cells.length; ci++) {
    currentCellIndex = ci;
    const cellSource = cells[ci];
    const analysis = scanLabels(cellSource);

    // Track which labels came from headings in this cell
    const headingLabelSet = new Set(
      analysis.headings.filter(h => h.explicitLabel).map(h => h.explicitLabel!)
    );

    for (const heading of analysis.headings) {
      // Level-1 headings are titles, not numbered sections
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

      const state: NotebookState = { labels, sections, enumeration, duplicates, duplicateSecondaries };

      // For implicit sections, also check whether the title is already reserved
      // by an explicit section (which hides the implicit title from resolution).
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

    // Non-heading explicit labels → global enumeration
    for (const label of analysis.labelsDefined) {
      if (headingLabelSet.has(label)) continue;

      const enumNumber = String(enumeration.length + 1);
      const info: EnumerationInfo = { kind: 'enumeration', number: enumNumber };
      const state: NotebookState = { labels, sections, enumeration, duplicates, duplicateSecondaries };
      registerLabel(label, info, state);
      enumeration.push(label);
    }
  }

  return { labels, sections, enumeration, duplicates, duplicateSecondaries };
}

/**
 * Resolves a user-facing reference to a canonical label.
 *
 * Precedence:
 *   1. Exact match in labels map (explicit or implicit)
 *   2. Unique prefix match against implicit section labels only
 */
export function resolveReference(ref: string, state: NotebookState): string | null {
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

function transformBodyText(text: string, state: NotebookState): string {
  // Replace @label with its number
  let result = text.replace(/@(\w+)/g, (match, raw) => {
    const canonical = normalize(raw);
    if (state.duplicates.has(canonical)) return `⚠ duplicate: @${raw}`;
    const info = state.labels.get(canonical);
    return info ? info.number : match;
  });

  // Replace #ref with resolved number or warning
  result = result.replace(/#(\w+)/g, (match, ref) => {
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
    result.push(transformActiveParts(line, text => transformBodyText(text, state)));
  }

  return result.join('\n');
}
