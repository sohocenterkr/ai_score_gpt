import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

interface AdminOverview {
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  counts: {
    totalUsers: number;
    activeUsers: number;
    suspendedUsers: number;
    totalOrganizations: number;
    totalSites: number;
    totalScans: number;
    completedScans: number;
    totalWorkOrders: number;
  };
  capabilities: {
    noticeManagement: "planned" | "enabled";
    memberManagement: "planned" | "enabled";
    paidFeatureTestBypass: "planned" | "enabled";
  };
}

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MemberSiteSummary {
  siteId: string;
  siteName: string;
  baseUrl: string;
  finalUrl: string | null;
  diagnosisCount: number;
  firstScore: string | null;
  secondScore: string | null;
  latestScore: string | null;
  bestScore: string | null;
  improvement: string | null;
  latestDiagnosisAt: string | null;
}

interface MemberItem {
  id: string;
  name: string;
  email: string;
  role: "USER" | "AGENCY" | "SUPER_ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  authProviders: string[];
  sites: MemberSiteSummary[];
}

interface NoticeListResponse {
  notices: NoticeItem[];
}

interface NoticeResponse {
  notice: NoticeItem;
}

interface MemberListResponse {
  members: MemberItem[];
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | (T & { message?: string })
    | null;

  if (!response.ok || !body) {
    throw new Error(body?.message ?? "요청을 처리하지 못했습니다.");
  }

  return body;
}

async function fetchAdminOverview(): Promise<AdminOverview> {
  const response = await fetch("/api/admin/overview", {
    credentials: "same-origin",
  });

  return readJson<AdminOverview>(response);
}

async function fetchNotices(): Promise<NoticeItem[]> {
  const response = await fetch("/api/admin/notices", {
    credentials: "same-origin",
  });
  const body = await readJson<NoticeListResponse>(response);

  return body.notices;
}

async function fetchMembers(input: {
  q: string;
  status: string;
}): Promise<MemberItem[]> {
  const params = new URLSearchParams();

  if (input.q.trim()) {
    params.set("q", input.q.trim());
  }

  if (input.status) {
    params.set("status", input.status);
  }

  const response = await fetch(`/api/admin/members?${params.toString()}`, {
    credentials: "same-origin",
  });
  const body = await readJson<MemberListResponse>(response);

  return body.members;
}

async function saveNotice(input: {
  noticeId: string | null;
  title: string;
  content: string;
  startsAt: string;
  endsAt: string;
}): Promise<NoticeItem> {
  const response = await fetch(
    input.noticeId
      ? `/api/admin/notices/${input.noticeId}`
      : "/api/admin/notices",
    {
      method: input.noticeId ? "PUT" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        content: input.content,
        startsAt: input.startsAt
          ? new Date(input.startsAt).toISOString()
          : null,
        endsAt: input.endsAt ? new Date(input.endsAt).toISOString() : null,
      }),
    },
  );
  const body = await readJson<NoticeResponse>(response);

  return body.notice;
}

async function deleteNotice(noticeId: string): Promise<void> {
  const response = await fetch(`/api/admin/notices/${noticeId}`, {
    method: "DELETE",
    credentials: "same-origin",
  });

  await readJson<{ message: string }>(response);
}

