import type { Holding, LoadedFile, Portfolio } from '../types';
import { loadedFileFromPortfolio } from './parseFile';

interface Seed {
  isin: string;
  name: string;
  industry: string;
  category: string;
  /** Weight % for each of the three quarters; null = not held. */
  w: [number | null, number | null, number | null];
}

const SCHEME = 'Sample Flexi Cap Fund — Demo';
const DATES = ['Dec 31, 2025', 'Mar 31, 2026', 'Jun 30, 2026'];

// A compact but realistic-looking equity portfolio that evolves over 3 quarters.
const SEEDS: Seed[] = [
  { isin: 'INE040A01034', name: 'HDFC Bank Ltd.', industry: 'Banks', category: 'Equity', w: [9.2, 9.6, 9.1] },
  { isin: 'INE090A01021', name: 'ICICI Bank Ltd.', industry: 'Banks', category: 'Equity', w: [7.4, 7.8, 8.3] },
  { isin: 'INE009A01021', name: 'Infosys Ltd.', industry: 'IT - Software', category: 'Equity', w: [6.1, 5.7, 5.2] },
  { isin: 'INE467B01029', name: 'Tata Consultancy Services Ltd.', industry: 'IT - Software', category: 'Equity', w: [5.3, 5.0, 4.6] },
  { isin: 'INE002A01018', name: 'Reliance Industries Ltd.', industry: 'Petroleum Products', category: 'Equity', w: [5.8, 6.2, 6.7] },
  { isin: 'INE154A01025', name: 'ITC Ltd.', industry: 'Diversified FMCG', category: 'Equity', w: [4.2, 4.6, 5.1] },
  { isin: 'INE030A01027', name: 'Hindustan Unilever Ltd.', industry: 'Diversified FMCG', category: 'Equity', w: [3.6, 3.3, 3.0] },
  { isin: 'INE062A01020', name: 'State Bank of India', industry: 'Banks', category: 'Equity', w: [3.9, 4.1, 4.4] },
  { isin: 'INE237A01028', name: 'Kotak Mahindra Bank Ltd.', industry: 'Banks', category: 'Equity', w: [3.1, 2.8, 2.5] },
  { isin: 'INE018A01030', name: 'Larsen & Toubro Ltd.', industry: 'Construction', category: 'Equity', w: [3.4, 3.7, 3.9] },
  { isin: 'INE795G01014', name: 'HDFC Life Insurance Co. Ltd.', industry: 'Insurance', category: 'Equity', w: [2.2, 2.0, 1.7] },
  { isin: 'INE860A01027', name: 'HCL Technologies Ltd.', industry: 'IT - Software', category: 'Equity', w: [2.4, 2.6, 2.8] },
  { isin: 'INE066A01021', name: 'Eicher Motors Ltd.', industry: 'Automobiles', category: 'Equity', w: [1.8, 2.1, 2.5] },
  { isin: 'INE761H01022', name: 'Page Industries Ltd.', industry: 'Textiles', category: 'Equity', w: [1.5, 1.3, null] },
  { isin: 'INE044A01036', name: 'Sun Pharmaceutical Industries Ltd.', industry: 'Pharmaceuticals', category: 'Equity', w: [null, 1.9, 2.6] },
  { isin: 'INE585B01010', name: 'Maruti Suzuki India Ltd.', industry: 'Automobiles', category: 'Equity', w: [2.6, 2.4, 2.2] },
  { isin: 'INE296A01024', name: 'Bajaj Finance Ltd.', industry: 'Finance', category: 'Equity', w: [null, null, 2.9] },
  { isin: 'INE397D01024', name: 'Bharti Airtel Ltd.', industry: 'Telecom - Services', category: 'Equity', w: [3.2, 3.4, 3.6] },
  { isin: 'INE021A01026', name: 'Asian Paints Ltd.', industry: 'Consumer Durables', category: 'Equity', w: [2.0, 1.6, null] },
  { isin: 'INE423A01024', name: 'Adani Enterprises Ltd.', industry: 'Diversified', category: 'Equity', w: [1.4, null, null] },
  { isin: 'IN0020230036', name: '7.18% GOI 2033', industry: 'Sovereign', category: 'Government Securities', w: [4.0, 3.8, 3.5] },
  { isin: 'TREPS000001', name: 'TREPS / Cash & Equivalents', industry: 'Cash', category: 'Money Market', w: [5.9, 5.6, 5.4] },
];

function buildPortfolio(quarter: number): Portfolio {
  const holdings: Holding[] = [];
  for (const s of SEEDS) {
    const weight = s.w[quarter];
    if (weight === null) continue;
    // Synthesise quantity & value from weight so value-based metrics work.
    const marketValueLakhs = Math.round(weight * 1000 + (s.isin.charCodeAt(4) % 7) * 13);
    const quantity = Math.round(marketValueLakhs * 100 + (s.isin.charCodeAt(5) % 9) * 137);
    holdings.push({
      isin: s.isin,
      name: s.name,
      code: null,
      industry: s.industry,
      quantity,
      marketValueLakhs,
      weightPct: weight,
      category: s.category,
    });
  }
  return {
    fileName: `demo-${DATES[quarter].replace(/[ ,]/g, '')}.xlsx`,
    schemeName: SCHEME,
    statementDate: DATES[quarter],
    holdings,
  };
}

/** Three quarterly demo portfolios, ready to drop into the app. */
export function makeDemoFiles(): LoadedFile[] {
  return [0, 1, 2].map((q) => loadedFileFromPortfolio(buildPortfolio(q)));
}
