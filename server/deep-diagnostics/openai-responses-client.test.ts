import { describe, expect, it } from "vitest";
import {
  parseEvaluationResponse,
  parseWebSearchResponse,
  validateFactEvaluationKeys,
  WEB_SEARCH_DEVELOPER_PROMPT,
} from "./openai-responses-client";

describe("OpenAI Responses parser", () => {
  it("정확한 대상을 찾지 못해도 이미 등록된 링크를 다시 요청하지 않도록 지시한다", () => {
    expect(WEB_SEARCH_DEVELOPER_PROMPT).toContain(
      "검사 대상 URL을 이미 등록",
    );
    expect(WEB_SEARCH_DEVELOPER_PROMPT).toContain(
      "사용자에게 링크를 달라고 요청하거나",
    );
    expect(WEB_SEARCH_DEVELOPER_PROMPT).toContain(
      "한 문장만 언급",
    );
    expect(WEB_SEARCH_DEVELOPER_PROMPT).toContain(
      "목록이나 여러 문단으로 자세히 설명하지 마세요",
    );
    expect(WEB_SEARCH_DEVELOPER_PROMPT).not.toContain(
      "정확한 링크를 제공하면 다시 확인",
    );
  });

  it("웹 답변·인용·전체 검색 출처·토큰을 분리한다", () => {
    const result = parseWebSearchResponse({
      id: "resp-1",
      usage: {
        input_tokens: 120,
        output_tokens: 80,
      },
      output: [
        {
          type: "web_search_call",
          action: {
            sources: [
              {
                type: "url",
                url: "https://example.com/about",
                title: "Example",
              },
            ],
          },
        },
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: "Example은 테스트 서비스입니다.",
              annotations: [
                {
                  type: "url_citation",
                  url: "https://example.com/about",
                  title: "Example",
                  start_index: 0,
                  end_index: 7,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      responseId: "resp-1",
      answerText: "Example은 테스트 서비스입니다.",
      citations: [
        {
          url: "https://example.com/about",
          title: "Example",
          startIndex: 0,
          endIndex: 7,
        },
      ],
      sources: [
        {
          url: "https://example.com/about",
          title: "Example",
          type: "url",
        },
      ],
      usage: {
        inputTokens: 120,
        outputTokens: 80,
      },
    });
  });

  it("웹 검색 실행 기록이 없으면 결과를 신뢰하지 않는다", () => {
    expect(() =>
      parseWebSearchResponse({
        id: "resp-1",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "검색하지 않은 답변",
              },
            ],
          },
        ],
      }),
    ).toThrow("웹 검색 실행 기록");
  });

  it("사실 평가가 사이트 기준정보 키를 그대로 사용하면 통과한다", () => {
    const evaluation = {
      factResults: [
        {
          factKey: "service_definition",
          status: "SUPPORTED" as const,
          reason: "서비스 정의와 일치합니다.",
        },
        {
          factKey: "primary_features",
          status: "NOT_MENTIONED" as const,
          reason: "주요 기능은 답변에 없습니다.",
        },
      ],
      factualAccuracy: 100,
      completeness: 50,
      summary: "일부만 설명했습니다.",
      usage: {
        inputTokens: null,
        outputTokens: null,
      },
    };

    expect(
      validateFactEvaluationKeys(evaluation, [
        "service_definition",
        "primary_features",
      ]),
    ).toBe(evaluation);
  });

  it("평가기가 기준정보 키 대신 임의의 주장 문구를 만들면 차단한다", () => {
    expect(() =>
      validateFactEvaluationKeys(
        {
          factResults: [
            {
              factKey: "게시 자동화 플랫폼이라는 주장",
              status: "CONTRADICTED",
              reason: "다른 서비스를 설명했습니다.",
            },
          ],
          factualAccuracy: 20,
          completeness: 5,
          summary: "다른 서비스를 설명했습니다.",
          usage: {
            inputTokens: null,
            outputTokens: null,
          },
        },
        ["service_definition"],
      ),
    ).toThrow("사이트 기준정보 키와 일치하지 않습니다");
  });

  it("구조화된 사실 평가 결과를 파싱한다", () => {
    const result = parseEvaluationResponse({
      usage: {
        input_tokens: 90,
        output_tokens: 50,
      },
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                factResults: [
                  {
                    factKey: "service_definition",
                    status: "SUPPORTED",
                    reason: "서비스 정의와 일치합니다.",
                  },
                ],
                factualAccuracy: 95,
                completeness: 80,
                summary: "대체로 정확합니다.",
              }),
            },
          ],
        },
      ],
    });

    expect(result).toMatchObject({
      factualAccuracy: 95,
      completeness: 80,
      summary: "대체로 정확합니다.",
      factResults: [
        {
          factKey: "service_definition",
          status: "SUPPORTED",
        },
      ],
    });
  });
});
