
export interface HeadingInfo {
  level: number;
  title: string;
  explicitLabel?: string;
}

export interface CellAnalysis {
  labelsDefined: string[];   // canonical labels from body text: global as 'foo', named as 'fig:arch'
  eqLabels: string[];        // eq:xxx labels found inside display math blocks
  headings: HeadingInfo[];   // headings in order of appearance
}

export class HeadingLabelError extends Error {
  enumerationName: string;
  member: string;

  constructor(enumerationName: string, member: string) {
    super(`Named-enumeration label @${enumerationName}:${member} is not allowed in section headings`);
    this.name = 'HeadingLabelError';
    this.enumerationName = enumerationName;
    this.member = member;
  }
}

export interface BibliographyDirective {
  src: string | null;
}


export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}


/**
 * finds explicit labels which begin with an ampersand-like sigil @foo as well as
 * finding sections, subsections, subsubections, etc. for which labels
 * are implicitly defined.  This function operates on a string representing
 * a single cell.
 */
export function scanLabels(md: string): CellAnalysis {
  const labelsDefined: string[] = [];
  const eqLabels: string[] = [];
  const headings: HeadingInfo[] = [];

  // Remove HTML comments (may be multiline)
  const text = md.replace(/<!--[\s\S]*?-->/g, '');

  const lines = text.split('\n');
  let inFencedBlock = false;
  let inDisplayMath = false;

  for (const line of lines) {
    // Toggle fenced code block on opening/closing fence
    if (/^(`{3,}|~{3,})/.test(line)) {
      inFencedBlock = !inFencedBlock;
      continue;
    }

    if (inFencedBlock) continue;

    // Display math delimiters
    const trimmed = line.trim();
    if (trimmed === '$$') { inDisplayMath = !inDisplayMath; continue; }
    if (trimmed === '\\[') { inDisplayMath = true; continue; }
    if (trimmed === '\\]') { inDisplayMath = false; continue; }

    // Single-line $$...$$ block (opening and closing on same line)
    if (!inDisplayMath && trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      const inner = trimmed.slice(2, -2);
      const rx = /@eq:(\w+)/g; let m;
      while ((m = rx.exec(inner)) !== null) eqLabels.push(`eq:${normalize(m[1])}`);
      continue;
    }
    // Opening $$ with inline content ($$formula...)
    if (!inDisplayMath && trimmed.startsWith('$$') && trimmed.length > 2) {
      inDisplayMath = true;
      const inner = trimmed.slice(2);
      const rx = /@eq:(\w+)/g; let m;
      while ((m = rx.exec(inner)) !== null) eqLabels.push(`eq:${normalize(m[1])}`);
      continue;
    }
    // Closing $$ with inline content (...formula$$)
    if (inDisplayMath && trimmed.endsWith('$$') && !trimmed.startsWith('$$')) {
      inDisplayMath = false;
      const inner = trimmed.slice(0, -2);
      const rx = /@eq:(\w+)/g; let m;
      while ((m = rx.exec(inner)) !== null) eqLabels.push(`eq:${normalize(m[1])}`);
      continue;
    }

    // Check for ATX heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      // Named-enum label at start of heading: ## @name:member Title — invalid, throw immediately
      const namedMatch = headingText.match(/^@(\w+):(\w+)/);
      if (namedMatch) {
        throw new HeadingLabelError(namedMatch[1], namedMatch[2]);
      }

      // Global explicit label at start of heading: ## @label Title text
      const labelMatch = headingText.match(/^@(\w+)\s+(.*)/);
      if (labelMatch) {
        const explicitLabel = normalize(labelMatch[1]);
        const title = labelMatch[2].trim();
        labelsDefined.push(explicitLabel);
        headings.push({ level, title, explicitLabel });
      } else {
        headings.push({ level, title: headingText });
      }
    } else {
      // Body text: strip inline code, then collect @labels
      const stripped = line.replace(/`[^`]*`/g, '');
      const labelRegex = /@(\w+)(?::(\w+))?/g;
      let match;
      while ((match = labelRegex.exec(stripped)) !== null) {
        if (match[2] !== undefined) {
          // Named enumeration label: @name:member
          const canonicalLabel = `${normalize(match[1])}:${normalize(match[2])}`;
          if (match[1].toLowerCase() === 'eq' && inDisplayMath) {
            eqLabels.push(canonicalLabel);
          } else {
            labelsDefined.push(canonicalLabel);
          }
        } else {
          // Global label: @foo
          labelsDefined.push(normalize(match[1]));
        }
      }
    }
  }

  return { labelsDefined, eqLabels, headings };
}


export function scanCitations(markdown: string): string[] {
  throw new Error('not implemented');
}


export function scanBibliographyDirectives(markdown: string): BibliographyDirective[] {
  throw new Error('not implemented');
}