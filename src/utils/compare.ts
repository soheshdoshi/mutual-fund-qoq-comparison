import type {
  ComparedRecord,
  ComparisonResult,
  Dataset,
  Insight,
  MetricDelta,
  MetricSummary,
} from '../types';

/** Heuristic: guess the best key column (the identifier used to match records). */
export function guessKeyColumn(prev: Dataset, curr: Dataset): string {
  const shared = prev.textColumns.filter((c) => curr.columns.includes(c));
  const candidates = shared.length > 0 ? shared : prev.columns.filter((c) => curr.columns.includes(c));

  // Prefer columns whose name looks like an identifier.
  const namePriority = ['scheme name', 'scheme', 'fund name', 'fund', 'name', 'isin', 'id', 'symbol', 'ticker'];
  const byName = candidates.find((c) =>
    namePriority.some((p) => c.toLowerCase().includes(p))
  );
  if (byName) return byName;

  // Otherwise pick the shared text column with the most unique values in prev.
  let best = candidates[0] ?? prev.columns[0] ?? '';
  let bestUnique = -1;
  for (const c of candidates) {
    const unique = new Set(prev.rows.map((r) => String(r[c] ?? ''))).size;
    if (unique > bestUnique) {
      bestUnique = unique;
      best = c;
    }
  }
  return best;
}

/** Default numeric metric columns shared between both datasets. */
export function sharedMetricColumns(prev: Dataset, curr: Dataset, keyColumn: string): string[] {
  return prev.numericColumns.filter(
    (c) => c !== keyColumn && curr.numericColumns.includes(c)
  );
}

