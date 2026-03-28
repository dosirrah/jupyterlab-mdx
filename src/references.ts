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

export interface ScanIssue {
  kind: 'duplicate-label' | 'reserved-enumeration-misuse' | 'enumeration-context';
  message: string;
  label: string;
}

export interface ScanLogger {
  warn(message: string, issue: ScanIssue): void;
}

const noopLogger: ScanLogger = { warn() {} };

export interface NotebookState {
  labels: Map<string, LabelInfo>;
  sections: string[];                      // ordered canonical labels of sections
  enumerations: Map<string, string[]>;     // ordered canonical labels per enumeration
  duplicates: Set<string>;                 // canonical labels that appeared more than once
  misused: Set<string>;                    // canonical labels misused in wrong context (e.g. @eq:foo in body text)
  primarySectionCells: Map<string, number>; // canonical section label → markdown-cell index of the primary registration
  issues: ScanIssue[];                     // all scan-time problems encountered
}

interface StackEntry { level: number; counter: number; }

/**
 * First pass over the notebook.
 *
 * `cells` contains only markdown cells, in notebook order.
 * Scans all cells regardless of errors. Recoverable problems are logged via `logger`
 * and recorded in the returned `issues` array rather than thrown as exceptions.
 */
export function scanNotebook(cells: string[], logger: ScanLogger = noopLogger): NotebookState {
  const labels = new Map<string, LabelInfo>();
  const sections: string[] = [];
  const enumerations = new Map<string, string[]>();
  const duplicates = new Set<string>();
  const misused = new Set<string>();
  const primarySectionCells = new Map<string, number>();
  const issues: ScanIssue[] = [];
  let mdCellIndex = 0;
  const stack: StackEntry[] = [];
  const reservedTitles = new Set<string>();

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

  function recordIssue(issue: ScanIssue): void {
    issues.push(issue);
    logger.warn(issue.message, issue);
  }

  // Returns true if the label was registered, false if it was a duplicate.
  function registerLabel(canonicalLabel: string, info: LabelInfo): boolean {
    if (labels.has(canonicalLabel)) {
      duplicates.add(canonicalLabel);
      recordIssue({
        kind: 'duplicate-label',
        message: `Duplicate canonical label: ${canonicalLabel}`,
        label: canonicalLabel,
      });
      return false;
    }
    labels.set(canonicalLabel, info);
    return true;
  }

  function addToEnumeration(name: string, label: string, info: EnumerationInfo): void {
    if (!enumerations.has(name)) enumerations.set(name, []);
    const enumList = enumerations.get(name)!;
    const enumNumber = String(enumList.length + 1);
    (info as any).number = enumNumber;
    if (registerLabel(label, info)) {
      enumList.push(label);
    }
  }

  for (const cellSource of cells) {
    const analysis = scanLabels(cellSource);

    // Report any named-enum-in-heading errors recovered by scanLabels.
    // Register the label anyway so that subsequent occurrences in body text are detected as duplicates.
    for (const err of analysis.headingErrors) {
      const isEq = err.enumerationName.toLowerCase() === 'eq';
      const canonicalLabel = `${normalize(err.enumerationName)}:${normalize(err.member)}`;
      recordIssue({
        kind: isEq ? 'reserved-enumeration-misuse' : 'enumeration-context',
        message: err.message,
        label: canonicalLabel,
      });
      const enumName = normalize(err.enumerationName);
      const info: EnumerationInfo = { kind: 'enumeration', name: enumName, number: '' };
      addToEnumeration(enumName, canonicalLabel, info);
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

      if (!heading.explicitLabel && reservedTitles.has(normalizedTitle)) {
        duplicates.add(normalizedTitle);
        recordIssue({
          kind: 'duplicate-label',
          message: `Duplicate implicit section label: ${normalizedTitle}`,
          label: normalizedTitle,
        });
        continue;
      }

      reservedTitles.add(normalizedTitle);
      if (registerLabel(canonicalLabel, info)) {
        sections.push(canonicalLabel);
        primarySectionCells.set(canonicalLabel, mdCellIndex);
      }
    }

    // Body labels
    for (const label of analysis.labelsDefined) {
      if (headingLabelSet.has(label)) continue;

      if (label.includes(':')) {
        const colonIdx = label.indexOf(':');
        const name = label.slice(0, colonIdx);
        const member = label.slice(colonIdx + 1);

        if (name === 'eq') {
          recordIssue({
            kind: 'reserved-enumeration-misuse',
            message: `Reserved enumeration eq misused: ${member}`,
            label,
          });
          misused.add(label);
          continue;
        }

        const info: EnumerationInfo = { kind: 'enumeration', name, number: '' };
        addToEnumeration(name, label, info);
      } else {
        const info: EnumerationInfo = { kind: 'enumeration', name: 'global', number: '' };
        addToEnumeration('global', label, info);
      }
    }

    // Equation labels from display math
    for (const label of analysis.eqLabels) {
      const info: EnumerationInfo = { kind: 'enumeration', name: 'eq', number: '' };
      addToEnumeration('eq', label, info);
    }

    mdCellIndex++;
  }

  return { labels, sections, enumerations, duplicates, misused, primarySectionCells, issues };
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

function transformBodyText(text: string, state: NotebookState): string {
  // Replace @label (including @name:member) with its number
  let result = text.replace(/@(\w+(?::\w+)?)/g, (match, raw) => {
    const canonical = raw.includes(':')
      ? normalize(raw.slice(0, raw.indexOf(':'))) + ':' + normalize(raw.slice(raw.indexOf(':') + 1))
      : normalize(raw);
    if (state.misused.has(canonical)) return `⚠ misuse: @${raw}`;
    if (state.duplicates.has(canonical)) return `⚠ duplicate: @${raw}`;
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
 * `mdCellIndex` is the 0-based index of this cell among markdown cells in the notebook;
 * it is used to distinguish the primary heading occurrence from secondaries when a
 * section label is duplicated.
 */
export function transformMarkdown(md: string, state: NotebookState, mdCellIndex: number = 0): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let inFencedBlock = false;
  let inHtmlComment = false;
  let inDisplayMath = false;
  let pendingEqDuplicates: string[] = [];

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
        if (state.duplicates.has(canonical)) { pendingEqDuplicates.push(`⚠ duplicate: @eq:${member}`); return ''; }
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
    if (/^\\begin\{(align|align\*|equation|equation\*|gather|gather\*|multline|multline\*|flalign|flalign\*|eqnarray|eqnarray\*)\}/.test(trimmed)) { inDisplayMath = true; result.push(line); continue; }
    if (/^\\end\{(align|align\*|equation|equation\*|gather|gather\*|multline|multline\*|flalign|flalign\*|eqnarray|eqnarray\*)\}/.test(trimmed)) {
      inDisplayMath = false;
      result.push(line);
      for (const dup of pendingEqDuplicates) result.push(dup);
      pendingEqDuplicates = [];
      continue;
    }
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

      // Named-enum label in heading (invalid: @name:member Title) — render warning
      const namedEnumMatch = headingText.match(/^@(\w+):(\w+)\s*(.*)/);
      if (namedEnumMatch) {
        const rawName = namedEnumMatch[1];
        const rawMember = namedEnumMatch[2];
        const title = namedEnumMatch[3].trim() || headingText;
        result.push(`${hashes} ${title}`);
        result.push('');
        result.push(`⚠ misuse: @${rawName}:${rawMember}`);
        continue;
      }

      const labelMatch = headingText.match(/^@(\w+)\s+(.*)/);
      const rawLabel = labelMatch ? labelMatch[1] : null;
      const title = labelMatch ? labelMatch[2].trim() : headingText;
      const canonicalLabel = rawLabel ? normalize(rawLabel) : normalize(headingText);

      if (state.duplicates.has(canonicalLabel)) {
        const isPrimary = state.primarySectionCells.get(canonicalLabel) === mdCellIndex;
        if (isPrimary) {
          // Primary occurrence: render numbered, no warning
          const info = state.labels.get(canonicalLabel);
          if (info && info.kind === 'section') {
            const sep = headingSeparator(info.number);
            result.push(`${hashes} ${info.number}${sep}${title}`);
          } else {
            result.push(`${hashes} ${title}`);
          }
        } else {
          // Secondary occurrence: show duplicate warning
          result.push(`${hashes} ${title}`);
          result.push('');
          result.push(`⚠ duplicate: @${rawLabel ?? canonicalLabel}`);
        }
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
