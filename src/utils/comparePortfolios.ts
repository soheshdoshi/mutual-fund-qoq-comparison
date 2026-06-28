import type {
  CategoryDelta,
  Holding,
  HoldingDelta,
  HoldingStatus,
  Insight,
  Portfolio,
  PortfolioComparison,
  RiskMetrics,
  SectorDelta,
  TurnoverStats,
} from '../types';

function pctChange(prev: number | null, curr: number | null): number | null {
  if (prev === null || curr === null) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/** Decide whether a matched holding was increased / reduced / unchanged. */
function classifyMatched(prev: Holding, curr: Holding): HoldingStatus {
  // Prefer quantity (true buy/sell signal); fall back to weight.
  if (prev.quantity !== null && curr.quantity !== null && prev.quantity !== curr.quantity) {
    return curr.quantity > prev.quantity ? 'increased' : 'reduced';
  }
  const wDiff = curr.weightPct - prev.weightPct;
  if (Math.abs(wDiff) < 0.005) return 'unchanged';
  return wDiff > 0 ? 'increased' : 'reduced';
}

function topWeight(holdings: Holding[], n: number): number {
  return [...holdings]
    .sort((a, b) => b.weightPct - a.weightPct)
    .slice(0, n)
    .reduce((s, h) => s + h.weightPct, 0);
}

/** Herfindahl–Hirschman Index on a 0–10,000 scale (sum of weight%²). */
function hhi(holdings: Holding[]): number {
  return holdings.reduce((s, h) => s + h.weightPct * h.weightPct, 0);
}

function buildMetrics(prev: Portfolio, curr: Portfolio): RiskMetrics {
  const avg = (hs: Holding[]) =>
    hs.length ? hs.reduce((s, h) => s + h.weightPct, 0) / hs.length : 0;
  const hhiPrev = hhi(prev.holdings);
  const hhiCurr = hhi(curr.holdings);
  return {
    holdings: { prev: prev.holdings.length, curr: curr.holdings.length },
    top5: { prev: topWeight(prev.holdings, 5), curr: topWeight(curr.holdings, 5) },
    top10: { prev: topWeight(prev.holdings, 10), curr: topWeight(curr.holdings, 10) },
    hhi: { prev: hhiPrev, curr: hhiCurr },
    effectiveStocks: {
      prev: hhiPrev > 0 ? 10000 / hhiPrev : 0,
      curr: hhiCurr > 0 ? 10000 / hhiCurr : 0,
    },
    avgPosition: { prev: avg(prev.holdings), curr: avg(curr.holdings) },
  };
}

/** Estimate turnover from per-holding market value moves. */
function buildTurnover(holdings: HoldingDelta[], totalValue: { prev: number; curr: number }): TurnoverStats {
  let bought = 0;
  let sold = 0;
  let churn = 0;
  for (const h of holdings) {
    const pv = h.prevValue ?? 0;
    const cv = h.currValue ?? 0;
    if (h.status === 'new') {
      bought += cv;
      churn += h.currWeight ?? 0;
    } else if (h.status === 'exited') {
      sold += pv;
      churn += h.prevWeight ?? 0;
    } else {
      const dv = cv - pv;
      if (dv > 0) bought += dv;
      else sold += -dv;
      churn += Math.abs(h.weightChange ?? 0);
    }
  }
  const avgValue = (totalValue.prev + totalValue.curr) / 2;
  const turnoverPct = avgValue > 0 ? (Math.min(bought, sold) / avgValue) * 100 : 0;
  return { boughtValue: bought, soldValue: sold, turnoverPct, weightChurn: churn / 2 };
}

/** Compare two fund portfolios by their holdings (matched on ISIN). */
export function comparePortfolios(prev: Portfolio, curr: Portfolio): PortfolioComparison {
  const prevMap = new Map(prev.holdings.map((h) => [h.isin, h]));
  const currMap = new Map(curr.holdings.map((h) => [h.isin, h]));
  const allIsins = new Set([...prevMap.keys(), ...currMap.keys()]);

  const holdings: HoldingDelta[] = [];
  for (const isin of allIsins) {
    const p = prevMap.get(isin) ?? null;
    const c = currMap.get(isin) ?? null;
    let status: HoldingStatus;
    if (!p) status = 'new';
    else if (!c) status = 'exited';
    else status = classifyMatched(p, c);

    const base = c ?? p!;
    holdings.push({
      isin,
      name: base.name,
      industry: base.industry,
      category: base.category,
      status,
      prevWeight: p ? p.weightPct : null,
      currWeight: c ? c.weightPct : null,
      weightChange: p && c ? c.weightPct - p.weightPct : null,
      prevQty: p ? p.quantity : null,
      currQty: c ? c.quantity : null,
      qtyChangePct: pctChange(p?.quantity ?? null, c?.quantity ?? null),
      prevValue: p ? p.marketValueLakhs : null,
      currValue: c ? c.marketValueLakhs : null,
      valueChangePct: pctChange(p?.marketValueLakhs ?? null, c?.marketValueLakhs ?? null),
    });
  }

  // Sort by current weight (then previous), highest first.
  holdings.sort((a, b) => (b.currWeight ?? -1) - (a.currWeight ?? -1) || (b.prevWeight ?? -1) - (a.prevWeight ?? -1));

  const counts = {
    prevHoldings: prev.holdings.length,
    currHoldings: curr.holdings.length,
    added: holdings.filter((h) => h.status === 'new').length,
    exited: holdings.filter((h) => h.status === 'exited').length,
    increased: holdings.filter((h) => h.status === 'increased').length,
    reduced: holdings.filter((h) => h.status === 'reduced').length,
    unchanged: holdings.filter((h) => h.status === 'unchanged').length,
  };

  const sectors = buildSectors(prev, curr);
  const categories = buildCategories(prev, curr);
  const concentration = { prevTop10: topWeight(prev.holdings, 10), currTop10: topWeight(curr.holdings, 10) };
  const totalValue = {
    prev: prev.holdings.reduce((s, h) => s + (h.marketValueLakhs ?? 0), 0),
    curr: curr.holdings.reduce((s, h) => s + (h.marketValueLakhs ?? 0), 0),
  };

  const topCurrent = [...holdings].filter((h) => h.currWeight !== null).slice(0, 10);
  const matched = holdings.filter((h) => h.status === 'increased' || h.status === 'reduced');
  const topIncreases = [...matched]
    .filter((h) => (h.weightChange ?? 0) > 0)
    .sort((a, b) => (b.weightChange ?? 0) - (a.weightChange ?? 0))
    .slice(0, 8);
  const topDecreases = [...matched]
    .filter((h) => (h.weightChange ?? 0) < 0)
    .sort((a, b) => (a.weightChange ?? 0) - (b.weightChange ?? 0))
    .slice(0, 8);
  const newHoldings = holdings
    .filter((h) => h.status === 'new')
    .sort((a, b) => (b.currWeight ?? 0) - (a.currWeight ?? 0));
  const exitedHoldings = holdings
    .filter((h) => h.status === 'exited')
    .sort((a, b) => (b.prevWeight ?? 0) - (a.prevWeight ?? 0));

  const metrics = buildMetrics(prev, curr);
  const turnover = buildTurnover(holdings, totalValue);

  // Conviction signals: meaningful new entries and exits from sizeable positions.
  const LARGE = 1.0; // % of net assets considered a "meaningful" position
  let convictionAdds = newHoldings.filter((h) => (h.currWeight ?? 0) >= LARGE);
  if (convictionAdds.length === 0) convictionAdds = newHoldings.slice(0, 3);
  let convictionExits = exitedHoldings.filter((h) => (h.prevWeight ?? 0) >= LARGE);
  if (convictionExits.length === 0) convictionExits = exitedHoldings.slice(0, 3);

  const insights = buildInsights(
    counts,
    concentration,
    sectors,
    newHoldings,
    exitedHoldings,
    topIncreases,
    topDecreases
  );

  const narrative = buildNarrative(
    prev,
    curr,
    counts,
    concentration,
    sectors,
    newHoldings,
    exitedHoldings,
    topIncreases,
    topDecreases,
    totalValue
  );

  return {
    prevLabel: prev.statementDate,
    currLabel: curr.statementDate,
    schemeName: curr.schemeName || prev.schemeName,
    holdings,
    sectors,
    counts,
    concentration,
    categories,
    totalValue,
    metrics,
    turnover,
    convictionAdds,
    convictionExits,
    narrative,
    topCurrent,
    topIncreases,
    topDecreases,
    newHoldings,
    exitedHoldings,
    insights,
  };
}

function buildSectors(prev: Portfolio, curr: Portfolio): SectorDelta[] {
  const agg = new Map<string, { prevW: number; currW: number; prevC: number; currC: number }>();
  const ensure = (s: string) => {
    if (!agg.has(s)) agg.set(s, { prevW: 0, currW: 0, prevC: 0, currC: 0 });
    return agg.get(s)!;
  };
  for (const h of prev.holdings) {
    const a = ensure(h.industry);
    a.prevW += h.weightPct;
    a.prevC += 1;
  }
  for (const h of curr.holdings) {
    const a = ensure(h.industry);
    a.currW += h.weightPct;
    a.currC += 1;
  }
  return Array.from(agg.entries())
    .map(([sector, a]) => ({
      sector,
      prevWeight: a.prevW,
      currWeight: a.currW,
      change: a.currW - a.prevW,
      prevCount: a.prevC,
      currCount: a.currC,
    }))
    .sort((a, b) => b.currWeight - a.currWeight);
}

function buildCategories(prev: Portfolio, curr: Portfolio): CategoryDelta[] {
  const agg = new Map<string, { prevW: number; currW: number; prevC: number; currC: number }>();
  const ensure = (s: string) => {
    if (!agg.has(s)) agg.set(s, { prevW: 0, currW: 0, prevC: 0, currC: 0 });
    return agg.get(s)!;
  };
  for (const h of prev.holdings) {
    const a = ensure(h.category);
    a.prevW += h.weightPct;
    a.prevC += 1;
  }
  for (const h of curr.holdings) {
    const a = ensure(h.category);
    a.currW += h.weightPct;
    a.currC += 1;
  }
  return Array.from(agg.entries())
    .map(([category, a]) => ({
      category,
      prevWeight: a.prevW,
      currWeight: a.currW,
      change: a.currW - a.prevW,
      prevCount: a.prevC,
      currCount: a.currC,
    }))
    .sort((a, b) => b.currWeight - a.currWeight);
}

/** Build a list of plain-English sentences summarising the quarter's changes. */
function buildNarrative(
  prev: Portfolio,
  curr: Portfolio,
  counts: PortfolioComparison['counts'],
  concentration: PortfolioComparison['concentration'],
  sectors: SectorDelta[],
  newHoldings: HoldingDelta[],
  exitedHoldings: HoldingDelta[],
  topIncreases: HoldingDelta[],
  topDecreases: HoldingDelta[],
  totalValue: { prev: number; curr: number }
): string[] {
  const s = (n: number, w: string) => (n === 1 ? w : w + 's');
  const lines: string[] = [];
  const net = counts.currHoldings - counts.prevHoldings;

  lines.push(
    `Between ${prev.statementDate} and ${curr.statementDate}, the fund's holdings count went from ${counts.prevHoldings} to ${counts.currHoldings} — a net ${net >= 0 ? 'gain' : 'reduction'} of ${Math.abs(net)} ${s(Math.abs(net), 'position')}.`
  );

  lines.push(
    `The manager added ${counts.added} new ${s(counts.added, 'holding')}, fully exited ${counts.exited}, increased ${counts.increased}, and trimmed ${counts.reduced} existing ${s(counts.reduced, 'position')} (${counts.unchanged} left unchanged).`
  );

  if (newHoldings[0]) {
    const names = newHoldings.slice(0, 3).map((h) => h.name).join(', ');
    lines.push(`Notable new buys include ${names}${newHoldings.length > 3 ? ' and others' : ''}.`);
  }
  if (exitedHoldings[0]) {
    const names = exitedHoldings.slice(0, 3).map((h) => h.name).join(', ');
    lines.push(`Positions fully sold include ${names}${exitedHoldings.length > 3 ? ' and others' : ''}.`);
  }
  if (topIncreases[0]) {
    lines.push(
      `The biggest weight increase was ${topIncreases[0].name} (+${(topIncreases[0].weightChange ?? 0).toFixed(2)} percentage points), while ${topDecreases[0]?.name ?? 'no position'} saw the largest cut (${(topDecreases[0]?.weightChange ?? 0).toFixed(2)} pp).`
    );
  }

  const concChange = concentration.currTop10 - concentration.prevTop10;
  lines.push(
    `Portfolio concentration ${concChange >= 0 ? 'rose' : 'eased'}: the top-10 holdings now make up ${concentration.currTop10.toFixed(1)}% of assets (was ${concentration.prevTop10.toFixed(1)}%).`
  );

  const sectorUp = [...sectors].sort((a, b) => b.change - a.change)[0];
  const sectorDown = [...sectors].sort((a, b) => a.change - b.change)[0];
  if (sectorUp && sectorDown) {
    lines.push(
      `On a sector basis, exposure to ${sectorUp.sector} grew the most (+${sectorUp.change.toFixed(2)} pp) while ${sectorDown.sector} was reduced the most (${sectorDown.change.toFixed(2)} pp).`
    );
  }

  if (totalValue.prev > 0 && totalValue.curr > 0) {
    const vChange = ((totalValue.curr - totalValue.prev) / totalValue.prev) * 100;
    lines.push(
      `Total disclosed market value of holdings moved ${vChange >= 0 ? 'up' : 'down'} ${Math.abs(vChange).toFixed(1)}% (₹${(totalValue.prev / 100).toFixed(0)} Cr → ₹${(totalValue.curr / 100).toFixed(0)} Cr).`
    );
  }

  return lines;
}

function buildInsights(
  counts: PortfolioComparison['counts'],
  concentration: PortfolioComparison['concentration'],
  sectors: SectorDelta[],
  newHoldings: HoldingDelta[],
  exitedHoldings: HoldingDelta[],
  topIncreases: HoldingDelta[],
  topDecreases: HoldingDelta[]
): Insight[] {
  const out: Insight[] = [];
  const s = (n: number, w: string) => (n === 1 ? w : w + 's');

  out.push({
    id: 'turnover',
    severity: counts.added >= counts.exited ? 'positive' : 'neutral',
    title: `${counts.added} new, ${counts.exited} exited`,
    detail: `Portfolio moved from ${counts.prevHoldings} to ${counts.currHoldings} holdings. ${counts.increased} ${s(counts.increased, 'position')} increased, ${counts.reduced} reduced, ${counts.unchanged} unchanged.`,
  });

  const concChange = concentration.currTop10 - concentration.prevTop10;
  out.push({
    id: 'concentration',
    severity: concChange > 0 ? 'neutral' : 'positive',
    title: `Top-10 concentration ${concChange >= 0 ? 'up' : 'down'} ${Math.abs(concChange).toFixed(2)} pp`,
    detail: `Combined weight of the 10 largest holdings went from ${concentration.prevTop10.toFixed(2)}% to ${concentration.currTop10.toFixed(2)}%.`,
  });

  if (newHoldings[0]) {
    out.push({
      id: 'top-new',
      severity: 'positive',
      title: `Largest new addition: ${newHoldings[0].name}`,
      detail: `Entered the portfolio at ${(newHoldings[0].currWeight ?? 0).toFixed(2)}% (${newHoldings[0].industry}). ${counts.added} new ${s(counts.added, 'holding')} in total.`,
    });
  }
  if (exitedHoldings[0]) {
    out.push({
      id: 'top-exit',
      severity: 'negative',
      title: `Largest exit: ${exitedHoldings[0].name}`,
      detail: `Fully sold; previously ${(exitedHoldings[0].prevWeight ?? 0).toFixed(2)}% (${exitedHoldings[0].industry}). ${counts.exited} ${s(counts.exited, 'holding')} exited in total.`,
    });
  }
  if (topIncreases[0]) {
    const h = topIncreases[0];
    out.push({
      id: 'top-buy',
      severity: 'positive',
      title: `Most added: ${h.name}`,
      detail: `Weight +${(h.weightChange ?? 0).toFixed(2)} pp (${(h.prevWeight ?? 0).toFixed(2)}% → ${(h.currWeight ?? 0).toFixed(2)}%)${h.qtyChangePct !== null ? `, quantity ${h.qtyChangePct >= 0 ? '+' : ''}${h.qtyChangePct.toFixed(1)}%` : ''}.`,
    });
  }
  if (topDecreases[0]) {
    const h = topDecreases[0];
    out.push({
      id: 'top-trim',
      severity: 'negative',
      title: `Most trimmed: ${h.name}`,
      detail: `Weight ${(h.weightChange ?? 0).toFixed(2)} pp (${(h.prevWeight ?? 0).toFixed(2)}% → ${(h.currWeight ?? 0).toFixed(2)}%)${h.qtyChangePct !== null ? `, quantity ${h.qtyChangePct >= 0 ? '+' : ''}${h.qtyChangePct.toFixed(1)}%` : ''}.`,
    });
  }

  const sectorUp = [...sectors].sort((a, b) => b.change - a.change)[0];
  const sectorDown = [...sectors].sort((a, b) => a.change - b.change)[0];
  if (sectorUp && sectorUp.change > 0) {
    out.push({
      id: 'sector-up',
      severity: 'positive',
      title: `Sector raised: ${sectorUp.sector}`,
      detail: `Allocation +${sectorUp.change.toFixed(2)} pp (${sectorUp.prevWeight.toFixed(2)}% → ${sectorUp.currWeight.toFixed(2)}%).`,
    });
  }
  if (sectorDown && sectorDown.change < 0) {
    out.push({
      id: 'sector-down',
      severity: 'negative',
      title: `Sector cut: ${sectorDown.sector}`,
      detail: `Allocation ${sectorDown.change.toFixed(2)} pp (${sectorDown.prevWeight.toFixed(2)}% → ${sectorDown.currWeight.toFixed(2)}%).`,
    });
  }

  return out;
}
