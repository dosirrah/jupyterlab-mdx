import { scanCitations } from './syntax';


export interface CitationState {
  citationNumbers: Map<string, number>;
}

export function scanNotebookCitations(cells: string[]): CitationState {
  // Note that the entire citation -> number mapping is created fresh each time
  // scanNotebookCitations is called.
  const citationNumbers = new Map<string, number>();
  let counter = 1;

  for (const cell of cells) {
    for (const key of scanCitations(cell)) {
      if (!citationNumbers.has(key)) {
        citationNumbers.set(key, counter++);
      }
    }
  }

  return { citationNumbers };
}


export interface BibliographyEntry {
  key: string;
  entryType: string;
  fields: Map<string, string>;
}

export function parseBibFile(source: string): Map<string, BibliographyEntry> {
  const entries = new Map<string, BibliographyEntry>();

  let i = 0;
  while (i < source.length) {
    const atIdx = source.indexOf('@', i);
    if (atIdx === -1) break;

    i = atIdx + 1;
    const headerMatch = source.slice(i).match(/^(\w+)\s*\{/);
    if (!headerMatch) continue;

    const entryType = headerMatch[1].toLowerCase();
    i += headerMatch[0].length;

    if (['string', 'preamble', 'comment'].includes(entryType)) continue;

    // Read key up to first comma
    const commaIdx = source.indexOf(',', i);
    if (commaIdx === -1) break;
    const key = source.slice(i, commaIdx).trim();
    i = commaIdx + 1;

    // Find the closing } of the entry by tracking brace depth (depth starts at 1)
    let depth = 1;
    let entryEnd = i;
    while (entryEnd < source.length && depth > 0) {
      if (source[entryEnd] === '{') depth++;
      else if (source[entryEnd] === '}') depth--;
      if (depth > 0) entryEnd++;
    }

    const body = source.slice(i, entryEnd);
    const fields = parseFields(body);

    entries.set(key, { key, entryType, fields });
    i = entryEnd + 1;
  }

  return entries;
}

function parseFields(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  let i = 0;

  while (i < body.length) {
    // Skip whitespace and commas
    while (i < body.length && /[\s,]/.test(body[i])) i++;
    if (i >= body.length) break;

    // Match field name and =
    const fieldMatch = body.slice(i).match(/^(\w+)\s*=\s*/);
    if (!fieldMatch) { i++; continue; }

    const fieldName = fieldMatch[1].toLowerCase();
    i += fieldMatch[0].length;
    if (i >= body.length) break;

    let value = '';
    if (body[i] === '{') {
      // Brace-delimited value — handle nested braces
      let depth = 1;
      i++;
      const vStart = i;
      while (i < body.length && depth > 0) {
        if (body[i] === '{') depth++;
        else if (body[i] === '}') depth--;
        if (depth > 0) i++;
      }
      value = body.slice(vStart, i);
      i++; // skip closing }
    } else if (body[i] === '"') {
      i++;
      const vStart = i;
      while (i < body.length && body[i] !== '"') i++;
      value = body.slice(vStart, i);
      i++; // skip closing "
    } else {
      // Bare token (e.g. a year as a number)
      const bare = body.slice(i).match(/^([^,\s}]+)/);
      if (bare) { value = bare[1]; i += bare[0].length; }
    }

    fields.set(fieldName, value);
  }

  return fields;
}


export function formatBibliographyEntry(
  entry: BibliographyEntry,
  citationNumber: number
): string {
  const author = entry.fields.get('author') ?? 'Unknown';
  const title  = entry.fields.get('title');
  const venue  = entry.fields.get('journal') ?? entry.fields.get('booktitle');
  const year   = entry.fields.get('year');

  // Build the parts that follow the author.
  // Title (when present) carries its comma inside the quotes per IEEE convention.
  // Venue and year are joined with ", "; that group is joined to title with " ".
  const titlePart = title ? `"${title},"` : null;
  const venuePart = venue ? `*${venue}*` : null;
  const yearPart  = year  ? `${year}`    : null;

  const venueYear = [venuePart, yearPart].filter((p): p is string => p !== null);

  const afterAuthor: string[] = [];
  if (titlePart) afterAuthor.push(titlePart);
  if (venueYear.length > 0) afterAuthor.push(venueYear.join(', '));

  return `[${citationNumber}] ${author}, ${afterAuthor.join(' ')}.`;
}


