import * as XLSX from 'xlsx';
import type { PortfolioComparison } from '../types';

const STATUS_TEXT: Record<string, string> = {
  new: 'New',
  exited: 'Exited',
  increased: 'Increased',
  reduced: 'Reduced',
  unchanged: 'Unchanged',
};

/** Export the full portfolio comparison as a multi-sheet Excel workbook. */
export function exportComparisonExcel(
  c: PortfolioComparison,
  prevLabel: string,
  currLabel: string
) {
  const wb = XLSX.utils.book_new();

  // --- Summary sheet ---
  const v = (n: number) => Number(n.toFixed(2));
  const summary: (string | number)[][] = [
    ['Scheme', c.schemeName],
    ['Previous statement', prevLabel],
    ['Current statement', currLabel],
    [],
    ['Metric', prevLabel, currLabel, 'Change'],
    ['Total holdings', c.counts.prevHoldings, c.counts.currHoldings, c.counts.currHoldings - c.counts.prevHoldings],
    ['New positions', '', c.counts.added, ''],
    ['Exited positions', '', c.counts.exited, ''],
    ['Increased', '', c.counts.increased, ''],
    ['Reduced', '', c.counts.reduced, ''],
    ['Unchanged', '', c.counts.unchanged, ''],
    ['Top-5 weight %', v(c.metrics.top5.prev), v(c.metrics.top5.curr), v(c.metrics.top5.curr - c.metrics.top5.prev)],
    ['Top-10 weight %', v(c.metrics.top10.prev), v(c.metrics.top10.curr), v(c.metrics.top10.curr - c.metrics.top10.prev)],
    ['HHI (0-10000)', v(c.metrics.hhi.prev), v(c.metrics.hhi.curr), v(c.metrics.hhi.curr - c.metrics.hhi.prev)],
    ['Effective # stocks', v(c.metrics.effectiveStocks.prev), v(c.metrics.effectiveStocks.curr), ''],
    ['Avg position %', v(c.metrics.avgPosition.prev), v(c.metrics.avgPosition.curr), ''],
    ['Total value (Cr)', v(c.totalValue.prev / 100), v(c.totalValue.curr / 100), ''],
    ['Turnover %', '', v(c.turnover.turnoverPct), ''],
    ['Value bought (Cr)', '', v(c.turnover.boughtValue / 100), ''],
    ['Value sold (Cr)', '', v(c.turnover.soldValue / 100), ''],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Summary');

  // --- Holdings sheet ---
  const holdings = c.holdings.map((h) => ({
    Name: h.name,
    ISIN: h.isin,
    'Industry/Rating': h.industry,
    Category: h.category,
    Status: STATUS_TEXT[h.status] ?? h.status,
    [`Weight % (${prevLabel})`]: h.prevWeight,
    [`Weight % (${currLabel})`]: h.currWeight,
    'Weight Δ (pp)': h.weightChange,
    [`Qty (${prevLabel})`]: h.prevQty,
    [`Qty (${currLabel})`]: h.currQty,
    'Qty Δ %': h.qtyChangePct,
    [`Value L (${prevLabel})`]: h.prevValue,
    [`Value L (${currLabel})`]: h.currValue,
    'Value Δ %': h.valueChangePct,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(holdings), 'Holdings');

  // --- Sectors sheet ---
  const sectors = c.sectors.map((s) => ({
    'Sector/Rating': s.sector,
    [`Weight % (${prevLabel})`]: v(s.prevWeight),
    [`Weight % (${currLabel})`]: v(s.currWeight),
    'Change (pp)': v(s.change),
    [`# (${prevLabel})`]: s.prevCount,
    [`# (${currLabel})`]: s.currCount,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sectors), 'Sectors');

  // --- Categories sheet ---
  const cats = c.categories.map((cat) => ({
    Category: cat.category,
    [`Weight % (${prevLabel})`]: v(cat.prevWeight),
    [`Weight % (${currLabel})`]: v(cat.currWeight),
    'Change (pp)': v(cat.change),
    [`# (${currLabel})`]: cat.currCount,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(cats), 'Categories');

  XLSX.writeFile(wb, 'portfolio-qoq-comparison.xlsx');
}
