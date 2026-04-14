import axios, { AxiosInstance } from "axios";
import { XMLParser } from "fast-xml-parser";
import crypto from "crypto";
import type {
  ClientConfig,
  CompanyMode,
  CompanyTab,
  CompanyData,
  CompanyRaw,
  CompanySummary,
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
} from "./types.js";
import { TtlCache } from "./utils/cache.js";
import { Throttle } from "./utils/throttle.js";
import { retryWithBackoff } from "./utils/retry.js";
import {
  parseHtml,
  parseTitle,
  parseTopRatios,
  parseTable,
  parseAnalysis,
  parseDocuments,
  parsePeers,
  parseSectorLinks,
  parseDataTable,
  parsePagination,
  parseScreenItems,
  parseSectionIds,
} from "./utils/parser.js";

const PARSER_VERSION = "1.0.0";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export class ScreenerClient {
  private readonly http: AxiosInstance;
  private readonly cache: TtlCache;
  private readonly throttle: Throttle;
  private readonly config: Required<ClientConfig>;

  constructor(config: ClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? "https://www.screener.in",
      cacheTtlMs: config.cacheTtlMs ?? 300_000,
      minIntervalMs: config.minIntervalMs ?? 200,
      maxRetries: config.maxRetries ?? 2,
      timeoutMs: config.timeoutMs ?? 20_000,
      proxyUrl: config.proxyUrl ?? "",
    };

    this.http = axios.create({
      timeout: this.config.timeoutMs,
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    });

    this.cache = new TtlCache(this.config.cacheTtlMs);
    this.throttle = new Throttle(this.config.minIntervalMs);
  }

  // ─── internal helpers ────────────────────────────────────────────────────────

  private cacheKey(url: string): string {
    return crypto.createHash("sha256").update(url).digest("hex");
  }

  private meta(url: string): Meta {
    return {
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      parserVersion: PARSER_VERSION,
    };
  }

  private async fetchHtml(url: string, scope = "default"): Promise<string> {
    const key = this.cacheKey(url);
    const cached = this.cache.get<string>(key);
    if (cached) return cached;

    await this.throttle.wait(scope);

    const html = await retryWithBackoff(async () => {
      const res = await this.http.get<string>(url, { responseType: "text" });
      return res.data;
    }, this.config.maxRetries);

    this.cache.set(key, html);
    return html;
  }

  private companyUrl(symbol: string, mode: CompanyMode): string {
    const base = `${this.config.baseUrl}/company/${symbol.toUpperCase()}`;
    return mode === "consolidated" ? `${base}/consolidated/` : `${base}/`;
  }

  // ─── company ─────────────────────────────────────────────────────────────────

  /**
   * Fetch full company snapshot.
   */
  async getCompany(
    symbol: string,
    mode: CompanyMode = "consolidated",
  ): Promise<ApiResponse<CompanyData>> {
    const url = this.companyUrl(symbol, mode);
    const html = await this.fetchHtml(url, "company");
    const root = parseHtml(html);
    const warnings: string[] = [];

    const data: CompanyData = {
      name: parseTitle(root),
      symbol: symbol.toUpperCase(),
      mode,
      topRatios: parseTopRatios(root),
      quarters: parseTable(root.querySelector("section#quarters")),
      profitLoss: parseTable(root.querySelector("section#profit-loss")),
      balanceSheet: parseTable(root.querySelector("section#balance-sheet")),
      cashFlow: parseTable(root.querySelector("section#cash-flow")),
      ratios: parseTable(root.querySelector("section#ratios")),
      shareholding: parseTable(root.querySelector("section#shareholding")),
      documents: parseDocuments(root),
      analysis: parseAnalysis(root),
      peers: parsePeers(root),
    };

    if (!data.name) warnings.push("Could not parse company name");

    return { data, meta: this.meta(url), warnings };
  }

  /**
   * Fetch a specific financial tab for a company.
   */
  async getCompanyTab(
    symbol: string,
    tab: CompanyTab,
    mode: CompanyMode = "consolidated",
  ): Promise<ApiResponse<Partial<CompanyData>>> {
    const url = this.companyUrl(symbol, mode);
    const html = await this.fetchHtml(url, "company");
    const root = parseHtml(html);
    const warnings: string[] = [];

    const tabData: Partial<CompanyData> = {
      symbol: symbol.toUpperCase(),
      mode,
    };

    switch (tab) {
      case "quarters":
        tabData.quarters = parseTable(root.querySelector("section#quarters"));
        break;
      case "profit-loss":
        tabData.profitLoss = parseTable(root.querySelector("section#profit-loss"));
        break;
      case "balance-sheet":
        tabData.balanceSheet = parseTable(root.querySelector("section#balance-sheet"));
        break;
      case "cash-flow":
        tabData.cashFlow = parseTable(root.querySelector("section#cash-flow"));
        break;
      case "ratios":
        tabData.ratios = parseTable(root.querySelector("section#ratios"));
        break;
      case "shareholding":
        tabData.shareholding = parseTable(root.querySelector("section#shareholding"));
        break;
      case "documents":
        tabData.documents = parseDocuments(root);
        break;
      case "analysis":
        tabData.analysis = parseAnalysis(root);
        break;
      case "peers":
        tabData.peers = parsePeers(root);
        break;
    }

    return { data: tabData, meta: this.meta(url), warnings };
  }

  /**
   * Fetch raw HTML and available section IDs for a company page.
   */
  async getCompanyRaw(
    symbol: string,
    mode: CompanyMode = "consolidated",
  ): Promise<ApiResponse<CompanyRaw>> {
    const url = this.companyUrl(symbol, mode);
    const html = await this.fetchHtml(url, "company");
    const root = parseHtml(html);

    return {
      data: { symbol: symbol.toUpperCase(), html, sectionIds: parseSectionIds(root) },
      meta: this.meta(url),
      warnings: [],
    };
  }

  /**
   * Compare multiple companies — returns a summary row per symbol.
   */
  async compareCompanies(
    symbols: string[],
    mode: CompanyMode = "consolidated",
  ): Promise<ApiResponse<CompanySummary[]>> {
    const results = await Promise.allSettled(symbols.map((s) => this.getCompany(s, mode)));

    const warnings: string[] = [];
    const summaries: CompanySummary[] = [];

    results.forEach((r, i) => {
      if (r.status === "rejected") {
        warnings.push(`Failed to fetch ${symbols[i]}: ${String(r.reason)}`);
        return;
      }
      const { data } = r.value;
      const ratio = (name: string) =>
        data.topRatios.find((tr) => tr.name.toLowerCase().includes(name.toLowerCase()))?.value;

      summaries.push({
        symbol: data.symbol,
        name: data.name,
        marketCap: ratio("market cap"),
        currentPrice: ratio("current price"),
        pe: ratio("stock p/e") ?? ratio("p/e"),
        roe: ratio("roe"),
        dividendYield: ratio("dividend yield"),
      });
    });

    return {
      data: summaries,
      meta: this.meta(`${this.config.baseUrl}/company/`),
      warnings,
    };
  }

  // ─── sectors ─────────────────────────────────────────────────────────────────

  /**
   * List all sectors available on screener.in.
   */
  async listSectors(): Promise<ApiResponse<SectorItem[]>> {
    const url = `${this.config.baseUrl}/market/`;
    const html = await this.fetchHtml(url, "sector");
    const root = parseHtml(html);
    const sectors = parseSectorLinks(root);

    return { data: sectors, meta: this.meta(url), warnings: [] };
  }

  /**
   * Fetch companies in a sector with optional pagination.
   */
  async getSectorData(
    sector: string,
    options: SectorDataOptions = {},
  ): Promise<ApiResponse<SectorData>> {
    const { page = 1, limit = 50, includeAllPages = false } = options;

    if (includeAllPages) {
      return this._getAllSectorPages(sector, limit);
    }

    const url = `${this.config.baseUrl}/market/${sector}/?limit=${limit}&page=${page}`;
    const html = await this.fetchHtml(url, "sector");
    const root = parseHtml(html);
    const { columns, rows } = parseDataTable(root);
    const { totalPages } = parsePagination(root);

    return {
      data: {
        sector,
        columns,
        rows,
        page,
        totalPages,
        totalResults: rows.length,
      },
      meta: this.meta(url),
      warnings: [],
    };
  }

  private async _getAllSectorPages(
    sector: string,
    limit: number,
  ): Promise<ApiResponse<SectorData>> {
    const first = await this.getSectorData(sector, { page: 1, limit });
    const allRows = [...first.data.rows];
    const warnings = [...(first.meta.sourceUrl ? [] : [""])];

    for (let p = 2; p <= first.data.totalPages; p++) {
      try {
        const page = await this.getSectorData(sector, { page: p, limit });
        allRows.push(...page.data.rows);
      } catch {
        warnings.push(`Failed to fetch page ${p}`);
      }
    }

    return {
      data: {
        ...first.data,
        rows: allRows,
        totalResults: allRows.length,
        page: 1,
      },
      meta: first.meta,
      warnings,
    };
  }

  // ─── screens ─────────────────────────────────────────────────────────────────

  /**
   * List public stock screens.
   */
  async listScreens(options: ListScreensOptions = {}): Promise<ApiResponse<ScreenItem[]>> {
    const { page = 1, includeAllPages = false, maxPages = 20, q, sort, order = "asc" } = options;

    const fetchPage = async (p: number): Promise<ScreenItem[]> => {
      const url = `${this.config.baseUrl}/screens/?page=${p}`;
      const html = await this.fetchHtml(url, "screens");
      const root = parseHtml(html);
      return parseScreenItems(root);
    };

    let items = await fetchPage(page);

    if (includeAllPages) {
      for (let p = page + 1; p <= maxPages; p++) {
        const more = await fetchPage(p);
        if (more.length === 0) break;
        items.push(...more);
      }
      // Deduplicate by id
      const seen = new Set<number>();
      items = items.filter((it) => {
        if (seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
      });
    }

    // Client-side filtering
    if (q) {
      const lq = q.toLowerCase();
      items = items.filter(
        (it) => it.title.toLowerCase().includes(lq) || it.description.toLowerCase().includes(lq),
      );
    }

    // Client-side sorting
    if (sort === "title") {
      items.sort((a, b) =>
        order === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title),
      );
    } else if (sort === "id") {
      items.sort((a, b) => (order === "asc" ? a.id - b.id : b.id - a.id));
    }

    return {
      data: items,
      meta: this.meta(`${this.config.baseUrl}/screens/?page=${page}`),
      warnings: [],
    };
  }

  /**
   * Fetch detailed data for a specific screen.
   */
  async getScreenDetails(
    screenId: number,
    slug: string,
    options: ScreenDetailsOptions = {},
  ): Promise<ApiResponse<ScreenDetails>> {
    const { page = 1, limit = 50, includeAllPages = false } = options;

    const fetchPage = async (p: number) => {
      const url = `${this.config.baseUrl}/screens/${screenId}/${slug}/?page=${p}&limit=${limit}`;
      const html = await this.fetchHtml(url, "screens");
      const root = parseHtml(html);
      return { root, url };
    };

    const { root, url } = await fetchPage(page);
    const { columns, rows } = parseDataTable(root);
    const { totalPages } = parsePagination(root);

    const titleEl = root.querySelector("h1, .screen-title, title");
    const title = titleEl?.text.trim().split("|")[0].trim() ?? `Screen #${screenId}`;

    const allRows = rows;

    if (includeAllPages) {
      for (let p = page + 1; p <= totalPages; p++) {
        try {
          const { root: r } = await fetchPage(p);
          const { rows: moreRows } = parseDataTable(r);
          allRows.push(...moreRows);
        } catch {
          // skip failed pages
        }
      }
    }

    return {
      data: {
        id: screenId,
        slug,
        title,
        columns,
        rows: allRows,
        page,
        totalPages,
      },
      meta: this.meta(url),
      warnings: [],
    };
  }

  // ─── search ──────────────────────────────────────────────────────────────────

  /**
   * Search companies by name/symbol using the screener.in sitemap.
   */
  async searchCompanies(query: string, limit = 10): Promise<ApiResponse<SearchResult[]>> {
    const sitemapUrl = `${this.config.baseUrl}/sitemap-companies.xml`;
    let xml: string;

    try {
      xml = await this.fetchHtml(sitemapUrl, "search");
    } catch {
      // fallback to main sitemap
      xml = await this.fetchHtml(`${this.config.baseUrl}/sitemap.xml`, "search");
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml) as {
      urlset?: { url?: Array<{ loc?: string }> | { loc?: string } };
      sitemapindex?: unknown;
    };

    const urls: string[] = [];
    const urlset = parsed?.urlset?.url;
    if (Array.isArray(urlset)) {
      urlset.forEach((u) => u.loc && urls.push(u.loc));
    } else if (urlset?.loc) {
      urls.push(urlset.loc);
    }

    const lq = query.toLowerCase();
    const results: SearchResult[] = [];

    for (const url of urls) {
      if (results.length >= limit) break;
      const match = url.match(/\/company\/([^/]+)\//);
      if (!match) continue;
      const symbol = match[1];
      if (symbol.toLowerCase().includes(lq)) {
        results.push({ symbol, name: symbol, url });
      }
    }

    return {
      data: results,
      meta: this.meta(sitemapUrl),
      warnings:
        results.length === 0 ? ["No results found; sitemap may not reflect all companies"] : [],
    };
  }

  // ─── cache control ───────────────────────────────────────────────────────────

  /** Clear all cached responses. */
  clearCache(): void {
    this.cache.clear();
  }
}
