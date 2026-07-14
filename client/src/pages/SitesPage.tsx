import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  archiveSiteRequest,
  createSiteRequest,
  listSitesRequest,
  queueSiteScanRequest,
  SiteApiError,
  updateSiteRequest,
  type RegisteredSite,
  type SiteDiagnosticProgress,
  type SiteProgress,
  type SiteScan,
  type SiteWorkOrderProgress,
} from "../sites/site-api";
import "../sites.css";

interface SiteFormState {
  name: string;
  baseUrl: string;
  description: string;
  hasReservationFeature: boolean;
}

const emptyForm: SiteFormState = {
  name: "",
  baseUrl: "",
  description: "",
  hasReservationFeature: false,
};

const scanStatusLabels = {
  ko: {
    QUEUED: "대기 중",
    RUNNING: "검사 중",
    COMPLETED: "완료",
    PARTIAL: "일부 완료",
    FAILED: "실패",
    CANCELLED: "취소",
  },
  en: {
    QUEUED: "Queued",
    RUNNING: "Running",
    COMPLETED: "Completed",
    PARTIAL: "Partially completed",
    FAILED: "Failed",
    CANCELLED: "Cancelled",
  },
} satisfies Record<"ko" | "en", Record<SiteScan["status"], string>>;

const sitesCopy = {
  ko: {
    pageEyebrow: "SITE MANAGEMENT",
    title: "사이트 대시보드",
    intro:
      "공개 URL만 등록할 수 있으며, 사설 IP·localhost·내부망은 자동으로 차단됩니다.",
    notice:
      "공개 URL의 실제 HTTP 응답과 초기 HTML 증거를 수집하고 규칙 기반 점수와 검사 결과를 제공합니다. 작업지시서 생성은 다음 단계에서 실패 항목에 연결됩니다.",
    createTitle: "새 사이트 등록",
    createHelp: "`example.com`처럼 입력하면 HTTPS 주소로 보완하여 확인합니다.",
    checking: "진단 시작 중...",
    createButton: "사이트 진단",
    listTitle: "등록 사이트",
    listHelp: "사이트 정보 수정·삭제와 검사 작업 등록을 관리합니다.",
    siteCount: (count: number) => `${count}개`,
    loading: "사이트 목록을 불러오고 있습니다.",
    empty: "아직 등록한 사이트가 없습니다. 첫 사이트를 등록해 주세요.",
    editTitle: "사이트 정보 수정",
    saving: "저장 중...",
    saveEdit: "수정 저장",
    cancel: "취소",
    registered: "등록 완료",
    finalUrl: "최종 확인 URL",
    createdAt: "등록일(KST)",
    notEntered: "미입력",
    checkedAfterScan: "간편검사 후 자동 확인",
    latestScan: "최근 검사 작업",
    noScan: "등록된 검사 작업 없음",
    score: (score: number, grade: string) => `${score}점 ${grade}`,
    scanWaiting: "검사 대기 중",
    scanComplete: "간편검사 완료",
    rescanCurrent: "현재 기준으로 다시 검사",
    scanOutdatedNotice:
      "평가 방법이 업그레이드되어 현재 기준으로 다시 검사가 필요합니다.",
    processing: "처리 중...",
    startScan: "간편검사 시작",
    viewResult: "결과 보기",
    edit: "수정",
    delete: "삭제",
    createdMessage: "사이트가 등록되었고 간편검사가 시작되었습니다.",
    registeredOnlyMessage:
      "사이트는 등록되었지만 간편검사 시작에 실패했습니다. 목록에서 다시 시도해 주세요.",
    updatedMessage: "사이트 정보가 수정되었습니다.",
    deletedMessage: "사이트가 삭제되었습니다. 기존 검사 이력은 보존됩니다.",
    queuedMessage:
      "검사 작업이 대기열에 등록되었습니다. 검사 실행 후 결과 화면에서 진단 내용을 확인할 수 있습니다.",
    deleteConfirm: (siteName: string) =>
      `${siteName} 사이트를 목록에서 삭제하시겠습니까? 검사 이력은 보존됩니다.`,
    unknownError: "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
    fields: {
      name: "사이트명",
      namePlaceholder: "예: Site AI Score",
      baseUrl: "대표 URL",
      baseUrlPlaceholder: "example.com",
      description: "사이트 설명",
      descriptionPlaceholder: "예: 강남 소아과 홈페이지",
      hasReservationFeature: "이 사이트에 예약·상담 신청 기능이 있나요?",
    },
  },
  en: {
    pageEyebrow: "SITE MANAGEMENT",
    title: "Site Dashboard",
    intro:
      "Only public URLs can be registered. Private IPs, localhost, and internal network URLs are blocked automatically.",
    notice:
      "Site AI Score collects the real HTTP response and initial HTML evidence from public URLs, then provides rule-based scores and diagnostic results. Work order generation is connected to failed items in the next step.",
    createTitle: "Register New Website",
    createHelp:
      "If you enter a domain such as `example.com`, the service will complete it as an HTTPS URL for verification.",
    checking: "Starting diagnosis...",
    createButton: "Start diagnosis",
    listTitle: "Registered Websites",
    listHelp: "Manage website details, deletion, and diagnostic scan jobs.",
    siteCount: (count: number) => `${count} ${count === 1 ? "site" : "sites"}`,
    loading: "Loading registered websites.",
    empty: "No websites have been registered yet. Register your first website.",
    editTitle: "Edit Website Information",
    saving: "Saving...",
    saveEdit: "Save Changes",
    cancel: "Cancel",
    registered: "Registered",
    finalUrl: "Final checked URL",
    createdAt: "Registered date (KST)",
    notEntered: "Not entered",
    checkedAfterScan: "Automatically checked after simple diagnostic",
    latestScan: "Latest scan job",
    noScan: "No scan job registered",
    score: (score: number, grade: string) => `${score} points ${grade}`,
    scanWaiting: "Scan queued",
    scanComplete: "Simple diagnostic completed",
    rescanCurrent: "Recheck with current rules",
    scanOutdatedNotice:
      "The evaluation method has been upgraded. Run a new scan with the current rules.",
    processing: "Processing...",
    startScan: "Start Simple Diagnostic",
    viewResult: "View Result",
    edit: "Edit",
    delete: "Delete",
    createdMessage:
      "The website has been registered and the simple diagnostic has started.",
    registeredOnlyMessage:
      "The website was registered, but starting the simple diagnostic failed. Please try again from the list.",
    updatedMessage: "The website information has been updated.",
    deletedMessage:
      "The website has been removed from the list. Existing scan history is preserved.",
    queuedMessage:
      "The scan job has been added to the queue. After the scan runs, you can review the diagnostic result page.",
    deleteConfirm: (siteName: string) =>
      `Remove ${siteName} from the website list? Scan history will be preserved.`,
    unknownError: "The request could not be processed. Please try again.",
    fields: {
      name: "Website name",
      namePlaceholder: "e.g. Site AI Score",
      baseUrl: "Main URL",
      baseUrlPlaceholder: "example.com",
      description: "Website description",
      descriptionPlaceholder: "e.g. Gangnam pediatric clinic website",
      hasReservationFeature:
        "Does this site have a reservation/consultation request feature?",
    },
  },
} as const;

