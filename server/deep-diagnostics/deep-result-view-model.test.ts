import { describe, expect, it } from "vitest";
import {
  serviceIdentificationFromEvaluation,
} from "./deep-diagnostic-admin-service";

describe("deep result view model", () => {
  it("서비스 정의가 기준정보와 일치하면 식별 성공으로 판정한다", () => {
    expect(
      serviceIdentificationFromEvaluation({
        factResults: [
          {
            factKey: "service_definition",
            status: "SUPPORTED",
            reason: "정의와 일치",
          },
        ],
      }),
    ).toBe(true);
  });

  it("다른 서비스를 설명하면 식별 실패로 판정한다", () => {
    expect(
      serviceIdentificationFromEvaluation({
        factResults: [
          {
            factKey: "service_definition",
            status: "CONTRADICTED",
            reason: "다른 서비스를 설명함",
          },
        ],
      }),
    ).toBe(false);
  });

  it("이전 평가 결과가 임의 주장 키를 사용했어도 다른 서비스 설명이 명확하면 실패로 판정한다", () => {
    expect(
      serviceIdentificationFromEvaluation(
        {
          factualAccuracy: 20,
          factResults: [
            {
              factKey: "게시 자동화 플랫폼이라는 주장",
              status: "CONTRADICTED",
              reason: "다른 서비스를 설명했습니다.",
            },
          ],
        },
        {
          hasServiceDefinition: true,
          targetDomainCited: false,
          answerText:
            "정확히는 해당 서비스를 확인하지 못했습니다.",
        },
      ),
    ).toBe(false);
  });

  it("답변이 정확한 서비스를 찾지 못했다고 명시하면 식별 실패로 판정한다", () => {
    expect(
      serviceIdentificationFromEvaluation(
        {
          factualAccuracy: 100,
          completeness: 0,
          factResults: [
            {
              factKey: "service_definition",
              status: "NOT_MENTIONED",
              reason: "서비스 정의가 답변에 없습니다.",
            },
          ],
        },
        {
          hasServiceDefinition: true,
          targetDomainCited: false,
          answerText:
            "정확히는 PostDrafter라는 서비스를 확인하지 못했습니다.",
        },
      ),
    ).toBe(false);
  });

  it("서비스 정의 평가가 없으면 식별 상태를 미측정으로 유지한다", () => {
    expect(
      serviceIdentificationFromEvaluation({
        factResults: [
          {
            factKey: "primary_features",
            status: "SUPPORTED",
            reason: "일부 기능 일치",
          },
        ],
      }),
    ).toBeNull();
  });
});
