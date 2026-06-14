import type { AuthUser } from "./types";

export class AuthApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

interface AuthResponse {
  user: AuthUser;
}

interface SessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as
    | (T & { code?: string; message?: string })
    | null;

  if (!response.ok) {
    throw new AuthApiError(
      body?.code ?? "REQUEST_FAILED",
      body?.message ?? "요청을 처리하지 못했습니다.",
    );
  }

  if (!body) {
    throw new AuthApiError(
      "INVALID_RESPONSE",
      "서버 응답을 확인할 수 없습니다.",
    );
  }

  return body;
}

export async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
  });

  return readResponse<SessionResponse>(response);
}

export async function signupRequest(input: {
  email: string;
  name: string;
  password: string;
  termsAccepted: true;
  privacyAccepted: true;
}): Promise<AuthResponse> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return readResponse<AuthResponse>(response);
}

export async function loginRequest(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return readResponse<AuthResponse>(response);
}

export async function logoutRequest(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;

    throw new AuthApiError(
      body?.code ?? "LOGOUT_FAILED",
      body?.message ?? "로그아웃하지 못했습니다.",
    );
  }
}
