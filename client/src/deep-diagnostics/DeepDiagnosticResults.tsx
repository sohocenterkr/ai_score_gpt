import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type {
  AiQuestionKind,
  DeepAnswerRun,
  DeepDiagnosticSetup,
  DeepFactEvaluationItem,
  FactEvaluationStatus,
} from "./deep-diagnostic-api";

const kindLabels: Record<AiQuestionKind, string> = {
  BRAND: "브랜드 직접 질문",
  DISCOVERY: "비브랜드 탐색 질문",
  FEATURE: "기능·지원 범위",
  USE_CASE: "이용 대상·활용 사례",
  TRUST: "요금·운영·신뢰",
  COMPARISON: "비교·선택",
  CUSTOM: "운영자 직접 질문",
};

const statusLabels: Record<FactEvaluationStatus, string> = {
  SUPPORTED: "AI 답변에서 일치",
  CONTRADICTED: "AI 답변에서 불일치",
  NOT_MENTIONED: "AI 답변에서 미언급",
  UNCLEAR: "AI 답변만으로 판단 어려움",
};

type Summary = NonNullable<
  DeepDiagnosticSetup["execution"]["summary"]
>;

function percentLabel(value: number | null): string {
  return value === null ? "미측정" : `${Math.round(value)}%`;
}

function scoreLabel(value: number | null): string {
  return value === null ? "미측정" : `${Math.round(value)}점`;
}

function displayScore(summary: Summary): number | null {
  if (summary.performanceScore === null) return null;

  const coverage = summary.scoreCoverage;
  if (
    summary.methodologyVersion !== "2026.06-ai-answer-v1" ||
    summary.serviceIdentificationRate === null ||
    summary.brandMentionRate === null ||
    coverage === null ||
    coverage <= 0
  ) {
    return summary.performanceScore;
  }

  const credited = Math.min(
    summary.brandMentionRate,
    summary.serviceIdentificationRate,
  );
  const removed =
    (summary.brandMentionRate - credited) * 15;

  return Math.max(
    0,
    (summary.performanceScore * coverage - removed) / coverage,
  );
}

function scoreMessage(score: number | null): string {
  if (score === null) {
    return "평가가 충분하지 않아 종합점수를 계산하지 않았습니다.";
  }
  if (score >= 80) {
    return "AI가 사이트를 정확하게 찾고 핵심 정보를 안정적으로 설명했습니다.";
  }
  if (score >= 60) {
    return "대체로 식별되지만 일부 사실과 인용을 보완할 필요가 있습니다.";
  }
  if (score >= 30) {
    return "AI가 사이트를 부분적으로만 이해하고 있습니다.";
  }
  return "AI가 사이트를 정확히 식별하거나 설명하지 못했습니다.";
}

function scoreTone(score: number | null): string {
  if (score === null) return "neutral";
  if (score >= 80) return "good";
  if (score >= 60) return "watch";
  return "bad";
}

function renderInline(
  value: string,
  keyPrefix: string,
): ReactNode[] {
  const pattern =
    /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

  return value.split(pattern).map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }

    const link = part.match(
      /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/,
    );

    if (link) {
      return (
        <a
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          key={key}
        >
          {link[1]}
        </a>
      );
    }

    return part;
  });
}

function AnswerText({ text }: { text: string }) {
  return (
    <div className="deep-answer-markdown">
      {text
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line, index) => (
          <p key={`answer-${index}`}>
            {renderInline(line.trim(), `answer-${index}`)}
          </p>
        ))}
    </div>
  );
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) /
        values.length) *
        10,
    ) / 10
  );
}

function groupedRuns(runs: readonly DeepAnswerRun[]) {
  const groups = new Map<
    string,
    {
      code: string;
      kind: AiQuestionKind;
      question: string;
      runs: DeepAnswerRun[];
    }
  >();

  for (const run of runs) {
    const group = groups.get(run.questionCode);
    if (group) {
      group.runs.push(run);
    } else {
      groups.set(run.questionCode, {
        code: run.questionCode,
        kind: run.questionKind,
        question: run.questionText,
        runs: [run],
      });
    }
  }

  return [...groups.values()];
}

