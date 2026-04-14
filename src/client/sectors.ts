import type { SectorItem, SectorData, SectorDataOptions, ApiResponse } from "../types.js";
import { parseHtml, parseSectorLinks, parseDataTable, parsePagination } from "../utils/parser.js";
import { CompanyClient } from "./company.js";

export abstract class SectorClient extends CompanyClient {
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
   * Pass `includeAllPages: true` to auto-fetch every page.
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
      data: { sector, columns, rows, page, totalPages, totalResults: rows.length },
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
    const warnings: string[] = [];

    for (let p = 2; p <= first.data.totalPages; p++) {
      try {
        const page = await this.getSectorData(sector, { page: p, limit });
        allRows.push(...page.data.rows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        warnings.push(`Failed to fetch page ${p}: ${msg}`);
      }
    }

    return {
      data: { ...first.data, rows: allRows, totalResults: allRows.length, page: 1 },
      meta: first.meta,
      warnings,
    };
  }
}