const progressCopy = {
  ko: {
    progressTitle: "진행 현황",
    progressHelp:
      "간편진단부터 4차 정밀진단까지 현재 위치와 다음 작업을 차수별로 확인할 수 있습니다.",
    expandDetails: "진행 현황 펼치기",
    collapseDetails: "진행 현황 접기",
    currentStage: "현재 단계",
    quickDiagnostic: "무료 간편진단",
    quickNotStarted: "아직 간편진단을 실행하지 않았습니다.",
    workflow: "차수별 진행",
    initialPayment: "최초 결제",
    extraPayment: "추가 결제",
    paid: "결제 완료",
    unpaid: "미결제",
    extraPaymentGuide: "3차 진단 후 필요 시",
    waitingPrevious: "이전 단계가 완료되면 열립니다.",
    extraPaymentRequired: "추가 결제 후 열립니다.",
    diagnosticTitle: (number: number) => `${number}차 정밀진단`,
    workOrderTitle: (number: number) => `${number}차 작업지시서`,
    score: (score: number, grade: string) => `${score}점 · ${grade}`,
    itemCount: (count: number, required: number) =>
      `개선 항목 ${count}개 · 필수 ${required}개`,
    viewDiagnostic: "진단 보기",
    viewWorkOrder: "작업지시서 보기",
    purchaseExtra: "추가 결제하기",
    createWorkOrder: "작업지시서 만들기",
    processing: "처리 중",
    stageRegistered: "사이트 등록 완료 · 간편진단 준비",
    stageQuick: "무료 간편진단 진행 중",
    stageInitialPayment: "무료 간편진단 발행완료",
    stageDiagnostic: (number: number) => `${number}차 정밀진단 진행 중`,
    stageWorkOrder: (number: number) => `${number}차 작업지시서 진행`,
    stageExtraPayment: "3차 작업지시서·4차 진단 추가 결제 필요",
    stageCompleted: (number: number) => `${number}차 정밀진단 완료`,
    status: {
      READY: "준비",
      REQUIRED: "필요",
      PENDING: "대기",
      QUEUED: "대기 중",
      RUNNING: "진행 중",
      EVALUATING: "판정 중",
      COMPLETED: "완료",
      PARTIAL: "일부 완료",
      PASSED: "완료",
      REWORK_REQUIRED: "추가 개선 필요",
      FAILED: "실패",
      CANCELLED: "취소",
      DRAFT: "초안",
      ISSUED: "발급 완료",
      ASSIGNED: "배정",
      IN_PROGRESS: "작업 중",
      SUBMITTED: "제출 완료",
      VERIFYING: "다음 진단 진행 중",
      REVIEW_REQUIRED: "확인 필요",
    } as Record<string, string>,
  },
  en: {
    progressTitle: "Progress",
    progressHelp:
      "Track the current position and next action from the simple diagnostic through Diagnostic 4.",
    expandDetails: "Show progress details",
    collapseDetails: "Hide progress details",
    currentStage: "Current stage",
    quickDiagnostic: "Free Simple Diagnostic",
    quickNotStarted: "The simple diagnostic has not been run yet.",
    workflow: "Round-by-round progress",
    initialPayment: "Initial payment",
    extraPayment: "Additional payment",
    paid: "Paid",
    unpaid: "Not paid",
    extraPaymentGuide: "If needed after Diagnostic 3",
    waitingPrevious: "Available after the previous step is completed.",
    extraPaymentRequired: "Available after the additional payment.",
    diagnosticTitle: (number: number) => `Diagnostic ${number}`,
    workOrderTitle: (number: number) => `Work Order ${number}`,
    score: (score: number, grade: string) => `${score} points · ${grade}`,
    itemCount: (count: number, required: number) =>
      `${count} improvement items · ${required} required`,
    viewDiagnostic: "View Diagnostic",
    viewWorkOrder: "View Work Order",
    purchaseExtra: "Make Additional Payment",
    createWorkOrder: "Create Work Order",
    processing: "Processing",
    stageRegistered: "Website registered · Ready for simple diagnostic",
    stageQuick: "Free simple diagnostic in progress",
    stageInitialPayment: "Free simple diagnostic issued",
    stageDiagnostic: (number: number) => `Diagnostic ${number} in progress`,
    stageWorkOrder: (number: number) => `Work Order ${number} in progress`,
    stageExtraPayment:
      "Additional payment required for Work Order 3 and Diagnostic 4",
    stageCompleted: (number: number) => `Diagnostic ${number} completed`,
    status: {
      READY: "Ready",
      REQUIRED: "Required",
      PENDING: "Pending",
      QUEUED: "Queued",
      RUNNING: "In progress",
      EVALUATING: "Evaluating",
      COMPLETED: "Completed",
      PARTIAL: "Partially completed",
      PASSED: "Completed",
      REWORK_REQUIRED: "More improvements needed",
      FAILED: "Failed",
      CANCELLED: "Cancelled",
      DRAFT: "Draft",
      ISSUED: "Issued",
      ASSIGNED: "Assigned",
      IN_PROGRESS: "In progress",
      SUBMITTED: "Submitted",
      VERIFYING: "Next diagnostic in progress",
      REVIEW_REQUIRED: "Review required",
    } as Record<string, string>,
  },
} as const;

