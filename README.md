# Mutual Fund QoQ Comparison

A frontend (React + Vite + TypeScript) application to upload **two quarterly mutual fund datasets** and generate a **Quarter-on-Quarter (QoQ) comparison report** with visual dashboards and performance insights.

All processing happens **locally in your browser** — no data is uploaded to any server.

## Features

- **Upload CSV or Excel** (`.csv`, `.xlsx`, `.xls`) — drag & drop or click to browse.
- **Automatic column detection** — numeric metrics vs. text columns are detected automatically; you don't need to pre-format the file.
- **Smart record matching** — auto-picks the best key column (e.g. *Scheme Name*) to link a fund across both quarters. You can override it.
- **Configurable metrics** — pick which numeric columns (NAV, AUM, Returns, Expense Ratio, …) to compare.
- **Visual dashboard**
  - Summary cards (fund counts, added, removed)
  - Per-metric totals & % change
  - Bar chart: totals by metric (Q1 vs Q2)
  - Pie chart: portfolio composition (matched / added / removed)
  - Horizontal bar chart: top movers by % change
- **Performance insights** — auto-generated narrative highlights (top gainer, biggest decline, metric trends, composition changes).
- **Comparison table** — searchable, filterable (matched / new / removed), with per-metric previous → current → % change.
- **Export** the full report as CSV.

## Getting started

```powershell
npm install
npm run dev
```

The app opens at http://localhost:5173.

## Try it with sample data

The `sample-data/` folder contains `Q1.csv` and `Q2.csv`. Upload `Q1.csv` as the previous quarter and `Q2.csv` as the current quarter to see the full report.

## Expected data shape

Any tabular file works. For best results include:

- One **identifier** column (e.g. `Scheme Name`, `ISIN`, `Fund Name`).
- One or more **numeric metric** columns (e.g. `NAV`, `AUM`, `1Y Return (%)`, `Expense Ratio (%)`).

Columns common to both files are matched automatically. Values with currency symbols, commas, `%`, or parentheses (negatives) are parsed correctly.

## Build for production

```powershell
npm run build
npm run preview
```

## Tech stack

- React 18 + TypeScript
- Vite
- [PapaParse](https://www.papaparse.com/) for CSV parsing
- [SheetJS (xlsx)](https://sheetjs.com/) for Excel parsing
- [Recharts](https://recharts.org/) for charts
