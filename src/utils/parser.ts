import { HTMLElement, parse } from "node-html-parser";
import type {
  TopRatio,
  FinancialTable,
  TableRow,
  AnalysisData,
  DocumentLink,
  PeerRow,
} from "../types.js";

export function parseHtml(html: string): HTMLElement {
  return parse(html);
}

export function parseTitle(root: HTMLElement): string {
  const titleTag = root.querySelector("title");
  if (!titleTag) return "";
  // e.g. "Reliance Industries - Balance Sheet, Annual Report, ..."
  return titleTag.text.split("|")[0].split("-")[0].trim();
}

export function parseTopRatios(root: HTMLElement): TopRatio[] {
  return root.querySelectorAll("ul#top-ratios li").map((li) => {
    const nameEl = li.querySelector(".name") ?? li.querySelector("span:first-child");
    const valueEl = li.querySelector(".value") ?? li.querySelector("span:last-child");
    return {
      id: li.getAttribute("id") ?? undefined,
      name: nameEl?.text.trim() ?? "",
      value: valueEl?.text.trim() ?? "",
    };
  });
}

export function parseTable(section: HTMLElement | null): FinancialTable | undefined {
  if (!section) return undefined;
  const table = section.querySelector("table");
  if (!table) return undefined;

  const headers: string[] = [];
  const rows: TableRow[] = [];

  const headerRow = table.querySelector("thead tr") ?? table.querySelector("tr");
  if (headerRow) {
    headerRow.querySelectorAll("th, td").forEach((cell) => {
      headers.push(cell.text.trim());
    });
  }

  const bodyRows = table.querySelectorAll("tbody tr");
  const dataRows = bodyRows.length > 0 ? bodyRows : table.querySelectorAll("tr:not(:first-child)");

  dataRows.forEach((tr) => {
    const cells = tr.querySelectorAll("td");
    if (cells.length === 0) return;
    const row: TableRow = {};
    cells.forEach((cell, i) => {
      const key = headers[i] ?? `col_${i}`;
      row[key] = cell.text.trim();
    });
    rows.push(row);
  });

  return { headers, rows };
}

export function parseAnalysis(root: HTMLElement): AnalysisData | undefined {
  const section = root.querySelector("section#analysis");
  if (!section) return undefined;

  const pros = section
    .querySelectorAll(".pros li")
    .map((li) => li.text.trim())
    .filter(Boolean);

  const cons = section
    .querySelectorAll(".cons li")
    .map((li) => li.text.trim())
    .filter(Boolean);

  const descEl = section.querySelector("p");
  const description = descEl?.text.trim() ?? "";

  return { pros, cons, description };
}

export function parseDocuments(root: HTMLElement): DocumentLink[] {
  return root
    .querySelectorAll("section#documents a[href]")
    .map((a) => ({
      title: a.text.trim(),
      url: a.getAttribute("href") ?? "",
    }))
    .filter((d) => d.title && d.url);
}

export function parsePeers(root: HTMLElement): PeerRow[] {
  const section = root.querySelector("section#peers");
  if (!section) return [];

  const table = section.querySelector("table");
  if (!table) return [];

  const headers: string[] = [];
  const headerRow = table.querySelector("thead tr");
  if (headerRow) {
    headerRow.querySelectorAll("th").forEach((th) => headers.push(th.text.trim()));
  }

  const rows: PeerRow[] = [];
  table.querySelectorAll("tbody tr").forEach((tr) => {
    const cells = tr.querySelectorAll("td");
    if (cells.length === 0) return;
    const row: PeerRow = {};
    cells.forEach((cell, i) => {
      row[headers[i] ?? `col_${i}`] = cell.text.trim();
    });
    rows.push(row);
  });

  return rows;
}

