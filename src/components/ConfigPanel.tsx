import type { Dataset } from '../types';

interface Props {
  prev: Dataset;
  curr: Dataset;
  keyColumn: string;
  metricColumns: string[];
  onKeyChange: (col: string) => void;
  onMetricsChange: (cols: string[]) => void;
}

export function ConfigPanel({
  prev,
  curr,
  keyColumn,
  metricColumns,
  onKeyChange,
  onMetricsChange,
}: Props) {
  const sharedColumns = prev.columns.filter((c) => curr.columns.includes(c));
  const sharedNumeric = prev.numericColumns.filter(
    (c) => curr.numericColumns.includes(c) && c !== keyColumn
  );

  function toggleMetric(col: string) {
    if (metricColumns.includes(col)) {
      onMetricsChange(metricColumns.filter((c) => c !== col));
    } else {
      onMetricsChange([...metricColumns, col]);
    }
  }

  return (
    <div className="config-panel">
      <div className="config-row">
        <label className="config-label">Match records by</label>
        <select value={keyColumn} onChange={(e) => onKeyChange(e.target.value)}>
          {sharedColumns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="config-hint">This column links a fund across both quarters.</span>
      </div>

      <div className="config-row">
        <label className="config-label">Compare metrics</label>
        <div className="metric-chips">
          {sharedNumeric.length === 0 && (
            <span className="config-hint">No shared numeric columns detected.</span>
          )}
          {sharedNumeric.map((c) => (
            <button
              key={c}
              className={`chip${metricColumns.includes(c) ? ' chip-active' : ''}`}
              onClick={() => toggleMetric(c)}
            >
              {metricColumns.includes(c) ? '✓ ' : ''}
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
