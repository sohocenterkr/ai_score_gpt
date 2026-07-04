import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

interface NoticePopupItem {
  id: string;
  title: string;
  content: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NoticeActiveResponse {
  notices: NoticePopupItem[];
}

function getTodayKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCookie(name: string): string | null {
  const target = `${name}=`;

  for (const entry of document.cookie.split(";")) {
    const cookie = entry.trim();

    if (cookie.startsWith(target)) {
      return decodeURIComponent(cookie.slice(target.length));
    }
  }

  return null;
}

function setCookieUntilTomorrow(name: string, value: string): void {
  const expires = new Date();
  expires.setHours(24, 0, 0, 0);

  document.cookie = `${name}=${encodeURIComponent(
    value,
  )}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function getHiddenCookieName(noticeId: string): string {
  return `siteaiscore_notice_hidden_${noticeId}`;
}

function isHiddenToday(noticeId: string): boolean {
  return getCookie(getHiddenCookieName(noticeId)) === getTodayKey();
}

export function NoticePopup() {
  const { locale = "ko" } = useParams();
  const [notice, setNotice] = useState<NoticePopupItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (locale === "en") {
      setNotice(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadNotice() {
      try {
        const response = await fetch("/api/notices/active", {
          credentials: "same-origin",
        });

        const body = (await response.json().catch(() => null)) as
          | NoticeActiveResponse
          | null;

        if (cancelled || !response.ok || !body) {
          return;
        }

        const visibleNotice =
          body.notices.find((item) => !isHiddenToday(item.id)) ?? null;

        setNotice(visibleNotice);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadNotice();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  if (locale === "en" || loading || !notice) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-popup-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "rgba(15, 23, 42, 0.48)",
      }}
    >
      <div
        className="surface"
        style={{
          width: "min(92vw, 520px)",
          maxHeight: "82vh",
          overflow: "auto",
          padding: "24px",
          borderRadius: "24px",
          boxShadow: "0 24px 70px rgba(15, 23, 42, 0.25)",
          background: "white",
        }}
      >
        <p className="eyebrow">NOTICE</p>
        <h2 id="notice-popup-title" style={{ marginTop: 0 }}>
          {notice.title}
        </h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{notice.content}</p>

        <div
          style={{
            display: "grid",
            gap: "10px",
            marginTop: "20px",
          }}
        >
          <button
            className="auth-submit"
            type="button"
            onClick={() => {
              setCookieUntilTomorrow(
                getHiddenCookieName(notice.id),
                getTodayKey(),
              );
              setNotice(null);
            }}
          >
            오늘은 더 이상 보지 않기
          </button>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{
              border: 0,
              background: "transparent",
              textDecoration: "underline",
              cursor: "pointer",
              padding: "10px",
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
