import { useEffect, useMemo, useRef, useState } from 'react';
import { ComparisonTable } from './components/ComparisonTable';
import { ConfigPanel } from './components/ConfigPanel';
import { Dashboard } from './components/Dashboard';
import { InsightsPanel } from './components/InsightsPanel';
import { MultiUploader } from './components/MultiUploader';
import { PortfolioReport } from './components/PortfolioReport';
import type { LoadedFile } from './types';
import { compareDatasets, guessKeyColumn, sharedMetricColumns } from './utils/compare';
import { comparePortfolios } from './utils/comparePortfolios';
import { makeDemoFiles } from './utils/demoData';
import { buildWeightTimeline, orderByDate, type FileEntry } from './utils/timeline';

export default function App() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [prevId, setPrevId] = useState<number | null>(null);
  const [currId, setCurrId] = useState<number | null>(null);
  const [dark, setDark] = useState(false);
  const [keyColumn, setKeyColumn] = useState('');
  const [metricColumns, setMetricColumns] = useState<string[]>([]);
  const idRef = useRef(1);

  // Apply the colour theme to the document root.
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  const ordered = useMemo(() => orderByDate(entries), [entries]);

  // Auto-select the two periods to compare whenever the file set changes.
  useEffect(() => {
    if (entries.length < 2) {
      setPrevId(null);
      setCurrId(null);
      return;
    }
    const list = orderByDate(entries);
    const prevOk = prevId !== null && entries.some((e) => e.id === prevId);
    const currOk = currId !== null && entries.some((e) => e.id === currId);
    if (!prevOk) setPrevId(list[0].id);
    if (!currOk) setCurrId(list[list.length - 1].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  const prevEntry = entries.find((e) => e.id === prevId) ?? null;
  const currEntry = entries.find((e) => e.id === currId) ?? null;
  const prev = prevEntry?.file ?? null;
  const curr = currEntry?.file ?? null;

  const prevLabel = prev?.portfolio?.statementDate || prev?.fileName || 'Period 1';
  const currLabel = curr?.portfolio?.statementDate || curr?.fileName || 'Period 2';

  const portfolioMode = !!(prev?.portfolio && curr?.portfolio);

  // Generic-mode column auto-pick.
  useEffect(() => {
    if (prev && curr && !portfolioMode) {
      const key = guessKeyColumn(prev.dataset, curr.dataset);
      setKeyColumn(key);
      setMetricColumns(sharedMetricColumns(prev.dataset, curr.dataset, key));
    } else if (!prev || !curr) {
      setKeyColumn('');
      setMetricColumns([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevId, currId, portfolioMode]);

  function handleKeyChange(col: string) {
    setKeyColumn(col);
    if (prev && curr) setMetricColumns(sharedMetricColumns(prev.dataset, curr.dataset, col));
  }

  function addFiles(files: LoadedFile[]) {
    setEntries((prevEntries) => [...prevEntries, ...files.map((f) => ({ id: idRef.current++, file: f }))]);
  }
  function removeFile(id: number) {
    setEntries((prevEntries) => prevEntries.filter((e) => e.id !== id));
    if (prevId === id) setPrevId(null);
    if (currId === id) setCurrId(null);
  }
  function clearAll() {
    setEntries([]);
    setPrevId(null);
    setCurrId(null);
  }
  function loadDemo() {
    const demo = makeDemoFiles();
    const newEntries = demo.map((f) => ({ id: idRef.current++, file: f }));
    setEntries(newEntries);
    const list = orderByDate(newEntries);
    setPrevId(list[0].id);
    setCurrId(list[list.length - 1].id);
  }

  const portfolioComparison = useMemo(() => {
    if (!portfolioMode || !prev?.portfolio || !curr?.portfolio) return null;
    return comparePortfolios(prev.portfolio, curr.portfolio);
  }, [portfolioMode, prev, curr]);

  // Build a weight timeline across every uploaded portfolio statement.
  const timeline = useMemo(() => {
    const ports = ordered.map((e) => e.file.portfolio).filter((p): p is NonNullable<typeof p> => !!p);
    return ports.length >= 2 ? buildWeightTimeline(ports) : [];
  }, [ordered]);
  const periodLabels = useMemo(
    () => ordered.map((e) => e.file.portfolio?.statementDate).filter((s): s is string => !!s),
    [ordered]
  );

  const genericResult = useMemo(() => {
    if (!prev || !curr || portfolioMode || !keyColumn || metricColumns.length === 0) return null;
    return compareDatasets(prev.dataset, curr.dataset, keyColumn, metricColumns);
  }, [prev, curr, portfolioMode, keyColumn, metricColumns]);

  const bothSelected = !!(prev && curr);
  const mismatch = bothSelected && !!prev.portfolio !== !!curr.portfolio;
  const portfolioCount = entries.filter((e) => e.file.portfolio).length;
  const distinct = prevId !== currId;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="logo">📊</span>
          <div>
            <h1>Mutual Fund QoQ Comparison</h1>
            <p>Upload two or more quarterly / monthly fund statements to compare holdings, sectors &amp; performance.</p>
          </div>
        </div>
        <button className="theme-toggle" onClick={() => setDark((d) => !d)} title="Toggle dark mode">
          {dark ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      <section className="upload-section single">
        <MultiUploader
          entries={entries}
          onAdd={addFiles}
          onRemove={removeFile}
          onClearAll={clearAll}
          onDemo={loadDemo}
        />
      </section>

      {entries.length >= 2 && (
        <section className="period-picker">
          <div className="picker-field">
            <label>Compare from</label>
            <select value={prevId ?? ''} onChange={(e) => setPrevId(Number(e.target.value))}>
              {ordered.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.file.portfolio?.statementDate || en.file.fileName}
                </option>
              ))}
            </select>
          </div>
          <span className="picker-arrow">→</span>
          <div className="picker-field">
            <label>to</label>
            <select value={currId ?? ''} onChange={(e) => setCurrId(Number(e.target.value))}>
              {ordered.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.file.portfolio?.statementDate || en.file.fileName}
                </option>
              ))}
            </select>
          </div>
          {portfolioCount >= 3 && (
            <span className="picker-hint">{portfolioCount} statements loaded · timeline available in the Explore tab</span>
          )}
        </section>
      )}

      {prevId !== null && !distinct && <div className="notice">Pick two different periods to compare.</div>}

      {mismatch && (
        <div className="notice">
          One selected file is a fund portfolio statement and the other isn’t — comparing them as generic tables instead.
        </div>
      )}

      {/* Portfolio (holdings) comparison mode */}
      {portfolioComparison && distinct && (
        <main>
          <PortfolioReport
            comparison={portfolioComparison}
            prevLabel={prevLabel}
            currLabel={currLabel}
            timeline={timeline}
            periodLabels={periodLabels}
          />
        </main>
      )}

      {/* Generic dataset comparison mode */}
      {!portfolioMode && bothSelected && distinct && (
        <ConfigPanel
          prev={prev.dataset}
          curr={curr.dataset}
          keyColumn={keyColumn}
          metricColumns={metricColumns}
          onKeyChange={handleKeyChange}
          onMetricsChange={setMetricColumns}
        />
      )}

      {!portfolioMode && bothSelected && distinct && metricColumns.length === 0 && (
        <div className="notice">Select at least one metric to compare. No numeric metric is currently selected.</div>
      )}

      {genericResult && distinct && (
        <main className="report">
          <Dashboard result={genericResult} previousLabel={prevLabel} currentLabel={currLabel} />
          <InsightsPanel insights={genericResult.insights} />
          <ComparisonTable result={genericResult} previousLabel={prevLabel} currentLabel={currLabel} />
        </main>
      )}

      {entries.length < 2 && (
        <div className="placeholder">
          <p>⬆️ Upload at least two files to begin — or click “Try demo data”.</p>
          <p className="hint">
            Supported formats: <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>. AMFI-style mutual fund
            portfolio statements are detected automatically for full holdings &amp; sector analysis.
          </p>
        </div>
      )}

      <footer className="app-footer">
        Mutual Fund QoQ Comparison · All processing happens locally in your browser.
      </footer>
    </div>
  );
}
