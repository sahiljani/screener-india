import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseHtml,
  parseTitle,
  parseTopRatios,
  parseTable,
  parseAnalysis,
  parseDocuments,
  parseSectorLinks,
  parseScreenItems,
  parsePagination,
  parseDataTable,
} from "../src/utils/parser.js";

// ─── fixtures ────────────────────────────────────────────────────────────────

const COMPANY_HTML = `
<html>
<head><title>Reliance Industries | Balance Sheet</title></head>
<body>
  <ul id="top-ratios">
    <li id="market-cap">
      <span class="name">Market Cap</span>
      <span class="value">₹19,00,000 Cr.</span>
    </li>
    <li id="current-price">
      <span class="name">Current Price</span>
      <span class="value">₹2,800</span>
    </li>
    <li id="stock-pe">
      <span class="name">Stock P/E</span>
      <span class="value">28.5</span>
    </li>
  </ul>

  <section id="profit-loss">
    <table>
      <thead><tr><th>Mar 2022</th><th>Mar 2023</th><th>Mar 2024</th></tr></thead>
      <tbody>
        <tr><td>Revenue</td><td>800000</td><td>900000</td></tr>
        <tr><td>Net Profit</td><td>60000</td><td>70000</td></tr>
      </tbody>
    </table>
  </section>

  <section id="analysis">
    <div class="pros">
      <ul>
        <li>Strong cash flow generation</li>
        <li>Dominant market position</li>
      </ul>
    </div>
    <div class="cons">
      <ul>
        <li>High debt levels</li>
      </ul>
    </div>
    <p>Reliance is a diversified conglomerate.</p>
  </section>

  <section id="documents">
    <a href="/media/annual-report-2024.pdf">Annual Report 2024</a>
    <a href="/media/q4-results.pdf">Q4 Results</a>
    <a href="">Empty link</a>
  </section>
</body>
</html>
`;

const SECTOR_HTML = `
<html>
<body>
  <a href="/market/automobile/">Automobile</a>
  <a href="/market/banks-private/">Banks - Private</a>
  <a href="/market/banks-public/">Banks - Public</a>
  <a href="/market/automobile/">Automobile</a>
</body>
</html>
`;

const SCREEN_HTML = `
<html>
<body>
  <ul class="card-list">
    <li>
      <a href="/screens/4/most-profitable-companies/">Most Profitable Companies</a>
      <p>Top profitable companies by net profit margin</p>
    </li>
    <li>
      <a href="/screens/8/highest-dividend-yield/">Highest Dividend Yield</a>
      <p>Companies with best dividend yields</p>
    </li>
  </ul>
  <div class="pagination">
    <a href="?page=2">2</a>
    <a href="?page=3">3</a>
  </div>
</body>
</html>
`;

const DATA_TABLE_HTML = `
<html>
<body>
  <div data-page-results="true">
    <table>
      <thead>
        <tr><th>Name</th><th>CMP</th><th>P/E</th></tr>
      </thead>
      <tbody>
        <tr><td>Reliance</td><td>2800</td><td>28.5</td></tr>
        <tr><td>TCS</td><td>3500</td><td>30.1</td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>
`;

// ─── tests ───────────────────────────────────────────────────────────────────

describe("parseTitle", () => {
  it("extracts company name from page title", () => {
    const root = parseHtml(COMPANY_HTML);
    assert.equal(parseTitle(root), "Reliance Industries");
  });

  it("returns empty string when no title tag", () => {
    const root = parseHtml("<html><body></body></html>");
    assert.equal(parseTitle(root), "");
  });
});

describe("parseTopRatios", () => {
  it("extracts all top ratios", () => {
    const root = parseHtml(COMPANY_HTML);
    const ratios = parseTopRatios(root);
    assert.equal(ratios.length, 3);
  });

  it("maps ratio name and value correctly", () => {
    const root = parseHtml(COMPANY_HTML);
    const ratios = parseTopRatios(root);
    assert.equal(ratios[0].name, "Market Cap");
    assert.equal(ratios[0].value, "₹19,00,000 Cr.");
    assert.equal(ratios[0].id, "market-cap");
  });

  it("returns empty array when no top-ratios list", () => {
    const root = parseHtml("<html><body></body></html>");
    assert.deepEqual(parseTopRatios(root), []);
  });
});