type DashboardLocale = "ko" | "en";
type ProgressCopy = (typeof progressCopy)[DashboardLocale];

interface DiagnosticStepView {
  scanId: string;
  status: string;
  score: number | null;
  grade: string | null;
  completedAt: string | null;
}

function diagnosticStep(
  site: RegisteredSite,
  number: number,
): DiagnosticStepView | null {
  const diagnostic = site.progress?.diagnostics.find(
    (item) => item.diagnosticNumber === number,
  );

  if (diagnostic) {
    return {
      scanId: diagnostic.scanId,
      status: diagnostic.status,
      score: diagnostic.score,
      grade: diagnostic.grade,
      completedAt: diagnostic.completedAt,
    };
  }

  if (
    number === 1 &&
    site.progress?.payment.initialPaid &&
    site.latestScan &&
    site.latestScan.type !== "VERIFICATION" &&
    ["COMPLETED", "PARTIAL"].includes(site.latestScan.status)
  ) {
    return {
      scanId: site.latestScan.id,
      status: site.latestScan.status,
      score: site.latestScan.score,
      grade: site.latestScan.grade,
      completedAt: site.latestScan.completedAt,
    };
  }

  return null;
}

function statusLabel(
  status: string,
  locale: DashboardLocale,
  copy: ProgressCopy,
): string {
  return copy.status[status] ?? status.replaceAll("_", " ").toLowerCase();
}

function statusTone(status: string): string {
  if (["COMPLETED", "PARTIAL", "PASSED", "ISSUED"].includes(status)) {
    return "complete";
  }

  if (
    ["QUEUED", "RUNNING", "EVALUATING", "VERIFYING", "IN_PROGRESS"].includes(
      status,
    )
  ) {
    return "active";
  }

  if (["FAILED", "CANCELLED", "REWORK_REQUIRED"].includes(status)) {
    return "attention";
  }

  return "pending";
}

