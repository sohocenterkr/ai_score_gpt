import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  createDeepDiagnosticQuestion,
  deleteDeepDiagnosticFact,
  DeepDiagnosticApiError,
  getDeepDiagnosticSetup,
  restoreDefaultQuestions,
  saveDeepDiagnosticFact,
  startDeepDiagnostic,
  updateDeepDiagnosticQuestion,
  type AiQuestionKind,
  type DeepDiagnosticQuestion,
  type DeepDiagnosticSetup,
  type SiteFactKey,
} from "../deep-diagnostics/deep-diagnostic-api";
import { DeepDiagnosticResults } from "../deep-diagnostics/DeepDiagnosticResults";
import "../deep-diagnostics.css";

const kindLabels: Record<AiQuestionKind, string> = {
  BRAND: "브랜드 직접 질문",
  DISCOVERY: "비브랜드 탐색 질문",
  FEATURE: "기능·지원 범위",
  USE_CASE: "이용 대상·활용 사례",
  TRUST: "요금·운영·신뢰",
  COMPARISON: "비교·선택",
  CUSTOM: "운영자 직접 질문",
};

const kinds = Object.keys(kindLabels) as AiQuestionKind[];

const scanStatusLabels = {
  QUEUED: "대기 중",
  RUNNING: "검사 중",
  COMPLETED: "완료",
  PARTIAL: "일부 완료",
  FAILED: "실패",
  CANCELLED: "취소",
} as const;

function formatKST(value: string | null): string {
  if (!value) return "미확인";

  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  return error instanceof DeepDiagnosticApiError
    ? error.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}

function factMap(setup: DeepDiagnosticSetup): Record<string, string> {
  return Object.fromEntries(
    setup.factDefinitions.map((definition) => [
      definition.key,
      setup.facts.find((fact) => fact.factKey === definition.key)?.value ??
        "",
    ]),
  );
}

interface QuestionDraft {
  kind: AiQuestionKind;
  question: string;
  expectedFactKeys: SiteFactKey[];
  isRequired: boolean;
}

function questionDraft(question: DeepDiagnosticQuestion): QuestionDraft {
  return {
    kind: question.kind,
    question: question.question,
    expectedFactKeys: question.expectedFactKeys,
    isRequired: question.isRequired,
  };
}

const emptyQuestion: QuestionDraft = {
  kind: "CUSTOM",
  question: "",
  expectedFactKeys: [],
  isRequired: true,
};

