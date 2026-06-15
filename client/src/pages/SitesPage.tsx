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

const scanStatusLabels: Record<SiteScan["status"], string> = {
  QUEUED: "대기 중",
  RUNNING: "검사 중",
  COMPLETED: "완료",
  PARTIAL: "일부 완료",
  FAILED: "실패",
  CANCELLED: "취소",
};

function formatKST(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function messageFromError(error: unknown): string {
  return error instanceof SiteApiError
    ? error.message
    : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
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
          setErrorMessage(messageFromError(error));
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
  }, []);

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
      setMessage("사이트가 등록되었습니다.");
    } catch (error) {
      setErrorMessage(messageFromError(error));
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
      setMessage("사이트 정보가 수정되었습니다.");
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setWorkingSiteId(null);
    }
  }

  async function handleArchive(site: RegisteredSite) {
    const confirmed = window.confirm(
      `${site.name} 사이트를 목록에서 삭제하시겠습니까? 검사 이력은 보존됩니다.`,
    );

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
      setMessage("사이트가 삭제되었습니다. 기존 검사 이력은 보존됩니다.");
    } catch (error) {
      setErrorMessage(messageFromError(error));
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
      setMessage(
        "검사 작업이 대기열에 등록되었습니다. 검사 실행 후 결과 화면에서 진단 내용을 확인할 수 있습니다.",
      );
    } catch (error) {
      setErrorMessage(messageFromError(error));
    } finally {
      setWorkingSiteId(null);
    }
  }

  return (
    <section className="full-bleed-section sites-section">
      <div className="content-container sites-content">
        <div className="sites-heading">
          <div>
            <p className="eyebrow">SITE MANAGEMENT</p>
            <h1>검사할 사이트 관리</h1>
            <p>
              공개 URL만 등록할 수 있으며, 사설 IP·localhost·내부망은
              자동으로 차단됩니다.
            </p>
          </div>
          <Link className="sites-back-link" to={`/${locale}/dashboard`}>
            대시보드로
          </Link>
        </div>

        <div className="sites-notice" role="note">
          공개 URL의 실제 HTTP 응답과 초기 HTML 증거를 수집합니다.
          점수 계산·검사 결과 화면·작업지시서 생성은 다음 단계에서
          현재 진단 데이터에 연결됩니다.
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
              <h2>새 사이트 등록</h2>
              <p>
                `example.com`처럼 입력하면 HTTPS 주소로 보완하여
                확인합니다.
              </p>
            </div>

            <SiteFields
              prefix="create"
              form={form}
              onChange={(key, value) => updateForm(key, value)}
            />

            <button
              className="site-primary-button"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "확인 중..." : "사이트 등록"}
            </button>
          </form>

          <div className="site-list-panel">
            <div className="site-list-heading">
              <div>
                <h2>등록 사이트</h2>
                <p>사이트 정보 수정·삭제와 검사 작업 등록을 관리합니다.</p>
              </div>
              <span>{sites.length}개</span>
            </div>

            {loading ? (
              <div className="surface sites-empty" role="status">
                사이트 목록을 불러오고 있습니다.
              </div>
            ) : sites.length === 0 ? (
              <div className="surface sites-empty">
                아직 등록한 사이트가 없습니다. 첫 사이트를 등록해 주세요.
              </div>
            ) : (
              <div className="site-list">
                {sites.map((site) => {
                  const scanPending =
                    site.latestScan?.status === "QUEUED" ||
                    site.latestScan?.status === "RUNNING";
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
                            <h3>사이트 정보 수정</h3>
                          </div>
                          <SiteFields
                            prefix={`edit-${site.id}`}
                            form={editForm}
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
                              {working ? "저장 중..." : "수정 저장"}
                            </button>
                            <button
                              className="site-secondary-button"
                              type="button"
                              onClick={() => setEditingId(null)}
                              disabled={working}
                            >
                              취소
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="site-card-header">
                            <div>
                              <span className="site-status">등록 완료</span>
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
                              <dt>업종</dt>
                              <dd>{site.siteType ?? "미입력"}</dd>
                            </div>
                            <div>
                              <dt>지역</dt>
                              <dd>{site.region ?? "미입력"}</dd>
                            </div>
                            <div>
                              <dt>최종 URL</dt>
                              <dd>
                                {site.finalUrl ??
                                  "첫 실제 검사에서 확인"}
                              </dd>
                            </div>
                            <div>
                              <dt>최근 수정(KST)</dt>
                              <dd>{formatKST(site.updatedAt)}</dd>
                            </div>
                          </dl>

                          <div className="scan-summary">
                            <strong>최근 검사 작업</strong>
                            {site.latestScan ? (
                              <span>
                                {scanStatusLabels[site.latestScan.status]} ·{" "}
                                {site.latestScan.type} ·{" "}
                                {formatKST(site.latestScan.createdAt)}
                              </span>
                            ) : (
                              <span>등록된 검사 작업 없음</span>
                            )}
                          </div>

                          <div className="site-card-actions">
                            <button
                              className="site-primary-button"
                              type="button"
                              onClick={() => void handleQueueScan(site)}
                              disabled={working || scanPending}
                            >
                              {scanPending
                                ? "검사 대기 중"
                                : working
                                  ? "처리 중..."
                                  : "간편검사 작업 만들기"}
                            </button>
                            <button
                              className="site-secondary-button"
                              type="button"
                              onClick={() => beginEdit(site)}
                              disabled={working}
                            >
                              수정
                            </button>
                            <button
                              className="site-danger-button"
                              type="button"
                              onClick={() => void handleArchive(site)}
                              disabled={working}
                            >
                              삭제
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
  onChange: (key: keyof SiteFormState, value: string) => void;
}

function SiteFields({ prefix, form, onChange }: SiteFieldsProps) {
  return (
    <div className="site-fields">
      <label htmlFor={`${prefix}-name`}>
        사이트명
        <input
          id={`${prefix}-name`}
          name="name"
          value={form.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="예: Site AI Score"
          required
        />
      </label>

      <label htmlFor={`${prefix}-url`}>
        대표 URL
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
          placeholder="example.com"
          required
        />
      </label>

      <label htmlFor={`${prefix}-type`}>
        업종·사이트 유형
        <input
          id={`${prefix}-type`}
          name="siteType"
          value={form.siteType}
          onChange={(event) => onChange("siteType", event.target.value)}
          placeholder="예: 음식점, 병원, 기업 홈페이지"
        />
      </label>

      <div className="site-field-row">
        <label htmlFor={`${prefix}-country`}>
          국가
          <input
            id={`${prefix}-country`}
            name="country"
            maxLength={2}
            value={form.country}
            onChange={(event) =>
              onChange("country", event.target.value.toUpperCase())
            }
            placeholder="KR"
            required
          />
        </label>

        <label htmlFor={`${prefix}-locale`}>
          기본 언어
          <input
            id={`${prefix}-locale`}
            name="primaryLocale"
            value={form.primaryLocale}
            onChange={(event) =>
              onChange("primaryLocale", event.target.value)
            }
            placeholder="ko"
            required
          />
        </label>
      </div>

      <label htmlFor={`${prefix}-region`}>
        지역
        <input
          id={`${prefix}-region`}
          name="region"
          value={form.region}
          onChange={(event) => onChange("region", event.target.value)}
          placeholder="예: 서울, 경기도"
        />
      </label>
    </div>
  );
}
