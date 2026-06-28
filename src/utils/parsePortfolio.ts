import type { Holding, Portfolio } from '../types';
import { parseNumeric } from './parseFile';

/** Standard ISIN: 2 letters + 9 alphanumerics + 1 check digit. */
const ISIN_RE = /^[A-Za-z]{2}[A-Za-z0-9]{9}[0-9]$/;

type Matrix = (string | number | null)[][];

function cell(row: (string | number | null)[] | undefined, idx: number): string | number | null {
  if (!row || idx < 0 || idx >= row.length) return null;
  return row[idx];
}

function text(v: string | number | null): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Find the header row index and column positions used by the statement. */
function locateHeader(matrix: Matrix) {
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;
    const hasName = row.some((c) => /name of the instrument/i.test(text(c)));
    const hasIsin = row.some((c) => /^isin$/i.test(text(c)) || /\bisin\b/i.test(text(c)));
    if (hasName && hasIsin) {
      const find = (re: RegExp) => row.findIndex((c) => re.test(text(c)));
      return {
        headerIdx: i,
        nameIdx: find(/name of the instrument/i),
        isinIdx: find(/\bisin\b/i),
        industryIdx: find(/industry|rating/i),
        qtyIdx: find(/quantity/i),
        valueIdx: find(/market|fair value/i),
        weightIdx: find(/%\s*to\s*net/i),
      };
    }
  }
  return null;
}

/** Section header keywords used to label each holding's category. */
const SECTION_KEYWORDS = [
  { re: /foreign/i, label: 'Foreign Equity' },
  { re: /arbitrage/i, label: 'Arbitrage' },
  { re: /reit/i, label: 'REITs' },
  { re: /certificate of deposit/i, label: 'Certificate of Deposit' },
  { re: /commercial paper/i, label: 'Commercial Paper' },
  { re: /treasury bill/i, label: 'Treasury Bill' },
  { re: /money market/i, label: 'Money Market' },
  { re: /mutual fund units/i, label: 'Mutual Fund Units' },
  { re: /equity & equity related/i, label: 'Equity' },
  { re: /government securities|g-sec/i, label: 'Government Securities' },
  { re: /corporate (debt|bond)|debentures/i, label: 'Corporate Debt' },
  { re: /others/i, label: 'Others' },
];

/** Rows that are section labels (not holdings) but should not change category. */
const NON_SECTION = /^(sub\s*total|total|grand\s*total|\(a\)|\(b\)|\(c\)|\(d\))/i;

function classifyCategory(name: string, current: string): string {
  for (const s of SECTION_KEYWORDS) {
    if (s.re.test(name)) return s.label;
  }
  return current;
}

/**
 * Detect and parse an AMFI-style monthly portfolio statement from a raw matrix.
 * Returns null if the statement format is not recognised.
 */
export function parsePortfolio(matrix: Matrix, fileName: string): Portfolio | null {
  const header = locateHeader(matrix);
  if (!header || header.nameIdx < 0 || header.isinIdx < 0) return null;

  // Scheme name: first non-empty cell above the header row.
  let schemeName = fileName;
  for (let i = 0; i < header.headerIdx; i++) {
    const row = matrix[i] ?? [];
    const found = row.map(text).find((t) => t.length > 8 && !/portfolio statement/i.test(t));
    if (found) {
      schemeName = found;
      break;
    }
  }

  // Statement date: row containing "as on".
  let statementDate = '';
  for (let i = 0; i < Math.min(matrix.length, header.headerIdx + 1); i++) {
    const joined = (matrix[i] ?? []).map(text).join(' ');
    const m = joined.match(/as on\s+(.+?)\s*$/i);
    if (m) {
      statementDate = m[1].replace(/[\s\r\n]+/g, ' ').trim();
      break;
    }
  }

  const holdings: Holding[] = [];
  let category = 'Equity';
  const rawWeights: number[] = [];

  for (let i = header.headerIdx + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;
    const name = text(cell(row, header.nameIdx));
    const isin = text(cell(row, header.isinIdx));

    if (!ISIN_RE.test(isin)) {
      // Possibly a section header — update the current category.
      if (name && !NON_SECTION.test(name)) {
        category = classifyCategory(name, category);
      }
      continue;
    }
    if (!name) continue;

    const weightRaw = parseNumeric(cell(row, header.weightIdx)) ?? 0;
    rawWeights.push(weightRaw);

    holdings.push({
      isin: isin.toUpperCase(),
      name,
      code: text(cell(row, 0)) || null,
      industry: text(cell(row, header.industryIdx)) || 'Unclassified',
      quantity: parseNumeric(cell(row, header.qtyIdx)),
      marketValueLakhs: parseNumeric(cell(row, header.valueIdx)),
      weightPct: weightRaw,
      category: classifyCategory(name, category),
    });
  }

  if (holdings.length === 0) return null;

  // The "% to Net Assets" column may be stored as a fraction (0.0788) or a
  // percentage (7.88). Detect the scale and normalise everything to percent.
  const maxWeight = Math.max(...rawWeights);
  const scale = maxWeight > 0 && maxWeight <= 1.5 ? 100 : 1;
  if (scale !== 1) {
    for (const h of holdings) h.weightPct = h.weightPct * scale;
  }

  return { fileName, schemeName, statementDate: statementDate || fileName, holdings };
}
