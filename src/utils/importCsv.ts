export interface CsvRow {
  [key: string]: string;
}

const normalizeHeaderLabel = (value: string, index: number) => {
  const trimmed = value.trim().replace(/^"|"$/g, '');
  return trimmed || `coluna_${index + 1}`;
};

const makeUniqueHeaders = (headers: string[]) => {
  const seen = new Map<string, number>();

  return headers.map((header) => {
    const count = seen.get(header) || 0;
    seen.set(header, count + 1);
    return count === 0 ? header : `${header}_${count + 1}`;
  });
};

export const parseCsvText = (text: string): { headers: string[]; rows: CsvRow[] } => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const separator = lines[0].includes(';') ? ';' : ',';
  const rawHeaders = lines[0].split(separator).map((header, index) => normalizeHeaderLabel(header, index));
  const headers = makeUniqueHeaders(rawHeaders);

  const rows = lines.slice(1).map((line) => {
    const values = line.split(separator).map((value) => value.trim().replace(/^"|"$/g, ''));
    const row: CsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });

  return { headers, rows };
};