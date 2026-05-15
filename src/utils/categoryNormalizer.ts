// Utilities to normalize and group similar category names

export function normalizeKey(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    // singularize trivial plurals
    .replace(/s$/, '');
}

export function canonicalLabel(names: string[]): string {
  // Pick the most "complete" name: prefer one with accents and Title Case
  const sorted = [...names].sort((a, b) => {
    const aAcc = /[áéíóúãõâêôç]/i.test(a) ? 1 : 0;
    const bAcc = /[áéíóúãõâêôç]/i.test(b) ? 1 : 0;
    if (aAcc !== bAcc) return bAcc - aAcc;
    const aTitle = a !== a.toUpperCase() && a !== a.toLowerCase() ? 1 : 0;
    const bTitle = b !== b.toUpperCase() && b !== b.toLowerCase() ? 1 : 0;
    if (aTitle !== bTitle) return bTitle - aTitle;
    return b.length - a.length;
  });
  return sorted[0];
}

export function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export interface DuplicateGroup {
  canonical: string;
  variants: { name: string; count: number }[];
  totalProducts: number;
}

export function findDuplicateGroups(
  cats: { name: string; productCount: number }[]
): DuplicateGroup[] {
  const groups = new Map<string, { name: string; count: number }[]>();
  for (const c of cats) {
    const key = normalizeKey(c.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ name: c.name, count: c.productCount });
  }
  const duplicates: DuplicateGroup[] = [];
  for (const variants of groups.values()) {
    if (variants.length > 1) {
      duplicates.push({
        canonical: canonicalLabel(variants.map(v => v.name)),
        variants,
        totalProducts: variants.reduce((s, v) => s + v.count, 0),
      });
    }
  }
  return duplicates.sort((a, b) => b.totalProducts - a.totalProducts);
}
