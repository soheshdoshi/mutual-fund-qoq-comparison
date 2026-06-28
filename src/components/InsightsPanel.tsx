import type { Insight } from '../types';

interface Props {
  insights: Insight[];
}

const ICON: Record<Insight['severity'], string> = {
  positive: '🟢',
  negative: '🔴',
  neutral: '🔵',
};

export function InsightsPanel({ insights }: Props) {
  if (insights.length === 0) return null;
  return (
    <div className="insights">
      <h2>Performance insights</h2>
      <div className="insight-grid">
        {insights.map((ins) => (
          <div className={`insight-card ${ins.severity}`} key={ins.id}>
            <div className="insight-title">
              <span className="insight-icon">{ICON[ins.severity]}</span>
              {ins.title}
            </div>
            <div className="insight-detail">{ins.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
