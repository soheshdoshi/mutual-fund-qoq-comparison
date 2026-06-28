import type { LoadedFile, Portfolio, WeightTimeline } from '../types';

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

/**
 * Parse a statement-date label into a sortable epoch (ms). Handles common
 * AMFI formats like "May 31, 2026", "31-May-2026", "31 May 2026", "2026-05-31".
 * Returns NaN when no date can be recognised.
 */
export function parseStatementDate(label: string): number {
  if (!label) return NaN;
  const native = Date.parse(label);
  if (!Number.isNaN(native)) return native;

  const cleaned = label.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  // Patterns: "Month DD, YYYY" / "DD Month YYYY" / "DD-Month-YYYY"
  const m = cleaned.match(/([A-Za-z]+)\s*[-\s]\s*(\d{1,2})\D+(\d{4})/) // Month DD YYYY
    || cleaned.match(/(\d{1,2})\s*[-\s]\s*([A-Za-z]+)\D*(\d{4})/); // DD Month YYYY
  if (m) {
    let monthName: string;
    let day: number;
    let year: number;
    if (Number.isNaN(Number(m[1]))) {
      monthName = m[1].toLowerCase();
      day = Number(m[2]);
      year = Number(m[3]);
    } else {
      day = Number(m[1]);
      monthName = m[2].toLowerCase();
      year = Number(m[3]);
    }
    const month = MONTHS[monthName];
    if (month !== undefined) return new Date(year, month, day || 1).getTime();
  }
  // Bare "Month YYYY"
  const my = cleaned.match(/([A-Za-z]+)\s+(\d{4})/);
  if (my && MONTHS[my[1].toLowerCase()] !== undefined) {
    return new Date(Number(my[2]), MONTHS[my[1].toLowerCase()], 1).getTime();
  }
  return NaN;
}

/** A loaded file paired with a stable id (used by the multi-file picker). */
export interface FileEntry {
  id: number;
  file: LoadedFile;
}

/**
 * Order portfolio file entries chronologically (oldest first). Files without a
 * recognisable date keep their insertion order at the end.
 */
export function orderByDate(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    const da = a.file.portfolio ? parseStatementDate(a.file.portfolio.statementDate) : NaN;
    const db = b.file.portfolio ? parseStatementDate(b.file.portfolio.statementDate) : NaN;
    if (Number.isNaN(da) && Number.isNaN(db)) return 0;
    if (Number.isNaN(da)) return 1;
    if (Number.isNaN(db)) return -1;
    return da - db;
  });
}

/**
 * Build a per-holding weight history across every supplied portfolio
 * (chronological order assumed). Used for sparklines and the stock timeline.
 */
export function buildWeightTimeline(portfolios: Portfolio[]): WeightTimeline[] {
  const order = new Map<string, { name: string; industry: string }>();
  for (const p of portfolios) {
    for (const h of p.holdings) {
      if (!order.has(h.isin)) order.set(h.isin, { name: h.name, industry: h.industry });
    }
  }
  const result: WeightTimeline[] = [];
  for (const [isin, meta] of order) {
    const points = portfolios.map((p) => {
      const h = p.holdings.find((x) => x.isin === isin);
      return { label: p.statementDate, weight: h ? h.weightPct : null };
    });
    const latest = [...points].reverse().find((pt) => pt.weight !== null)?.weight ?? null;
    result.push({ isin, name: meta.name, industry: meta.industry, points, latest });
  }
  return result.sort((a, b) => (b.latest ?? 0) - (a.latest ?? 0));
}
