import { describe, expect, it } from "vitest";
import {
  localizedWorkOrderForPdf,
  renderWorkOrderPdf,
  workOrderPdfFilename,
} from "./work-order-pdf";
import type { PublicWorkOrder } from "./work-order-service";

const workOrder: PublicWorkOrder = {
  id: "work-order-1",
  orderNumber: "WO-20260615-34838",
  version: 1,
  status: "ISSUED",
  rulesVersion: "2026.06-core-v2",
  scoreBefore: 71,
  gradeBefore: "B",
  expectedScoreMin: 86,
  expectedScoreMax: 100,
  issuedAt: "2026-06-15T07:37:39.954Z",
  createdAt: "2026-06-15T07:37:30.502Z",
  updatedAt: "2026-06-15T07:37:39.959Z",
  site: {
    id: "site-1",
    name: "비짓제주",
    baseUrl: "https://www.visitjeju.net/",
    finalUrl: "https://www.visitjeju.net/kr",
  },
  initialScan: {
    id: "scan-1",
    score: 71,
    grade: "B",
    rulesVersion: "2026.06-core-v3",
    targetUrl: "https://example.com/",
    completedAt: "2026-06-15T06:29:35.490Z",
  },
  customerOrganization: {
    id: "organization-1",
    name: "김천식의 사이트",
  },
  agencyOrganization: null,
  verificationAttempts: [],
  extraVerification: {
    required: false,
    available: true,
    freeUntilVersion: 2,
    priceAmount: 33_000,
    currency: "KRW",
  },
  versionHistory: [],
  items: [
    {
      id: "item-1",
      findingId: "finding-1",
      itemCode: "STRUCT-JSONLD-001",
      targetUrl: "https://www.visitjeju.net/kr",
      title: "JSON-LD 구조화 데이터",
      requirement:
        "사이트의 성격과 핵심정보를 설명하는 유효한 Schema.org JSON-LD를 초기 HTML에 추가합니다.",
      developerMessage:
        "초기 HTML에 JSON-LD를 출력하고 화면 정보와 일치하도록 구현해 주세요.",
      acceptanceCriteria: [
        {
          code: "JSONLD-01",
          label: "초기 HTML에서 JSON-LD script를 발견할 수 있다.",
          required: true,
        },
        {
          code: "JSONLD-02",
          label: "JSON-LD가 오류 없이 파싱되는 유효한 JSON이다.",
          required: true,
        },
      ],
      isRequired: true,
      weight: 12,
      status: "PENDING",
      finding: {
        ruleCode: "STRUCT-JSONLD-001",
        category: "핵심정보 인식 정확도",
        summaryGroup: "TRUST",
        severity: "MEDIUM",
        status: "FAIL",
        description:
          "초기 HTML에서 유효한 JSON-LD 구조화 데이터를 찾지 못했습니다.",
        evidence: {
          validCount: 0,
          invalidCount: 0,
          types: [],
        },
        recommendation: "JSON-LD를 추가하세요.",
      },
    },
  ],
};

describe("work order PDF", () => {
  it("한글 작업지시서를 유효한 PDF 버퍼로 생성한다", async () => {
    const result = await renderWorkOrderPdf(workOrder);
    const source = result.toString("latin1");
    const pageCount = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;

    expect(result.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(result.length).toBeGreaterThan(10_000);
    expect(pageCount).toBe(4);
  }, 45_000);

  it("안전한 PDF 파일명을 만든다", () => {
    expect(workOrderPdfFilename(workOrder)).toBe("WO-20260615-34838-v1.pdf");
  });

  it("rebuilds Korean stored items with English templates for PDF export", () => {
    const localized = localizedWorkOrderForPdf(workOrder, "en");
    const renderedText = JSON.stringify(
      localized.items.map((item) => ({
        title: item.title,
        requirement: item.requirement,
        developerMessage: item.developerMessage,
        acceptanceCriteria: item.acceptanceCriteria,
      })),
    );

    expect(renderedText).toContain("Add valid Schema.org JSON-LD");
    expect(renderedText).not.toContain("JSON-LD를 추가하세요");
    expect(renderedText).not.toContain("현재 문제");
  });

  it("fully translates a stored rendered-improvement item", () => {
    const item = workOrder.items[0];
    const localized = localizedWorkOrderForPdf(
      {
        ...workOrder,
        items: [
          {
            ...item,
            findingId: null,
            finding: null,
            itemCode: "RENDERED-ADDED-CONTENT",
            title: "화면에는 보이지만 일부 AI가 놓칠 수 있는 정보가 있습니다",
            requirement:
              "현재 상태: 초기 HTML 본문 포함 비율은 97.4%입니다. 초기 HTML 내부 링크 포함 비율은 63.8%입니다.\n\n무슨 뜻인가요: 초기 HTML 본문은 렌더링 후 본문의 97.4%를 포함해 기준을 충족하지만, 초기 HTML 내부 링크 포함 비율 63.8%는 보완이 필요합니다.",
            developerMessage:
              "- AI 검색 노출 보장이 아니라 AI가 브랜드와 상품을 정확히 인식·인용할 가능성을 높이는 작업으로 이해해 주세요.\n- 기존 디자인·본문·사용자 기능을 제거하거나 비활성화하지 마세요.",
            acceptanceCriteria: [
              {
                code: "JS-CONTENT-01",
                label: "초기 HTML 본문 포함 비율 97.4% 이상이 유지됩니다.",
                required: true,
              },
            ],
          },
        ],
      },
      "en",
    );
    const renderedFields = JSON.stringify({
      title: localized.items[0]?.title,
      requirement: localized.items[0]?.requirement,
      developerMessage: localized.items[0]?.developerMessage,
      acceptanceCriteria: localized.items[0]?.acceptanceCriteria,
    });
    expect(renderedFields).not.toMatch(/[가-힣]/);
    expect(renderedFields).toContain("97.4%");
  });

  it("renders an English work-order PDF", async () => {
    const result = await renderWorkOrderPdf(workOrder, { locale: "en" });
    const source = result.toString("latin1");
    const pageCount = source.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    expect(result.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(result.length).toBeGreaterThan(10_000);
    expect(pageCount).toBeGreaterThanOrEqual(3);
  }, 45_000);

});
