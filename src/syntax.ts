
// Future extension: support named enumerations such as @name:label.
// For now, only unqualified labels @foo are supported.


export interface HeadingInfo {
  level: number;
  title: string;
  explicitLabel?: string;
}

export interface CellAnalysis {
  labelsDefined: Set<string>;
  headings: HeadingInfo[];     // headings are returned in order of appearance.
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}


/**
 * finds explicit labels which begin with an ampersand-like sigil @foo as well as
 * finding sections, subsections, subsubsections, etc. for which labels
 * are implicitly defined.  This function operates on a string representing
 * a single cell.
 */
export function scanLabels(md: string): CellAnalysis {
  const labelsDefined = new Set<string>();
  const headings: HeadingInfo[] = [];

  // Remove HTML comments (may be multiline)
  const text = md.replace(/<!--[\s\S]*?-->/g, '');

  const lines = text.split('\n');
  let inFencedBlock = false;

  for (const line of lines) {
    // Toggle fenced code block on opening/closing fence
    if (/^(`{3,}|~{3,})/.test(line)) {
      inFencedBlock = !inFencedBlock;
      continue;
    }

    if (inFencedBlock) continue;

    // Check for ATX heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      // Explicit label at start of heading: ## @label Title text
      const labelMatch = headingText.match(/^@(\w+)\s+(.*)/);
      if (labelMatch) {
        const explicitLabel = normalize(labelMatch[1]);
        const title = labelMatch[2].trim();
        labelsDefined.add(explicitLabel);
        headings.push({ level, title, explicitLabel });
      } else {
        headings.push({ level, title: headingText });
      }
    } else {
      // Body text: strip inline code, then collect @labels
      const stripped = line.replace(/`[^`]*`/g, '');
      const labelRegex = /@(\w+)/g;
      let match;
      while ((match = labelRegex.exec(stripped)) !== null) {
        labelsDefined.add(normalize(match[1]));
      }
    }
  }

  return { labelsDefined, headings };
}
