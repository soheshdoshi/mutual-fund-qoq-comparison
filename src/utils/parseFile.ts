import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Dataset, DatasetRow, LoadedFile, Portfolio } from '../types';
import { parsePortfolio } from './parsePortfolio';

/** A raw spreadsheet as a matrix of cells (no header assumptions). */
export type Matrix = (string | number | null)[][];

/** Try to coerce a raw cell value into a number; returns null if not numeric. */
export function parseNumeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  if (s === '' || s === '-' || s === 'NA' || s.toLowerCase() === 'n/a') return null;
  // Strip common formatting: currency symbols, commas, percent signs, spaces.
  s = s.replace(/[₹$€£,%\s]/g, '');
  // Handle parentheses as negative, e.g. (1,234) -> -1234
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
  if (s === '' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Given raw rows, detect numeric vs text columns. */
function classifyColumns(columns: string[], rows: DatasetRow[]) {
  const numericColumns: string[] = [];
  const textColumns: string[] = [];

  for (const col of columns) {
    let numericCount = 0;
    let nonEmpty = 0;
    for (const row of rows) {
      const raw = row[col];
      if (raw === null || raw === undefined || String(raw).trim() === '') continue;
      nonEmpty++;
      if (parseNumeric(raw) !== null) numericCount++;
    }
    // Treat as numeric if at least 70% of non-empty values are numbers.
    if (nonEmpty > 0 && numericCount / nonEmpty >= 0.7) {
      numericColumns.push(col);
    } else {
      textColumns.push(col);
    }
  }
  return { numericColumns, textColumns };
}

function nonEmptyCount(row: (string | number | null)[]): number {
  return row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length;
}

/** Build a generic Dataset from a raw matrix by detecting the header row. */
function matrixToDataset(fileName: string, matrix: Matrix): Dataset {
  // Find the first row that looks like a header (>= 2 non-empty cells).
  let headerIdx = matrix.findIndex((r) => nonEmptyCount(r) >= 2);
  if (headerIdx < 0) headerIdx = 0;
  const headerRow = matrix[headerIdx] ?? [];

  const seen = new Map<string, number>();
  const columns = headerRow.map((c, i) => {
    let name = c === null || c === undefined ? '' : String(c).replace(/[\r\n]+/g, ' ').trim();
    if (name === '') name = `Column ${i + 1}`;
    const dup = seen.get(name) ?? 0;
    seen.set(name, dup + 1);
    return dup === 0 ? name : `${name} (${dup + 1})`;
  });

  const rows: DatasetRow[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const raw = matrix[i];
    if (!raw || nonEmptyCount(raw) === 0) continue;
    const row: DatasetRow = {};
    columns.forEach((col, c) => {
      const v = raw[c];
      const num = parseNumeric(v);
      row[col] = num !== null ? num : v === null || v === undefined ? null : String(v).trim();
    });
    rows.push(row);
  }

  const { numericColumns, textColumns } = classifyColumns(columns, rows);
  return { fileName, columns, numericColumns, textColumns, rows };
}

/** Build a clean tabular Dataset from a parsed portfolio (generic fallback view). */
function portfolioToDataset(portfolio: Portfolio): Dataset {
  const columns = [
    'Name',
    'ISIN',
    'Industry / Rating',
    'Category',
    'Quantity',
    'Market Value (Lakhs)',
    'Weight %',
  ];
  const rows: DatasetRow[] = portfolio.holdings.map((h) => ({
    Name: h.name,
    ISIN: h.isin,
    'Industry / Rating': h.industry,
    Category: h.category,
    Quantity: h.quantity,
    'Market Value (Lakhs)': h.marketValueLakhs,
    'Weight %': Number(h.weightPct.toFixed(4)),
  }));
  return {
    fileName: portfolio.fileName,
    columns,
    numericColumns: ['Quantity', 'Market Value (Lakhs)', 'Weight %'],
    textColumns: ['Name', 'ISIN', 'Industry / Rating', 'Category'],
    rows,
  };
}

/** Wrap a ready-made Portfolio (e.g. demo data) into a LoadedFile. */
export function loadedFileFromPortfolio(portfolio: Portfolio): LoadedFile {
  return {
    fileName: portfolio.fileName,
    portfolio,
    dataset: portfolioToDataset(portfolio),
  };
}

/** Read a CSV file into a raw matrix. */
function readCsvMatrix(file: File): Promise<Matrix> {
  return new Promise((resolve, reject) => {
    Papa.parse<(string | number | null)[]>(file, {
      header: false,
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error(results.errors[0].message));
          return;
        }
        resolve(results.data as Matrix);
      },
      error: (err) => reject(err),
    });
  });
}

/** Read the first sheet of an Excel file into a raw matrix. */
async function readExcelMatrix(file: File): Promise<Matrix> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('The Excel file has no sheets.');
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as Matrix;
}

/**
 * Load a file: auto-detect the AMFI portfolio format and always provide a
 * generic tabular dataset as a fallback / comparison view.
 */
export async function loadFile(file: File): Promise<LoadedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  let matrix: Matrix;
  if (ext === 'csv' || ext === 'txt') matrix = await readCsvMatrix(file);
  else if (ext === 'xlsx' || ext === 'xls') matrix = await readExcelMatrix(file);
  else throw new Error(`Unsupported file type: .${ext}. Please upload a CSV or Excel file.`);

  const portfolio = parsePortfolio(matrix, file.name);
  const dataset = portfolio ? portfolioToDataset(portfolio) : matrixToDataset(file.name, matrix);
  return { fileName: file.name, portfolio, dataset };
}
