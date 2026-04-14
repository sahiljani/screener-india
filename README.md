# screener-india

> **Disclaimer:** This is an **unofficial, independently maintained** package. It is not affiliated with, endorsed by, or connected to [Screener.in](https://www.screener.in) in any way. Use it responsibly and in accordance with Screener.in's [Privacy Policy](https://www.screener.in/guides/privacy/). This is not financial advice.

[![npm version](https://img.shields.io/npm/v/screener-india.svg)](https://www.npmjs.com/package/screener-india)
[![npm downloads](https://img.shields.io/npm/dm/screener-india.svg)](https://www.npmjs.com/package/screener-india)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-green.svg)](https://nodejs.org/)

**Unofficial Node.js / TypeScript client for [Screener.in](https://www.screener.in)** — the most popular Indian stock market fundamental analysis platform.

Fetch real-time and historical **Indian stock fundamentals**, **NSE/BSE financial data**, **sector analysis**, **stock screener results**, and **company comparisons** — all from a single, typed API with built-in caching, throttling, and retry logic.

---

## Why screener-india?

- **Indian stock market data** — NSE and BSE listed companies, sectors, and screens
- **Fundamental analysis** — P/E ratio, ROE, ROCE, debt-to-equity, EPS, book value, market cap
- **Financial statements** — quarterly results, profit & loss, balance sheet, cash flow, ratios
- **Stock screener** — browse and query pre-built public screens (value picks, growth stocks, dividend yield, low PE, high ROE, etc.)
- **Sector analysis** — list all NSE/BSE sectors and fetch companies ranked by fundamentals
- **Company comparison** — compare multiple Indian stocks side-by-side
- **Search** — find companies by name or NSE/BSE ticker symbol
- **TypeScript-first** — complete type definitions for every API response
- **Production-ready** — built-in LRU cache, request throttle, and exponential-backoff retry

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [getCompany](#getccompany)
  - [getCompanyTab](#getcompanytab)
  - [getCompanyRaw](#getcompanyraw)
  - [compareCompanies](#comparecompanies)
  - [searchCompanies](#searchcompanies)
  - [listSectors](#listsectors)
  - [getSectorData](#getsectordata)
  - [listScreens](#listscreens)
  - [getScreenDetails](#getscreendetails)
- [Configuration](#configuration)
- [TypeScript Types](#typescript-types)
- [Use Cases](#use-cases)
- [Authentication](#authentication)
- [Disclaimer](#disclaimer)

---

## Installation

```bash
# npm
npm install screener-india

# yarn
yarn add screener-india

# pnpm
pnpm add screener-india
```

> **Requires Node.js >= 22** and an ESM-compatible environment.

---

## Quick Start

```ts
import { ScreenerClient } from "screener-india";

const client = new ScreenerClient();

// Get full fundamentals for Reliance Industries
const { data } = await client.getCompany("RELIANCE");

console.log(data.name);           // "Reliance Industries"
console.log(data.topRatios);      // Market Cap, P/E, Book Value, Dividend Yield, ...
console.log(data.profitLoss);     // Annual P&L table
console.log(data.balanceSheet);   // Balance Sheet
console.log(data.cashFlow);       // Cash Flow Statement
console.log(data.ratios);         // Key financial ratios (ROE, ROCE, Debt/Equity, ...)
console.log(data.peers);          // Peer comparison table
console.log(data.analysis?.pros); // Pros listed on Screener.in
console.log(data.analysis?.cons); // Cons listed on Screener.in
```

---

## API Reference

### `getCompany`

Fetch the complete fundamental snapshot of an Indian stock — top ratios, all financial tables, peer comparison, Screener.in analysis notes, and document links.

```ts
const { data, meta, warnings } = await client.getCompany(
  "TCS",           // NSE/BSE symbol
  "consolidated",  // "consolidated" (default) | "standalone"
);
```

**Returns `CompanyData`:**

| Field          | Type              | Description                                             |
|----------------|-------------------|---------------------------------------------------------|
| `name`         | `string`          | Company name                                            |
| `symbol`       | `string`          | NSE/BSE ticker symbol                                   |
| `mode`         | `CompanyMode`     | `"consolidated"` or `"standalone"`                      |
| `topRatios`    | `TopRatio[]`      | Market Cap, P/E, Book Value, Dividend Yield, ROE, etc.  |
| `quarters`     | `FinancialTable`  | Quarterly results (revenue, net profit, EPS)            |
| `profitLoss`   | `FinancialTable`  | Annual profit & loss statement                          |
| `balanceSheet` | `FinancialTable`  | Balance sheet (assets, liabilities, equity)             |
| `cashFlow`     | `FinancialTable`  | Cash flow statement (operating, investing, financing)   |
| `ratios`       | `FinancialTable`  | Key ratios (ROE, ROCE, Debt/Equity, Asset Turnover)     |
| `shareholding` | `FinancialTable`  | Promoter / FII / DII / public shareholding pattern      |
| `documents`    | `DocumentLink[]`  | Annual reports, investor presentations, concall notes   |
| `analysis`     | `AnalysisData`    | Pros, cons, and description from Screener.in            |
| `peers`        | `PeerRow[]`       | Peer comparison table                                   |

**Example — fetch HDFC Bank fundamentals:**

```ts
const { data } = await client.getCompany("HDFCBANK");

// Top ratios
for (const ratio of data.topRatios) {
  console.log(`${ratio.name}: ${ratio.value}`);
  // Market Cap: ₹1,234,567 Cr
  // Current Price: ₹1,750
  // High / Low: ₹1,990 / ₹1,363
  // Stock P/E: 18.5
  // Book Value: ₹630
  // Dividend Yield: 1.2%
  // ROCE: 7.8%
  // ROE: 16.5%
}
```

---

### `getCompanyTab`

Fetch only a specific financial tab — useful when you only need one section and want to reduce data volume.

```ts
const { data } = await client.getCompanyTab(
  "INFY",           // NSE symbol
  "profit-loss",    // tab name
  "consolidated",   // mode
);
console.log(data.profitLoss);
```

**Available tabs:**

| Tab              | Data returned                               |
|------------------|---------------------------------------------|
| `quarters`       | Quarterly results                           |
| `profit-loss`    | Annual profit & loss                        |
| `balance-sheet`  | Balance sheet                               |
| `cash-flow`      | Cash flow statement                         |
| `ratios`         | Financial ratios                            |
| `shareholding`   | Promoter / FII / DII shareholding pattern   |
| `documents`      | Annual reports and filings                  |
| `analysis`       | Pros, cons, description                     |
| `peers`          | Peer comparison                             |

---

### `getCompanyRaw`

Fetch the raw HTML and a list of available section IDs for a company page. Useful for custom scraping or debugging.

```ts
const { data } = await client.getCompanyRaw("WIPRO");
console.log(data.html);        // Raw HTML string
console.log(data.sectionIds);  // ["quarters", "profit-loss", "balance-sheet", ...]
```

---

### `compareCompanies`

Compare multiple Indian stocks side-by-side. Returns a summary with key metrics for each company — great for building stock comparison tools or portfolio screeners.

```ts
const { data, warnings } = await client.compareCompanies(
  ["TCS", "INFY", "WIPRO", "HCLTECH"],
  "consolidated",
);

for (const co of data) {
  console.log(`${co.symbol} | PE: ${co.pe} | ROE: ${co.roe} | Div Yield: ${co.dividendYield}`);
}
// TCS       | PE: 31.2 | ROE: 53.1% | Div Yield: 1.5%
// INFY      | PE: 24.8 | ROE: 32.6% | Div Yield: 2.1%
// WIPRO     | PE: 22.4 | ROE: 17.9% | Div Yield: 0.2%
// HCLTECH   | PE: 27.1 | ROE: 23.4% | Div Yield: 4.8%
```

**Returns `CompanySummary[]`:**

| Field           | Description                  |
|-----------------|------------------------------|
| `symbol`        | NSE/BSE ticker               |
| `name`          | Company name                 |
| `marketCap`     | Market capitalisation        |
| `currentPrice`  | Current stock price          |
| `pe`            | Price-to-earnings ratio      |
| `roe`           | Return on equity             |
| `dividendYield` | Dividend yield (%)           |

---

### `searchCompanies`

Search Indian stocks by company name or NSE/BSE ticker symbol. Uses the Screener.in JSON search API.

```ts
const { data } = await client.searchCompanies("Tata", 5);

for (const result of data) {
  console.log(`${result.symbol} — ${result.name}`);
  // TATAMOTORS — Tata Motors Ltd
  // TCS        — Tata Consultancy Services Ltd
  // TATASTEEL  — Tata Steel Ltd
  // TATAPOWER  — Tata Power Company Ltd
  // TATACOMM   — Tata Communications Ltd
}
```

---

### `listSectors`

List all market sectors available on Screener.in (auto, banking, pharma, IT, FMCG, metals, energy, etc.).

```ts
const { data } = await client.listSectors();

for (const sector of data) {
  console.log(`${sector.name} → ${sector.slug}`);
  // Automobile → automobile
  // Banks → banks
  // Pharmaceuticals → pharmaceuticals
  // IT Software → it-software
  // ...
}
```

---

### `getSectorData`

Fetch a ranked list of companies within an Indian market sector, with key financial metrics and pagination.

```ts
// Single page
const { data } = await client.getSectorData("banks", { page: 1, limit: 50 });

// All pages at once
const { data: all } = await client.getSectorData("it-software", {
  includeAllPages: true,
});

console.log(`Total IT companies: ${all.totalResults}`);
for (const row of all.rows) {
  console.log(row); // { "Name": "TCS", "Market Cap": "14,00,000", "P/E": "31.2", ... }
}
```

---

### `listScreens`

List public stock screens published on Screener.in. Supports filtering, sorting, and pagination.

```ts
// All screens
const { data } = await client.listScreens({ includeAllPages: true });

// Filter screens by keyword
const { data: valuePicks } = await client.listScreens({
  q: "value",
  sort: "title",
  order: "asc",
});

// Search for high-dividend screens
const { data: dividendScreens } = await client.listScreens({ q: "dividend" });
```

---

### `getScreenDetails`

Fetch the full list of stocks matching a specific Screener.in screen. Requires a session cookie for private/protected screens.

```ts
const { data } = await client.getScreenDetails(
  23,              // screen ID
  "undervalued",   // screen slug
  { includeAllPages: true },
);

console.log(`Screen: ${data.title}`);
console.log(`Columns: ${data.columns.join(", ")}`);

for (const row of data.rows) {
  console.log(row);
}
```

---

## Configuration

Pass a `ClientConfig` object to the `ScreenerClient` constructor to customise behaviour:

```ts
const client = new ScreenerClient({
  // Session cookie for protected screens (optional)
  cookies: "sessionid=YOUR_SESSION_ID",

  // In-memory cache TTL in ms (default: 300_000 = 5 minutes)
  cacheTtlMs: 600_000,

  // Minimum gap between outbound requests in ms (default: 200)
  minIntervalMs: 300,

  // Max retry attempts on 429 / 5xx errors (default: 2)
  maxRetries: 3,

  // HTTP request timeout in ms (default: 20_000)
  timeoutMs: 30_000,

  // Optional HTTP/HTTPS/SOCKS proxy URL
  proxyUrl: "http://proxy.example.com:8080",

  // Override Screener.in base URL (rarely needed)
  baseUrl: "https://www.screener.in",
});

// Clear the in-memory cache at any time
client.clearCache();
```

---

## TypeScript Types

All types are exported from the package root:

```ts
import type {
  ClientConfig,
  CompanyMode,
  CompanyTab,
  CompanyData,
  CompanyRaw,
  CompanySummary,
  TopRatio,
  FinancialTable,
  TableRow,
  AnalysisData,
  DocumentLink,
  PeerRow,
  SectorItem,
  SectorData,
  SectorDataOptions,
  ScreenItem,
  ScreenDetails,
  ScreenDetailsOptions,
  ListScreensOptions,
  SearchResult,
  ApiResponse,
  Meta,
} from "screener-india";
```

Every `client.*` method returns `Promise<ApiResponse<T>>`:

```ts
interface ApiResponse<T> {
  data: T;       // The parsed payload
  meta: Meta;    // sourceUrl, fetchedAt, parserVersion
  warnings: string[];  // Non-fatal parse warnings
}
```

---

## Use Cases

**Portfolio tracker** — pull fundamentals for your watchlist on a schedule and store in a database.

```ts
const watchlist = ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY"];
const results = await Promise.all(watchlist.map((s) => client.getCompany(s)));
```

**Stock screener / filter engine** — fetch an entire sector and filter by custom criteria.

```ts
const { data } = await client.getSectorData("pharmaceuticals", { includeAllPages: true });
const lowPeHighRoe = data.rows.filter(
  (row) => parseFloat(row["P/E"]) < 20 && parseFloat(row["ROE %"]) > 15,
);
```

**Fundamental analysis dashboard** — display quarterly results, balance sheet trends, and shareholding patterns.

```ts
const [qr, bs, sh] = await Promise.all([
  client.getCompanyTab("BAJFINANCE", "quarters"),
  client.getCompanyTab("BAJFINANCE", "balance-sheet"),
  client.getCompanyTab("BAJFINANCE", "shareholding"),
]);
```

**Peer comparison tool** — benchmark an IT stock against its sector peers.

```ts
const peers = ["TCS", "INFY", "WIPRO", "HCLTECH", "TECHM", "LTIM"];
const { data } = await client.compareCompanies(peers);
```

**Algo trading research** — gather historical financial ratio data for quantitative models.

```ts
const { data } = await client.getCompanyTab("NESTLEIND", "ratios");
// data.ratios.rows contains year-wise ROE, ROCE, Debt/Equity, asset turnover, etc.
```

**Screen browser** — discover and browse community-built value/growth/dividend stock screens.

```ts
const { data: screens } = await client.listScreens({ q: "graham", includeAllPages: true });
for (const screen of screens) {
  const { data } = await client.getScreenDetails(screen.id, screen.slug);
  console.log(`${screen.title}: ${data.rows.length} companies`);
}
```

---

## Response Example

```jsonc
// client.getCompany("TCS") — abbreviated
{
  "data": {
    "name": "Tata Consultancy Services Ltd",
    "symbol": "TCS",
    "mode": "consolidated",
    "topRatios": [
      { "name": "Market Cap", "value": "₹13,98,765 Cr." },
      { "name": "Current Price", "value": "₹3,854" },
      { "name": "Stock P/E", "value": "31.2" },
      { "name": "Book Value", "value": "₹330" },
      { "name": "Dividend Yield", "value": "1.5%" },
      { "name": "ROCE", "value": "65.8%" },
      { "name": "ROE", "value": "53.1%" }
    ],
    "analysis": {
      "pros": [
        "Company has a good return on equity (ROE) track record: 3 Years ROE 47.9%",
        "Company has been maintaining a healthy dividend payout"
      ],
      "cons": [
        "Stock is trading at 9.40 times its book value"
      ],
      "description": "Tata Consultancy Services is an IT services, consulting and business solutions provider..."
    }
    // ... profitLoss, balanceSheet, cashFlow, ratios, shareholding, peers, documents
  },
  "meta": {
    "sourceUrl": "https://www.screener.in/company/TCS/consolidated/",
    "fetchedAt": "2026-04-14T10:30:00.000Z",
    "parserVersion": "1"
  },
  "warnings": []
}
```

---

## Frequently Asked Questions

**Do I need an account on Screener.in?**
No — public company pages, sectors, and public screens are accessible without login. A session cookie is only needed for private/protected screens.

**Is this an official Screener.in API?**
No. This is an unofficial client that scrapes public pages. Use it responsibly and respect Screener.in's terms of service.

**How do I avoid rate limiting?**
The client throttles requests to one per 200 ms by default (`minIntervalMs`). Increase it or use `cacheTtlMs` to cache repeated lookups.

**Can I use this in a browser?**
No — the client makes direct HTTP requests to Screener.in, which does not expose CORS headers. Use it in a Node.js server or serverless function.

**What data is available?**
- **Fundamentals:** Market Cap, P/E, EPS, Book Value, Dividend Yield, ROE, ROCE, Debt/Equity, Current Ratio, Quick Ratio
- **Financials:** Quarterly results, P&L, Balance Sheet, Cash Flow, Key Ratios (10+ years of history)
- **Shareholding:** Promoter holding, FII, DII, public, government shareholding patterns
- **Screens:** 1,250+ public stock screeners (value, growth, momentum, dividend, small-cap, mid-cap, large-cap)
- **Sectors:** 50+ NSE/BSE sectors with ranked company lists

---

## Authentication

Most methods work without any login — public company pages, sectors, and public screens are freely accessible.

Authentication is only needed for two cases:

- **Private screens** — screens you created on Screener.in and set to private
- **Gated company data** — the Insights tab and standalone financials on some company pages require a Screener.in login to load

For everything else (public company pages, sectors, public screens), no login is required.

**How to get your session cookie:**

1. Log in at [https://www.screener.in/login/](https://www.screener.in/login/)
2. Open **DevTools** → **Application** → **Cookies** → `www.screener.in`
3. Copy the value of the `sessionid` cookie
4. Pass it to the client:

```ts
const client = new ScreenerClient({
  cookies: "sessionid=YOUR_SESSION_ID_HERE",
});
```

You can also include the CSRF token if needed:

```ts
const client = new ScreenerClient({
  cookies: "sessionid=abc123; csrftoken=xyz789",
});
```

---

## Contributing

Issues and pull requests are welcome at [github.com/sahiljani/screener-india](https://github.com/sahiljani/screener-india).

```bash
git clone https://github.com/sahiljani/screener-india.git
cd screener-india
npm install
npm run build
npm test
```

---

## Disclaimer

This package is **not affiliated with, endorsed by, or connected to Screener.in** in any way. It is an independent open-source tool that reads publicly available web pages. All financial data is sourced from Screener.in and the underlying exchanges (NSE, BSE). This package is intended for **personal research, educational use, and non-commercial projects** only. Do not use it to build products that redistribute Screener.in data commercially without their explicit permission.

**This is not financial advice.** Always consult a SEBI-registered investment advisor before making investment decisions.

---

## License

[MIT](./LICENSE) © [Sahil Jani](https://github.com/sahiljani)
