import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public landing page SEO fallback", () => {
  const indexHtml = readFileSync("index.html", "utf8");

  it("exposes canonical, H1, core body copy, and internal links in initial HTML", () => {
    expect(indexHtml).toContain(
      '<link rel="canonical" href="https://siteaiscore.com/ko"',
    );
    expect(indexHtml).toContain(
      "<h1>내 사이트를 AI가 얼마나 잘 이해하는지 확인하세요.</h1>",
    );
    expect(indexHtml).toContain(
      "Site AI Score는 공개 URL을 기준으로 AI 검색 접근성",
    );
    expect(indexHtml).toContain('href="/ko/privacy"');
    expect(indexHtml).toContain('href="/ko/terms"');
    expect(indexHtml).toContain('type="application/ld+json"');
  });

  it("keeps initial HTML content large enough for answerability checks", () => {
    const text = indexHtml
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<[^>]+>/g, " ");
    expect(text.replace(/\s+/g, " ").trim().length).toBeGreaterThan(800);
  });

  it("provides llms.txt as plain markdown guidance", () => {
    const llms = readFileSync("public/llms.txt", "utf8");
    expect(llms).toContain("# Site AI Score");
    expect(llms).not.toContain("<!DOCTYPE html>");
    expect(llms).toContain("https://siteaiscore.com/ko");
  });
});
