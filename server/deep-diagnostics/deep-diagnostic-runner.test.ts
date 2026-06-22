import { describe, expect, it } from "vitest";
import {
  answerMentionsBrand,
  citesTargetDomain,
  consistencySignature,
} from "./deep-diagnostic-runner";

describe("deep diagnostic automatic metrics", () => {
  it("공백과 문장부호 차이가 있어도 브랜드 언급을 찾는다", () => {
    expect(
      answerMentionsBrand(
        "Post Drafter는 블로그 초안 서비스입니다.",
        "PostDrafter",
      ),
    ).toBe(true);
  });

  it("브랜드가 답변에 없으면 언급으로 계산하지 않는다", () => {
    expect(
      answerMentionsBrand(
        "사진으로 글을 만드는 서비스가 있습니다.",
        "PostDrafter",
      ),
    ).toBe(false);
  });

  it("대상 도메인과 하위 도메인 인용을 찾는다", () => {
    expect(
      citesTargetDomain(
        [
          {
            url: "https://www.example.com/guide",
            title: null,
            startIndex: null,
            endIndex: null,
          },
        ],
        [],
        "https://example.com/",
      ),
    ).toBe(true);
  });

  it("대상 사이트와 무관한 출처만 있으면 인용되지 않은 것으로 판정한다", () => {
    expect(
      citesTargetDomain(
        [
          {
            url: "https://deepwiki.com/unrelated",
            title: null,
            startIndex: null,
            endIndex: null,
          },
        ],
        [],
        "https://postdrafter.com/",
      ),
    ).toBe(false);
  });

  it("핵심 판정이 같으면 문장 표현이 달라도 같은 일관성 서명을 만든다", () => {
    const first = consistencySignature({
      brandMentioned: true,
      targetDomainCited: false,
      evaluation: {
        factResults: [
          {
            factKey: "service_definition",
            status: "SUPPORTED",
            reason: "일치",
          },
        ],
        factualAccuracy: 90,
        completeness: 80,
        summary: "요약 1",
        usage: {
          inputTokens: null,
          outputTokens: null,
        },
      },
    });
    const second = consistencySignature({
      brandMentioned: true,
      targetDomainCited: false,
      evaluation: {
        factResults: [
          {
            factKey: "service_definition",
            status: "SUPPORTED",
            reason: "다른 설명",
          },
        ],
        factualAccuracy: 85,
        completeness: 75,
        summary: "요약 2",
        usage: {
          inputTokens: null,
          outputTokens: null,
        },
      },
    });

    expect(first).toBe(second);
  });
});
