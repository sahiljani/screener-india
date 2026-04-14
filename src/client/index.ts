import type { ClientConfig } from "../types.js";
import { SearchClient } from "./search.js";

/**
 * ScreenerClient — scrapes screener.in for Indian stock market data.
 *
 * @example
 * ```ts
 * const client = new ScreenerClient({ minIntervalMs: 300 });
 * const { data } = await client.getCompany("TCS");
 * ```
 *
 * For protected pages (screens, watchlist, announcements), pass a session cookie:
 * ```ts
 * const client = new ScreenerClient({ cookies: "sessionid=YOUR_SESSION_ID" });
 * ```
 */
export class ScreenerClient extends SearchClient {
  constructor(config: ClientConfig = {}) {
    super(config);
  }

  /** Clear all cached responses. */
  clearCache(): void {
    this.cache.clear();
  }
}
