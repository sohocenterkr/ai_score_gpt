import { createHash } from "node:crypto";
import { load } from "cheerio";

export interface HtmlAnalysis {
  rawHtmlHash: string;
  bodyBytes: number;
  textLength: number;
  title: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  robotsMeta: string | null;
  htmlLang: string | null;
  openGraph: {
    title: string | null;
    description: string | null;
    image: string | null;
  };
  headings: {
    h1: string[];
    h2: string[];
    h3Count: number;
  };
  links: {
    total: number;
    internal: number;
    external: number;
    sample: string[];
  };
  jsonLd: {
    scriptCount: number;
    validCount: number;
    invalidCount: number;
    types: string[];
    errors: string[];
  };
  iframeCount: number;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstMetaContent(
  html: ReturnType<typeof load>,
  attributeName: "name" | "property",
  expectedValue: string,
): string | null {
  let result: string | null = null;

  html("meta").each((_index, element) => {
    if (result) {
      return;
    }

    const actual = html(element)
      .attr(attributeName)
      ?.trim()
      .toLowerCase();

    if (actual === expectedValue.toLowerCase()) {
      const content = normalizeText(
        html(element).attr("content") ?? "",
      );
      result = content || null;
    }
  });

  return result;
}

function canonicalFromDocument(
  html: ReturnType<typeof load>,
  finalUrl: string,
): string | null {
  let href: string | null = null;

  html("link[rel]").each((_index, element) => {
    if (href) {
      return;
    }

    const rel = (html(element).attr("rel") ?? "")
      .toLowerCase()
      .split(/\s+/);

    if (rel.includes("canonical")) {
      href = html(element).attr("href")?.trim() ?? null;
    }
  });

  if (!href) {
    return null;
  }

  try {
    return new URL(href, finalUrl).toString();
  } catch {
    return href;
  }
}

function collectJsonLdTypes(
  value: unknown,
  target: Set<string>,
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonLdTypes(item, target);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const rawType = record["@type"];

  if (typeof rawType === "string") {
    target.add(rawType);
  } else if (Array.isArray(rawType)) {
    for (const item of rawType) {
      if (typeof item === "string") {
        target.add(item);
      }
    }
  }

  if (record["@graph"]) {
    collectJsonLdTypes(record["@graph"], target);
  }
}

function analyzeJsonLd(html: ReturnType<typeof load>) {
  let scriptCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  const types = new Set<string>();
  const errors: string[] = [];

  html('script[type="application/ld+json"]').each(
    (_index, element) => {
      scriptCount += 1;
      const raw = html(element).text().trim();

      if (!raw) {
        invalidCount += 1;
        if (errors.length < 5) {
          errors.push("빈 JSON-LD 스크립트");
        }
        return;
      }

      try {
        const parsed = JSON.parse(raw) as unknown;
        validCount += 1;
        collectJsonLdTypes(parsed, types);
      } catch (error) {
        invalidCount += 1;
        if (errors.length < 5) {
          errors.push(
            error instanceof Error
              ? error.message.slice(0, 180)
              : "JSON 파싱 실패",
          );
        }
      }
    },
  );

  return {
    scriptCount,
    validCount,
    invalidCount,
    types: [...types].sort(),
    errors,
  };
}

function analyzeLinks(
  html: ReturnType<typeof load>,
  finalUrl: string,
) {
  const base = new URL(finalUrl);
  const links = new Set<string>();

  html("a[href]").each((_index, element) => {
    const raw = html(element).attr("href")?.trim();

    if (
      !raw ||
      raw.startsWith("#") ||
      /^(?:mailto|tel|javascript|data):/i.test(raw)
    ) {
      return;
    }

    try {
      const resolved = new URL(raw, base);
      resolved.hash = "";

      if (["http:", "https:"].includes(resolved.protocol)) {
        links.add(resolved.toString());
      }
    } catch {
      return;
    }
  });

  let internal = 0;
  let external = 0;

  for (const link of links) {
    if (new URL(link).origin === base.origin) {
      internal += 1;
    } else {
      external += 1;
    }
  }

  return {
    total: links.size,
    internal,
    external,
    sample: [...links].slice(0, 20),
  };
}

function headingTexts(
  html: ReturnType<typeof load>,
  selector: string,
  limit: number,
): string[] {
  const values: string[] = [];

  html(selector).each((_index, element) => {
    if (values.length >= limit) {
      return;
    }

    const text = normalizeText(html(element).text());

    if (text) {
      values.push(text);
    }
  });

  return values;
}

export function analyzeHtml(
  body: Buffer,
  finalUrl: string,
): HtmlAnalysis {
  const html = load(body.toString("utf8"));
  const title = normalizeText(html("title").first().text()) || null;
  const metaDescription = firstMetaContent(
    html,
    "name",
    "description",
  );
  const robotsMeta = firstMetaContent(html, "name", "robots");
  const htmlLang =
    normalizeText(html("html").attr("lang") ?? "") || null;
  const iframeCount = html("iframe").length;
  const headings = {
    h1: headingTexts(html, "h1", 10),
    h2: headingTexts(html, "h2", 20),
    h3Count: html("h3").length,
  };
  const links = analyzeLinks(html, finalUrl);
  const jsonLd = analyzeJsonLd(html);

  html(
    "script,style,noscript,template,svg,canvas",
  ).remove();
  const text = normalizeText(
    html("body").text() || html.root().text(),
  );

  return {
    rawHtmlHash: createHash("sha256").update(body).digest("hex"),
    bodyBytes: body.length,
    textLength: text.length,
    title,
    metaDescription,
    canonicalUrl: canonicalFromDocument(html, finalUrl),
    robotsMeta,
    htmlLang,
    openGraph: {
      title: firstMetaContent(html, "property", "og:title"),
      description: firstMetaContent(
        html,
        "property",
        "og:description",
      ),
      image: firstMetaContent(html, "property", "og:image"),
    },
    headings,
    links,
    jsonLd,
    iframeCount,
  };
}
