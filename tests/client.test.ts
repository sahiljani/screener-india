import { describe, it, mock, before, after } from "node:test";
import assert from "node:assert/strict";
import { ScreenerClient } from "../src/client.js";

// ─── mock axios ──────────────────────────────────────────────────────────────
// We intercept at the cache + throttle level by stubbing fetchHtml on the
// prototype so no real HTTP requests are made.

const MOCK_COMPANY_HTML = `
<html>
<head><title>TCS | Tata Consultancy Services</title></head>
<body>
  <ul id="top-ratios">
    <li id="market-cap">
      <span class="name">Market Cap</span>
      <span class="value">₹14,00,000 Cr.</span>
    </li>
    <li id="stock-pe">
      <span class="name">Stock P/E</span>
      <span class="value">30.1</span>
    </li>
    <li id="roe">
      <span class="name">ROE</span>
      <span class="value">48%</span>
    </li>
  </ul>
  <section id="ratios">
    <table>
      <thead><tr><th>Mar 2022</th><th>Mar 2023</th></tr></thead>
      <tbody><tr><td>ROE</td><td>48%</td></tr></tbody>
    </table>
  </section>
  <section id="analysis">
    <div class="pros"><ul><li>High ROE</li></ul></div>
    <div class="cons"><ul><li>Currency risk</li></ul></div>
    <p>TCS is India's largest IT company.</p>
  </section>
</body>
</html>
`;

describe("ScreenerClient", () => {
  let client: ScreenerClient;
  let fetchHtmlMock: ReturnType<typeof mock.method>;

  before(() => {
    client = new ScreenerClient({ minIntervalMs: 0 });
    // Stub the private fetchHtml method so no real HTTP calls happen
    fetchHtmlMock = mock.method(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      "fetchHtml",
      async (_url: string, _scope?: string) => MOCK_COMPANY_HTML,
    );
  });

  after(() => {
    fetchHtmlMock.mock.restore();
  });

  describe("getCompany", () => {
    it("returns a company with name and topRatios", async () => {
      const result = await client.getCompany("TCS");
      assert.equal(result.data.symbol, "TCS");
      assert.equal(result.data.name, "TCS");
      assert.equal(result.data.topRatios.length, 3);
    });

    it("includes meta with sourceUrl and fetchedAt", async () => {
      const result = await client.getCompany("TCS");
      assert.ok(result.meta.sourceUrl.includes("TCS"));
      assert.ok(result.meta.fetchedAt);
      assert.ok(result.meta.parserVersion);
    });

    it("returns warnings array (empty on success)", async () => {
      const result = await client.getCompany("TCS");
      assert.ok(Array.isArray(result.warnings));
    });

    it("defaults mode to consolidated", async () => {
      const result = await client.getCompany("TCS");
      assert.equal(result.data.mode, "consolidated");
    });
  });

  describe("getCompanyTab", () => {
    it("returns only the requested tab data", async () => {
      const result = await client.getCompanyTab("TCS", "ratios");
      assert.ok(result.data.ratios);
      assert.equal(result.data.ratios.headers.length, 2);
      // Other tabs should not be present
      assert.equal(result.data.quarters, undefined);
    });

    it("returns analysis tab correctly", async () => {
      const result = await client.getCompanyTab("TCS", "analysis");
      assert.ok(result.data.analysis);
      assert.deepEqual(result.data.analysis.pros, ["High ROE"]);
      assert.deepEqual(result.data.analysis.cons, ["Currency risk"]);
    });
  });

  describe("compareCompanies", () => {
    it("returns a summary per symbol", async () => {
      const result = await client.compareCompanies(["TCS", "INFY"]);
      assert.equal(result.data.length, 2);
    });

    it("includes market cap and P/E fields", async () => {
      const result = await client.compareCompanies(["TCS"]);
      const summary = result.data[0];
      assert.ok(summary.marketCap);
      assert.ok(summary.pe);
      assert.ok(summary.roe);
    });
  });

  describe("cache", () => {
    it("clearCache() does not throw", () => {
      assert.doesNotThrow(() => client.clearCache());
    });

    it("serves cached response on second call without extra http.get", async () => {
      const freshClient = new ScreenerClient({ minIntervalMs: 0 });
      // Stub http.get so the cache inside fetchHtml still operates normally
      const stubbed = mock.method(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (freshClient as any).http,
        "get",
        async () => ({ data: MOCK_COMPANY_HTML }),
      );

      await freshClient.getCompany("TCS");
      await freshClient.getCompany("TCS"); // second call should be served from cache
      // http.get only called once — cache absorbed the second request
      assert.equal(stubbed.mock.callCount(), 1);
      stubbed.mock.restore();
    });
  });
});