describe("parseTable", () => {
  it("returns undefined when section is null", () => {
    assert.equal(parseTable(null), undefined);
  });

  it("parses headers and rows from a financial table", () => {
    const root = parseHtml(COMPANY_HTML);
    const section = root.querySelector("section#profit-loss");
    const table = parseTable(section);
    assert.ok(table, "table should be defined");
    assert.deepEqual(table.headers, ["Mar 2022", "Mar 2023", "Mar 2024"]);
    assert.equal(table.rows.length, 2);
    assert.equal(table.rows[0]["Mar 2022"], "Revenue");
  });

  it("returns undefined when section has no table", () => {
    const root = parseHtml("<section id='empty'><p>no table</p></section>");
    const section = root.querySelector("section#empty");
    assert.equal(parseTable(section), undefined);
  });
});

describe("parseAnalysis", () => {
  it("extracts pros, cons and description", () => {
    const root = parseHtml(COMPANY_HTML);
    const analysis = parseAnalysis(root);
    assert.ok(analysis);
    assert.deepEqual(analysis.pros, ["Strong cash flow generation", "Dominant market position"]);
    assert.deepEqual(analysis.cons, ["High debt levels"]);
    assert.equal(analysis.description, "Reliance is a diversified conglomerate.");
  });

  it("returns undefined when no analysis section", () => {
    const root = parseHtml("<html><body></body></html>");
    assert.equal(parseAnalysis(root), undefined);
  });
});

describe("parseDocuments", () => {
  it("extracts document links with title and url", () => {
    const root = parseHtml(COMPANY_HTML);
    const docs = parseDocuments(root);
    assert.equal(docs.length, 2);
    assert.equal(docs[0].title, "Annual Report 2024");
    assert.equal(docs[0].url, "/media/annual-report-2024.pdf");
  });

  it("filters out links with empty href", () => {
    const root = parseHtml(COMPANY_HTML);
    const docs = parseDocuments(root);
    assert.ok(docs.every((d) => d.url.length > 0));
  });
});

describe("parseSectorLinks", () => {
  it("extracts unique sector slugs", () => {
    const root = parseHtml(SECTOR_HTML);
    const sectors = parseSectorLinks(root);
    assert.equal(sectors.length, 3); // deduplicated
  });

  it("maps name and slug correctly", () => {
    const root = parseHtml(SECTOR_HTML);
    const sectors = parseSectorLinks(root);
    assert.equal(sectors[0].name, "Automobile");
    assert.equal(sectors[0].slug, "automobile");
  });
});

describe("parseScreenItems", () => {
  it("extracts screen items from listing page", () => {
    const root = parseHtml(SCREEN_HTML);
    const screens = parseScreenItems(root);
    assert.equal(screens.length, 2);
  });

  it("maps id, slug, title and description", () => {
    const root = parseHtml(SCREEN_HTML);
    const screens = parseScreenItems(root);
    assert.equal(screens[0].id, 4);
    assert.equal(screens[0].slug, "most-profitable-companies");
    assert.equal(screens[0].title, "Most Profitable Companies");
    assert.equal(screens[0].description, "Top profitable companies by net profit margin");
  });
});

describe("parsePagination", () => {
  it("detects max page from pagination links", () => {
    const root = parseHtml(SCREEN_HTML);
    const { totalPages } = parsePagination(root);
    assert.equal(totalPages, 3);
  });

  it("returns 1 when no pagination exists", () => {
    const root = parseHtml("<html><body></body></html>");
    const { totalPages } = parsePagination(root);
    assert.equal(totalPages, 1);
  });
});

describe("parseDataTable", () => {
  it("extracts columns and rows from data-page-results table", () => {
    const root = parseHtml(DATA_TABLE_HTML);
    const { columns, rows } = parseDataTable(root);
    assert.deepEqual(columns, ["Name", "CMP", "P/E"]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]["Name"], "Reliance");
    assert.equal(rows[1]["P/E"], "30.1");
  });

  it("returns empty arrays when no table found", () => {
    const root = parseHtml("<html><body></body></html>");
    const { columns, rows } = parseDataTable(root);
    assert.deepEqual(columns, []);
    assert.deepEqual(rows, []);
  });
});
