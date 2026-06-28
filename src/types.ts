// Core data types for the QoQ comparison app.

/** A single row from an uploaded dataset, keyed by column header. */
export type DatasetRow = Record<string, string | number | null>;

/** A parsed dataset with detected columns. */
export interface Dataset {
  /** Original file name. */
  fileName: string;
  /** All column headers, in order. */
  columns: string[];
  /** Columns detected as numeric (most values parse to numbers). */
  numericColumns: string[];
  /** Columns detected as text/categorical. */
  textColumns: string[];
  /** The parsed rows. */
  rows: DatasetRow[];
}

/** Direction in which a record changed between quarters. */
export type ChangeType = 'new' | 'removed' | 'matched';

/** Per-metric comparison for a single matched record. */
export interface MetricDelta {
  metric: string;
  previous: number | null;
  current: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
}

/** A single record compared across the two quarters. */
export interface ComparedRecord {
  key: string;
  changeType: ChangeType;
  metrics: MetricDelta[];
  /** Convenience: raw rows for display. */
  previousRow: DatasetRow | null;
  currentRow: DatasetRow | null;
}

/** Aggregate summary for one numeric metric across all matched records. */
export interface MetricSummary {
  metric: string;
  previousTotal: number;
  currentTotal: number;
  absoluteChange: number;
  percentChange: number | null;
  previousAvg: number;
  currentAvg: number;
}

/** A generated textual insight. */
export interface Insight {
  id: string;
  severity: 'positive' | 'negative' | 'neutral';
  title: string;
  detail: string;
}

/** The full comparison result. */
export interface ComparisonResult {
  keyColumn: string;
  metricColumns: string[];
  records: ComparedRecord[];
  summaries: MetricSummary[];
  insights: Insight[];
  counts: {
    matched: number;
    added: number;
    removed: number;
    previousTotal: number;
    currentTotal: number;
  };
}

/* ------------------------------------------------------------------ *
 * Mutual fund portfolio (AMFI monthly statement) specific types       *
 * ------------------------------------------------------------------ */

/** A single security held in a fund portfolio. */
export interface Holding {
  /** ISIN — the unique identifier used to match holdings across months. */
  isin: string;
  /** Instrument / security name. */
  name: string;
  /** Internal scheme code, if present. */
  code: string | null;
  /** Industry / sector (or rating for debt). */
  industry: string;
  /** Quantity / number of shares held. */
  quantity: number | null;
  /** Market / fair value in Rs. Lakhs. */
  marketValueLakhs: number | null;
  /** Weight as a percentage of net assets (e.g. 7.88 means 7.88%). */
  weightPct: number;
  /** Section the holding belongs to (Equity, Arbitrage, Foreign, etc.). */
  category: string;
}

/** A parsed fund portfolio statement. */
export interface Portfolio {
  fileName: string;
  schemeName: string;
  /** Statement date label, e.g. "May 31, 2026". */
  statementDate: string;
  holdings: Holding[];
}

/** How a holding changed between two statements. */
export type HoldingStatus = 'new' | 'exited' | 'increased' | 'reduced' | 'unchanged';

/** Per-holding comparison between two statements. */
export interface HoldingDelta {
  isin: string;
  name: string;
  industry: string;
  category: string;
  status: HoldingStatus;
  prevWeight: number | null;
  currWeight: number | null;
  /** Change in weight, in percentage points (curr - prev). */
  weightChange: number | null;
  prevQty: number | null;
  currQty: number | null;
  /** % change in quantity (shares added/reduced). */
  qtyChangePct: number | null;
  prevValue: number | null;
  currValue: number | null;
  /** % change in market value. */
  valueChangePct: number | null;
}

/** Aggregated sector / industry allocation change. */
export interface SectorDelta {
  sector: string;
  prevWeight: number;
  currWeight: number;
  /** Change in percentage points. */
  change: number;
  prevCount: number;
  currCount: number;
}

/** Aggregated asset-category allocation (Equity / Foreign / Money Market, etc.). */
export interface CategoryDelta {
  category: string;
  prevWeight: number;
  currWeight: number;
  change: number;
  prevCount: number;
  currCount: number;
}

/** Concentration & diversification (risk) metrics for both periods. */
export interface RiskMetrics {
  holdings: { prev: number; curr: number };
  /** Combined weight of the 5 largest holdings (%). */
  top5: { prev: number; curr: number };
  /** Combined weight of the 10 largest holdings (%). */
  top10: { prev: number; curr: number };
  /** Herfindahl–Hirschman Index on a 0–10,000 scale (sum of weight%²). */
  hhi: { prev: number; curr: number };
  /** Effective number of holdings (10,000 / HHI). */
  effectiveStocks: { prev: number; curr: number };
  /** Average position size (% of net assets). */
  avgPosition: { prev: number; curr: number };
}

/** Portfolio turnover / churn statistics. */
export interface TurnoverStats {
  /** Market value bought (new positions + top-ups), in Rs. Lakhs. */
  boughtValue: number;
  /** Market value sold (exits + trims), in Rs. Lakhs. */
  soldValue: number;
  /** Turnover ratio: lesser of buys/sells over average portfolio value (%). */
  turnoverPct: number;
  /** One-way churn measured in weight (percentage points). */
  weightChurn: number;
}

/** One data point in a holding's weight history. */
export interface WeightPoint {
  label: string;
  weight: number | null;
}

/** A holding's weight across every uploaded statement (for sparklines/timeline). */
export interface WeightTimeline {
  isin: string;
  name: string;
  industry: string;
  points: WeightPoint[];
  /** Most recent non-null weight. */
  latest: number | null;
}

/** Full portfolio comparison result. */
export interface PortfolioComparison {
  prevLabel: string;
  currLabel: string;
  schemeName: string;
  holdings: HoldingDelta[];
  sectors: SectorDelta[];
  counts: {
    prevHoldings: number;
    currHoldings: number;
    added: number;
    exited: number;
    increased: number;
    reduced: number;
    unchanged: number;
  };
  /** Concentration: combined weight of the top 10 holdings. */
  concentration: { prevTop10: number; currTop10: number };
  /** Asset-category allocation breakdown. */
  categories: CategoryDelta[];
  /** Total invested market value (Rs. Lakhs) across all holdings. */
  totalValue: { prev: number; curr: number };
  /** Concentration & diversification metrics. */
  metrics: RiskMetrics;
  /** Turnover / churn statistics. */
  turnover: TurnoverStats;
  /** High-conviction adds: new positions entering at a meaningful weight. */
  convictionAdds: HoldingDelta[];
  /** High-conviction exits: large positions that were fully sold. */
  convictionExits: HoldingDelta[];
  /** Net activity counts used for the plain-English summary. */
  narrative: string[];
  topCurrent: HoldingDelta[];
  topIncreases: HoldingDelta[];
  topDecreases: HoldingDelta[];
  newHoldings: HoldingDelta[];
  exitedHoldings: HoldingDelta[];
  insights: Insight[];
}

/** Result of loading a file: a portfolio (if detected) and/or a generic dataset. */
export interface LoadedFile {
  fileName: string;
  /** Present when the AMFI portfolio format was detected. */
  portfolio: Portfolio | null;
  /** Generic tabular fallback view, always present. */
  dataset: Dataset;
}
