const STORAGE_KEY = "site-ai-score:dev-user-preview";
const PREVIEW_HEADER = "X-Site-AI-Dev-User-Preview";
const PREVIEW_QUERY = "devUserPreview";
const FETCH_INSTALL_KEY = "__siteAiDevUserPreviewFetchInstalled";

export function canUseDevUserPreviewClient(): boolean {
  const meta = import.meta as ImportMeta & {
    env?: {
      DEV?: boolean;
    };
  };

  return typeof window !== "undefined" && meta.env?.DEV === true;
}

function canUseBrowserStorage(): boolean {
  return canUseDevUserPreviewClient();
}

export function readDevUserPreview(): boolean {
  if (!canUseBrowserStorage()) {
    return false;
  }

  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDevUserPreview(enabled: boolean): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  try {
    if (enabled) {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // 브라우저 저장소를 사용할 수 없으면 현재 화면 상태만 사용합니다.
  }
}

function isSameOriginApiUrl(value: string): boolean {
  try {
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

export function installDevUserPreviewFetch(): void {
  if (!canUseBrowserStorage()) {
    return;
  }

  const previewWindow = window as typeof window & {
    [FETCH_INSTALL_KEY]?: boolean;
  };

  if (previewWindow[FETCH_INSTALL_KEY]) {
    return;
  }

  previewWindow[FETCH_INSTALL_KEY] = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (!readDevUserPreview()) {
      return originalFetch(input, init);
    }

    const request = input instanceof Request ? input : null;
    const requestUrl = request?.url ?? String(input);

    if (!isSameOriginApiUrl(requestUrl)) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init?.headers ?? request?.headers);
    headers.set(PREVIEW_HEADER, "1");

    if (request) {
      return originalFetch(
        new Request(request, {
          ...init,
          headers,
        }),
      );
    }

    return originalFetch(input, {
      ...init,
      headers,
    });
  };
}

export function withDevUserPreviewQuery(url: string): string {
  if (!readDevUserPreview()) {
    return url;
  }

  const parsed = new URL(url, window.location.href);

  if (parsed.origin !== window.location.origin) {
    return url;
  }

  parsed.searchParams.set(PREVIEW_QUERY, "1");
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
