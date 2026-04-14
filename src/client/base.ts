import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import type { ClientConfig, CompanyMode, Meta } from "../types.js";
import { TtlCache } from "../utils/cache.js";
import { Throttle } from "../utils/throttle.js";
import { retryWithBackoff } from "../utils/retry.js";

const PARSER_VERSION = "1.0.0";
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export abstract class BaseClient {
  protected readonly http: AxiosInstance;
  protected readonly cache: TtlCache;
  protected readonly throttle: Throttle;
  protected readonly config: Required<ClientConfig>;

  constructor(config: ClientConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? "https://www.screener.in",
      cacheTtlMs: config.cacheTtlMs ?? 300_000,
      minIntervalMs: config.minIntervalMs ?? 200,
      maxRetries: config.maxRetries ?? 2,
      timeoutMs: config.timeoutMs ?? 20_000,
      proxyUrl: config.proxyUrl ?? "",
      cookies: config.cookies ?? "",
    };

    const defaultHeaders: Record<string, string> = {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    if (this.config.cookies) {
      defaultHeaders["Cookie"] = this.config.cookies;
    }

    this.http = axios.create({
      timeout: this.config.timeoutMs,
      headers: defaultHeaders,
    });

    this.cache = new TtlCache(this.config.cacheTtlMs);
    this.throttle = new Throttle(this.config.minIntervalMs);
  }

  protected cacheKey(url: string): string {
    return crypto.createHash("sha256").update(url).digest("hex");
  }

  protected meta(url: string): Meta {
    return {
      sourceUrl: url,
      fetchedAt: new Date().toISOString(),
      parserVersion: PARSER_VERSION,
    };
  }

  protected async fetchHtml(url: string, scope = "default"): Promise<string> {
    const key = this.cacheKey(url);
    const cached = this.cache.get<string>(key);
    if (cached) return cached;

    await this.throttle.wait(scope);

    const html = await retryWithBackoff(async () => {
      const res = await this.http.get<string>(url, {
        responseType: "text",
        maxRedirects: 5,
      });
      // Detect login-wall: screener.in redirects protected pages to /register/ or /login/
      const finalUrl: string = (res.request?.res?.responseUrl as string) ?? "";
      if (finalUrl.includes("/register") || finalUrl.includes("/login")) {
        throw new Error(`LOGIN_REQUIRED: ${url} requires a screener.in account`);
      }
      return res.data as string;
    }, this.config.maxRetries);

    this.cache.set(key, html);
    return html;
  }

  protected companyUrl(symbol: string, mode: CompanyMode): string {
    const base = `${this.config.baseUrl}/company/${symbol.toUpperCase()}`;
    return mode === "consolidated" ? `${base}/consolidated/` : `${base}/`;
  }
}
