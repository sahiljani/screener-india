import type {
  ScreenItem,
  ScreenDetails,
  ListScreensOptions,
  ScreenDetailsOptions,
  ApiResponse,
} from "../types.js";
import { parseHtml, parseScreenItems, parseDataTable, parsePagination } from "../utils/parser.js";
import { SectorClient } from "./sectors.js";

export abstract class ScreenClient extends SectorClient {
  /**
   * List public stock screens with optional filtering, sorting, and pagination.
   */
  async listScreens(options: ListScreensOptions = {}): Promise<ApiResponse<ScreenItem[]>> {
    const { page = 1, includeAllPages = false, maxPages = 20, q, sort, order = "asc" } = options;

    const fetchPage = async (p: number): Promise<ScreenItem[]> => {
      const url = `${this.config.baseUrl}/screens/?page=${p}`;
      const html = await this.fetchHtml(url, "screens");
      return parseScreenItems(parseHtml(html));
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
   * Fetch detailed company list for a specific screen.
   * Requires a session cookie for protected screens.
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
    const warnings: string[] = [];

    if (includeAllPages) {
      for (let p = page + 1; p <= totalPages; p++) {
        try {
          const { root: r } = await fetchPage(p);
          const { rows: moreRows } = parseDataTable(r);
          allRows.push(...moreRows);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          warnings.push(`Failed to fetch page ${p}: ${msg}`);
        }
      }
    }

    return {
      data: { id: screenId, slug, title, columns, rows: allRows, page, totalPages },
      meta: this.meta(url),
      warnings,
    };
  }
}
