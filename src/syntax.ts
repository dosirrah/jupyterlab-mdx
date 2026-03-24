

// Future extension: support named enumerations such as @name:label.
// For now, only unqualified labels @foo are supported.


export interface HeadingInfo {
  level: number;
  title: string;
  explicitLabel?: string;Hmm
}

export interface CellAnalysis {
  labelsDefined: Set<string>;
  headings: HeadingInfo[];     // headings are returned in order of appearance.
}

export function normalize(s: string): string {
  throw new Error('not implemented');
}


/**
 * finds explicit labels which being with an ampresand like @foo as well as
 * finding sections, subsections, subsubsections, etc. for which labels
 * are implicity defined.  This function operates on a string representing
 * a single cell.
 */
export function scanLabels(md: string): CellAnalysis
  throw new Error('not implemented');
}



// export normal internal functions for purposes of testing. 
//export const __testExports__ = {
//};