function currentStageLabel(
  progress: SiteProgress | undefined,
  locale: DashboardLocale,
  copy: ProgressCopy,
  latestScan: SiteScan | null,
): string {
  if (!progress) {
    if (!latestScan) {
      return copy.stageRegistered;
    }

    if (["QUEUED", "RUNNING"].includes(latestScan.status)) {
      return copy.stageQuick;
    }

    return locale === "en"
      ? "Free simple diagnostic issued"
      : "무료 간편진단 발행완료";
  }

  const number = progress.currentStage.number ?? 1;

  switch (progress.currentStage.kind) {
    case "REGISTERED":
      return copy.stageRegistered;
    case "QUICK_SCAN":
      return copy.stageQuick;
    case "INITIAL_PAYMENT":
      return copy.stageInitialPayment;
    case "DIAGNOSTIC":
      return copy.stageDiagnostic(number);
    case "WORK_ORDER":
      return copy.stageWorkOrder(number);
    case "EXTRA_PAYMENT":
      return copy.stageExtraPayment;
    case "COMPLETED":
      return copy.stageCompleted(number);
  }
}

function isCurrentStep(
  progress: SiteProgress | undefined,
  kind: "DIAGNOSTIC" | "WORK_ORDER",
  number: number,
): boolean {
  if (!progress) {
    return false;
  }

  const stage = progress.currentStage;

  if (stage.kind === kind && stage.number === number) {
    return true;
  }

  if (stage.kind === "COMPLETED" && kind === "DIAGNOSTIC") {
    return stage.number === number;
  }

  if (stage.kind === "INITIAL_PAYMENT" && kind === "DIAGNOSTIC") {
    return number === 1;
  }

  if (stage.kind === "EXTRA_PAYMENT" && kind === "WORK_ORDER") {
    return number === 3;
  }

  return false;
}

function formatKST(value: string, locale: "ko" | "en"): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof SiteApiError ? error.message : fallback;
}

function formFromSite(site: RegisteredSite): SiteFormState {
  return {
    name: site.name,
    baseUrl: site.baseUrl,
    description: site.description ?? "",
    hasReservationFeature: site.hasReservationFeature ?? false,
  };
}

function toRequest(form: SiteFormState) {
  return {
    name: form.name,
    baseUrl: form.baseUrl,
    description: form.description.trim() || undefined,
    hasReservationFeature: form.hasReservationFeature,
  };
}