function toNum(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function pct(prev: number | null, curr: number | null): number | null {
  if (prev === null || curr === null) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/** Build the full QoQ comparison between two datasets. */
export function compareDatasets(
  prev: Dataset,
  curr: Dataset,
  keyColumn: string,
  metricColumns: string[]
): ComparisonResult {
  const prevMap = new Map<string, (typeof prev.rows)[number]>();
  for (const row of prev.rows) {
    const key = String(row[keyColumn] ?? '').trim();
    if (key) prevMap.set(key, row);
  }
  const currMap = new Map<string, (typeof curr.rows)[number]>();
  for (const row of curr.rows) {
    const key = String(row[keyColumn] ?? '').trim();
    if (key) currMap.set(key, row);
  }

  const allKeys = new Set<string>([...prevMap.keys(), ...currMap.keys()]);
  const records: ComparedRecord[] = [];

  for (const key of allKeys) {
    const prevRow = prevMap.get(key) ?? null;
    const currRow = currMap.get(key) ?? null;
    const changeType = !prevRow ? 'new' : !currRow ? 'removed' : 'matched';

    const metrics: MetricDelta[] = metricColumns.map((metric) => {
      const previous = prevRow ? toNum(prevRow[metric]) : null;
      const current = currRow ? toNum(currRow[metric]) : null;
      const absoluteChange =
        previous !== null && current !== null ? current - previous : null;
      return {
        metric,
        previous,
        current,
        absoluteChange,
        percentChange: pct(previous, current),
      };
    });

    records.push({ key, changeType, metrics, previousRow: prevRow, currentRow: currRow });
  }

  // Sort: matched first by largest absolute change in first metric, then new, then removed.
  records.sort((a, b) => {
    const order = { matched: 0, new: 1, removed: 2 } as const;
    if (order[a.changeType] !== order[b.changeType]) {
      return order[a.changeType] - order[b.changeType];
    }
    const av = Math.abs(a.metrics[0]?.absoluteChange ?? 0);
    const bv = Math.abs(b.metrics[0]?.absoluteChange ?? 0);
    return bv - av;
  });

  const summaries = buildSummaries(records, metricColumns);
  const counts = {
    matched: records.filter((r) => r.changeType === 'matched').length,
    added: records.filter((r) => r.changeType === 'new').length,
    removed: records.filter((r) => r.changeType === 'removed').length,
    previousTotal: prevMap.size,
    currentTotal: currMap.size,
  };
  const insights = buildInsights(records, summaries, counts);

  return { keyColumn, metricColumns, records, summaries, insights, counts };
}

function buildSummaries(records: ComparedRecord[], metricColumns: string[]): MetricSummary[] {
  return metricColumns.map((metric) => {
    let prevTotal = 0;
    let currTotal = 0;
    let prevCount = 0;
    let currCount = 0;
    for (const rec of records) {
      const m = rec.metrics.find((x) => x.metric === metric);
      if (!m) continue;
      if (m.previous !== null) {
        prevTotal += m.previous;
        prevCount++;
      }
      if (m.current !== null) {
        currTotal += m.current;
        currCount++;
      }
    }
    return {
      metric,
      previousTotal: prevTotal,
      currentTotal: currTotal,
      absoluteChange: currTotal - prevTotal,
      percentChange: pct(prevTotal, currTotal),
      previousAvg: prevCount ? prevTotal / prevCount : 0,
      currentAvg: currCount ? currTotal / currCount : 0,
    };
  });
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return n.toFixed(2);
}

function buildInsights(
  records: ComparedRecord[],
  summaries: MetricSummary[],
  counts: ComparisonResult['counts']
): Insight[] {
  const insights: Insight[] = [];

  // Portfolio composition insight.
  insights.push({
    id: 'composition',
    severity: counts.added >= counts.removed ? 'positive' : 'neutral',
    title: 'Portfolio composition change',
    detail: `${counts.added} new ${plural('record', counts.added)} added and ${counts.removed} removed quarter-on-quarter. Matched records: ${counts.matched}.`,
  });

  // Metric-level trend insights.
  for (const s of summaries) {
    if (s.percentChange === null) continue;
    const up = s.percentChange >= 0;
    insights.push({
      id: `metric-${s.metric}`,
      severity: up ? 'positive' : 'negative',
      title: `${s.metric} ${up ? 'increased' : 'decreased'} ${Math.abs(s.percentChange).toFixed(1)}%`,
      detail: `Total ${s.metric} moved from ${fmt(s.previousTotal)} to ${fmt(s.currentTotal)} (avg ${fmt(s.previousAvg)} → ${fmt(s.currentAvg)}).`,
    });
  }

  // Top mover insights based on first metric.
  const primaryMetric = summaries[0]?.metric;
  if (primaryMetric) {
    const matched = records.filter((r) => r.changeType === 'matched');
    const withDelta = matched
      .map((r) => ({ rec: r, m: r.metrics.find((x) => x.metric === primaryMetric) }))
      .filter((x) => x.m && x.m.percentChange !== null) as {
      rec: ComparedRecord;
      m: MetricDelta;
    }[];

    const gainer = [...withDelta].sort(
      (a, b) => (b.m.percentChange ?? 0) - (a.m.percentChange ?? 0)
    )[0];
    const loser = [...withDelta].sort(
      (a, b) => (a.m.percentChange ?? 0) - (b.m.percentChange ?? 0)
    )[0];

    if (gainer) {
      insights.push({
        id: 'top-gainer',
        severity: 'positive',
        title: `Top gainer: ${gainer.rec.key}`,
        detail: `${primaryMetric} rose ${(gainer.m.percentChange ?? 0).toFixed(1)}% (${fmt(gainer.m.previous ?? 0)} → ${fmt(gainer.m.current ?? 0)}).`,
      });
    }
    if (loser && loser.rec.key !== gainer?.rec.key) {
      insights.push({
        id: 'top-loser',
        severity: 'negative',
        title: `Biggest decline: ${loser.rec.key}`,
        detail: `${primaryMetric} fell ${Math.abs(loser.m.percentChange ?? 0).toFixed(1)}% (${fmt(loser.m.previous ?? 0)} → ${fmt(loser.m.current ?? 0)}).`,
      });
    }
  }

  return insights;

  function plural(word: string, n: number) {
    return n === 1 ? word : word + 's';
  }
}
