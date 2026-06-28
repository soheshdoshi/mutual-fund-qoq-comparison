import { useMemo, useState } from 'react';
import type { ComparisonResult } from '../types';

interface Props {
  result: ComparisonResult;
  previousLabel: string;
  currentLabel: string;
}

type Filter = 'all' | 'matched' | 'new' | 'removed';

function num(v: number | null): string {
  if (v === null) return '—';
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const BADGE: Record<string, { text: string; cls: string }> = {
  matched: { text: 'Matched', cls: 'badge-matched' },
  new: { text: 'New', cls: 'badge-new' },
  removed: { text: 'Removed', cls: 'badge-removed' },
};

export function ComparisonTable({ result, previousLabel, currentLabel }: Props) {
  const { records, metricColumns, keyColumn } = result;
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (filter !== 'all' && r.changeType !== filter) return false;
      if (search && !r.key.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [records, filter, search]);

  function exportCsv() {
    const headers = [keyColumn, 'Status'];
    for (const m of metricColumns) {
      headers.push(`${m} (${previousLabel})`, `${m} (${currentLabel})`, `${m} Δ`, `${m} %`);
    }
    const lines = [headers.join(',')];
    for (const r of records) {
      const cells: string[] = [csvCell(r.key), BADGE[r.changeType].text];
      for (const m of metricColumns) {
        const md = r.metrics.find((x) => x.metric === m);
        cells.push(
          num(md?.previous ?? null),
          num(md?.current ?? null),
          num(md?.absoluteChange ?? null),
          md?.percentChange === null || md?.percentChange === undefined
            ? '—'
            : md.percentChange.toFixed(2) + '%'
        );
      }
      lines.push(cells.map(csvCell).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qoq-comparison-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="table-section">
      <div className="table-toolbar">
        <h2>QoQ comparison report</h2>
        <div className="toolbar-controls">
          <input
            className="search"
            placeholder={`Search ${keyColumn}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="filters">
            {(['all', 'matched', 'new', 'removed'] as Filter[]).map((f) => (
              <button
                key={f}
                className={`filter-btn${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={exportCsv}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="cmp-table">
          <thead>
            <tr>
              <th className="sticky-col">{keyColumn}</th>
              <th>Status</th>
              {metricColumns.map((m) => (
                <th key={m} colSpan={3} className="metric-group">
                  {m}
                </th>
              ))}
            </tr>
            <tr className="subhead">
              <th className="sticky-col"></th>
              <th></th>
              {metricColumns.map((m) => (
                <ColumnSubhead key={m} previousLabel={previousLabel} currentLabel={currentLabel} />
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.key + r.changeType}>
                <td className="sticky-col key-cell" title={r.key}>
                  {r.key}
                </td>
                <td>
                  <span className={`badge ${BADGE[r.changeType].cls}`}>
                    {BADGE[r.changeType].text}
                  </span>
                </td>
                {metricColumns.map((m) => {
                  const md = r.metrics.find((x) => x.metric === m);
                  const pctVal = md?.percentChange ?? null;
                  const up = (pctVal ?? 0) >= 0;
                  return (
                    <FragmentCells
                      key={m}
                      prev={num(md?.previous ?? null)}
                      curr={num(md?.current ?? null)}
                      pct={
                        pctVal === null ? (
                          <span className="muted">—</span>
                        ) : (
                          <span className={up ? 'pos' : 'neg'}>
                            {up ? '▲' : '▼'} {Math.abs(pctVal).toFixed(1)}%
                          </span>
                        )
                      }
                    />
                  );
                })}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={2 + metricColumns.length * 3} className="empty-row">
                  No records match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">Showing {filtered.length} of {records.length} records</div>
    </div>
  );
}

function ColumnSubhead({
  previousLabel,
  currentLabel,
}: {
  previousLabel: string;
  currentLabel: string;
}) {
  return (
    <>
      <th className="sub">{previousLabel}</th>
      <th className="sub">{currentLabel}</th>
      <th className="sub">Change</th>
    </>
  );
}

function FragmentCells({
  prev,
  curr,
  pct,
}: {
  prev: string;
  curr: string;
  pct: React.ReactNode;
}) {
  return (
    <>
      <td className="num">{prev}</td>
      <td className="num">{curr}</td>
      <td className="num">{pct}</td>
    </>
  );
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}