function allFactItems(
  runs: readonly DeepAnswerRun[],
): DeepFactEvaluationItem[] {
  return runs
    .filter((run) => run.serviceIdentified === true)
    .flatMap(
      (run) => run.factualEvaluation?.factResults ?? [],
    );
}

function countStatus(
  facts: readonly DeepFactEvaluationItem[],
  status: FactEvaluationStatus,
): number {
  return facts.filter((fact) => fact.status === status).length;
}

function questionOutcome(runs: readonly DeepAnswerRun[]) {
  if (runs.some((run) => run.status === "FAILED")) {
    return { label: "검사 실패", tone: "bad" };
  }
  if (runs.some((run) => run.status === "PARTIAL")) {
    return { label: "일부 완료", tone: "watch" };
  }
  if (runs.some((run) => run.serviceIdentified === false)) {
    return { label: "대상 식별 실패", tone: "bad" };
  }
  if (runs.some((run) => run.serviceIdentified === true)) {
    return { label: "대상 식별 성공", tone: "good" };
  }
  if (
    runs.every(
      (run) =>
        run.serviceIdentified === null ||
        run.serviceIdentified === undefined,
    )
  ) {
    return { label: "대상 식별 미측정", tone: "neutral" };
  }
  return { label: "검사 완료", tone: "neutral" };
}

function FactBadge({
  status,
}: {
  status: FactEvaluationStatus;
}) {
  return (
    <span
      className={`deep-fact-status deep-fact-status-${status.toLowerCase()}`}
    >
      {statusLabels[status]}
    </span>
  );
}

