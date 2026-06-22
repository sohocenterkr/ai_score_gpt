import { createHash } from "node:crypto";
import {
  Prisma,
  type AiAnswerRun,
  type AiQuestion,
  type SiteFact,
} from "@prisma/client";
import { env } from "../config/env";
import { getDatabase } from "../db";
import {
  calculateAnswerPerformance,
} from "./answer-performance";
import {
  answerExplicitlyDoesNotIdentifyTarget,
} from "./deep-answer-trust";
import {
  createOpenAiResponsesClient,
  OpenAiResponsesError,
  type OpenAiCitation,
  type OpenAiFactEvaluation,
  type OpenAiResponsesClient,
  type OpenAiSource,
} from "./openai-responses-client";

export interface DeepAnswerRunResult {
  scanId: string;
  status: "COMPLETED" | "PARTIAL";
  errorCode: string | null;
}

export class DeepDiagnosticRunnerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DeepDiagnosticRunnerError";
  }
}

function compact(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function answerMentionsBrand(
  answerText: string,
  siteName: string,
): boolean {
  const answer = compact(answerText);
  const brand = compact(siteName);

  return brand.length >= 2 && answer.includes(brand);
}

function normalizedHost(value: string): string | null {
  try {
    return new URL(value).hostname
      .toLocaleLowerCase()
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sameDomain(candidate: string, target: string): boolean {
  const candidateHost = normalizedHost(candidate);
  const targetHost = normalizedHost(target);

  if (!candidateHost || !targetHost) {
    return false;
  }

  return (
    candidateHost === targetHost ||
    candidateHost.endsWith(`.${targetHost}`) ||
    targetHost.endsWith(`.${candidateHost}`)
  );
}

export function citesTargetDomain(
  citations: readonly OpenAiCitation[],
  sources: readonly OpenAiSource[],
  siteUrl: string,
): boolean {
  return [...citations, ...sources].some((item) =>
    sameDomain(item.url, siteUrl),
  );
}

function jsonFactKeys(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function factValue(fact: SiteFact): string {
  if (typeof fact.expectedValue === "string") {
    return fact.expectedValue;
  }

  if (Array.isArray(fact.expectedValue)) {
    return fact.expectedValue
      .filter((item): item is string => typeof item === "string")
      .join("\n");
  }

  return JSON.stringify(fact.expectedValue);
}

function factsForQuestion(
  question: AiQuestion,
  facts: readonly SiteFact[],
): Record<string, string> {
  const expected = new Set(jsonFactKeys(question.expectedFactKeys));

  return Object.fromEntries(
    facts
      .filter((fact) => expected.has(fact.factKey))
      .map((fact) => [fact.factKey, factValue(fact)]),
  );
}

export function consistencySignature(input: {
  brandMentioned: boolean;
  targetDomainCited: boolean;
  evaluation: OpenAiFactEvaluation | null;
}): string {
  const factStatuses =
    input.evaluation?.factResults
      .map((item) => `${item.factKey}:${item.status}`)
      .sort() ?? [];

  return createHash("sha256")
    .update(
      JSON.stringify({
        brandMentioned: input.brandMentioned,
        targetDomainCited: input.targetDomainCited,
        factStatuses,
      }),
    )
    .digest("hex");
}

function runnerClient(): OpenAiResponsesClient {
  if (!env.OPENAI_API_KEY) {
    throw new DeepDiagnosticRunnerError(
      "OPENAI_NOT_CONFIGURED",
      "OPENAI_API_KEY가 설정되지 않았습니다.",
    );
  }

  return createOpenAiResponsesClient({
    apiKey: env.OPENAI_API_KEY,
    searchModel: env.OPENAI_WEB_SEARCH_MODEL,
    evaluationModel: env.OPENAI_EVALUATION_MODEL,
    timeoutMs: env.OPENAI_TIMEOUT_MS,
  });
}

function errorDetails(error: unknown): {
  code: string;
  message: string;
} {
  if (
    error instanceof OpenAiResponsesError ||
    error instanceof DeepDiagnosticRunnerError
  ) {
    return {
      code: error.code,
      message: error.message.slice(0, 1_000),
    };
  }

  return {
    code: "DEEP_ANSWER_INTERNAL_ERROR",
    message: "AI 답변 테스트를 처리하는 중 내부 오류가 발생했습니다.",
  };
}

function serviceIdentifiedForPerformance(
  evaluation: OpenAiFactEvaluation | null,
  expectedFactsSnapshot: Prisma.JsonValue,
  targetDomainCited: boolean | null,
  answerText: string | null,
): boolean | null {
  if (
    !evaluation ||
    !expectedFactsSnapshot ||
    typeof expectedFactsSnapshot !== "object" ||
    Array.isArray(expectedFactsSnapshot) ||
    !Object.prototype.hasOwnProperty.call(
      expectedFactsSnapshot,
      "service_definition",
    )
  ) {
    return null;
  }

  if (
    targetDomainCited === false &&
    answerExplicitlyDoesNotIdentifyTarget(answerText)
  ) {
    return false;
  }

  const serviceDefinition = evaluation.factResults.find(
    (item) => item.factKey === "service_definition",
  );

  if (serviceDefinition?.status === "SUPPORTED") {
    return true;
  }

  if (serviceDefinition?.status === "CONTRADICTED") {
    return false;
  }

  if (
    targetDomainCited === false &&
    evaluation.factualAccuracy < 50 &&
    evaluation.factResults.some(
      (item) => item.status === "CONTRADICTED",
    )
  ) {
    return false;
  }

  return null;
}

function evaluationFromJson(
  value: Prisma.JsonValue | null,
): OpenAiFactEvaluation | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const factualAccuracy =
    typeof record.factualAccuracy === "number"
      ? record.factualAccuracy
      : null;
  const completeness =
    typeof record.completeness === "number"
      ? record.completeness
      : null;

  if (factualAccuracy === null || completeness === null) {
    return null;
  }

  return {
    factResults: Array.isArray(record.factResults)
      ? (record.factResults as OpenAiFactEvaluation["factResults"])
      : [],
    factualAccuracy,
    completeness,
    summary:
      typeof record.summary === "string" ? record.summary : "",
    usage: {
      inputTokens: null,
      outputTokens: null,
    },
  };
}

async function prepareRuns(
  scanId: string,
  questions: readonly AiQuestion[],
  facts: readonly SiteFact[],
): Promise<void> {
  const prisma = getDatabase();

  await prisma.$transaction(async (transaction) => {
    await transaction.aiAnswerRun.deleteMany({
      where: { scanId },
    });
    await transaction.aiAnswerSummary.deleteMany({
      where: { scanId },
    });

    for (const question of questions) {
      const snapshot = factsForQuestion(question, facts);

      for (
        let runNumber = 1;
        runNumber <= env.DEEP_DIAGNOSTIC_RUNS_PER_QUESTION;
        runNumber += 1
      ) {
        await transaction.aiAnswerRun.create({
          data: {
            scanId,
            questionId: question.id,
            runNumber,
            questionCode: question.code,
            questionKind: question.kind,
            questionText: question.question,
            expectedFactsSnapshot:
              snapshot as Prisma.InputJsonValue,
            provider: "OPENAI",
            model: env.OPENAI_WEB_SEARCH_MODEL,
            status: "QUEUED",
          },
        });
      }
    }
  });
}

async function executeRun(
  run: AiAnswerRun,
  site: {
    name: string;
    baseUrl: string;
    primaryLocale: string;
  },
  client: OpenAiResponsesClient,
): Promise<void> {
  const prisma = getDatabase();
  const startedAt = new Date();

  await prisma.aiAnswerRun.update({
    where: { id: run.id },
    data: {
      status: "RUNNING",
      startedAt,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });

  try {
    const facts =
      run.expectedFactsSnapshot &&
      typeof run.expectedFactsSnapshot === "object" &&
      !Array.isArray(run.expectedFactsSnapshot)
        ? (run.expectedFactsSnapshot as Record<string, string>)
        : {};

    if (Object.keys(facts).length === 0) {
      await prisma.aiAnswerRun.update({
        where: { id: run.id },
        data: {
          status: "PARTIAL",
          errorCode: "DEEP_FACTS_NOT_CONNECTED",
          errorMessage:
            "이 질문에 연결된 사이트 기준정보가 없어 웹 답변과 사실 평가를 실행하지 않았습니다.",
          completedAt: new Date(),
        },
      });
      return;
    }

    const answer = await client.search(
      run.questionText,
      site.primaryLocale,
    );
    const brandMentioned = answerMentionsBrand(
      answer.answerText,
      site.name,
    );
    const targetDomainCited = citesTargetDomain(
      answer.citations,
      answer.sources,
      site.baseUrl,
    );

    let evaluation: OpenAiFactEvaluation | null = null;
    let evaluationError: { code: string; message: string } | null = null;

    try {
      evaluation = await client.evaluate(
        answer.answerText,
        facts,
      );
    } catch (error) {
      evaluationError = errorDetails(error);
    }

    const completedAt = new Date();
    const inputTokens =
      (answer.usage.inputTokens ?? 0) +
      (evaluation?.usage.inputTokens ?? 0);
    const outputTokens =
      (answer.usage.outputTokens ?? 0) +
      (evaluation?.usage.outputTokens ?? 0);

    await prisma.aiAnswerRun.update({
      where: { id: run.id },
      data: {
        status: evaluationError ? "PARTIAL" : "COMPLETED",
        responseId: answer.responseId,
        answerText: answer.answerText,
        answerSha256: createHash("sha256")
          .update(answer.answerText)
          .digest("hex"),
        brandMentioned,
        targetDomainCited,
        citationsJson:
          answer.citations as unknown as Prisma.InputJsonValue,
        sourcesJson:
          answer.sources as unknown as Prisma.InputJsonValue,
        automaticMetricsJson: {
          webSearchUsed: true,
          citationCount: answer.citations.length,
          sourceCount: answer.sources.length,
          brandMentioned,
          targetDomainCited,
        },
        factualEvaluationJson:
          evaluation as unknown as Prisma.InputJsonValue,
        consistencySignature: consistencySignature({
          brandMentioned,
          targetDomainCited,
          evaluation,
        }),
        inputTokens: inputTokens || null,
        outputTokens: outputTokens || null,
        errorCode: evaluationError?.code ?? null,
        errorMessage: evaluationError?.message ?? null,
        completedAt,
      },
    });
  } catch (error) {
    const details = errorDetails(error);

    await prisma.aiAnswerRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorCode: details.code,
        errorMessage: details.message,
        completedAt: new Date(),
      },
    });
  }
}

export async function runDeepAnswerDiagnostic(
  scanId: string,
  client: OpenAiResponsesClient = runnerClient(),
): Promise<DeepAnswerRunResult> {
  const prisma = getDatabase();
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      site: {
        include: {
          facts: true,
          aiQuestions: {
            where: { status: "ACTIVE" },
            orderBy: [
              { isRequired: "desc" },
              { sortOrder: "asc" },
              { createdAt: "asc" },
            ],
            take: env.DEEP_DIAGNOSTIC_MAX_QUESTIONS,
          },
        },
      },
    },
  });

  if (!scan || scan.type !== "DEEP") {
    throw new DeepDiagnosticRunnerError(
      "DEEP_SCAN_NOT_FOUND",
      "실행할 DEEP 검사 작업을 찾을 수 없습니다.",
    );
  }

  const questions = scan.site.aiQuestions;

  if (questions.length === 0) {
    throw new DeepDiagnosticRunnerError(
      "DEEP_QUESTIONS_REQUIRED",
      "활성화된 AI 테스트 질문이 없습니다.",
    );
  }

  await prepareRuns(scanId, questions, scan.site.facts);

  const queuedRuns = await prisma.aiAnswerRun.findMany({
    where: { scanId },
    orderBy: [
      { questionCode: "asc" },
      { runNumber: "asc" },
    ],
  });

  for (const run of queuedRuns) {
    await executeRun(
      run,
      {
        name: scan.site.name,
        baseUrl: scan.site.baseUrl,
        primaryLocale: scan.site.primaryLocale,
      },
      client,
    );
  }

  const completedRuns = await prisma.aiAnswerRun.findMany({
    where: { scanId },
    orderBy: [
      { questionCode: "asc" },
      { runNumber: "asc" },
    ],
  });

  const performance = calculateAnswerPerformance(
    completedRuns.map((run) => {
      const evaluation = evaluationFromJson(
        run.factualEvaluationJson,
      );

      return {
        questionCode: run.questionCode,
        status: run.status,
        brandMentioned: run.brandMentioned,
        serviceIdentified: serviceIdentifiedForPerformance(
          evaluation,
          run.expectedFactsSnapshot,
          run.targetDomainCited,
          run.answerText,
        ),
        targetDomainCited: run.targetDomainCited,
        factualAccuracy: evaluation?.factualAccuracy ?? null,
        completeness: evaluation?.completeness ?? null,
        supportedFactCount:
          evaluation?.factResults.filter(
            (item) => item.status === "SUPPORTED",
          ).length ?? 0,
        contradictedFactCount:
          evaluation?.factResults.filter(
            (item) => item.status === "CONTRADICTED",
          ).length ?? 0,
        consistencySignature: run.consistencySignature,
      };
    }),
  );

  await prisma.aiAnswerSummary.upsert({
    where: { scanId },
    create: {
      scanId,
      provider: "OPENAI",
      model: env.OPENAI_WEB_SEARCH_MODEL,
      methodologyVersion: performance.methodologyVersion,
      plannedQuestionCount: performance.plannedQuestionCount,
      completedQuestionCount: performance.completedQuestionCount,
      totalRunCount: performance.totalRunCount,
      completedRunCount: performance.completedRunCount,
      partialRunCount: performance.partialRunCount,
      failedRunCount: performance.failedRunCount,
      answerCompletionRate: performance.answerCompletionRate,
      brandMentionRate: performance.brandMentionRate,
      targetCitationRate: performance.targetCitationRate,
      factualAccuracy: performance.factualAccuracy,
      completeness: performance.completeness,
      consistency: performance.consistency,
      performanceScore: performance.performanceScore,
      scoreCoverage: performance.scoreCoverage,
    },
    update: {
      provider: "OPENAI",
      model: env.OPENAI_WEB_SEARCH_MODEL,
      methodologyVersion: performance.methodologyVersion,
      plannedQuestionCount: performance.plannedQuestionCount,
      completedQuestionCount: performance.completedQuestionCount,
      totalRunCount: performance.totalRunCount,
      completedRunCount: performance.completedRunCount,
      partialRunCount: performance.partialRunCount,
      failedRunCount: performance.failedRunCount,
      answerCompletionRate: performance.answerCompletionRate,
      brandMentionRate: performance.brandMentionRate,
      targetCitationRate: performance.targetCitationRate,
      factualAccuracy: performance.factualAccuracy,
      completeness: performance.completeness,
      consistency: performance.consistency,
      performanceScore: performance.performanceScore,
      scoreCoverage: performance.scoreCoverage,
    },
  });

  const hasNonCompleted = completedRuns.some(
    (run) => run.status !== "COMPLETED",
  );

  return {
    scanId,
    status: hasNonCompleted ? "PARTIAL" : "COMPLETED",
    errorCode: hasNonCompleted ? "DEEP_ANSWER_PARTIAL" : null,
  };
}
