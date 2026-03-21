// util.ts


export function setsEqualOrdered(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  const aIter = a.values();
  const bIter = b.values();
  let aNext, bNext;

  while (!(aNext = aIter.next()).done && !(bNext = bIter.next()).done) {
    if (aNext.value !== bNext.value) return false;
  }

  return true;
}

export function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  return new Set([...a, ...b]);
}