export function DeepDiagnosticSetupPage() {
  const { locale = "ko", siteId = "" } = useParams();
  const [setup, setSetup] = useState<DeepDiagnosticSetup | null>(null);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [questionDrafts, setQuestionDrafts] = useState<
    Record<string, QuestionDraft>
  >({});
  const [newQuestion, setNewQuestion] =
    useState<QuestionDraft>(emptyQuestion);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState("");
  const [message, setMessage] = useState("");
  const [pageError, setPageError] = useState("");

  function applySetup(result: DeepDiagnosticSetup) {
    setSetup(result);
    setFacts(factMap(result));
    setQuestionDrafts(
      Object.fromEntries(
        result.questions.map((question) => [
          question.id,
          questionDraft(question),
        ]),
      ),
    );
  }

  useEffect(() => {
    let cancelled = false;

    void getDeepDiagnosticSetup(siteId)
      .then((result) => {
        if (cancelled) return;
        applySetup(result);
      })
      .catch((error) => {
        if (!cancelled) setPageError(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const latestScanStatus =
    setup?.execution.latestScan?.status ?? null;
  const scanPending =
    latestScanStatus === "QUEUED" ||
    latestScanStatus === "RUNNING";

  useEffect(() => {
    if (!scanPending) {
      return;
    }

    let cancelled = false;
    const timer = setInterval(() => {
      void getDeepDiagnosticSetup(siteId)
        .then((result) => {
          if (!cancelled) {
            applySetup(result);
          }
        })
        .catch(() => {
          // 다음 주기에서 다시 확인합니다.
        });
    }, 2_000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [scanPending, siteId]);

  const savedFactCount = useMemo(() => {
    if (!setup) return 0;
    return setup.factDefinitions.filter(
      (definition) => facts[definition.key]?.trim(),
    ).length;
  }, [facts, setup]);

  const visibleQuestions = useMemo(
    () =>
      setup?.questions.filter(
        (question) =>
          question.status === "ACTIVE" ||
          (showArchived && question.status === "ARCHIVED"),
      ) ?? [],
    [setup, showArchived],
  );

  function replaceQuestion(question: DeepDiagnosticQuestion) {
    setSetup((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((item) =>
              item.id === question.id ? question : item,
            ),
          }
        : current,
    );
    setQuestionDrafts((current) => ({
      ...current,
      [question.id]: questionDraft(question),
    }));
  }

  async function saveFact(key: SiteFactKey) {
    const value = facts[key]?.trim() ?? "";

    if (!value) {
      setPageError("저장할 기준정보를 입력해 주세요.");
      return;
    }

    setWorkingKey(`fact-${key}`);
    setMessage("");
    setPageError("");

    try {
      const saved = await saveDeepDiagnosticFact(siteId, key, value);
      setFacts((current) => ({ ...current, [key]: saved.value }));
      setSetup((current) =>
        current
          ? {
              ...current,
              facts: [
                ...current.facts.filter((fact) => fact.factKey !== key),
                saved,
              ],
            }
          : current,
      );
      setMessage("기준정보를 저장했습니다.");
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setWorkingKey("");
    }
  }

  async function removeFact(key: SiteFactKey) {
    if (!window.confirm("이 기준정보를 삭제하시겠습니까?")) return;

    setWorkingKey(`fact-${key}`);
    setMessage("");
    setPageError("");

    try {
      await deleteDeepDiagnosticFact(siteId, key);
      setFacts((current) => ({ ...current, [key]: "" }));
      setSetup((current) =>
        current
          ? {
              ...current,
              facts: current.facts.filter(
                (fact) => fact.factKey !== key,
              ),
            }
          : current,
      );
      setMessage("기준정보를 삭제했습니다.");
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setWorkingKey("");
    }
  }

  async function saveQuestion(questionId: string) {
    const draft = questionDrafts[questionId];

    if (!draft?.question.trim()) return;

    setWorkingKey(`question-${questionId}`);
    setMessage("");
    setPageError("");

    try {
      replaceQuestion(
        await updateDeepDiagnosticQuestion(siteId, questionId, draft),
      );
      setMessage("AI 테스트 질문을 수정했습니다.");
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setWorkingKey("");
    }
  }

  async function changeQuestionStatus(
    question: DeepDiagnosticQuestion,
  ) {
    const next =
      question.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    setWorkingKey(`question-${question.id}`);
    setMessage("");
    setPageError("");

    try {
      replaceQuestion(
        await updateDeepDiagnosticQuestion(siteId, question.id, {
          status: next,
        }),
      );
      setMessage(
        next === "ARCHIVED"
          ? "질문을 보관했습니다."
          : "질문을 다시 활성화했습니다.",
      );
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setWorkingKey("");
    }
  }

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkingKey("new-question");
    setMessage("");
    setPageError("");

    try {
      const created = await createDeepDiagnosticQuestion(
        siteId,
        newQuestion,
      );
      setSetup((current) =>
        current
          ? {
              ...current,
              questions: [...current.questions, created],
            }
          : current,
      );
      setQuestionDrafts((current) => ({
        ...current,
        [created.id]: questionDraft(created),
      }));
      setNewQuestion(emptyQuestion);
      setMessage("운영자 질문을 추가했습니다.");
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setWorkingKey("");
    }
  }

  async function beginDiagnostic() {
    if (!setup?.execution.canStart) {
      setPageError(
        setup?.execution.blockers[0] ??
          "정밀진단 준비 정보를 확인해 주세요.",
      );
      return;
    }

    const confirmed = window.confirm(
      `활성 질문 ${setup.execution.activeQuestionCount}개를 ${setup.execution.runsPerQuestion}회씩 실행합니다. 웹 답변과 사실 평가를 합쳐 최대 ${setup.execution.plannedApiCalls}회의 OpenAI API 요청이 발생할 수 있습니다. 정밀진단을 시작하시겠습니까?`,
    );

    if (!confirmed) return;

    setWorkingKey("start-diagnostic");
    setMessage("");
    setPageError("");

    try {
      const scan = await startDeepDiagnostic(siteId);
      setSetup((current) =>
        current
          ? {
              ...current,
              execution: {
                ...current.execution,
                canStart: false,
                blockers: [
                  "정밀진단이 대기 중이거나 실행 중입니다.",
                ],
                latestScan: scan,
                summary: null,
                runs: [],
              },
            }
          : current,
      );
      setMessage(
        "정밀진단을 시작했습니다. 기술 진단 후 AI 웹 답변 테스트를 순차 실행합니다.",
      );
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setWorkingKey("");
    }
  }

  async function restoreDefaults() {
    setWorkingKey("defaults");
    setMessage("");
    setPageError("");

    try {
      const questions = await restoreDefaultQuestions(siteId);
      setSetup((current) =>
        current ? { ...current, questions } : current,
      );
      setQuestionDrafts(
        Object.fromEntries(
          questions.map((question) => [
            question.id,
            questionDraft(question),
          ]),
        ),
      );
      setMessage("누락된 기본 질문을 복구했습니다.");
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setWorkingKey("");
    }
  }

  if (loading) {
    return (
      <section className="full-bleed-section deep-setup-section">
        <div className="content-container deep-setup-loading">
          정밀진단 준비 정보를 불러오고 있습니다.
        </div>
      </section>
    );
  }

  if (!setup) {
    return (
      <section className="full-bleed-section deep-setup-section">
        <div className="content-container deep-setup-loading">
          <p role="alert">{pageError || "사이트 정보를 찾을 수 없습니다."}</p>
          <Link to={`/${locale}/sites`}>사이트 관리로 돌아가기</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="full-bleed-section deep-setup-section">
      <div className="content-container deep-setup-content">
        <header className="deep-setup-heading">
          <div>
            <p className="eyebrow">DEEP DIAGNOSTIC SETUP</p>
            <h1>{setup.site.name} 정밀진단</h1>
            <p>
              실제 AI 웹 답변 결과를 확인하고, 정확도 평가에 사용할
              기준정보와 질문을 함께 관리합니다.
            </p>
          </div>
          <Link to={`/${locale}/sites`}>사이트 관리로</Link>
        </header>

        <nav className="deep-page-nav" aria-label="정밀진단 페이지 이동">
          <a href="#deep-results">진단 결과</a>
          <a href="#deep-facts">기준정보</a>
          <a href="#deep-questions">질문 설정</a>
        </nav>

        <div className="deep-setup-notice" role="note">
          <strong>이 페이지에서 정답지와 시험문제를 준비합니다.</strong>
          <p>
            ① 정확한 사이트 정보 입력 → ② AI에게 물어볼 질문 확인 →
            ③ 정밀진단 시작 → ④ 실제 웹 답변·인용·정확도 결과 확인
            순서로 진행합니다. QUICK 기술 점수와 AI 답변 성과점수는
            별도로 표시됩니다.
          </p>
        </div>

        <section className="surface deep-run-card">
          <div className="deep-run-heading">
            <div>
              <p className="eyebrow">OPENAI WEB ANSWER TEST</p>
              <h2>정밀진단 실행</h2>
              <p>
                {setup.execution.activeQuestionCount}개 질문 ×{" "}
                {setup.execution.runsPerQuestion}회 반복 · 최대{" "}
                {setup.execution.plannedApiCalls}회 API 요청
              </p>
            </div>
            <span>
              {setup.execution.apiConfigured
                ? `${setup.execution.model} 연결됨`
                : "OpenAI 연결 필요"}
            </span>
          </div>

          <div className="deep-run-progress">
            <div>
              <strong>핵심 기준정보</strong>
              <span>
                {setup.execution.savedRequiredFactCount}/
                {setup.execution.requiredFactCount}개 저장
              </span>
            </div>
            <div>
              <strong>사용 중인 질문</strong>
              <span>{setup.execution.activeQuestionCount}개</span>
            </div>
            <div>
              <strong>최근 정밀진단</strong>
              <span>
                {setup.execution.latestScan
                  ? scanStatusLabels[
                      setup.execution.latestScan.status
                    ]
                  : "실행 이력 없음"}
              </span>
            </div>
          </div>

          {setup.execution.blockers.length > 0 ? (
            <div className="deep-run-blockers" role="note">
              <strong>시작 전 확인</strong>
              <ul>
                {setup.execution.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="deep-card-actions">
            <button
              type="button"
              className="deep-primary-button deep-start-button"
              disabled={
                !setup.execution.canStart ||
                workingKey === "start-diagnostic" ||
                scanPending
              }
              onClick={() => void beginDiagnostic()}
            >
              {scanPending
                ? "정밀진단 진행 중"
                : workingKey === "start-diagnostic"
                  ? "시작 중..."
                  : "정밀진단 시작하기"}
            </button>
            {setup.execution.latestScan &&
            (setup.execution.latestScan.status === "COMPLETED" ||
              setup.execution.latestScan.status === "PARTIAL") ? (
              <Link
                className="deep-secondary-button deep-result-link"
                to={`/${locale}/sites/${siteId}/scans/${setup.execution.latestScan.id}`}
              >
                기술 진단 결과 함께 보기
              </Link>
            ) : null}
          </div>

          {setup.execution.latestScan ? (
            <p className="deep-run-time">
              최근 실행:{" "}
              {formatKST(setup.execution.latestScan.createdAt)}
              {setup.execution.latestScan.errorCode
                ? ` · ${setup.execution.latestScan.errorCode}`
                : ""}
            </p>
          ) : null}
        </section>

        {message ? (
          <p className="deep-message deep-success" role="status">
            {message}
          </p>
        ) : null}
        {pageError ? (
          <p className="deep-message deep-error" role="alert">
            {pageError}
          </p>
        ) : null}

        {setup.execution.summary ? (
          <DeepDiagnosticResults
            setup={setup}
            locale={locale}
            siteId={siteId}
          />
        ) : (
          <section
            className="deep-setup-block deep-results-empty"
            id="deep-results"
          >
            <p className="eyebrow">DEEP RESULT</p>
            <h2>정밀진단 결과</h2>
            <p>
              아직 표시할 AI 웹 답변 결과가 없습니다. 기준정보와 질문을
              확인한 뒤 정밀진단을 실행하면 종합 결과와 질문별 상세
              평가가 여기에 표시됩니다.
            </p>
          </section>
        )}

        <section className="deep-setup-block" id="deep-facts">
          <div className="deep-section-heading">
            <div>
              <p className="eyebrow">STEP 1</p>
              <h2>AI 답변과 비교할 정확한 사이트 정보</h2>
              <p>
                {savedFactCount}/{setup.factDefinitions.length}개 항목에
                정보가 입력되어 있습니다.
              </p>
            </div>
          </div>

          <div className="deep-fact-grid">
            {setup.factDefinitions.map((definition) => {
              const saved = Boolean(
                setup.facts.find(
                  (fact) => fact.factKey === definition.key,
                ),
              );
              const working =
                workingKey === `fact-${definition.key}`;

              return (
                <article className="surface deep-fact-card" key={definition.key}>
                  <div className="deep-card-heading">
                    <div>
                      <h3>{definition.label}</h3>
                      <p>{definition.help}</p>
                    </div>
                    <span>
                      {definition.important ? "핵심" : "선택"} ·{" "}
                      {saved ? "저장됨" : "미입력"}
                    </span>
                  </div>
                  <textarea
                    value={facts[definition.key] ?? ""}
                    onChange={(event) =>
                      setFacts((current) => ({
                        ...current,
                        [definition.key]: event.target.value,
                      }))
                    }
                    placeholder={definition.placeholder}
                    rows={5}
                    maxLength={4_000}
                  />
                  <div className="deep-card-actions">
                    <button
                      type="button"
                      className="deep-primary-button"
                      disabled={working}
                      onClick={() => void saveFact(definition.key)}
                    >
                      {working ? "처리 중..." : "저장"}
                    </button>
                    {saved ? (
                      <button
                        type="button"
                        className="deep-danger-button"
                        disabled={working}
                        onClick={() => void removeFact(definition.key)}
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="deep-setup-block" id="deep-questions">
          <div className="deep-section-heading deep-question-heading">
            <div>
              <p className="eyebrow">STEP 2</p>
              <h2>AI에게 실제로 물어볼 질문</h2>
              <p>
                기본 질문을 실제 서비스에 맞게 수정하고 운영자 질문을
                추가할 수 있습니다.
              </p>
            </div>
            <div className="deep-heading-actions">
              <label>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) =>
                    setShowArchived(event.target.checked)
                  }
                />
                보관 질문 표시
              </label>
              <button
                type="button"
                className="deep-secondary-button"
                onClick={() => void restoreDefaults()}
                disabled={workingKey === "defaults"}
              >
                누락 기본 질문 복구
              </button>
            </div>
          </div>

          <form className="surface deep-new-question" onSubmit={addQuestion}>
            <h3>운영자 질문 추가</h3>
            <QuestionFields
              prefix="new"
              draft={newQuestion}
              definitions={setup.factDefinitions}
              onChange={setNewQuestion}
            />
            <button
              type="submit"
              className="deep-primary-button"
              disabled={workingKey === "new-question"}
            >
              {workingKey === "new-question"
                ? "추가 중..."
                : "질문 추가"}
            </button>
          </form>

          <div className="deep-question-list">
            {visibleQuestions.map((question) => {
              const draft =
                questionDrafts[question.id] ?? questionDraft(question);
              const working =
                workingKey === `question-${question.id}`;

              return (
                <article
                  className={`surface deep-question-card${
                    question.status === "ARCHIVED"
                      ? " deep-question-archived"
                      : ""
                  }`}
                  key={question.id}
                >
                  <div className="deep-card-heading">
                    <div>
                      <span className="deep-question-code">
                        {question.code}
                      </span>
                      <h3>{kindLabels[question.kind]}</h3>
                    </div>
                    <span>
                      {question.source === "SYSTEM"
                        ? "기본 질문"
                        : "운영자 질문"}{" "}
                      ·{" "}
                      {question.status === "ACTIVE"
                        ? "사용 중"
                        : "보관됨"}
                    </span>
                  </div>

                  <QuestionFields
                    prefix={question.id}
                    draft={draft}
                    definitions={setup.factDefinitions}
                    disabled={question.status === "ARCHIVED"}
                    onChange={(next) =>
                      setQuestionDrafts((current) => ({
                        ...current,
                        [question.id]: next,
                      }))
                    }
                  />

                  <div className="deep-card-actions">
                    {question.status === "ACTIVE" ? (
                      <button
                        type="button"
                        className="deep-primary-button"
                        disabled={working}
                        onClick={() => void saveQuestion(question.id)}
                      >
                        {working ? "저장 중..." : "수정 저장"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="deep-secondary-button"
                      disabled={working}
                      onClick={() => void changeQuestionStatus(question)}
                    >
                      {question.status === "ACTIVE"
                        ? "보관"
                        : "다시 사용"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}

function QuestionFields({
  prefix,
  draft,
  definitions,
  disabled = false,
  onChange,
}: {
  prefix: string;
  draft: QuestionDraft;
  definitions: DeepDiagnosticSetup["factDefinitions"];
  disabled?: boolean;
  onChange: (draft: QuestionDraft) => void;
}) {
  function toggleFact(key: SiteFactKey, checked: boolean) {
    onChange({
      ...draft,
      expectedFactKeys: checked
        ? [...new Set([...draft.expectedFactKeys, key])]
        : draft.expectedFactKeys.filter((item) => item !== key),
    });
  }

  return (
    <div className="deep-question-fields">
      <label htmlFor={`${prefix}-kind`}>
        질문 유형
        <select
          id={`${prefix}-kind`}
          value={draft.kind}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...draft,
              kind: event.target.value as AiQuestionKind,
            })
          }
        >
          {kinds.map((kind) => (
            <option value={kind} key={kind}>
              {kindLabels[kind]}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor={`${prefix}-question`}>
        실제로 AI에 물어볼 질문
        <textarea
          id={`${prefix}-question`}
          value={draft.question}
          disabled={disabled}
          required
          minLength={5}
          maxLength={500}
          rows={3}
          onChange={(event) =>
            onChange({ ...draft, question: event.target.value })
          }
        />
      </label>

      <fieldset disabled={disabled}>
        <legend>이 질문의 정답 판단에 사용할 기준정보</legend>
        <div className="deep-fact-options">
          {definitions.map((definition) => (
            <label key={definition.key}>
              <input
                type="checkbox"
                checked={draft.expectedFactKeys.includes(definition.key)}
                onChange={(event) =>
                  toggleFact(definition.key, event.target.checked)
                }
              />
              {definition.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="deep-required-option">
        <input
          type="checkbox"
          checked={draft.isRequired}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...draft,
              isRequired: event.target.checked,
            })
          }
        />
        정밀진단 필수 질문으로 사용
      </label>
    </div>
  );
}
