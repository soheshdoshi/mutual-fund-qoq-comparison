import { useEffect, useMemo, useState } from 'react';
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
  Treemap,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CategoryDelta,
  HoldingDelta,
  HoldingStatus,
  PortfolioComparison,
  RiskMetrics,
  SectorDelta,
  WeightTimeline,
} from '../types';
import { InsightsPanel } from './InsightsPanel';
import { exportComparisonExcel } from '../utils/exportExcel';

interface Props {
  comparison: PortfolioComparison;
  prevLabel: string;
  currLabel: string;
  /** Full weight history across every uploaded statement (for the Explore tab). */
  timeline?: WeightTimeline[];
  /** Chronological list of all statement labels. */
  periodLabels?: string[];
}

const STATUS_META: Record<HoldingStatus, { text: string; cls: string; icon: string }> = {
  new: { text: 'New', cls: 'badge-new', icon: '🟢' },
  exited: { text: 'Exited', cls: 'badge-removed', icon: '🔴' },
  increased: { text: 'Increased', cls: 'badge-up', icon: '▲' },
  reduced: { text: 'Reduced', cls: 'badge-down', icon: '▼' },
  unchanged: { text: 'Unchanged', cls: 'badge-matched', icon: '–' },
};

const PALETTE = [
  '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777',
  '#65a30d', '#ea580c', '#0d9488', '#4f46e5', '#b45309', '#be123c', '#15803d',
];

type Tab = 'overview' | 'analytics' | 'holdings' | 'sectors' | 'movers' | 'activity' | 'explore';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '🏠' },
  { id: 'analytics', label: 'Risk & Metrics', icon: '📐' },
  { id: 'holdings', label: 'Holdings', icon: '📋' },
  { id: 'sectors', label: 'Sectors', icon: '🏭' },
  { id: 'movers', label: 'Movers', icon: '📈' },
  { id: 'activity', label: 'Buys & Sells', icon: '🔄' },
  { id: 'explore', label: 'Explore', icon: '🔎' },
];

/* ---------- formatting helpers ---------- */
function pp(v: number | null): string {
  if (v === null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(2);
}
function pctNum(v: number | null): string {
  return v === null ? '—' : v.toFixed(2) + '%';
}
function pctChange(v: number | null): string {
  return v === null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}
function crore(lakhs: number): string {
  return '₹' + (lakhs / 100).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' Cr';
}

/** Stable colour per sector name, used by treemap / heatmap. */
function buildSectorColors(sectors: SectorDelta[]): Record<string, string> {
  const map: Record<string, string> = {};
  sectors.forEach((s, i) => {
    map[s.sector] = PALETTE[i % PALETTE.length];
  });
  return map;
}

export function PortfolioReport({ comparison, prevLabel, currLabel, timeline = [], periodLabels = [] }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [printMode, setPrintMode] = useState(false);

  // When entering full-print mode, render everything then open the print dialog.
  useEffect(() => {
    if (!printMode) return;
    const t = setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 450);
    return () => clearTimeout(t);
  }, [printMode]);

  const shared = { comparison, prevLabel, currLabel, timeline, periodLabels };

  if (printMode) {
    return (
      <div className="report portfolio-report print-report">
        <PrintCover comparison={comparison} prevLabel={prevLabel} currLabel={currLabel} />
        <PrintSection title="Overview"><OverviewTab {...shared} /></PrintSection>
        <PrintSection title="Risk & Metrics"><AnalyticsTab {...shared} /></PrintSection>
        <PrintSection title="Holdings"><HoldingsTab {...shared} /></PrintSection>
        <PrintSection title="Sectors"><SectorsTab {...shared} /></PrintSection>
        <PrintSection title="Movers"><MoversTab {...shared} /></PrintSection>
        <PrintSection title="Buys & Sells"><ActivityTab comparison={comparison} /></PrintSection>
      </div>
    );
  }

  return (
    <div className="report portfolio-report">
      <div className="scheme-banner">
        <div>
          <h2>{comparison.schemeName}</h2>
          <p>
            Holdings comparison · <strong>{prevLabel}</strong> → <strong>{currLabel}</strong>
          </p>
        </div>
        <div className="banner-actions">
          <button className="btn-light" onClick={() => exportComparisonExcel(comparison, prevLabel, currLabel)} title="Download full Excel workbook">
            ⬇ Excel
          </button>
          <button className="btn-light" onClick={() => setPrintMode(true)} title="Print or save the full report as PDF">
            🖨 Full PDF
          </button>
        </div>
      </div>

      <KpiStrip comparison={comparison} prevLabel={prevLabel} currLabel={currLabel} />

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && <OverviewTab {...shared} />}
      {tab === 'analytics' && <AnalyticsTab {...shared} />}
      {tab === 'holdings' && <HoldingsTab {...shared} />}
      {tab === 'sectors' && <SectorsTab {...shared} />}
      {tab === 'movers' && <MoversTab {...shared} />}
      {tab === 'activity' && <ActivityTab comparison={comparison} />}
      {tab === 'explore' && <ExploreTab comparison={comparison} timeline={timeline} periodLabels={periodLabels} />}
    </div>
  );
}

