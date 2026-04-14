import type {
  CompanyMode,
  CompanyTab,
  CompanyData,
  CompanyRaw,
  CompanySummary,
  ApiResponse,
} from "../types.js";
import {
  parseHtml,
  parseTitle,
  parseTopRatios,
  parseTable,
  parseAnalysis,
  parseDocuments,
  parsePeers,
  parseSectionIds,
} from "../utils/parser.js";
import { BaseClient } from "./base.js";

export abstract class CompanyClient extends BaseClient {
  /**
   * Fetch full company snapshot — ratios, financials, analysis, peers, documents.
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
   * Compare multiple companies side-by-side — returns a summary row per symbol.
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
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        warnings.push(`Failed to fetch ${symbols[i]}: ${msg}`);
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
}
