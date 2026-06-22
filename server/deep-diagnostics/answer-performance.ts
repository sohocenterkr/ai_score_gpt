export const ANSWER_PERFORMANCE_METHODOLOGY_VERSION =
  "2026.06-ai-answer-v4";

export type AnswerPerformanceRunStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIAL"
  | "FAILED";

export interface AnswerPerformanceRun {
  questionCode: string;
  status: AnswerPerformanceRunStatus;
  brandMentioned: boolean | null;
  serviceIdentified?: boolean | null;
  targetDomainCited: boolean | null;
  factualAccuracy: number | null;
  completeness: number | null;
  supportedFactCount?: number;
  contradictedFactCount?: number;
  consistencySignature?: string | null;
}

export interface AnswerPerformanceSummary {
  methodologyVersion: string;
  plannedQuestionCount: number;
  completedQuestionCount: number;
  totalRunCount: number;
  completedRunCount: number;
  partialRunCount: number;
  failedRunCount: number;
  answerCompletionRate: number | null;
  brandMentionRate: number | null;
  targetCitationRate: number | null;
  factualAccuracy: number | null;
  completeness: number | null;
  consistency: number | null;
  serviceIdentificationRate: number | null;
  performanceScore: number | null;
  scoreCoverage: number;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function percent(numerator: number, denominator: number): number | null {
  return denominator > 0
    ? roundOne(clampPercent((numerator / denominator) * 100))
    : null;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return roundOne(
    values.reduce((total, value) => total + clampPercent(value), 0) /
      values.length,
  );
}

function consistencyPercent(
  completedRuns: readonly AnswerPerformanceRun[],
): number | null {
  const grouped = new Map<string, string[]>();

  for (const run of completedRuns) {
    const signature = run.consistencySignature?.trim();

    if (!signature) {
      continue;
    }

    const values = grouped.get(run.questionCode) ?? [];
    values.push(signature);
    grouped.set(run.questionCode, values);
  }

  const questionConsistency: number[] = [];

  for (const signatures of grouped.values()) {
    if (signatures.length < 2) {
      continue;
    }

    const frequencies = new Map<string, number>();

    for (const signature of signatures) {
      frequencies.set(signature, (frequencies.get(signature) ?? 0) + 1);
    }

    const mostCommon = Math.max(...frequencies.values());
    questionConsistency.push((mostCommon / signatures.length) * 100);
  }

  return average(questionConsistency);
}

export function calculateAnswerPerformance(
  runs: readonly AnswerPerformanceRun[],
): AnswerPerformanceSummary {
  const plannedQuestions = new Set(runs.map((run) => run.questionCode));
  const completedRuns = runs.filter((run) => run.status === "COMPLETED");
  const completedQuestions = new Set(
    completedRuns.map((run) => run.questionCode),
  );
  const partialRunCount = runs.filter(
    (run) => run.status === "PARTIAL",
  ).length;
  const failedRunCount = runs.filter(
    (run) => run.status === "FAILED",
  ).length;

  const brandMentionRate = percent(
    completedRuns.filter((run) => run.brandMentioned === true).length,
    completedRuns.length,
  );
  const brandCreditRate = percent(
    completedRuns.filter(
      (run) =>
        run.brandMentioned === true &&
        run.serviceIdentified === true,
    ).length,
    completedRuns.length,
  );
  const targetCitationRate = percent(
    completedRuns.filter((run) => run.targetDomainCited === true).length,
    completedRuns.length,
  );
  const measuredIdentificationRuns = completedRuns.filter(
    (run) =>
      run.serviceIdentified !== null &&
      run.serviceIdentified !== undefined,
  );
  const serviceIdentificationRate = percent(
    measuredIdentificationRuns.filter(
      (run) => run.serviceIdentified === true,
    ).length,
    measuredIdentificationRuns.length,
  );
  const identifiedRuns = completedRuns.filter(
    (run) => run.serviceIdentified === true,
  );

  const factualAccuracy = average(
    identifiedRuns
      .filter((run) => {
        const hasCountInformation =
          run.supportedFactCount !== undefined ||
          run.contradictedFactCount !== undefined;

        if (!hasCountInformation) {
          return true;
        }

        return (
          (run.supportedFactCount ?? 0) +
            (run.contradictedFactCount ?? 0) >
          0
        );
      })
      .map((run) => run.factualAccuracy)
      .filter((value): value is number => value !== null),
  );

  const completeness = average(
    identifiedRuns
      .map((run) => run.completeness)
      .filter((value): value is number => value !== null),
  );

  const consistency = consistencyPercent(identifiedRuns);

  const weightedMetrics: Array<{
    value: number | null;
    weight: number;
  }> = [
    { value: brandCreditRate, weight: 15 },
    { value: targetCitationRate, weight: 30 },
    { value: factualAccuracy, weight: 30 },
    { value: completeness, weight: 15 },
    { value: consistency, weight: 10 },
  ];

  const availableWeight = weightedMetrics
    .filter((metric) => metric.value !== null)
    .reduce((total, metric) => total + metric.weight, 0);

  const allMeasuredRunsMisidentified =
    completedRuns.length > 0 &&
    measuredIdentificationRuns.length === completedRuns.length &&
    measuredIdentificationRuns.every(
      (run) => run.serviceIdentified === false,
    );

  const rawPerformanceScore =
    allMeasuredRunsMisidentified
      ? 0
      : completedRuns.length > 0 &&
          completeness !== null &&
          availableWeight > 0
        ? roundOne(
            weightedMetrics.reduce(
              (total, metric) =>
                total + (metric.value ?? 0) * metric.weight,
              0,
            ) / availableWeight,
          )
        : null;

  let performanceScore = rawPerformanceScore;

  if (performanceScore !== null) {
    if (completeness === 0) {
      performanceScore = Math.min(performanceScore, 20);
    }

    if (serviceIdentificationRate === 0) {
      performanceScore = Math.min(performanceScore, 30);
    }

    if (
      serviceIdentificationRate === null &&
      targetCitationRate === 0
    ) {
      performanceScore = Math.min(performanceScore, 50);
    }

    performanceScore = roundOne(performanceScore);
  }

  return {
    methodologyVersion: ANSWER_PERFORMANCE_METHODOLOGY_VERSION,
    plannedQuestionCount: plannedQuestions.size,
    completedQuestionCount: completedQuestions.size,
    totalRunCount: runs.length,
    completedRunCount: completedRuns.length,
    partialRunCount,
    failedRunCount,
    answerCompletionRate: percent(
      completedQuestions.size,
      plannedQuestions.size,
    ),
    brandMentionRate,
    targetCitationRate,
    factualAccuracy,
    completeness,
    consistency,
    serviceIdentificationRate,
    performanceScore,
    scoreCoverage: roundOne(availableWeight),
  };
}