/* ============================ Print helpers ============================ */
function PrintCover({ comparison, prevLabel, currLabel }: { comparison: PortfolioComparison; prevLabel: string; currLabel: string }) {
  const { counts, metrics, totalValue, turnover } = comparison;
  return (
    <div className="print-cover">
      <div className="pc-logo">📊</div>
      <h1>{comparison.schemeName}</h1>
      <h2>Quarter-on-Quarter Portfolio Report</h2>
      <p className="pc-period">{prevLabel} &nbsp;→&nbsp; {currLabel}</p>
      <table className="pc-table">
        <tbody>
          <tr><td>Total holdings</td><td>{counts.prevHoldings} → {counts.currHoldings}</td></tr>
          <tr><td>New / Exited</td><td>{counts.added} new · {counts.exited} exited</td></tr>
          <tr><td>Top-10 concentration</td><td>{metrics.top10.prev.toFixed(1)}% → {metrics.top10.curr.toFixed(1)}%</td></tr>
          <tr><td>Turnover</td><td>{turnover.turnoverPct.toFixed(1)}%</td></tr>
          <tr><td>Total value</td><td>{crore(totalValue.prev)} → {crore(totalValue.curr)}</td></tr>
        </tbody>
      </table>
      <p className="pc-foot">Generated locally · {new Date().toLocaleDateString()}</p>
    </div>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="print-section">
      <h2 className="print-section-title">{title}</h2>
      {children}
    </section>
  );
}

