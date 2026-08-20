import type {
  PublicDeepAnswerRun,
  PublicDeepAnswerSummary,
  PublicFactEvaluationItem,
  PublicFactEvaluationStatus,
} from "../deep-diagnostics/deep-diagnostic-admin-service";
import type { RenderedDomImprovementPlan } from "../scans/scan-result-pdf";

export const AI_ANSWER_IMPROVEMENT_PLAN_CODES = [
  "AI-SERVICE-IDENTIFICATION",
  "AI-DOMAIN-CITATION",
  "AI-FACT-CORRECTION",
  "AI-MISSING-CORE-INFO",
] as const;

export type AiAnswerImprovementPlanCode =
  (typeof AI_ANSWER_IMPROVEMENT_PLAN_CODES)[number];

export function isAiAnswerImprovementPlanCode(
  value: string,
): value is AiAnswerImprovementPlanCode {
  return (AI_ANSWER_IMPROVEMENT_PLAN_CODES as readonly string[]).includes(
    value,
  );
}

function allFactItems(
  runs: readonly PublicDeepAnswerRun[],
): PublicFactEvaluationItem[] {
  return runs
    .filter((run) => run.serviceIdentified === true)
    .flatMap((run) => run.factualEvaluation?.factResults ?? []);
}

function factsByStatus(
  facts: readonly PublicFactEvaluationItem[],
  status: PublicFactEvaluationStatus,
): PublicFactEvaluationItem[] {
  return facts.filter((fact) => fact.status === status);
}

function uniqueLabels(facts: readonly PublicFactEvaluationItem[]): string[] {
  return [...new Set(facts.map((fact) => fact.label))];
}

const VERIFICATION_NOTE = {
  ko: "이 항목은 자동으로 재검증되지 않습니다. 사이트의 정밀진단(DEEP, ChatGPT 실측) 페이지에서 진단을 다시 실행해 직접 결과를 확인해 주세요.",
  en: "This item is not verified automatically. Re-run the DEEP diagnostic (ChatGPT-based) on the site's precision diagnostic page to confirm the result yourself.",
} as const;

/**
 * DEEP(ChatGPT 실측) 진단 결과를 작업지시서에 넣을 수 있는 개선안 형태로 변환합니다.
 * 반복 실행 횟수 부족(consistency 미측정)은 사이트 콘텐츠로 고칠 수 있는 항목이 아니라서
 * 여기서는 제외하고, DeepDiagnosticResults 화면의 안내에만 남겨둡니다.
 */
