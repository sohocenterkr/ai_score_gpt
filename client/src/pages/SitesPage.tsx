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
  type SiteScan,
} from "../sites/site-api";
import "../sites.css";

interface SiteFormState {
  name: string;
  baseUrl: string;
  siteType: string;
  country: string;
  region: string;
  primaryLocale: string;
}

const emptyForm: SiteFormState = {
  name: "",
  baseUrl: "",
  siteType: "",
  country: "KR",
  region: "",
  primaryLocale: "ko",
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
    createHelp:
      "`example.com`처럼 입력하면 HTTPS 주소로 보완하여 확인합니다.",
    checking: "확인 중...",
    createButton: "사이트 등록",
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
    industry: "업종",
    region: "지역/상권",
    finalUrl: "최종 확인 URL",
    createdAt: "등록일(KST)",
    notEntered: "미입력",
    checkedAfterScan: "간편검사 후 자동 확인",
    latestScan: "최근 검사 작업",
    noScan: "등록된 검사 작업 없음",
    score: (score: number, grade: string) => `${score}점 ${grade}`,
    scanWaiting: "검사 대기 중",
    scanComplete: "간편검사 완료",
    processing: "처리 중...",
    startScan: "간편검사 시작",
    viewResult: "결과 보기",
    edit: "수정",
    delete: "삭제",
    createdMessage: "사이트가 등록되었습니다.",
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
      siteType: "업종·사이트 유형",
      siteTypePlaceholder: "예: 음식점, 병원, 기업 홈페이지",
      country: "대상 국가/시장",
      countryPlaceholder: "KR",
      primaryLocale: "검사 기본 언어",
      primaryLocalePlaceholder: "ko",
      region: "지역/상권(선택)",
      regionPlaceholder: "예: 서울, 강남구, 역삼동 (다중 입력가능)",
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
    checking: "Checking...",
    createButton: "Register Website",
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
    industry: "Industry",
    region: "Region / market area",
    finalUrl: "Final checked URL",
    createdAt: "Registered date (KST)",
    notEntered: "Not entered",
    checkedAfterScan: "Automatically checked after simple diagnostic",
    latestScan: "Latest scan job",
    noScan: "No scan job registered",
    score: (score: number, grade: string) => `${score} points ${grade}`,
    scanWaiting: "Scan queued",
    scanComplete: "Simple diagnostic completed",
    processing: "Processing...",
    startScan: "Start Simple Diagnostic",
    viewResult: "View Result",
    edit: "Edit",
    delete: "Delete",
    createdMessage: "The website has been registered.",
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
      siteType: "Industry / website type",
      siteTypePlaceholder: "e.g. restaurant, clinic, company website",
      country: "Target country / market",
      countryPlaceholder: "US",
      primaryLocale: "Primary diagnostic language",
      primaryLocalePlaceholder: "en",
      region: "Region / market area (optional)",
      regionPlaceholder: "e.g. Seoul, Gangnam, New York, local market",
    },
  },
} as const;

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
    siteType: site.siteType ?? "",
    country: site.country,
    region: site.region ?? "",
    primaryLocale: site.primaryLocale,
  };
}

