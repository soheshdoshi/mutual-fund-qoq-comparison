import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ComparisonResult } from '../types';

interface Props {
  result: ComparisonResult;
  previousLabel: string;
  currentLabel: string;
}

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777'];

function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toFixed(1);
}

export function Dashboard({ result, previousLabel, currentLabel }: Props) {
  const { summaries, counts, records, metricColumns } = result;

  // Summary cards data.
  const cards = [
    { label: `${previousLabel} funds`, value: counts.previousTotal, accent: '#2563eb' },
    { label: `${currentLabel} funds`, value: counts.currentTotal, accent: '#16a34a' },
    { label: 'Added', value: counts.added, accent: '#16a34a' },
    { label: 'Removed', value: counts.removed, accent: '#dc2626' },
  ];

  // Bar chart: total per metric for prev vs curr.
  const totalsData = summaries.map((s) => ({
    metric: s.metric,
    [previousLabel]: Number(s.previousTotal.toFixed(2)),
    [currentLabel]: Number(s.currentTotal.toFixed(2)),
  }));

  // Pie chart: composition of matched / added / removed.
  const compositionData = [
    { name: 'Matched', value: counts.matched },
    { name: 'Added', value: counts.added },
    { name: 'Removed', value: counts.removed },
  ].filter((d) => d.value > 0);

  // Top movers chart for the primary metric.
  const primaryMetric = metricColumns[0];
  const topMovers = primaryMetric
    ? records
        .filter((r) => r.changeType === 'matched')
        .map((r) => {
          const m = r.metrics.find((x) => x.metric === primaryMetric);
          return { key: r.key, change: m?.percentChange ?? null };
        })
        .filter((d): d is { key: string; change: number } => d.change !== null)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 8)
        .map((d) => ({ name: d.key.length > 18 ? d.key.slice(0, 18) + '…' : d.key, change: Number(d.change.toFixed(1)) }))
    : [];

  return (
    <div className="dashboard">
      <div className="cards">
        {cards.map((c) => (
          <div className="card" key={c.label} style={{ borderTopColor: c.accent }}>
            <div className="card-value">{c.value}</div>
            <div className="card-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="metric-summary">
        {summaries.map((s) => {
          const up = (s.percentChange ?? 0) >= 0;
          return (
            <div className="metric-card" key={s.metric}>
              <div className="metric-name">{s.metric}</div>
              <div className="metric-totals">
                <span>{compact(s.previousTotal)}</span>
                <span className="arrow">→</span>
                <span>{compact(s.currentTotal)}</span>
              </div>
              <div className={`metric-change ${up ? 'pos' : 'neg'}`}>
                {up ? '▲' : '▼'} {s.percentChange === null ? 'n/a' : Math.abs(s.percentChange).toFixed(1) + '%'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="charts">
        <div className="chart-box">
          <h3>Total by metric</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={totalsData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey={previousLabel} fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey={currentLabel} fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h3>Portfolio composition</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={compositionData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={(e) => `${e.name}: ${e.value}`}
              >
                {compositionData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {topMovers.length > 0 && (
          <div className="chart-box wide">
            <h3>Top movers — {primaryMetric} (% change)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topMovers}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis type="number" tickFormatter={(v) => v + '%'} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => v + '%'} />
                <Bar dataKey="change" radius={[0, 4, 4, 0]}>
                  {topMovers.map((d, i) => (
                    <Cell key={i} fill={d.change >= 0 ? '#16a34a' : '#dc2626'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