export function SitesPage() {
  const { locale = "ko" } = useParams();
  const normalizedLocale = locale === "en" ? "en" : "ko";
  const copy = normalizedLocale === "en" ? sitesCopy.en : sitesCopy.ko;
  const scanLabels = scanStatusLabels[normalizedLocale];
  const [sites, setSites] = useState<RegisteredSite[]>([]);
  const [form, setForm] = useState<SiteFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SiteFormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [workingSiteId, setWorkingSiteId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    void listSitesRequest()
      .then((result) => {
        if (!cancelled) {
          setSites(result);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(messageFromError(error, copy.unknownError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [copy.unknownError]);

  const hasPendingScan = sites.some(
    (site) =>
      site.latestScan?.status === "QUEUED" ||
      site.latestScan?.status === "RUNNING",
  );

  useEffect(() => {
    if (!hasPendingScan) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refreshPendingScans = async () => {
      try {
        const result = await listSitesRequest();

        if (cancelled) {
          return;
        }

        setSites(result);

        const stillPending = result.some(
          (site) =>
            site.latestScan?.status === "QUEUED" ||
            site.latestScan?.status === "RUNNING",
        );

        if (stillPending) {
          timer = setTimeout(refreshPendingScans, 2_000);
        }
      } catch {
        if (!cancelled) {
          timer = setTimeout(refreshPendingScans, 5_000);
        }
      }
    };

    timer = setTimeout(refreshPendingScans, 1_000);

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [hasPendingScan]);

  function updateForm<K extends keyof SiteFormState>(
    key: K,
    value: SiteFormState[K],
    editing = false,
  ) {
    if (editing) {
      setEditForm((current) => ({ ...current, [key]: value }));
      return;
    }

    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    setSubmitting(true);

    try {
      const site = await createSiteRequest(toRequest(form));
      let registeredSite = site;
      let scanQueued = true;

      try {
        const scan = await queueSiteScanRequest(
          site.id,
          "QUICK",
          normalizedLocale === "en" ? "en" : "ko",
        );
        registeredSite = { ...site, latestScan: scan };
      } catch (scanError) {
        scanQueued = false;
        setErrorMessage(messageFromError(scanError, copy.unknownError));
      }

      setSites((current) => [
        registeredSite,
        ...current.filter((item) => item.id !== registeredSite.id),
      ]);
      setForm(emptyForm);
      setMessage(scanQueued ? copy.createdMessage : copy.registeredOnlyMessage);
    } catch (error) {
      setErrorMessage(messageFromError(error, copy.unknownError));
    } finally {
      setSubmitting(false);
    }
  }

  function beginEdit(site: RegisteredSite) {
    setEditingId(site.id);
    setEditForm(formFromSite(site));
    setMessage("");
    setErrorMessage("");
  }

  async function handleUpdate(
    event: FormEvent<HTMLFormElement>,
    siteId: string,
  ) {
    event.preventDefault();
    setMessage("");
    setErrorMessage("");
    setWorkingSiteId(siteId);

    try {
      const updated = await updateSiteRequest(siteId, {
        ...toRequest(editForm),
        description: editForm.description.trim() || null,
      });
      setSites((current) =>
        current.map((site) => (site.id === siteId ? updated : site)),
      );
      setEditingId(null);
      setMessage(copy.updatedMessage);
    } catch (error) {
      setErrorMessage(messageFromError(error, copy.unknownError));
    } finally {
      setWorkingSiteId(null);
    }
  }

  async function handleArchive(site: RegisteredSite) {
    const confirmed = window.confirm(copy.deleteConfirm(site.name));

    if (!confirmed) {
      return;
    }

    setMessage("");
    setErrorMessage("");
    setWorkingSiteId(site.id);

    try {
      await archiveSiteRequest(site.id);
      setSites((current) => current.filter((item) => item.id !== site.id));
      setMessage(copy.deletedMessage);
    } catch (error) {
      setErrorMessage(messageFromError(error, copy.unknownError));
    } finally {
      setWorkingSiteId(null);
    }
  }

  async function handleQueueScan(site: RegisteredSite) {
    setMessage("");
    setErrorMessage("");
    setWorkingSiteId(site.id);

    try {
      const scan = await queueSiteScanRequest(
        site.id,
        "QUICK",
        normalizedLocale === "en" ? "en" : "ko",
      );
      setSites((current) =>
        current.map((item) =>
          item.id === site.id ? { ...item, latestScan: scan } : item,
        ),
      );
      setMessage(copy.queuedMessage);
    } catch (error) {
      setErrorMessage(messageFromError(error, copy.unknownError));
    } finally {
      setWorkingSiteId(null);
    }
  }

  return (
    <section className="full-bleed-section sites-section">
      <div className="content-container sites-content">
        <div className="sites-heading">
          <div>
            <p className="eyebrow">{copy.pageEyebrow}</p>
            <h1>{copy.title}</h1>
            <p>{copy.intro}</p>
          </div>
        </div>

        <div className="sites-notice" role="note">
          {copy.notice}
        </div>

        {message ? (
          <p className="sites-message sites-success" role="status">
            {message}
          </p>
        ) : null}

        {errorMessage ? (
          <p className="sites-message sites-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="sites-layout">
          <form
            className="surface site-form site-create-form"
            onSubmit={handleCreate}
          >
            <div className="site-form-heading">
              <h2>{copy.createTitle}</h2>
              <p>{copy.createHelp}</p>
            </div>

            <div className="site-create-body">
              <SiteFields
                prefix="create"
                form={form}
                labels={copy.fields}
                onChange={(key, value) => updateForm(key, value)}
              />

              <button
                className="site-primary-button site-create-submit"
                type="submit"
                disabled={submitting}
              >
                {submitting ? copy.checking : copy.createButton}
              </button>
            </div>
          </form>

          <div className="site-list-panel">
            <div className="site-list-heading">
              <div>
                <h2>{copy.listTitle}</h2>
                <p>{copy.listHelp}</p>
              </div>
              <span>{copy.siteCount(sites.length)}</span>
            </div>

            {loading ? (
              <div className="surface sites-empty" role="status">
                {copy.loading}
              </div>
            ) : sites.length === 0 ? (
              <div className="surface sites-empty">{copy.empty}</div>
            ) : (
              <div className="site-list">
                {sites.map((site) => (
                  <SiteDashboardCard
                    key={site.id}
                    site={site}
                    locale={normalizedLocale}
                    copy={copy}
                    scanLabels={scanLabels}
                    editing={editingId === site.id}
                    editForm={editForm}
                    working={workingSiteId === site.id}
                    onBeginEdit={() => beginEdit(site)}
                    onCancelEdit={() => setEditingId(null)}
                    onEditChange={(key, value) => updateForm(key, value, true)}
                    onUpdate={(event) => void handleUpdate(event, site.id)}
                    onQueueScan={() => void handleQueueScan(site)}
                    onArchive={() => void handleArchive(site)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface SiteDashboardCardProps {
  site: RegisteredSite;
  locale: DashboardLocale;
  copy: typeof sitesCopy.ko | typeof sitesCopy.en;
  scanLabels: Record<SiteScan["status"], string>;
  editing: boolean;
  editForm: SiteFormState;
  working: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: <K extends keyof SiteFormState>(
    key: K,
    value: SiteFormState[K],
  ) => void;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void;
  onQueueScan: () => void;
  onArchive: () => void;
}

function SiteDashboardCard({
  site,
  locale,
  copy,
  scanLabels,
  editing,
  editForm,
  working,
  onBeginEdit,
  onCancelEdit,
  onEditChange,
  onUpdate,
  onQueueScan,
  onArchive,
}: SiteDashboardCardProps) {
  const [expanded, setExpanded] = useState(false);
  const progress = site.progress;
  const progressText = progressCopy[locale];
  const latestSimpleScan =
    site.latestScan?.type === "VERIFICATION" ? null : site.latestScan;
  const scanPending =
    latestSimpleScan?.status === "QUEUED" ||
    latestSimpleScan?.status === "RUNNING";
  const scanCompleted =
    latestSimpleScan?.status === "COMPLETED" ||
    latestSimpleScan?.status === "PARTIAL";
  const scanOutdated = Boolean(
    scanCompleted && latestSimpleScan?.isOutdatedRulesVersion,
  );
  const workflowSteps = [
    { kind: "DIAGNOSTIC" as const, number: 1 },
    { kind: "WORK_ORDER" as const, number: 1 },
    { kind: "DIAGNOSTIC" as const, number: 2 },
    { kind: "WORK_ORDER" as const, number: 2 },
    { kind: "DIAGNOSTIC" as const, number: 3 },
    { kind: "WORK_ORDER" as const, number: 3 },
    { kind: "DIAGNOSTIC" as const, number: 4 },
  ];
  const currentWorkflowStepIndex = workflowSteps.findIndex((step) =>
    isCurrentStep(progress, step.kind, step.number),
  );
  const visibleWorkflowSteps =
    currentWorkflowStepIndex >= 0
      ? workflowSteps.slice(
          0,
          Math.min(workflowSteps.length, currentWorkflowStepIndex + 2),
        )
      : workflowSteps.slice(0, Math.min(workflowSteps.length, 2));
  const currentWorkOrder =
    progress?.workOrders.find(
      (item) => item.version === progress.currentStage.number,
    ) ?? progress?.workOrders.at(-1);
  const workOrderDiagnostic =
    progress?.currentStage.number === 1
      ? diagnosticStep(site, 1)
      : progress?.diagnostics.find(
          (item) => item.diagnosticNumber === progress.currentStage.number,
        );
  const simpleDiagnostic =
    diagnosticStep(site, 1) ??
    (latestSimpleScan
      ? {
          scanId: latestSimpleScan.id,
          status: latestSimpleScan.status,
          score: latestSimpleScan.score,
          grade: latestSimpleScan.grade,
          completedAt: latestSimpleScan.completedAt,
        }
      : null);
  const thirdDiagnostic = diagnosticStep(site, 3);

  function renderNextAction() {
    const action = progress?.currentStage.nextAction;

    if (!progress || action === "START_QUICK_SCAN") {
      return (
        <button
          className="site-primary-button"
          type="button"
          onClick={onQueueScan}
          disabled={working || scanPending}
        >
          {working
            ? copy.processing
            : scanPending
              ? copy.scanWaiting
              : scanOutdated
                ? copy.rescanCurrent
                : copy.startScan}
        </button>
      );
    }

    if (action === "WAIT") {
      return (
        <button className="site-primary-button" type="button" disabled>
          {progressText.processing}
        </button>
      );
    }

    if (action === "PURCHASE_INITIAL") {
      return null;
    }

    if (action === "VIEW_WORK_ORDER" && currentWorkOrder) {
      return (
        <Link
          className="site-primary-button"
          to={`/${locale}/work-orders/${currentWorkOrder.id}`}
        >
          {progressText.viewWorkOrder}
        </Link>
      );
    }

    if (action === "CREATE_NEXT_WORK_ORDER" && workOrderDiagnostic) {
      return (
        <Link
          className="site-primary-button"
          to={`/${locale}/sites/${site.id}/scans/${workOrderDiagnostic.scanId}`}
        >
          {progressText.createWorkOrder}
        </Link>
      );
    }

    if (action === "PURCHASE_EXTRA" && thirdDiagnostic) {
      const params = new URLSearchParams({
        scanId: thirdDiagnostic.scanId,
        plan: "EXTRA_VERIFICATION",
        returnTo: `/${locale}/sites`,
      });

      return (
        <Link
          className="site-primary-button"
          to={`/${locale}/checkout?${params.toString()}`}
        >
          {progressText.purchaseExtra}
        </Link>
      );
    }

    return null;
  }

  if (editing) {
    return (
      <article className="surface site-card">
        <form className="site-form site-edit-form" onSubmit={onUpdate}>
          <div className="site-card-header">
            <h3>{copy.editTitle}</h3>
          </div>
          <SiteFields
            prefix={`edit-${site.id}`}
            form={editForm}
            labels={copy.fields}
            onChange={onEditChange}
          />
          {scanOutdated ? (
            <p className="site-upgrade-notice">{copy.scanOutdatedNotice}</p>
          ) : null}

          <div className="site-card-actions">
            <button
              className="site-primary-button"
              type="submit"
              disabled={working}
            >
              {working ? copy.saving : copy.saveEdit}
            </button>
            <button
              className="site-secondary-button"
              type="button"
              onClick={onCancelEdit}
              disabled={working}
            >
              {copy.cancel}
            </button>
          </div>
        </form>
      </article>
    );
  }

  return (
    <article className="surface site-card">
      <div className="site-card-header">
        <div>
          <span className="site-status">{copy.registered}</span>
          <h3>{site.name}</h3>
        </div>
        <span className="site-locale">
          {site.country} · {site.primaryLocale}
        </span>
      </div>

      <a
        className="site-url"
        href={site.baseUrl}
        target="_blank"
        rel="noreferrer"
      >
        {site.baseUrl}
      </a>

      <dl className="site-meta">
        <div>
          <dt>{copy.fields.description}</dt>
          <dd>{site.description ?? copy.notEntered}</dd>
        </div>
        <div>
          <dt>{copy.finalUrl}</dt>
          <dd>{site.finalUrl ?? copy.checkedAfterScan}</dd>
        </div>
        <div>
          <dt>{copy.createdAt}</dt>
          <dd>{formatKST(site.createdAt, locale)}</dd>
        </div>
      </dl>

      <section className="site-progress-section">
        <div className="site-progress-heading">
          <div>
            <h4>{progressText.progressTitle}</h4>
            <p>{progressText.progressHelp}</p>
          </div>
          <button
            type="button"
            className="site-progress-toggle"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded
              ? progressText.collapseDetails
              : progressText.expandDetails}
          </button>
        </div>

        <div className="site-current-stage">
          <div>
            <span>{progressText.currentStage}</span>
            <strong>
              {currentStageLabel(
                progress,
                locale,
                progressText,
                site.latestScan,
              )}
            </strong>
          </div>
          <div className="site-current-action">{renderNextAction()}</div>
        </div>

        {expanded ? (
          <>
            <div
              className="site-payment-summary"
              aria-label={progressText.progressTitle}
            >
              <span
                className={progress?.payment.initialPaid ? "paid" : "unpaid"}
              >
                {progressText.initialPayment}:{" "}
                {progress?.payment.initialPaid
                  ? progressText.paid
                  : progressText.unpaid}
              </span>
              <span
                className={progress?.payment.extraPaid ? "paid" : "pending"}
              >
                {progressText.extraPayment}:{" "}
                {progress?.payment.extraPaid
                  ? progressText.paid
                  : progressText.extraPaymentGuide}
              </span>
            </div>

            <div className="site-quick-diagnostic">
              <div>
                <span>{progressText.quickDiagnostic}</span>
                <strong>
                  {simpleDiagnostic
                    ? statusLabel(simpleDiagnostic.status, locale, progressText)
                    : progressText.quickNotStarted}
                </strong>
                {simpleDiagnostic?.score !== null &&
                simpleDiagnostic?.score !== undefined ? (
                  <small>
                    {progressText.score(
                      Math.round(simpleDiagnostic.score),
                      simpleDiagnostic.grade ?? "-",
                    )}
                  </small>
                ) : null}
              </div>
              <div className="site-quick-actions">
                {simpleDiagnostic &&
                ["COMPLETED", "PARTIAL", "FAILED"].includes(
                  simpleDiagnostic.status,
                ) ? (
                  <Link
                    className="site-primary-button site-result-primary-button"
                    to={`/${locale}/sites/${site.id}/scans/${simpleDiagnostic.scanId}`}
                  >
                    {copy.viewResult}
                  </Link>
                ) : null}
                {scanOutdated ? (
                  <button
                    className="site-secondary-button"
                    type="button"
                    onClick={onQueueScan}
                    disabled={working || scanPending}
                  >
                    {working ? copy.processing : copy.rescanCurrent}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="site-workflow-heading">
              <strong>{progressText.workflow}</strong>
            </div>

            <div className="site-progress-flow">
              {visibleWorkflowSteps.map((step, index) => {
                const current = isCurrentStep(progress, step.kind, step.number);

                if (step.kind === "DIAGNOSTIC") {
                  const diagnostic = diagnosticStep(site, step.number);
                  const status = diagnostic?.status ?? "PENDING";

                  return (
                    <div
                      className={`site-progress-step ${current ? "current" : ""}`}
                      key={`diagnostic-${step.number}`}
                    >
                      <span className="site-step-index">{index + 1}</span>
                      <div className="site-step-title">
                        <strong>
                          {progressText.diagnosticTitle(step.number)}
                        </strong>
                        <span
                          className={`site-step-status ${statusTone(status)}`}
                        >
                          {diagnostic
                            ? statusLabel(status, locale, progressText)
                            : progressText.status.PENDING}
                        </span>
                      </div>
                      <div className="site-step-detail">
                        {diagnostic ? (
                          <>
                            {diagnostic.score !== null ? (
                              <span>
                                {progressText.score(
                                  Math.round(diagnostic.score),
                                  diagnostic.grade ?? "-",
                                )}
                              </span>
                            ) : null}
                            {diagnostic.completedAt ? (
                              <small>
                                {formatKST(diagnostic.completedAt, locale)}
                              </small>
                            ) : null}
                          </>
                        ) : (
                          <span>{progressText.waitingPrevious}</span>
                        )}
                      </div>
                      <div className="site-step-action">
                        {diagnostic ? (
                          <Link
                            className="site-secondary-button"
                            to={`/${locale}/sites/${site.id}/scans/${diagnostic.scanId}`}
                          >
                            {progressText.viewDiagnostic}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  );
                }

                const workOrder = progress?.workOrders.find(
                  (item) => item.version === step.number,
                );
                const status = workOrder?.status ?? "PENDING";
                const needsExtraPayment =
                  step.number === 3 &&
                  Boolean(diagnosticStep(site, 3)) &&
                  !progress?.payment.extraPaid;

                return (
                  <div
                    className={`site-progress-step ${current ? "current" : ""}`}
                    key={`work-order-${step.number}`}
                  >
                    <span className="site-step-index">{index + 1}</span>
                    <div className="site-step-title">
                      <strong>
                        {progressText.workOrderTitle(step.number)}
                      </strong>
                      <span
                        className={`site-step-status ${statusTone(status)}`}
                      >
                        {workOrder
                          ? statusLabel(status, locale, progressText)
                          : progressText.status.PENDING}
                      </span>
                    </div>
                    <div className="site-step-detail">
                      {workOrder ? (
                        <>
                          <span>
                            {progressText.itemCount(
                              workOrder.itemCount,
                              workOrder.requiredItemCount,
                            )}
                          </span>
                          <small>
                            {formatKST(
                              workOrder.issuedAt ?? workOrder.createdAt,
                              locale,
                            )}
                          </small>
                        </>
                      ) : (
                        <span>
                          {needsExtraPayment
                            ? progressText.extraPaymentRequired
                            : progressText.waitingPrevious}
                        </span>
                      )}
                    </div>
                    <div className="site-step-action">
                      {workOrder ? (
                        <Link
                          className="site-secondary-button"
                          to={`/${locale}/work-orders/${workOrder.id}`}
                        >
                          {progressText.viewWorkOrder}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      <div className="site-card-management">
        <button
          className="site-secondary-button"
          type="button"
          onClick={onBeginEdit}
          disabled={working}
        >
          {copy.edit}
        </button>
        <button
          className="site-danger-button"
          type="button"
          onClick={onArchive}
          disabled={working}
        >
          {copy.delete}
        </button>
      </div>
    </article>
  );
}

interface SiteFieldsProps {
  prefix: string;
  form: SiteFormState;
  labels: typeof sitesCopy.ko.fields | typeof sitesCopy.en.fields;
  onChange: <K extends keyof SiteFormState>(
    key: K,
    value: SiteFormState[K],
  ) => void;
}

function SiteFields({ prefix, form, labels, onChange }: SiteFieldsProps) {
  return (
    <div className="site-fields">
      <label className="site-field-name" htmlFor={`${prefix}-name`}>
        {labels.name}
        <input
          id={`${prefix}-name`}
          name="name"
          value={form.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder={labels.namePlaceholder}
          required
        />
      </label>

      <label className="site-field-url" htmlFor={`${prefix}-url`}>
        {labels.baseUrl}
        <input
          id={`${prefix}-url`}
          name="baseUrl"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={form.baseUrl}
          onChange={(event) => onChange("baseUrl", event.target.value)}
          placeholder={labels.baseUrlPlaceholder}
          required
        />
      </label>

      <label
        className="site-field-description"
        htmlFor={`${prefix}-description`}
      >
        {labels.description}
        <textarea
          id={`${prefix}-description`}
          name="description"
          rows={prefix === "create" ? 1 : 3}
          value={form.description}
          onChange={(event) => onChange("description", event.target.value)}
          placeholder={labels.descriptionPlaceholder}
        />
      </label>

      <label
        className="site-field-reservation"
        htmlFor={`${prefix}-reservation`}
      >
        <input
          id={`${prefix}-reservation`}
          name="hasReservationFeature"
          type="checkbox"
          checked={form.hasReservationFeature}
          onChange={(event) =>
            onChange("hasReservationFeature", event.target.checked)
          }
        />
        {labels.hasReservationFeature}
      </label>
    </div>
  );
}
