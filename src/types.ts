export type CompanyMode = "default" | "consolidated";

export type CompanyTab =
  | "quarters"
  | "profit-loss"
  | "balance-sheet"
  | "cash-flow"
  | "ratios"
  | "shareholding"
  | "documents"
  | "analysis"
  | "peers";

export interface ClientConfig {
  /** Base URL of screener.in (default: https://www.screener.in) */
  baseUrl?: string;
  /** Cache TTL in milliseconds (default: 300_000 = 5 min) */
  cacheTtlMs?: number;
  /** Minimum gap between requests in ms (default: 200) */
  minIntervalMs?: number;
  /** Max retries on 429/5xx (default: 2) */
  maxRetries?: number;
  /** Request timeout in ms (default: 20_000) */
  timeoutMs?: number;
  /** Optional proxy URL (http/https/socks) */
  proxyUrl?: string;
  /**
   * Session cookie string from a logged-in screener.in browser session.
   * Required to access protected pages (screens, some company data).
   *
   * How to get it:
   *   1. Log in at https://www.screener.in/login/
   *   2. Open DevTools → Application → Cookies → www.screener.in
   *   3. Copy the value of the `sessionid` cookie
   *   4. Pass it here as: "sessionid=YOUR_VALUE_HERE"
   *
   * You can also include csrftoken: "sessionid=abc; csrftoken=xyz"
   */
  cookies?: string;
}

// --------------- shared response envelope ---------------

export interface Meta {
  sourceUrl: string;
  fetchedAt: string;
  parserVersion: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: Meta;
  warnings: string[];
}

// --------------- company ---------------

export interface TopRatio {
  name: string;
  value: string;
  id?: string;
}

export interface TableRow {
  [column: string]: string;
}

export interface FinancialTable {
  headers: string[];
  rows: TableRow[];
}

export interface AnalysisData {
  pros: string[];
  cons: string[];
  description: string;
}

export interface PeerRow {
  [column: string]: string;
}

export interface DocumentLink {
  title: string;
  url: string;
}

export interface CompanyData {
  name: string;
  symbol: string;
  mode: CompanyMode;
  topRatios: TopRatio[];
  quarters?: FinancialTable;
  profitLoss?: FinancialTable;
  balanceSheet?: FinancialTable;
  cashFlow?: FinancialTable;
  ratios?: FinancialTable;
  shareholding?: FinancialTable;
  documents?: DocumentLink[];
  analysis?: AnalysisData;
  peers?: PeerRow[];
}

export interface CompanyRaw {
  symbol: string;
  html: string;
  sectionIds: string[];
}

export interface CompanySummary {
  symbol: string;
  name: string;
  marketCap?: string;
  currentPrice?: string;
  pe?: string;
  roe?: string;
  dividendYield?: string;
}

// --------------- sectors ---------------

export interface SectorItem {
  name: string;
  slug: string;
  url: string;
}

export interface SectorData {
  sector: string;
  columns: string[];
  rows: TableRow[];
  page: number;
  totalPages: number;
  totalResults: number;
}

// --------------- screens ---------------

export interface ScreenItem {
  id: number;
  slug: string;
  title: string;
  description: string;
  url: string;
}

export interface ScreenDetails {
  id: number;
  slug: string;
  title: string;
  author?: string;
  columns: string[];
  rows: TableRow[];
  page: number;
  totalPages: number;
}

// --------------- search ---------------

export interface SearchResult {
  symbol: string;
  name: string;
  url: string;
}

// --------------- list options ---------------

export interface SectorDataOptions {
  page?: number;
  limit?: number;
  includeAllPages?: boolean;
}

export interface ListScreensOptions {
  page?: number;
  includeAllPages?: boolean;
  maxPages?: number;
  q?: string;
  sort?: "title" | "id";
  order?: "asc" | "desc";
}

export interface ScreenDetailsOptions {
  page?: number;
  limit?: number;
  includeAllPages?: boolean;
}
