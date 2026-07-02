import { useEffect, useState } from "react";
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

async function fetchAdminOverview(): Promise<AdminOverview> {
  const response = await fetch("/api/admin/overview", {
    credentials: "same-origin",
  });

  const body = (await response.json().catch(() => null)) as
    | (AdminOverview & { message?: string })
    | null;

  if (!response.ok || !body) {
    throw new Error(body?.message ?? "관리자 정보를 불러오지 못했습니다.");
  }

  return body;
}

function formatCapability(value: "planned" | "enabled"): string {
  return value === "enabled" ? "사용 가능" : "구현 예정";
}

export function AdminPage() {
  const { locale = "ko" } = useParams();
  const { state } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (
      state.status !== "authenticated" ||
      state.user.role !== "SUPER_ADMIN" ||
      state.user.email.trim().toLowerCase() !== "sohocenter.kr@gmail.com"
    ) {
      return;
    }

    fetchAdminOverview()
      .then((data) => {
        if (!cancelled) {
          setOverview(data);
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
  }, [state]);

  if (state.status === "loading") {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container" role="status">
          로그인 상태를 확인하고 있습니다.
        </div>
      </section>
    );
  }

  if (state.status === "anonymous") {
    return <Navigate to={`/${locale}/login`} replace />;
  }

  const isSuperAdmin =
    state.user.role === "SUPER_ADMIN" &&
    state.user.email.trim().toLowerCase() === "sohocenter.kr@gmail.com";

  if (!isSuperAdmin) {
    return (
      <section className="full-bleed-section auth-section">
        <div className="content-container auth-container surface">
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

  return (
    <section className="full-bleed-section auth-section">
      <div className="content-container auth-container">
        <div className="auth-heading">
          <p className="eyebrow">SUPER ADMIN</p>
          <h1>관리자 페이지</h1>
          <p>총관리자 전용 관리 화면입니다.</p>
        </div>

        <div className="auth-form surface">
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
        </div>
      </div>
    </section>
  );
}
