import { describe, expect, it } from "vitest";
import { buildSiteFactDrafts } from "./site-fact-drafts";

describe("buildSiteFactDrafts", () => {
  it("문서 제목·메타 설명·H1이 있으면 서비스 정의와 주요 기능 초안을 만든다", () => {
    const drafts = buildSiteFactDrafts([
      {
        ruleCode: "META-TITLE-001",
        evidence: { title: "PostDrafter - AI 블로그 글쓰기 도구" },
      },
      {
        ruleCode: "META-DESCRIPTION-001",
        evidence: {
          metaDescription:
            "사진, 음성, 메모만으로 블로그 초안을 AI가 자동 생성합니다.",
        },
      },
      {
        ruleCode: "STRUCT-H1-001",
        evidence: {
          h1: ["사진·음성·메모로 AI 블로그 초안을 만드는 PostDrafter"],
          h2: ["새 글 시작"],
        },
      },
    ]);

    expect(drafts.service_definition).toContain(
      "사진·음성·메모로 AI 블로그 초안을 만드는 PostDrafter",
    );
    expect(drafts.service_definition).toContain(
      "사진, 음성, 메모만으로 블로그 초안을 AI가 자동 생성합니다.",
    );
    expect(drafts.primary_features).toBe(
      "사진, 음성, 메모만으로 블로그 초안을 AI가 자동 생성합니다.",
    );
  });

  it("관련 Finding이 없으면 초안을 만들지 않는다", () => {
    const drafts = buildSiteFactDrafts([]);

    expect(drafts.service_definition).toBeUndefined();
    expect(drafts.primary_features).toBeUndefined();
  });

  it("target_audience처럼 원문이 없는 필드는 초안을 만들지 않는다", () => {
    const drafts = buildSiteFactDrafts([
      {
        ruleCode: "META-DESCRIPTION-001",
        evidence: { metaDescription: "설명" },
      },
    ]);

    expect(drafts.target_audience).toBeUndefined();
    expect(drafts.pricing).toBeUndefined();
    expect(drafts.operator).toBeUndefined();
  });

  it("H1만 있고 메타 설명이 없으면 H1만으로 서비스 정의 초안을 만든다", () => {
    const drafts = buildSiteFactDrafts([
      {
        ruleCode: "STRUCT-H1-001",
        evidence: { h1: ["대표 제목"], h2: [] },
      },
    ]);

    expect(drafts.service_definition).toBe("대표 제목");
    expect(drafts.primary_features).toBeUndefined();
  });
});