function toRequest(form: SiteFormState) {
  return {
    name: form.name,
    baseUrl: form.baseUrl,
    siteType: form.siteType.trim() || undefined,
    country: form.country,
    region: form.region.trim() || undefined,
    primaryLocale: form.primaryLocale,
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

  function updateForm(
    key: keyof SiteFormState,
    value: string,
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
      setSites((current) => [
        site,
        ...current.filter((item) => item.id !== site.id),
      ]);
      setForm(emptyForm);
      setMessage(copy.createdMessage);
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
        siteType: editForm.siteType.trim() || null,
        region: editForm.region.trim() || null,
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
      setSites((current) =>
        current.filter((item) => item.id !== site.id),
      );
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
      const scan = await queueSiteScanRequest(site.id);
      setSites((current) =>
        current.map((item) =>
          item.id === site.id
            ? { ...item, latestScan: scan }
            : item,
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

            <SiteFields
              prefix="create"
              form={form}
              labels={copy.fields}
              onChange={(key, value) => updateForm(key, value)}
            />

            <button
              className="site-primary-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? copy.checking : copy.createButton}
            </button>
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
              <div className="surface sites-empty">
                {copy.empty}
              </div>
            ) : (
              <div className="site-list">
                {sites.map((site) => {
                  const scanPending =
                    site.latestScan?.status === "QUEUED" ||
                    site.latestScan?.status === "RUNNING";
                  const scanCompleted =
                    site.latestScan?.status === "COMPLETED" ||
                    site.latestScan?.status === "PARTIAL";
                  const working = workingSiteId === site.id;

                  return (
                    <article className="surface site-card" key={site.id}>
                      {editingId === site.id ? (
                        <form
                          className="site-form site-edit-form"
                          onSubmit={(event) =>
                            void handleUpdate(event, site.id)
                          }
                        >
                          <div className="site-card-header">
                            <h3>{copy.editTitle}</h3>
                          </div>
                          <SiteFields
                            prefix={`edit-${site.id}`}
                            form={editForm}
                            labels={copy.fields}
                            onChange={(key, value) =>
                              updateForm(key, value, true)
                            }
                          />
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
                              onClick={() => setEditingId(null)}
                              disabled={working}
                            >
                              {copy.cancel}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
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
                              <dt>{copy.industry}</dt>
                              <dd>{site.siteType ?? copy.notEntered}</dd>
                            </div>
                            <div>
                              <dt>{copy.region}</dt>
                              <dd>{site.region ?? copy.notEntered}</dd>
                            </div>
                            <div>
                              <dt>{copy.finalUrl}</dt>
                              <dd>
                                {site.finalUrl ?? copy.checkedAfterScan}
                              </dd>
                            </div>
                            <div>
                              <dt>{copy.createdAt}</dt>
                              <dd>{formatKST(site.createdAt, normalizedLocale)}</dd>
                            </div>
                          </dl>

                          <div className="scan-summary">
                            <strong>{copy.latestScan}</strong>
                            {site.latestScan ? (
                              <span>
                                {scanLabels[site.latestScan.status]} ·{" "}
                                {site.latestScan.type}
                                {site.latestScan.score !== null ? (
                                  <>
                                    {" "}·{" "}
                                    {copy.score(
                                      Math.round(site.latestScan.score),
                                      site.latestScan.grade ?? "-",
                                    )}
                                  </>
                                ) : null}
                                {" "}·{" "}
                                {formatKST(
                                  site.latestScan.createdAt,
                                  normalizedLocale,
                                )}
                              </span>
                            ) : (
                              <span>{copy.noScan}</span>
                            )}
                          </div>

                          <div className="site-card-actions">
                            <button
                              className="site-primary-button"
                              type="button"
                              onClick={() => void handleQueueScan(site)}
                              disabled={working || scanPending || scanCompleted}
                            >
                              {scanPending
                                ? copy.scanWaiting
                                : scanCompleted
                                  ? copy.scanComplete
                                  : working
                                    ? copy.processing
                                    : copy.startScan}
                            </button>
                            {site.latestScan &&
                            (site.latestScan.status === "COMPLETED" ||
                              site.latestScan.status === "PARTIAL" ||
                              site.latestScan.status === "FAILED") ? (
                              <Link
                                className="site-secondary-button"
                                to={`/${locale}/sites/${site.id}/scans/${site.latestScan.id}`}
                              >
                                {copy.viewResult}
                              </Link>
                            ) : null}
                            <button
                              className="site-secondary-button"
                              type="button"
                              onClick={() => beginEdit(site)}
                              disabled={working}
                            >
                              {copy.edit}
                            </button>
                            <button
                              className="site-danger-button"
                              type="button"
                              onClick={() => void handleArchive(site)}
                              disabled={working}
                            >
                              {copy.delete}
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

interface SiteFieldsProps {
  prefix: string;
  form: SiteFormState;
  labels: typeof sitesCopy.ko.fields | typeof sitesCopy.en.fields;
  onChange: (key: keyof SiteFormState, value: string) => void;
}

function SiteFields({ prefix, form, labels, onChange }: SiteFieldsProps) {
  return (
    <div className="site-fields">
      <label htmlFor={`${prefix}-name`}>
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

      <label htmlFor={`${prefix}-url`}>
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

      <label htmlFor={`${prefix}-type`}>
        {labels.siteType}
        <input
          id={`${prefix}-type`}
          name="siteType"
          value={form.siteType}
          onChange={(event) => onChange("siteType", event.target.value)}
          placeholder={labels.siteTypePlaceholder}
        />
      </label>

      <div className="site-field-row">
        <label htmlFor={`${prefix}-country`}>
          {labels.country}
          <input
            id={`${prefix}-country`}
            name="country"
            maxLength={2}
            value={form.country}
            onChange={(event) =>
              onChange("country", event.target.value.toUpperCase())
            }
            placeholder={labels.countryPlaceholder}
            required
          />
        </label>

        <label htmlFor={`${prefix}-locale`}>
          {labels.primaryLocale}
          <input
            id={`${prefix}-locale`}
            name="primaryLocale"
            value={form.primaryLocale}
            onChange={(event) =>
              onChange("primaryLocale", event.target.value)
            }
            placeholder={labels.primaryLocalePlaceholder}
            required
          />
        </label>
      </div>

      <label htmlFor={`${prefix}-region`}>
        {labels.region}
        <input
          id={`${prefix}-region`}
          name="region"
          value={form.region}
          onChange={(event) => onChange("region", event.target.value)}
          placeholder={labels.regionPlaceholder}
        />
      </label>
    </div>
  );
}