export function parseSectorLinks(
  root: HTMLElement,
): Array<{ name: string; slug: string; url: string }> {
  // Screener.in uses deep hierarchical paths: /market/IN02/IN0201/IN020101/IN020101002/
  // We extract the full path after /market/ as the slug so getSectorData can use it directly.
  const links = root.querySelectorAll("a[href*='/market/']");
  const seen = new Set<string>();
  const result: Array<{ name: string; slug: string; url: string }> = [];

  links.forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const match = href.match(/\/market\/(.+?)\/?$/);
    if (!match) return;
    const name = a.text.trim();
    if (!name) return; // skip nav links with no label
    const slug = match[1].replace(/\/$/, ""); // e.g. IN02/IN0201/IN020101/IN020101002
    if (seen.has(slug)) return;
    seen.add(slug);
    result.push({
      name,
      slug,
      url: href.startsWith("http") ? href : `https://www.screener.in${href}`,
    });
  });

  return result;
}

function normalizeCell(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function parseDataTable(root: HTMLElement): {
  columns: string[];
  rows: TableRow[];
} {
  const table =
    root.querySelector("[data-page-results] table") ??
    root.querySelector("table.data-table") ??
    root.querySelector("table");

  if (!table) return { columns: [], rows: [] };

  const columns: string[] = [];

  // Screener.in puts the header row inside tbody (th cells in the first tr)
  // Try thead first, fall back to first tr with th elements
  const theadRow = table.querySelector("thead tr");
  const firstTbodyRow = table.querySelector("tbody tr");
  const headerRow =
    theadRow ?? (firstTbodyRow?.querySelectorAll("th").length ? firstTbodyRow : null);

  if (headerRow) {
    headerRow.querySelectorAll("th").forEach((th) => columns.push(normalizeCell(th.text)));
  }

  const rows: TableRow[] = [];
  table.querySelectorAll("tbody tr").forEach((tr) => {
    // Skip the header row if it lives inside tbody
    if (tr === firstTbodyRow && tr.querySelectorAll("th").length > 0) return;
    const cells = tr.querySelectorAll("td");
    if (cells.length === 0) return;
    const row: TableRow = {};
    cells.forEach((cell, i) => {
      row[columns[i] ?? `col_${i}`] = normalizeCell(cell.text);
    });
    rows.push(row);
  });

  return { columns, rows };
}

export function parsePagination(root: HTMLElement): {
  currentPage: number;
  totalPages: number;
} {
  const links = root.querySelectorAll(".pagination a[href]");
  let maxPage = 1;
  links.forEach((a) => {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/[?&]page=(\d+)/);
    if (m) maxPage = Math.max(maxPage, parseInt(m[1], 10));
  });
  return { currentPage: 1, totalPages: maxPage };
}

export function parseScreenItems(root: HTMLElement): Array<{
  id: number;
  slug: string;
  title: string;
  description: string;
  url: string;
}> {
  const items: ReturnType<typeof parseScreenItems> = [];

  // Screener.in puts title + description inside the same anchor, separated by \n
  // e.g. "Highest Dividend Yield Shares\n      Stocks that have been consistently paying…"
  root.querySelectorAll("a[href*='/screens/']").forEach((anchor) => {
    const href = anchor.getAttribute("href") ?? "";
    const match = href.match(/\/screens\/(\d+)\/([^/?#]+)/);
    if (!match) return;

    const rawText = anchor.text;
    const parts = rawText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const title = parts[0] ?? "";
    // Description may be inline (newline-separated in anchor) or in a sibling <p>
    const description =
      parts.length > 1
        ? parts.slice(1).join(" ").trim()
        : ((anchor.parentNode as HTMLElement | null)?.querySelector("p")?.text.trim() ?? "");

    items.push({
      id: parseInt(match[1], 10),
      slug: match[2],
      title,
      description,
      url: href.startsWith("http") ? href : `https://www.screener.in${href}`,
    });
  });

  return items;
}

export function parseSectionIds(root: HTMLElement): string[] {
  return root
    .querySelectorAll("section[id]")
    .map((s) => s.getAttribute("id") ?? "")
    .filter(Boolean);
}
