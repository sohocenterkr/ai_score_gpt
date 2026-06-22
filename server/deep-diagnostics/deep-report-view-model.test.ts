import { describe, expect, it } from "vitest";
import {
  buildPublicFactualEvaluation,
} from "./deep-diagnostic-admin-service";

describe("deep diagnostic report view model", () => {
  it("저장된 사실 평가를 라벨과 기준정보를 포함한 공개 결과로 변환한다", () => {
    expect(
      buildPublicFactualEvaluation(
        {
          summary: "서비스 정의는 일치하고 기능은 빠졌습니다.",
          factualAccuracy: 100,
          completeness: 50,
          factResults: [
            {
              factKey: "service_definition",
              status: "SUPPORTED",
              reason: "서비스 정의가 일치합니다.",
            },
            {
              factKey: "primary_features",
              status: "NOT_MENTIONED",
              reason: "주요 기능이 답변에 없습니다.",
            },
          ],
        },
        {
          service_definition: "블로그 초안 생성 서비스",
          primary_features: "사진·음성 입력",
        },
      ),
    ).toEqual({
      summary: "서비스 정의는 일치하고 기능은 빠졌습니다.",
      factualAccuracy: 100,
      completeness: 50,
      factResults: [
        {
          factKey: "service_definition",
          label: "서비스 정의",
          status: "SUPPORTED",
          reason: "서비스 정의가 일치합니다.",
          expectedValue: "블로그 초안 생성 서비스",
        },
        {
          factKey: "primary_features",
          label: "주요 기능",
          status: "NOT_MENTIONED",
          reason: "주요 기능이 답변에 없습니다.",
          expectedValue: "사진·음성 입력",
        },
      ],
    });
  });

  it("점수와 요약이 없는 평가 데이터는 공개하지 않는다", () => {
    expect(
      buildPublicFactualEvaluation(
        {
          factResults: [],
        },
        {},
      ),
    ).toBeNull();
  });
});