async function updateMemberStatus(
  memberId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<void> {
  const response = await fetch(`/api/admin/members/${memberId}/status`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  await readJson<{ member: unknown }>(response);
}

async function deleteMember(
  memberId: string,
  adminPassword: string,
): Promise<void> {
  const response = await fetch(`/api/admin/members/${memberId}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminPassword }),
  });

  await readJson<{ message: string }>(response);
}

function formatCapability(value: "planned" | "enabled"): string {
  return value === "enabled" ? "사용 가능" : "구현 예정";
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "영구";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function providerLabel(providers: string[]): string {
  if (providers.length === 0) {
    return "-";
  }

  return providers
    .map((provider) => {
      if (provider === "LOCAL") {
        return "이메일";
      }

      if (provider === "GOOGLE") {
        return "Google";
      }

      if (provider === "SECRET_ADMIN") {
        return "수퍼관리자";
      }

      return provider;
    })
    .join(", ");
}

function score(value: string | null): string {
  return value ?? "-";
}

export function AdminPage() {
  const { locale = "ko" } = useParams();
  const { state } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberStatus, setMemberStatus] = useState("ALL");
  const [message, setMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeError, setNoticeError] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [memberError, setMemberError] = useState("");
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null);
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [noticeStartsAt, setNoticeStartsAt] = useState("");
  const [noticeEndsAt, setNoticeEndsAt] = useState("");
  const [savingNotice, setSavingNotice] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const isSuperAdmin =
    state.status === "authenticated" &&
    state.user.role === "SUPER_ADMIN" &&
    state.user.email.trim().toLowerCase() === "sohocenter.kr@gmail.com";

  async function reloadNotices() {
    const data = await fetchNotices();
    setNotices(data);
  }

  async function reloadMembers(
    q = memberQuery,
    status = memberStatus,
  ): Promise<void> {
    setLoadingMembers(true);

    try {
      const data = await fetchMembers({ q, status });
      setMembers(data);
      setMemberError("");
    } catch (error) {
      setMemberError(
        error instanceof Error
          ? error.message
          : "회원 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoadingMembers(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    if (!isSuperAdmin) {
      return;
    }

    Promise.all([
      fetchAdminOverview(),
      fetchNotices(),
      fetchMembers({ q: "", status: "ALL" }),
    ])
      .then(([overviewData, noticeData, memberData]) => {
        if (!cancelled) {
          setOverview(overviewData);
          setNotices(noticeData);
          setMembers(memberData);
          setMessage("");
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "관리자 정보를 불러오지 못했습니다.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin]);

  if (state.status === "loading") {
    return (
      <section className="full-bleed-section admin-section">
        <div className="content-container admin-container" role="status">
          로그인 상태를 확인하고 있습니다.
        </div>
      </section>
    );
  }

  if (state.status === "anonymous") {
    return <Navigate to={`/${locale}/login`} replace />;
  }

  if (!isSuperAdmin) {
    return (
      <section className="full-bleed-section admin-section">
        <div className="content-container admin-container surface">
          <div className="auth-heading">
            <p className="eyebrow">ADMIN</p>
            <h1>접근 권한이 없습니다</h1>
            <p>총관리자만 접근할 수 있는 페이지입니다.</p>
          </div>
          <Link className="auth-submit" to={`/${locale}`}>
            홈으로 이동
          </Link>
        </div>
      </section>
    );
  }

  function resetNoticeForm() {
    setEditingNoticeId(null);
    setNoticeTitle("");
    setNoticeContent("");
    setNoticeStartsAt("");
    setNoticeEndsAt("");
    setNoticeError("");
    setNoticeMessage("");
  }

  function editNotice(notice: NoticeItem) {
    setEditingNoticeId(notice.id);
    setNoticeTitle(notice.title);
    setNoticeContent(notice.content);
    setNoticeStartsAt(toDateTimeLocalValue(notice.startsAt));
    setNoticeEndsAt(toDateTimeLocalValue(notice.endsAt));
    setNoticeError("");
    setNoticeMessage("");
  }

  async function handleNoticeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNoticeError("");
    setNoticeMessage("");

    if (!noticeTitle.trim() || !noticeContent.trim()) {
      setNoticeError("공지 제목과 내용을 입력해 주세요.");
      return;
    }

    if (
      noticeStartsAt &&
      noticeEndsAt &&
      new Date(noticeStartsAt).getTime() > new Date(noticeEndsAt).getTime()
    ) {
      setNoticeError("게시 종료 날짜는 게시 시작 날짜보다 늦어야 합니다.");
      return;
    }

    setSavingNotice(true);

    try {
      await saveNotice({
        noticeId: editingNoticeId,
        title: noticeTitle,
        content: noticeContent,
        startsAt: noticeStartsAt,
        endsAt: noticeEndsAt,
      });
      await reloadNotices();
      resetNoticeForm();
      setNoticeMessage(
        editingNoticeId ? "공지사항을 수정했습니다." : "공지사항을 등록했습니다.",
      );
    } catch (error) {
      setNoticeError(
        error instanceof Error
          ? error.message
          : "공지사항을 저장하지 못했습니다.",
      );
    } finally {
      setSavingNotice(false);
    }
  }

  async function handleNoticeDelete(notice: NoticeItem) {
    const ok = window.confirm(`공지사항 “${notice.title}”을 삭제할까요?`);

    if (!ok) {
      return;
    }

    setNoticeError("");
    setNoticeMessage("");

    try {
      await deleteNotice(notice.id);
      await reloadNotices();

      if (editingNoticeId === notice.id) {
        resetNoticeForm();
      }

      setNoticeMessage("공지사항을 삭제했습니다.");
    } catch (error) {
      setNoticeError(
        error instanceof Error
          ? error.message
          : "공지사항을 삭제하지 못했습니다.",
      );
    }
  }

  async function handleMemberSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMemberMessage("");
    await reloadMembers(memberQuery, memberStatus);
  }

  async function handleMemberStatus(member: MemberItem) {
    const nextStatus = member.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const actionLabel = nextStatus === "SUSPENDED" ? "정지" : "활성화";
    const ok = window.confirm(`${member.email} 계정을 ${actionLabel}할까요?`);

    if (!ok) {
      return;
    }

    setMemberError("");
    setMemberMessage("");

    try {
      await updateMemberStatus(member.id, nextStatus);
      await reloadMembers();
      setMemberMessage(`회원 계정을 ${actionLabel}했습니다.`);
    } catch (error) {
      setMemberError(
        error instanceof Error
          ? error.message
          : "회원 상태를 변경하지 못했습니다.",
      );
    }
  }

  async function handleMemberDelete(member: MemberItem) {
    if (member.role === "SUPER_ADMIN") {
      setMemberError("총관리자 계정은 삭제할 수 없습니다.");
      return;
    }

    const ok = window.confirm(
      `${member.email} 회원을 삭제할까요?\n회원의 단독 조직, 사이트, 진단 데이터도 함께 삭제될 수 있습니다.`,
    );

    if (!ok) {
      return;
    }

    const adminPassword = window.prompt(
      "회원 삭제를 위해 총관리자 본인 비밀번호를 다시 입력해 주세요.",
    );

    if (!adminPassword) {
      return;
    }

    setMemberError("");
    setMemberMessage("");

    try {
      await deleteMember(member.id, adminPassword);
      await reloadMembers();
      setMemberMessage("회원을 삭제했습니다.");
    } catch (error) {
      setMemberError(
        error instanceof Error
          ? error.message
          : "회원을 삭제하지 못했습니다.",
      );
    }
  }

  return (
    <section className="full-bleed-section admin-section">
      <div className="content-container admin-container">
        <div className="auth-heading">
          <p className="eyebrow">SUPER ADMIN</p>
          <h1>관리자 페이지</h1>
          <p>총관리자 전용 관리 화면입니다.</p>
        </div>

        <div className="admin-panel surface">
          <h2>관리자 인증</h2>
          <p>
            현재 로그인: <strong>{state.user.email}</strong>
          </p>

          <Link className="auth-submit" to={`/${locale}/sites`}>
            사이트로 이동
          </Link>
          <p className="field-guide">
            현재 세션이 유지되므로 사이트 이동 후에도 자동 로그인 상태로
            테스트할 수 있습니다.
          </p>

          {message ? (
            <p className="auth-message auth-error" role="alert">
              {message}
            </p>
          ) : null}

          {overview ? (
            <>
              <h2>운영 현황</h2>
              <div className="admin-metric-grid">
                <p>전체 회원: {overview.counts.totalUsers}</p>
                <p>활성 회원: {overview.counts.activeUsers}</p>
                <p>정지 회원: {overview.counts.suspendedUsers}</p>
                <p>조직: {overview.counts.totalOrganizations}</p>
                <p>사이트: {overview.counts.totalSites}</p>
                <p>전체 진단: {overview.counts.totalScans}</p>
                <p>완료 진단: {overview.counts.completedScans}</p>
                <p>작업지시서: {overview.counts.totalWorkOrders}</p>
              </div>

              <h2>관리 기능</h2>
              <div className="admin-metric-grid">
                <p>
                  공지사항 팝업 관리:{" "}
                  {formatCapability(overview.capabilities.noticeManagement)}
                </p>
                <p>
                  회원 관리:{" "}
                  {formatCapability(overview.capabilities.memberManagement)}
                </p>
                <p>
                  유료 기능 무료 테스트:{" "}
                  {formatCapability(
                    overview.capabilities.paidFeatureTestBypass,
                  )}
                </p>
              </div>
            </>
          ) : (
            <p role="status">관리자 정보를 불러오고 있습니다.</p>
          )}

          <h2>회원 관리</h2>
          <form onSubmit={handleMemberSearch}>
            <label htmlFor="member-query">회원/사이트 검색</label>
            <input
              id="member-query"
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="이름, 이메일, 사이트명, 대표 URL"
            />

            <label htmlFor="member-status">상태 필터</label>
            <select
              id="member-status"
              value={memberStatus}
              onChange={(event) => setMemberStatus(event.target.value)}
            >
              <option value="ALL">전체</option>
              <option value="ACTIVE">활성</option>
              <option value="SUSPENDED">정지</option>
            </select>

            <button className="auth-submit" type="submit" disabled={loadingMembers}>
              {loadingMembers ? "검색 중..." : "검색/새로고침"}
            </button>
          </form>

          {memberMessage ? (
            <p className="auth-message auth-success" role="status">
              {memberMessage}
            </p>
          ) : null}

          {memberError ? (
            <p className="auth-message auth-error" role="alert">
              {memberError}
            </p>
          ) : null}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">ID</th>
                  <th align="left">이름</th>
                  <th align="left">이메일</th>
                  <th align="left">가입일</th>
                  <th align="left">상태</th>
                  <th align="left">가입 방식</th>
                  <th align="left">사이트/진단</th>
                  <th align="left">관리</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} style={{ verticalAlign: "top" }}>
                    <td style={{ padding: "10px 8px" }}>
                      <code>{member.id}</code>
                    </td>
                    <td style={{ padding: "10px 8px" }}>{member.name}</td>
                    <td style={{ padding: "10px 8px" }}>{member.email}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {formatDate(member.createdAt)}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {member.status === "ACTIVE" ? "활성" : "정지"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {providerLabel(member.authProviders)}
                    </td>
                    <td style={{ padding: "10px 8px", minWidth: "360px" }}>
                      {member.sites.length > 0 ? (
                        <div style={{ display: "grid", gap: "12px" }}>
                          {member.sites.map((site) => (
                            <div key={site.siteId}>
                              <strong>{site.siteName}</strong>
                              <br />
                              <span>{site.baseUrl}</span>
                              <br />
                              <span>
                                진단 {site.diagnosisCount}회 / 1차{" "}
                                {score(site.firstScore)} / 2차{" "}
                                {score(site.secondScore)} / 최근{" "}
                                {score(site.latestScore)} / 최고{" "}
                                {score(site.bestScore)} / 개선폭{" "}
                                {score(site.improvement)}
                              </span>
                              <br />
                              <span>
                                최근 진단일:{" "}
                                {formatDate(site.latestDiagnosisAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        "진단 사이트 없음"
                      )}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      {member.role === "SUPER_ADMIN" ? (
                        "총관리자"
                      ) : (
                        <div style={{ display: "grid", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => void handleMemberStatus(member)}
                          >
                            {member.status === "ACTIVE" ? "정지" : "활성화"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMemberDelete(member)}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "16px" }}>
                      표시할 회원이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <h2>공지사항 팝업 관리</h2>
          <form onSubmit={handleNoticeSubmit}>
            <label htmlFor="notice-title">공지 제목</label>
            <input
              id="notice-title"
              value={noticeTitle}
              onChange={(event) => setNoticeTitle(event.target.value)}
              maxLength={100}
              required
            />

            <label htmlFor="notice-content">공지 내용</label>
            <textarea
              id="notice-content"
              value={noticeContent}
              onChange={(event) => setNoticeContent(event.target.value)}
              rows={6}
              maxLength={2000}
              required
            />

            <label htmlFor="notice-starts-at">게시 시작 날짜</label>
            <input
              id="notice-starts-at"
              type="datetime-local"
              value={noticeStartsAt}
              onChange={(event) => setNoticeStartsAt(event.target.value)}
            />
            <p className="field-guide">
              비워두면 시작일 제한 없이 바로 게시됩니다.
            </p>

            <label htmlFor="notice-ends-at">게시 종료 날짜</label>
            <input
              id="notice-ends-at"
              type="datetime-local"
              value={noticeEndsAt}
              onChange={(event) => setNoticeEndsAt(event.target.value)}
            />
            <p className="field-guide">
              비워두면 종료일 없이 계속 게시됩니다.
            </p>

            {noticeMessage ? (
              <p className="auth-message auth-success" role="status">
                {noticeMessage}
              </p>
            ) : null}

            {noticeError ? (
              <p className="auth-message auth-error" role="alert">
                {noticeError}
              </p>
            ) : null}

            <button className="auth-submit" type="submit" disabled={savingNotice}>
              {savingNotice
                ? "저장 중..."
                : editingNoticeId
                  ? "공지사항 수정"
                  : "공지사항 등록"}
            </button>

            {editingNoticeId ? (
              <button
                className="auth-submit"
                type="button"
                onClick={resetNoticeForm}
              >
                새 공지 작성
              </button>
            ) : null}
          </form>

          <h3>등록된 공지사항</h3>
          {notices.length > 0 ? (
            <div style={{ display: "grid", gap: "16px" }}>
              {notices.map((notice) => (
                <article
                  key={notice.id}
                  className="surface"
                  style={{ padding: "16px" }}
                >
                  <h4>{notice.title}</h4>
                  <p style={{ whiteSpace: "pre-wrap" }}>{notice.content}</p>
                  <p className="field-guide">
                    게시 시작: {formatDateTime(notice.startsAt)} / 게시 종료:{" "}
                    {formatDateTime(notice.endsAt)}
                  </p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => editNotice(notice)}>
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleNoticeDelete(notice)}
                    >
                      삭제
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="field-guide">등록된 공지사항이 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}
