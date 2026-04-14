import type { SearchResult, ApiResponse } from "../types.js";
import { retryWithBackoff } from "../utils/retry.js";
import { ScreenClient } from "./screens.js";

export abstract class SearchClient extends ScreenClient {
  /**
   * Search companies by name or symbol using the screener.in JSON search API.
   * Returns real company names (not just symbols like the old sitemap approach).
   */
  async searchCompanies(query: string, limit = 10): Promise<ApiResponse<SearchResult[]>> {
    const apiUrl = `${this.config.baseUrl}/api/company/search/?q=${encodeURIComponent(query)}&limit=${limit}`;
    await this.throttle.wait("search");

    const res = await retryWithBackoff(async () => {
      return this.http.get<Array<{ id: number; name: string; url: string }>>(apiUrl, {
        headers: { Accept: "application/json" },
      });
    }, this.config.maxRetries);

    const items = Array.isArray(res.data) ? res.data : [];
    const results: SearchResult[] = items.slice(0, limit).map((item) => {
      const match = item.url?.match(/\/company\/([^/]+)\//);
      const symbol = match?.[1] ?? item.name;
      return {
        symbol,
        name: item.name,
        url: item.url
          ? `${this.config.baseUrl}${item.url}`
          : `${this.config.baseUrl}/company/${symbol}/`,
      };
    });

    return {
      data: results,
      meta: this.meta(apiUrl),
      warnings: results.length === 0 ? ["No results found for the given query"] : [],
    };
  }
}