function FactEvaluation({
  items,
}: {
  items: readonly DeepFactEvaluationItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="deep-report-muted">
        기준정보별 판정 결과가 없습니다.
      </p>
    );
  }

  return (
    <div className="deep-fact-evaluation-list">
      {items.map((item, index) => (
        <article
          className="deep-fact-evaluation-item"
          key={`${item.factKey}-${index}`}
        >
          <div>
            <strong>{item.label}</strong>
            <FactBadge status={item.status} />
          </div>
          <p>{item.reason}</p>
          {item.expectedValue ? (
            <details className="deep-expected-fact">
              <summary>비교 기준으로 등록한 정보</summary>
              <pre>{item.expectedValue}</pre>
            </details>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function RunDetail({ run }: { run: DeepAnswerRun }) {
  const evaluation =
    run.serviceIdentified === true
      ? run.factualEvaluation
      : null;
  const wrong =
    evaluation?.factResults.filter(
      (item) => item.status === "CONTRADICTED",
    ) ?? [];
  const missing =
    evaluation?.factResults.filter(
      (item) => item.status === "NOT_MENTIONED",
    ) ?? [];
  const links = new Map<
    string,
    { url: string; title: string | null }
  >();

  for (const link of [...run.citations, ...run.sources]) {
    if (!links.has(link.url)) links.set(link.url, link);
  }

  return (
    <details className="deep-run-result">
      <summary>
        <span>{run.runNumber}회차 실제 답변과 평가</span>
        <span className="deep-answer-summary-meta">
          <strong>
            {run.status === "COMPLETED"
              ? "검사 완료"
              : run.status === "PARTIAL"
                ? "일부 완료"
                : run.status === "FAILED"
                  ? "실패"
                  : "진행 중"}
          </strong>
          <span className="deep-answer-chevron" aria-hidden="true" />
        </span>
      </summary>

      <div className="deep-run-result-body">
        <dl className="deep-run-indicators">
          <div>
            <dt>브랜드명 문자열</dt>
            <dd>
              {run.brandMentioned === null
                ? "미확인"
                : run.brandMentioned
                  ? "언급됨"
                  : "언급되지 않음"}
            </dd>
          </div>
          <div>
            <dt>대상 서비스 식별</dt>
            <dd>
              {run.serviceIdentified === null
                ? "미측정"
                : run.serviceIdentified
                  ? "성공"
                  : "실패"}
            </dd>
          </div>
          <div>
            <dt>공식 사이트 인용</dt>
            <dd>
              {run.targetDomainCited === null
                ? "미확인"
                : run.targetDomainCited
                  ? "인용됨"
                  : "인용되지 않음"}
            </dd>
          </div>
          <div>
            <dt>연결 기준정보</dt>
            <dd>{run.expectedFactCount}개</dd>
          </div>
        </dl>

        {evaluation ? (
          <>
            <section className="deep-evaluation-overview">
              <div>
                <span>사실 정확도</span>
                <strong>{percentLabel(evaluation.factualAccuracy)}</strong>
              </div>
              <div>
                <span>답변 완전성</span>
                <strong>{percentLabel(evaluation.completeness)}</strong>
              </div>
              <p>{evaluation.summary}</p>
            </section>

            <div className="deep-diagnostic-issue-columns">
              <section>
                <h5>잘못 설명한 내용</h5>
                {wrong.length > 0 ? (
                  <ul>
                    {wrong.map((item) => (
                      <li key={item.factKey}>
                        <strong>{item.label}</strong>
                        <span>{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>기준정보와 충돌하는 설명이 없습니다.</p>
                )}
              </section>
              <section>
                <h5>답변에서 빠진 핵심 정보</h5>
                {missing.length > 0 ? (
                  <ul>
                    {missing.map((item) => (
                      <li key={item.factKey}>
                        <strong>{item.label}</strong>
                        <span>{item.reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>연결된 기준정보가 모두 반영됐습니다.</p>
                )}
              </section>
            </div>

            <section className="deep-report-subsection">
              <h4>기준정보별 판정</h4>
              <FactEvaluation items={evaluation.factResults} />
            </section>
          </>
        ) : (
          <p className="deep-answer-warning">
            {run.serviceIdentified === false
              ? "AI가 대상 서비스를 정확히 식별하지 못해 세부 기준정보 평가는 제외되었습니다."
              : run.serviceIdentified === null
                ? "대상 서비스 식별 여부를 확인하지 못해 세부 기준정보 평가는 제외되었습니다."
                : "사실 정확도 평가가 완료되지 않았습니다."}
          </p>
        )}

        {run.answerText ? (
          <section className="deep-report-subsection">
            <h4>실제 AI 답변</h4>
            <AnswerText text={run.answerText} />
          </section>
        ) : null}

        {links.size > 0 ? (
          <section className="deep-report-subsection deep-answer-links">
            <h4>검색·인용 출처</h4>
            <ul>
              {[...links.values()].map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.title ?? link.url}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="deep-report-muted">
            답변에 연결된 웹 출처가 없습니다.
          </p>
        )}

        {run.errorMessage ? (
          <p className="deep-answer-error">
            {run.errorCode}: {run.errorMessage}
          </p>
        ) : null}
      </div>
    </details>
  );
}

function improvementGuide(
  summary: Summary,
  runs: readonly DeepAnswerRun[],
) {
  const facts = allFactItems(runs);
  const guides: Array<{
    title: string;
    reason: string;
    actions: string[];
  }> = [];

  if (
    summary.serviceIdentificationRate !== null &&
    summary.serviceIdentificationRate < 100
  ) {
    guides.push({
      title: "브랜드와 서비스 정체성을 더 분명하게 공개하세요",
      reason:
        "AI가 이름이 비슷한 다른 서비스로 오인했거나 정확한 대상을 확인하지 못했습니다.",
      actions: [
        "페이지 제목·H1·첫 문단에 브랜드명과 서비스 정의를 함께 표시",
        "소개·기능·요금·문의 페이지에서 동일한 브랜드 표기 사용",
        "다른 서비스와 구분되는 고유 기능과 제공하지 않는 기능 명시",
      ],
    });
  }

  if (
    summary.targetCitationRate !== null &&
    summary.targetCitationRate < 100
  ) {
    guides.push({
      title: "공식 사이트가 답변 출처로 선택될 근거를 강화하세요",
      reason:
        "AI 답변이 등록된 공식 도메인을 직접 인용하지 않았습니다.",
      actions: [
        "핵심 답변을 초기 HTML의 읽을 수 있는 본문으로 제공",
        "소개·FAQ·요금·개인정보 처리 내용을 독립 URL로 공개",
        "페이지별 제목과 설명을 질문에 바로 답하는 문장으로 작성",
      ],
    });
  }

  if (countStatus(facts, "CONTRADICTED") > 0) {
    guides.push({
      title: "잘못 알려진 기능과 범위를 바로잡으세요",
      reason:
        "AI 답변에 등록 기준정보와 충돌하는 설명이 포함됐습니다.",
      actions: [
        "실제 제공 기능과 제공하지 않는 기능을 같은 페이지에서 구분",
        "자동 게시·가격·운영 주체처럼 오인하기 쉬운 항목 명시",
        "오래된 외부 소개 글과 검색 노출 문구 최신화",
      ],
    });
  }

  if (countStatus(facts, "NOT_MENTIONED") > 0) {
    guides.push({
      title: "답변에서 빠진 핵심 정보를 공개 콘텐츠에 보완하세요",
      reason:
        "연결된 기준정보가 AI 답변에 포함되지 않았습니다.",
      actions: [
        "이용 대상과 이용 절차를 짧은 문답 형태로 추가",
        "주요 기능·지원 환경·요금·문의 방법을 쉽게 찾도록 구성",
        "모호한 홍보 문구 대신 검증 가능한 사실 문장 사용",
      ],
    });
  }

  if (summary.consistency === null) {
    guides.push({
      title: "최종 검사에서는 질문당 2회 이상 반복하세요",
      reason:
        "현재 실행 횟수로는 답변 일관성을 측정할 수 없습니다.",
      actions: [
        "질문당 반복 횟수를 2회로 설정",
        "두 답변의 식별·인용·사실 판정이 같은지 확인",
      ],
    });
  }

  return guides;
}

export function DeepDiagnosticResults({
  setup,
  locale,
  siteId,
}: {
  setup: DeepDiagnosticSetup;
  locale: string;
  siteId: string;
}) {
  const summary = setup.execution.summary;
  if (!summary) return null;

  const score = displayScore(summary);
  const groups = groupedRuns(setup.execution.runs);
  const facts = allFactItems(setup.execution.runs);
  const guides = improvementGuide(
    summary,
    setup.execution.runs,
  );

  return (
    <section
      className="deep-setup-block deep-results-section"
      id="deep-results"
    >
      <div className="deep-section-heading">
        <div>
          <p className="eyebrow">DEEP RESULT</p>
          <h2>AI 웹 답변 정밀진단 결과</h2>
          <p>
            실제 웹 검색 답변, 공식 사이트 인용, 등록 기준정보와의
            일치 여부를 질문별로 분석한 결과입니다.
          </p>
        </div>
        {setup.execution.latestScan ? (
          <Link
            className="deep-secondary-button deep-result-link"
            to={`/${locale}/sites/${siteId}/scans/${setup.execution.latestScan.id}`}
          >
            기술 진단 결과 함께 보기
          </Link>
        ) : null}
      </div>

      <section
        className={`surface deep-result-hero deep-result-hero-${scoreTone(score)}`}
      >
        <div>
          <span>AI 답변 성과점수</span>
          <strong>{scoreLabel(score)}</strong>
          <small>
            측정 범위 {percentLabel(summary.scoreCoverage)}
          </small>
        </div>
        <div>
          <h3>{scoreMessage(score)}</h3>
          <p>
            모델 {summary.model} · 방법론 {summary.methodologyVersion} ·
            완료 질문 {summary.completedQuestionCount}/
            {summary.plannedQuestionCount}개
          </p>
        </div>
      </section>

      <div className="deep-metric-grid deep-report-metric-grid">
        {[
          ["답변 완료율", summary.answerCompletionRate],
          ["브랜드명 문자열 언급률", summary.brandMentionRate],
          ["대상 서비스 식별률", summary.serviceIdentificationRate],
          ["대상 사이트 인용률", summary.targetCitationRate],
          ["사실 정확도", summary.factualAccuracy],
          ["답변 완전성", summary.completeness],
          ["반복 일관성", summary.consistency],
        ].map(([label, value]) => (
          <article className="surface deep-metric-card" key={label}>
            <span>{label}</span>
            <strong>{percentLabel(value as number | null)}</strong>
          </article>
        ))}
      </div>

      <div className="deep-report-explanation" role="note">
        <strong>결과 읽는 법</strong>
        <p>
          답변 모델에는 등록 URL을 직접 알려주지 않고 실제 질문
          문구만 전달합니다. 대상 서비스 식별률은 AI가 공개 웹에서
          정확한 서비스를 찾았는지, 대상 사이트 인용률은 공식
          도메인을 답변 근거로 사용했는지를 나타냅니다. 사실 정확도·답변 완전성·반복 일관성은 대상 서비스를 정확히 식별한 답변만 평가합니다.
        </p>
      </div>

      <section className="deep-report-summary">
        <h3>전체 판정 요약</h3>
        <div className="deep-report-count-grid">
          {[
            ["정확히 설명", countStatus(facts, "SUPPORTED"), "건"],
            ["기준정보와 불일치", countStatus(facts, "CONTRADICTED"), "건"],
            ["AI 답변에서 핵심 정보 미언급", countStatus(facts, "NOT_MENTIONED"), "건"],
            ["판단 어려움", countStatus(facts, "UNCLEAR"), "건"],
            [
              "대상 식별 실패",
              setup.execution.runs.filter(
                (run) => run.serviceIdentified === false,
              ).length,
              "회",
            ],
            [
              "공식 사이트 미인용",
              setup.execution.runs.filter(
                (run) => run.targetDomainCited === false,
              ).length,
              "회",
            ],
          ].map(([label, value, unit]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}{unit}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="deep-report-question-section">
        <div className="deep-section-heading">
          <div>
            <h3>질문별 상세 진단</h3>
            <p>
              실제 답변, 잘못된 설명, 빠진 정보와 기준정보별 판정을
              확인합니다.
            </p>
          </div>
        </div>

        <div className="deep-question-result-list">
          {groups.map((group) => {
            const outcome = questionOutcome(group.runs);
            const accuracies = group.runs.flatMap((run) =>
              run.factualEvaluation
                ? [run.factualEvaluation.factualAccuracy]
                : [],
            );
            const completeness = group.runs.flatMap((run) =>
              run.factualEvaluation
                ? [run.factualEvaluation.completeness]
                : [],
            );

            return (
              <article
                className="surface deep-question-result-card"
                key={group.code}
              >
                <header>
                  <div>
                    <span className="deep-question-code">
                      {group.code}
                    </span>
                    <p>{kindLabels[group.kind]}</p>
                    <h4>{group.question}</h4>
                  </div>
                  <span
                    className={`deep-outcome-badge deep-outcome-${outcome.tone}`}
                  >
                    {outcome.label}
                  </span>
                </header>

                <dl className="deep-question-result-stats">
                  <div>
                    <dt>실행 횟수</dt>
                    <dd>{group.runs.length}회</dd>
                  </div>
                  <div>
                    <dt>평균 사실 정확도</dt>
                    <dd>{percentLabel(average(accuracies))}</dd>
                  </div>
                  <div>
                    <dt>평균 답변 완전성</dt>
                    <dd>{percentLabel(average(completeness))}</dd>
                  </div>
                </dl>

                <div className="deep-run-result-list">
                  {group.runs.map((run) => (
                    <RunDetail run={run} key={run.id} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="deep-improvement-section">
        <div className="deep-section-heading">
          <div>
            <h3>사이트 운영자 개선 가이드</h3>
            <p>
              현재 결과를 바탕으로 공개 사이트에서 우선 보완할
              항목입니다.
            </p>
          </div>
        </div>

        <div className="deep-improvement-list">
          {guides.map((guide, index) => (
            <article
              className="surface deep-improvement-card"
              key={guide.title}
            >
              <span>{index + 1}</span>
              <div>
                <h4>{guide.title}</h4>
                <p>{guide.reason}</p>
                <ul>
                  {guide.actions.map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
