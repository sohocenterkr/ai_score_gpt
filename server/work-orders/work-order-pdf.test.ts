import { describe, expect, it } from "vitest";
import { renderWorkOrderPdf, workOrderPdfFilename } from "./work-order-pdf";
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
});