/* ============================ KPI strip ============================ */
function KpiStrip({ comparison, prevLabel, currLabel }: { comparison: PortfolioComparison; prevLabel: string; currLabel: string }) {
  const { counts, metrics, totalValue, turnover } = comparison;
  const netHoldings = counts.currHoldings - counts.prevHoldings;
  const valueChange = totalValue.prev > 0 ? ((totalValue.curr - totalValue.prev) / totalValue.prev) * 100 : null;
  const concChange = metrics.top10.curr - metrics.top10.prev;

  const kpis = [
    { icon: '📦', label: 'Total holdings', value: String(counts.currHoldings), sub: `${netHoldings >= 0 ? '+' : ''}${netHoldings} vs ${prevLabel}`, tone: netHoldings >= 0 ? 'pos' : 'neg' },
    { icon: '🟢', label: 'New positions', value: String(counts.added), sub: 'added this period', tone: 'pos' },
    { icon: '🔴', label: 'Exited positions', value: String(counts.exited), sub: 'fully sold', tone: 'neg' },
    { icon: '🔁', label: 'Turnover', value: turnover.turnoverPct.toFixed(1) + '%', sub: `${counts.increased} up · ${counts.reduced} down`, tone: 'neutral' },
    { icon: '🎯', label: 'Top-10 weight', value: metrics.top10.curr.toFixed(1) + '%', sub: `${pp(concChange)} pp`, tone: concChange >= 0 ? 'neg' : 'pos' },
    { icon: '💰', label: `Total value (${currLabel})`, value: crore(totalValue.curr), sub: valueChange === null ? '' : `${pctChange(valueChange)}`, tone: (valueChange ?? 0) >= 0 ? 'pos' : 'neg' },
  ];

  return (
    <div className="kpi-strip">
      {kpis.map((k) => (
        <div className="kpi" key={k.label}>
          <div className="kpi-icon">{k.icon}</div>
          <div className="kpi-body">
            <div className="kpi-value">{k.value}</div>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-sub ${k.tone}`}>{k.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ Overview ============================ */
function OverviewTab({ comparison, prevLabel, currLabel }: Props) {
  const { categories, narrative, topCurrent, counts, convictionAdds, convictionExits } = comparison;

  const activityData = [
    { name: 'New', value: counts.added, fill: '#16a34a' },
    { name: 'Increased', value: counts.increased, fill: '#0891b2' },
    { name: 'Unchanged', value: counts.unchanged, fill: '#94a3b8' },
    { name: 'Reduced', value: counts.reduced, fill: '#f59e0b' },
    { name: 'Exited', value: counts.exited, fill: '#dc2626' },
  ].filter((d) => d.value > 0);

  const catData = categories.map((c, i) => ({
    name: c.category,
    value: Number(c.currWeight.toFixed(2)),
    fill: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="tab-content">
      <div className="story">
        <h3>📝 What changed this period</h3>
        <ul>
          {narrative.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <ConvictionPanels adds={convictionAdds} exits={convictionExits} />

      <ValueWaterfall comparison={comparison} prevLabel={prevLabel} currLabel={currLabel} />

      <div className="charts">
        <div className="chart-box">
          <h3>Asset category mix — {currLabel}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {catData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => v + '%'} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h3>Portfolio activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={activityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.name}: ${e.value}`}>
                {activityData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <CategoryTable categories={categories} prevLabel={prevLabel} currLabel={currLabel} />

      <div className="panel">
        <h3>🏆 Top 10 holdings — {currLabel}</h3>
        <WeightBars
          rows={topCurrent.map((h) => ({ label: h.name, value: h.currWeight ?? 0, sub: h.industry, delta: h.weightChange }))}
        />
      </div>

      <InsightsPanel insights={comparison.insights} />
    </div>
  );
}

function ConvictionPanels({ adds, exits }: { adds: HoldingDelta[]; exits: HoldingDelta[] }) {
  return (
    <div className="two-col">
      <div className="panel signal-panel">
        <h3>⭐ High-conviction adds</h3>
        <p className="muted small">Brand-new positions opened at a meaningful weight.</p>
        {adds.length === 0 ? (
          <p className="muted small">No notable new positions.</p>
        ) : (
          <ul className="signal-list">
            {adds.map((h) => (
              <li key={h.isin}>
                <span className="sig-name" title={h.name}>{h.name}</span>
                <span className="sig-meta">{h.industry}</span>
                <span className="sig-val pos">{(h.currWeight ?? 0).toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="panel signal-panel">
        <h3>🚪 Conviction exits</h3>
        <p className="muted small">Sizeable positions that were fully sold out.</p>
        {exits.length === 0 ? (
          <p className="muted small">No sizeable exits.</p>
        ) : (
          <ul className="signal-list">
            {exits.map((h) => (
              <li key={h.isin}>
                <span className="sig-name" title={h.name}>{h.name}</span>
                <span className="sig-meta">{h.industry}</span>
                <span className="sig-val neg">{(h.prevWeight ?? 0).toFixed(2)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryTable({ categories, prevLabel, currLabel }: { categories: CategoryDelta[]; prevLabel: string; currLabel: string }) {
  return (
    <div className="panel">
      <h3>Asset allocation breakdown</h3>
      <table className="mini-table">
        <thead>
          <tr>
            <th>Category</th>
            <th className="num">{prevLabel} %</th>
            <th className="num">{currLabel} %</th>
            <th className="num">Change</th>
            <th className="num"># holdings</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => {
            const up = c.change >= 0;
            return (
              <tr key={c.category}>
                <td className="key-cell">{c.category}</td>
                <td className="num">{c.prevWeight.toFixed(2)}</td>
                <td className="num">{c.currWeight.toFixed(2)}</td>
                <td className="num">
                  <span className={Math.abs(c.change) < 0.005 ? 'muted' : up ? 'pos' : 'neg'}>{pp(c.change)} pp</span>
                </td>
                <td className="num">{c.currCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ============================ Value waterfall ============================ */
function ValueWaterfall({ comparison, prevLabel, currLabel }: { comparison: PortfolioComparison; prevLabel: string; currLabel: string }) {
  const { holdings, totalValue } = comparison;
  let newV = 0, addV = 0, trimV = 0, exitV = 0;
  for (const h of holdings) {
    const pv = h.prevValue ?? 0;
    const cv = h.currValue ?? 0;
    if (h.status === 'new') newV += cv;
    else if (h.status === 'exited') exitV += pv;
    else {
      const d = cv - pv;
      if (d > 0) addV += d;
      else trimV += -d;
    }
  }
  const toCr = (l: number) => l / 100;

  // Build floating-bar waterfall data.
  type Step = { name: string; base: number; bar: number; fill: string; display: number };
  const steps: Step[] = [];
  let running = totalValue.prev;
  steps.push({ name: prevLabel, base: 0, bar: toCr(running), fill: '#475569', display: toCr(running) });
  const pushUp = (name: string, delta: number, fill: string) => {
    if (delta <= 0) return;
    steps.push({ name, base: toCr(running), bar: toCr(delta), fill, display: toCr(delta) });
    running += delta;
  };
  const pushDown = (name: string, delta: number, fill: string) => {
    if (delta <= 0) return;
    running -= delta;
    steps.push({ name, base: toCr(running), bar: toCr(delta), fill, display: -toCr(delta) });
  };
  pushUp('New buys', newV, '#16a34a');
  pushUp('Top-ups', addV, '#0891b2');
  pushDown('Trims', trimV, '#f59e0b');
  pushDown('Exits', exitV, '#dc2626');
  steps.push({ name: currLabel, base: 0, bar: toCr(totalValue.curr), fill: '#2563eb', display: toCr(totalValue.curr) });

  return (
    <div className="chart-box wide">
      <h3>💧 How portfolio value moved (₹ Cr)</h3>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={steps} margin={{ top: 8, right: 16, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(_v: number, _n: string, p: any) => [(p.payload.display >= 0 ? '+' : '') + p.payload.display.toFixed(0) + ' Cr', 'Δ']}
          />
          <Bar dataKey="base" stackId="w" fill="transparent" />
          <Bar dataKey="bar" stackId="w" radius={[4, 4, 0, 0]}>
            {steps.map((s, i) => (
              <Cell key={i} fill={s.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ============================ Analytics (risk + metrics) ============================ */
function AnalyticsTab({ comparison }: Props) {
  const { metrics, turnover, convictionAdds, convictionExits } = comparison;
  return (
    <div className="tab-content">
      <MetricsGrid metrics={metrics} />

      <div className="two-col">
        <div className="panel">
          <h3>🔁 Turnover & churn</h3>
          <div className="stat-rows">
            <div className="stat-row"><span>Turnover ratio</span><strong>{turnover.turnoverPct.toFixed(1)}%</strong></div>
            <div className="stat-row"><span>Value bought</span><strong className="pos">{crore(turnover.boughtValue)}</strong></div>
            <div className="stat-row"><span>Value sold</span><strong className="neg">{crore(turnover.soldValue)}</strong></div>
            <div className="stat-row"><span>Weight churn (one-way)</span><strong>{turnover.weightChurn.toFixed(2)} pp</strong></div>
          </div>
          <p className="muted small">
            Turnover ≈ lesser of buys/sells over average assets — a higher number means more active trading.
          </p>
        </div>

        <div className="panel">
          <h3>🧮 Diversification</h3>
          <div className="stat-rows">
            <div className="stat-row"><span>Effective # of stocks</span><strong>{metrics.effectiveStocks.curr.toFixed(1)}</strong></div>
            <div className="stat-row"><span>HHI (0–10,000)</span><strong>{metrics.hhi.curr.toFixed(0)}</strong></div>
            <div className="stat-row"><span>Avg position size</span><strong>{metrics.avgPosition.curr.toFixed(2)}%</strong></div>
            <div className="stat-row"><span>Top-5 concentration</span><strong>{metrics.top5.curr.toFixed(1)}%</strong></div>
          </div>
          <p className="muted small">
            A lower HHI / higher effective stock count means a more spread-out, diversified portfolio.
          </p>
        </div>
      </div>

      <ConvictionPanels adds={convictionAdds} exits={convictionExits} />
    </div>
  );
}

function MetricsGrid({ metrics }: { metrics: RiskMetrics }) {
  const cards = [
    { label: 'Holdings', prev: metrics.holdings.prev, curr: metrics.holdings.curr, fmt: (n: number) => String(Math.round(n)), lowerBetter: false },
    { label: 'Top-5 weight', prev: metrics.top5.prev, curr: metrics.top5.curr, fmt: (n: number) => n.toFixed(1) + '%', lowerBetter: true },
    { label: 'Top-10 weight', prev: metrics.top10.prev, curr: metrics.top10.curr, fmt: (n: number) => n.toFixed(1) + '%', lowerBetter: true },
    { label: 'HHI', prev: metrics.hhi.prev, curr: metrics.hhi.curr, fmt: (n: number) => n.toFixed(0), lowerBetter: true },
    { label: 'Effective stocks', prev: metrics.effectiveStocks.prev, curr: metrics.effectiveStocks.curr, fmt: (n: number) => n.toFixed(1), lowerBetter: false },
    { label: 'Avg position', prev: metrics.avgPosition.prev, curr: metrics.avgPosition.curr, fmt: (n: number) => n.toFixed(2) + '%', lowerBetter: false },
  ];
  return (
    <div className="metrics-grid">
      {cards.map((c) => {
        const diff = c.curr - c.prev;
        const better = c.lowerBetter ? diff < 0 : diff > 0;
        const tone = Math.abs(diff) < 1e-6 ? 'neutral' : better ? 'pos' : 'neg';
        return (
          <div className="metric-card" key={c.label}>
            <div className="metric-label">{c.label}</div>
            <div className="metric-value">{c.fmt(c.curr)}</div>
            <div className={`metric-diff ${tone}`}>
              {diff >= 0 ? '▲' : '▼'} {c.fmt(Math.abs(diff))} <span className="metric-prev">from {c.fmt(c.prev)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================ Holdings ============================ */
type SortKey = 'name' | 'currWeight' | 'weightChange' | 'qtyChangePct' | 'valueChangePct';

function HoldingsTab({ comparison, prevLabel, currLabel }: Props) {
  const { holdings, sectors } = comparison;
  const [filter, setFilter] = useState<'all' | HoldingStatus>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('currWeight');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sectorColors = useMemo(() => buildSectorColors(sectors), [sectors]);
  const treeData = useMemo(
    () =>
      holdings
        .filter((h) => (h.currWeight ?? 0) > 0)
        .map((h) => ({ name: h.name, size: Number((h.currWeight ?? 0).toFixed(2)), sector: h.industry })),
    [holdings]
  );

  const filtered = useMemo(() => {
    let rows = holdings.filter((h) => {
      if (filter !== 'all' && h.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!h.name.toLowerCase().includes(q) && !h.industry.toLowerCase().includes(q) && !h.isin.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
    rows = [...rows].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      const av = (a[sortKey] as number | null) ?? -Infinity;
      const bv = (b[sortKey] as number | null) ?? -Infinity;
      return (av - bv) * dir;
    });
    return rows;
  }, [holdings, filter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  }
  const arrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const maxWeight = Math.max(1, ...holdings.map((h) => h.currWeight ?? 0));

  return (
    <div className="tab-content">
      <div className="chart-box wide">
        <h3>🗺️ Holdings map — box size = weight, colour = sector ({currLabel})</h3>
        <ResponsiveContainer width="100%" height={360}>
          <Treemap data={treeData} dataKey="size" nameKey="name" stroke="#fff" content={<TreeCell colors={sectorColors} />} />
        </ResponsiveContainer>
      </div>

      <div className="table-section">
        <div className="table-toolbar">
          <h2>All holdings — detailed change</h2>
          <div className="toolbar-controls">
            <input className="search" placeholder="🔍 Search name / sector / ISIN…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="filters">
              {(['all', 'new', 'increased', 'reduced', 'exited', 'unchanged'] as const).map((f) => (
                <button key={f} className={`filter-btn${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'All' : STATUS_META[f].text}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={() => exportHoldingsCsv(comparison, prevLabel, currLabel)}>
              ⬇ Export CSV
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="cmp-table">
            <thead>
              <tr>
                <th className="sticky-col sortable" onClick={() => toggleSort('name')}>Holding{arrow('name')}</th>
                <th>Sector</th>
                <th>Status</th>
                <th className="num sortable" onClick={() => toggleSort('currWeight')}>{currLabel} %{arrow('currWeight')}</th>
                <th>Weight bar</th>
                <th className="num sortable" onClick={() => toggleSort('weightChange')}>Δ pp{arrow('weightChange')}</th>
                <th className="num sortable" onClick={() => toggleSort('qtyChangePct')}>Qty Δ{arrow('qtyChangePct')}</th>
                <th className="num sortable" onClick={() => toggleSort('valueChangePct')}>Value Δ{arrow('valueChangePct')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const up = (h.weightChange ?? 0) >= 0;
                const w = h.currWeight ?? 0;
                return (
                  <tr key={h.isin}>
                    <td className="sticky-col key-cell" title={`${h.name} (${h.isin})`}>{h.name}</td>
                    <td title={h.industry}>{h.industry}</td>
                    <td>
                      <span className={`badge ${STATUS_META[h.status].cls}`}>{STATUS_META[h.status].text}</span>
                    </td>
                    <td className="num">{pctNum(h.currWeight)}</td>
                    <td className="bar-cell">
                      <div className="wbar-track">
                        <div className="wbar-fill" style={{ width: `${(w / maxWeight) * 100}%` }} />
                      </div>
                    </td>
                    <td className="num">
                      {h.weightChange === null ? <span className="muted">—</span> : <span className={up ? 'pos' : 'neg'}>{pp(h.weightChange)}</span>}
                    </td>
                    <td className="num">
                      {h.qtyChangePct === null ? <span className="muted">—</span> : <span className={h.qtyChangePct >= 0 ? 'pos' : 'neg'}>{pctChange(h.qtyChangePct)}</span>}
                    </td>
                    <td className="num">
                      {h.valueChangePct === null ? <span className="muted">—</span> : <span className={h.valueChangePct >= 0 ? 'pos' : 'neg'}>{pctChange(h.valueChangePct)}</span>}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-row">No holdings match your filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          Showing {filtered.length} of {holdings.length} holdings · click a column header to sort
        </div>
      </div>
    </div>
  );
}

/** Custom treemap node — colours each box by its sector. */
function TreeCell(props: any) {
  const { x, y, width, height, name, colors, size, sector } = props;
  if (width <= 0 || height <= 0) return null;
  const fill = (colors && sector && colors[sector]) || '#94a3b8';
  const maxChars = Math.max(3, Math.floor(width / 7));
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={1.5} />
      {width > 54 && height > 22 && (
        <text x={x + 5} y={y + 15} fontSize={11} fill="#fff" fontWeight={600}>
          {name && name.length > maxChars ? name.slice(0, maxChars) + '…' : name}
        </text>
      )}
      {width > 54 && height > 36 && (
        <text x={x + 5} y={y + 29} fontSize={10} fill="rgba(255,255,255,0.85)">
          {size}%
        </text>
      )}
    </g>
  );
}

/* ============================ Sectors ============================ */
function SectorsTab({ comparison, prevLabel, currLabel }: Props) {
  const { sectors } = comparison;
  const sectorData = sectors.slice(0, 14).map((s) => ({
    sector: s.sector.length > 18 ? s.sector.slice(0, 18) + '…' : s.sector,
    [prevLabel]: Number(s.prevWeight.toFixed(2)),
    [currLabel]: Number(s.currWeight.toFixed(2)),
  }));
  const changeData = [...sectors]
    .filter((s) => Math.abs(s.change) >= 0.005)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 12)
    .map((s) => ({ name: s.sector.length > 18 ? s.sector.slice(0, 18) + '…' : s.sector, change: Number(s.change.toFixed(2)) }));

  return (
    <div className="tab-content">
      <SectorHeatmap sectors={sectors} />

      <div className="chart-box wide">
        <h3>Sector / industry allocation (% of net assets)</h3>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={sectorData} margin={{ top: 8, right: 16, left: 0, bottom: 70 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis dataKey="sector" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} height={80} />
            <YAxis tickFormatter={(v) => v + '%'} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => v + '%'} />
            <Legend />
            <Bar dataKey={prevLabel} fill="#94a3b8" radius={[4, 4, 0, 0]} />
            <Bar dataKey={currLabel} fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-box wide">
        <h3>Biggest sector shifts (percentage points)</h3>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={changeData} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis type="number" tickFormatter={(v) => (v >= 0 ? '+' : '') + v} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => (v >= 0 ? '+' : '') + v + ' pp'} />
            <Bar dataKey="change" radius={[0, 4, 4, 0]}>
              {changeData.map((d, i) => (
                <Cell key={i} fill={d.change >= 0 ? '#16a34a' : '#dc2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectorTable sectors={sectors} prevLabel={prevLabel} currLabel={currLabel} />
    </div>
  );
}

function SectorHeatmap({ sectors }: { sectors: SectorDelta[] }) {
  const maxAbs = Math.max(0.01, ...sectors.map((s) => Math.abs(s.change)));
  function cellStyle(change: number): React.CSSProperties {
    const intensity = Math.min(1, Math.abs(change) / maxAbs);
    const alpha = 0.12 + intensity * 0.7;
    const bg = change >= 0 ? `rgba(22,163,74,${alpha})` : `rgba(220,38,38,${alpha})`;
    return { background: bg };
  }
  return (
    <div className="panel">
      <h3>🌡️ Sector change heatmap</h3>
      <p className="muted small">Greener = increased exposure, redder = reduced. Stronger colour = bigger move.</p>
      <div className="heatmap">
        {sectors.map((s) => (
          <div className="heat-cell" style={cellStyle(s.change)} key={s.sector} title={`${s.sector}: ${pp(s.change)} pp`}>
            <span className="heat-name">{s.sector}</span>
            <span className="heat-weight">{s.currWeight.toFixed(1)}%</span>
            <span className={`heat-change ${s.change >= 0 ? 'pos' : 'neg'}`}>{pp(s.change)} pp</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectorTable({ sectors, prevLabel, currLabel }: { sectors: SectorDelta[]; prevLabel: string; currLabel: string }) {
  return (
    <div className="table-section">
      <div className="table-toolbar">
        <h2>Sector allocation change</h2>
      </div>
      <div className="table-scroll">
        <table className="cmp-table">
          <thead>
            <tr>
              <th className="sticky-col">Sector / Rating</th>
              <th className="num">{prevLabel} %</th>
              <th className="num">{currLabel} %</th>
              <th className="num">Change (pp)</th>
              <th className="num"># {prevLabel}</th>
              <th className="num"># {currLabel}</th>
            </tr>
          </thead>
          <tbody>
            {sectors.map((s) => {
              const up = s.change >= 0;
              return (
                <tr key={s.sector}>
                  <td className="sticky-col key-cell" title={s.sector}>{s.sector}</td>
                  <td className="num">{s.prevWeight.toFixed(2)}</td>
                  <td className="num">{s.currWeight.toFixed(2)}</td>
                  <td className="num">
                    <span className={Math.abs(s.change) < 0.005 ? 'muted' : up ? 'pos' : 'neg'}>{pp(s.change)}</span>
                  </td>
                  <td className="num">{s.prevCount}</td>
                  <td className="num">{s.currCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================ Movers ============================ */
function MoversTab({ comparison, prevLabel, currLabel }: Props) {
  const { topIncreases, topDecreases } = comparison;
  const diverging = [
    ...topDecreases.slice(0, 8).map((h) => ({ name: h.name.length > 22 ? h.name.slice(0, 22) + '…' : h.name, change: Number((h.weightChange ?? 0).toFixed(2)) })),
    ...topIncreases.slice(0, 8).map((h) => ({ name: h.name.length > 22 ? h.name.slice(0, 22) + '…' : h.name, change: Number((h.weightChange ?? 0).toFixed(2)) })),
  ].sort((a, b) => a.change - b.change);

  return (
    <div className="tab-content">
      <div className="chart-box wide">
        <h3>Top weight changes — {prevLabel} → {currLabel} (percentage points)</h3>
        <ResponsiveContainer width="100%" height={Math.max(300, diverging.length * 34)}>
          <BarChart data={diverging} layout="vertical" margin={{ top: 8, right: 24, left: 24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
            <XAxis type="number" tickFormatter={(v) => (v >= 0 ? '+' : '') + v} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => (v >= 0 ? '+' : '') + v + ' pp'} />
            <Bar dataKey="change" radius={[0, 4, 4, 0]}>
              {diverging.map((d, i) => (
                <Cell key={i} fill={d.change >= 0 ? '#16a34a' : '#dc2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="two-col">
        <MoversCard title="📈 Top added (weight ↑)" rows={topIncreases} kind="up" prevLabel={prevLabel} currLabel={currLabel} />
        <MoversCard title="📉 Top trimmed (weight ↓)" rows={topDecreases} kind="down" prevLabel={prevLabel} currLabel={currLabel} />
      </div>
    </div>
  );
}

function MoversCard({
  title,
  rows,
  kind,
  prevLabel,
  currLabel,
}: {
  title: string;
  rows: HoldingDelta[];
  kind: 'up' | 'down';
  prevLabel: string;
  currLabel: string;
}) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted small">No positions {kind === 'up' ? 'increased' : 'reduced'}.</p>
      ) : (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Holding</th>
              <th className="num">{prevLabel}%</th>
              <th className="num">{currLabel}%</th>
              <th className="num">Δ pp</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.isin}>
                <td className="key-cell" title={h.name}>{h.name}</td>
                <td className="num">{(h.prevWeight ?? 0).toFixed(2)}</td>
                <td className="num">{(h.currWeight ?? 0).toFixed(2)}</td>
                <td className="num">
                  <span className={kind === 'up' ? 'pos' : 'neg'}>{pp(h.weightChange)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ============================ Activity (buys & sells) ============================ */
function ActivityTab({ comparison }: { comparison: PortfolioComparison }) {
  const { newHoldings, exitedHoldings } = comparison;
  return (
    <div className="tab-content">
      <div className="two-col">
        <ListCard title={`🟢 New holdings (${newHoldings.length})`} rows={newHoldings} weightKey="curr" empty="No new holdings." accent="#16a34a" />
        <ListCard title={`🔴 Exited holdings (${exitedHoldings.length})`} rows={exitedHoldings} weightKey="prev" empty="No holdings exited." accent="#dc2626" />
      </div>
    </div>
  );
}

function ListCard({
  title,
  rows,
  weightKey,
  empty,
  accent,
}: {
  title: string;
  rows: HoldingDelta[];
  weightKey: 'prev' | 'curr';
  empty: string;
  accent: string;
}) {
  return (
    <div className="panel" style={{ borderTop: `3px solid ${accent}` }}>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted small">{empty}</p>
      ) : (
        <table className="mini-table">
          <thead>
            <tr>
              <th>Holding</th>
              <th>Sector</th>
              <th className="num">Weight %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.isin}>
                <td className="key-cell" title={h.name}>{h.name}</td>
                <td title={h.industry}>{h.industry}</td>
                <td className="num">{((weightKey === 'prev' ? h.prevWeight : h.currWeight) ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ============================ Explore (find a stock + timeline) ============================ */
function ExploreTab({
  comparison,
  timeline,
  periodLabels,
}: {
  comparison: PortfolioComparison;
  timeline: WeightTimeline[];
  periodLabels: string[];
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? timeline.filter((t) => t.name.toLowerCase().includes(q) || t.industry.toLowerCase().includes(q) || t.isin.toLowerCase().includes(q))
      : timeline;
    return list.slice(0, 24);
  }, [timeline, query]);

  const deltaByIsin = useMemo(() => {
    const m = new Map<string, HoldingDelta>();
    for (const h of comparison.holdings) m.set(h.isin, h);
    return m;
  }, [comparison]);

  const multiPeriod = periodLabels.length >= 2;

  return (
    <div className="tab-content">
      <div className="panel">
        <h3>🔎 Find a stock</h3>
        <p className="muted small">
          {multiPeriod
            ? `Search any holding to see how its weight moved across ${periodLabels.length} statements.`
            : 'Search any holding to see its before/after detail.'}
        </p>
        <input
          className="search wide-search"
          placeholder="Type a stock or sector, e.g. HDFC, Banks…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {matches.length === 0 ? (
        <div className="panel"><p className="muted">No holdings match “{query}”.</p></div>
      ) : (
        <div className="explore-grid">
          {matches.map((t) => {
            const d = deltaByIsin.get(t.isin);
            return (
              <div className="explore-card" key={t.isin}>
                <div className="ex-head">
                  <div>
                    <div className="ex-name" title={t.name}>{t.name}</div>
                    <div className="ex-sector">{t.industry}</div>
                  </div>
                  {d && <span className={`badge ${STATUS_META[d.status].cls}`}>{STATUS_META[d.status].text}</span>}
                </div>
                <Sparkline points={t.points} />
                <div className="ex-stats">
                  {t.points.map((pt, i) => (
                    <div className="ex-stat" key={i}>
                      <span className="ex-label">{shortLabel(pt.label)}</span>
                      <span className="ex-val">{pt.weight === null ? '—' : pt.weight.toFixed(2) + '%'}</span>
                    </div>
                  ))}
                </div>
                {d && d.weightChange !== null && (
                  <div className={`ex-delta ${d.weightChange >= 0 ? 'pos' : 'neg'}`}>
                    {pp(d.weightChange)} pp vs previous
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function shortLabel(label: string): string {
  const m = label.match(/([A-Za-z]{3})[a-z]*\s.*?(\d{2,4})$/);
  if (m) return `${m[1]} '${m[2].slice(-2)}`;
  return label.length > 8 ? label.slice(0, 8) : label;
}

/** Tiny inline SVG sparkline of a holding's weight over time. */
function Sparkline({ points }: { points: { label: string; weight: number | null }[] }) {
  const w = 240;
  const h = 56;
  const pad = 6;
  const vals = points.map((p) => p.weight);
  const known = vals.filter((v): v is number => v !== null);
  if (known.length === 0) return <div className="sparkline-empty">no data</div>;
  const max = Math.max(...known);
  const min = Math.min(...known, 0);
  const span = max - min || 1;
  const n = points.length;
  const xOf = (i: number) => pad + (n === 1 ? (w - 2 * pad) / 2 : (i * (w - 2 * pad)) / (n - 1));
  const yOf = (v: number) => h - pad - ((v - min) / span) * (h - 2 * pad);

  const segs: string[] = [];
  let started = false;
  points.forEach((p, i) => {
    if (p.weight === null) {
      started = false;
      return;
    }
    segs.push(`${started ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(p.weight).toFixed(1)}`);
    started = true;
  });
  const lastIdx = vals.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0).pop() ?? 0;
  const up = known.length >= 2 ? known[known.length - 1] >= known[0] : true;
  const color = up ? '#16a34a' : '#dc2626';

  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <path d={segs.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) =>
        p.weight === null ? null : (
          <circle key={i} cx={xOf(i)} cy={yOf(p.weight)} r={i === lastIdx ? 3.5 : 2.2} fill={color} />
        )
      )}
    </svg>
  );
}

/* ============================ Weight bars ============================ */
function WeightBars({ rows }: { rows: { label: string; value: number; sub?: string; delta?: number | null }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="weight-bars">
      {rows.map((r) => (
        <div className="wb-row" key={r.label}>
          <div className="wb-label" title={r.label}>
            {r.label}
            {r.sub && <span className="wb-sub">{r.sub}</span>}
          </div>
          <div className="wb-track">
            <div className="wb-fill" style={{ width: `${(r.value / max) * 100}%` }}>
              <span className="wb-value">{r.value.toFixed(2)}%</span>
            </div>
          </div>
          {r.delta !== undefined && r.delta !== null && (
            <div className={`wb-delta ${r.delta >= 0 ? 'pos' : 'neg'}`}>{pp(r.delta)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============================ CSV export ============================ */
function exportHoldingsCsv(comparison: PortfolioComparison, prevLabel: string, currLabel: string) {
  const headers = [
    'Name', 'ISIN', 'Industry/Rating', 'Category', 'Status',
    `Weight % (${prevLabel})`, `Weight % (${currLabel})`, 'Weight Δ (pp)',
    `Qty (${prevLabel})`, `Qty (${currLabel})`, 'Qty Δ %',
    `Value L (${prevLabel})`, `Value L (${currLabel})`, 'Value Δ %',
  ];
  const lines = [headers.join(',')];
  for (const h of comparison.holdings) {
    const cells = [
      h.name, h.isin, h.industry, h.category, STATUS_META[h.status].text,
      h.prevWeight?.toFixed(4) ?? '', h.currWeight?.toFixed(4) ?? '', h.weightChange?.toFixed(4) ?? '',
      h.prevQty ?? '', h.currQty ?? '', h.qtyChangePct?.toFixed(2) ?? '',
      h.prevValue?.toFixed(2) ?? '', h.currValue?.toFixed(2) ?? '', h.valueChangePct?.toFixed(2) ?? '',
    ].map((c) => csvCell(String(c)));
    lines.push(cells.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'portfolio-qoq-holdings.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