export function renderBibliographyMarkdown(
  citationState: CitationState,
  entries: Map<string, BibliographyEntry>
): string {
  const lines: string[] = [];

  for (const [key, num] of citationState.citationNumbers.entries()) {
    const entry = entries.get(key);
    if (!entry) continue; // silently omit missing keys
    lines.push(formatBibliographyEntry(entry, num));
  }

  return lines.join('\n\n');
}


/**
 * Replace `^key` citation tokens in markdown with `[n]` (when resolved) or
 * `[?]` (when the key is unknown or not found in entries).
 * Skips fenced code blocks and inline code spans.
 */
export function transformCitationRefs(
  markdown: string,
  citationState: CitationState,
  entries: Map<string, BibliographyEntry>
): string {
  const lines = markdown.split('\n');
  let inFencedBlock = false;
  const result: string[] = [];

  for (const line of lines) {
    if (/^(`{3,}|~{3,})/.test(line)) {
      inFencedBlock = !inFencedBlock;
      result.push(line);
      continue;
    }
    if (inFencedBlock) {
      result.push(line);
      continue;
    }

    // Replace inline code spans and ^key tokens together so inline code is skipped
    const transformed = line.replace(
      /(`[^`]*`)|(\^([A-Za-z][A-Za-z0-9_]*))/g,
      (match, code, _fullCite, key) => {
        if (code !== undefined) return match; // preserve inline code as-is
        const num = citationState.citationNumbers.get(key);
        if (num === undefined || !entries.has(key)) return '[?]';
        return `[${num}]`;
      }
    );
    result.push(transformed);
  }

  return result.join('\n');
}


/**
 * Replace `::: bibliography ... :::` directive blocks with rendered bibliography
 * markdown.  Blocks inside fenced code blocks or HTML comments are left unchanged.
 */
export function transformBibliographyDirective(
  markdown: string,
  citationState: CitationState,
  entries: Map<string, BibliographyEntry>
): string {
  // Precompute HTML comment character ranges so we can skip directives inside them.
  const commentRanges: [number, number][] = [];
  const commentRx = /<!--[\s\S]*?-->/g;
  let cm;
  while ((cm = commentRx.exec(markdown)) !== null) {
    commentRanges.push([cm.index, cm.index + cm[0].length]);
  }
  const posInComment = (pos: number): boolean =>
    commentRanges.some(([s, e]) => pos >= s && pos < e);

  const lines = markdown.split('\n');
  let inFencedBlock = false;
  let inDirective = false;
  const result: string[] = [];
  let linePos = 0;

  for (const line of lines) {
    if (/^(`{3,}|~{3,})/.test(line)) {
      inFencedBlock = !inFencedBlock;
      result.push(line);
      linePos += line.length + 1;
      continue;
    }

    if (inFencedBlock) {
      result.push(line);
      linePos += line.length + 1;
      continue;
    }

    const inComment = posInComment(linePos);

    if (!inDirective) {
      if (!inComment && line.trim() === '::: bibliography') {
        inDirective = true;
        // Consume the opening line; the whole block will be replaced.
      } else {
        result.push(line);
      }
    } else {
      if (line.trim() === ':::') {
        inDirective = false;
        result.push(renderBibliographyMarkdown(citationState, entries));
      }
      // else: inside directive body — consumed (not emitted)
    }

    linePos += line.length + 1;
  }

  return result.join('\n');
}