export function buildAiAnswerImprovementPlans(
  summary: PublicDeepAnswerSummary,
  runs: readonly PublicDeepAnswerRun[],
  locale: "ko" | "en" = "ko",
): RenderedDomImprovementPlan[] {
  const isEnglish = locale === "en";
  const facts = allFactItems(runs);
  const plans: RenderedDomImprovementPlan[] = [];

  if (
    summary.serviceIdentificationRate !== null &&
    summary.serviceIdentificationRate < 100
  ) {
    const rate = Math.round(summary.serviceIdentificationRate);

    plans.push({
      code: "AI-SERVICE-IDENTIFICATION",
      title: isEnglish
        ? "Make the brand and service identity clearer to AI"
        : "브랜드와 서비스 정체성을 더 분명하게 공개하세요",
      currentState: isEnglish
        ? `ChatGPT correctly identified the target service in only ${rate}% of test answers.`
        : `ChatGPT 실측 답변 중 대상 서비스를 정확히 식별한 비율이 ${rate}%에 그쳤습니다.`,
      meaning: isEnglish
        ? "AI may be confusing the site with a similarly named service, or may not be able to confirm the exact target service."
        : "AI가 이름이 비슷한 다른 서비스로 오인했거나 정확한 대상을 확인하지 못했을 수 있습니다.",
      change: isEnglish
        ? "State the brand name together with the service definition wherever AI is most likely to read first."
        : "AI가 가장 먼저 읽을 가능성이 높은 위치에 브랜드명과 서비스 정의를 함께 명시해야 합니다.",
      developerInstructions: isEnglish
        ? [
            "Show the brand name together with the service definition in the page title, H1, and first paragraph.",
            "Use the same brand naming consistently across the intro, features, pricing, and contact pages.",
            "State unique features and features you do NOT provide, to reduce confusion with similar services.",
            VERIFICATION_NOTE.en,
          ]
        : [
            "페이지 제목·H1·첫 문단에 브랜드명과 서비스 정의를 함께 표시",
            "소개·기능·요금·문의 페이지에서 동일한 브랜드 표기 사용",
            "다른 서비스와 구분되는 고유 기능과 제공하지 않는 기능 명시",
            VERIFICATION_NOTE.ko,
          ],
      acceptanceCriteria: isEnglish
        ? [
            "The brand name and service definition appear together in the initial HTML.",
            "The service's unique features and out-of-scope features are stated on the site.",
          ]
        : [
            "초기 HTML에 브랜드명과 서비스 정의가 함께 노출된다.",
            "서비스의 고유 기능과 제공하지 않는 기능이 사이트에 명시된다.",
          ],
    });
  }

  if (
    summary.targetCitationRate !== null &&
    summary.targetCitationRate < 100
  ) {
    const rate = Math.round(summary.targetCitationRate);

    plans.push({
      code: "AI-DOMAIN-CITATION",
      title: isEnglish
        ? "Strengthen why AI would cite the official site as its source"
        : "공식 사이트가 답변 출처로 선택될 근거를 강화하세요",
      currentState: isEnglish
        ? `ChatGPT cited the registered official domain as a source in only ${rate}% of test answers.`
        : `ChatGPT 실측 답변 중 등록된 공식 도메인을 출처로 인용한 비율이 ${rate}%에 그쳤습니다.`,
      meaning: isEnglish
        ? "AI's web-search answers are not directly citing the official domain."
        : "AI 답변이 등록된 공식 도메인을 답변 근거로 직접 인용하지 않았습니다.",
      change: isEnglish
        ? "Publish key answers as readable initial HTML on independent, easy-to-find URLs."
        : "핵심 답변을 초기 HTML에서 읽을 수 있는 독립 URL로 공개해야 합니다.",
      developerInstructions: isEnglish
        ? [
            "Provide key answer content as readable text in the initial HTML, not only after client-side rendering.",
            "Publish intro, FAQ, pricing, and privacy-policy content on independent URLs.",
            "Write each page's title and description as sentences that directly answer likely questions.",
            VERIFICATION_NOTE.en,
          ]
        : [
            "핵심 답변을 초기 HTML의 읽을 수 있는 본문으로 제공",
            "소개·FAQ·요금·개인정보 처리 내용을 독립 URL로 공개",
            "페이지별 제목과 설명을 질문에 바로 답하는 문장으로 작성",
            VERIFICATION_NOTE.ko,
          ],
      acceptanceCriteria: isEnglish
        ? [
            "Intro, FAQ, pricing, and privacy-policy content are published on independent URLs.",
            "Key answer content is present as readable text in the initial HTML.",
          ]
        : [
            "소개·FAQ·요금·개인정보 처리 내용이 독립 URL로 공개되어 있다.",
            "핵심 답변 내용이 초기 HTML에서 읽을 수 있는 텍스트로 존재한다.",
          ],
    });
  }

  const contradicted = factsByStatus(facts, "CONTRADICTED");

  if (contradicted.length > 0) {
    const labels = uniqueLabels(contradicted);

    plans.push({
      code: "AI-FACT-CORRECTION",
      title: isEnglish
        ? "Correct information AI is describing incorrectly"
        : "잘못 알려진 기능과 범위를 바로잡으세요",
      currentState: isEnglish
        ? `ChatGPT's answers contained information that contradicts the registered facts for: ${labels.join(", ")}.`
        : `ChatGPT 답변에 다음 항목에서 등록 기준정보와 충돌하는 설명이 포함됐습니다: ${labels.join(", ")}.`,
      meaning: isEnglish
        ? "AI answers include claims that conflict with the facts registered for this site."
        : "AI 답변에 등록 기준정보와 충돌하는 설명이 포함됐습니다.",
      change: isEnglish
        ? "Clarify what the site actually provides and does not provide for the listed items."
        : "위 항목에 대해 실제로 제공하는 것과 제공하지 않는 것을 명확히 구분해야 합니다.",
      developerInstructions: isEnglish
        ? [
            "Clearly separate features actually provided from features not provided on the same page.",
            "Clarify items that are easy to misunderstand, such as automation, pricing, or the operating entity.",
            "Update outdated third-party descriptions and search-exposed copy where possible.",
            VERIFICATION_NOTE.en,
          ]
        : [
            "실제 제공 기능과 제공하지 않는 기능을 같은 페이지에서 구분",
            "자동 게시·가격·운영 주체처럼 오인하기 쉬운 항목 명시",
            "오래된 외부 소개 글과 검색 노출 문구 최신화",
            VERIFICATION_NOTE.ko,
          ],
      acceptanceCriteria: isEnglish
        ? [
            `The current, accurate description for ${labels.join(", ")} is published on the site.`,
          ]
        : [`${labels.join(", ")}에 대한 현재 기준 정확한 설명이 사이트에 공개되어 있다.`],
    });
  }

  const missing = factsByStatus(facts, "NOT_MENTIONED");

  if (missing.length > 0) {
    const labels = uniqueLabels(missing);

    plans.push({
      code: "AI-MISSING-CORE-INFO",
      title: isEnglish
        ? "Add core information AI's answers are missing"
        : "답변에서 빠진 핵심 정보를 공개 콘텐츠에 보완하세요",
      currentState: isEnglish
        ? `The registered facts for the following were not reflected in ChatGPT's answers: ${labels.join(", ")}.`
        : `다음 등록 기준정보가 ChatGPT 답변에 포함되지 않았습니다: ${labels.join(", ")}.`,
      meaning: isEnglish
        ? "AI could not find this information in publicly readable content."
        : "AI가 공개된 읽을 수 있는 콘텐츠에서 해당 정보를 찾지 못했습니다.",
      change: isEnglish
        ? "Present the missing information as short, direct question-and-answer style content."
        : "빠진 정보를 짧은 문답 형태의 직접적인 콘텐츠로 제공해야 합니다.",
      developerInstructions: isEnglish
        ? [
            "Add short question-and-answer style content covering target audience and usage steps.",
            "Make key features, supported environment, pricing, and contact information easy to find.",
            "Use verifiable factual sentences instead of vague marketing copy.",
            VERIFICATION_NOTE.en,
          ]
        : [
            "이용 대상과 이용 절차를 짧은 문답 형태로 추가",
            "주요 기능·지원 환경·요금·문의 방법을 쉽게 찾도록 구성",
            "모호한 홍보 문구 대신 검증 가능한 사실 문장 사용",
            VERIFICATION_NOTE.ko,
          ],
      acceptanceCriteria: isEnglish
        ? [`Content covering ${labels.join(", ")} is published in the initial HTML.`]
        : [`${labels.join(", ")}에 해당하는 내용이 초기 HTML에 공개되어 있다.`],
    });
  }

  return plans;
}
