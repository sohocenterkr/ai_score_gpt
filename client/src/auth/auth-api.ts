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

interface MessageResponse {
  message: string;
}

interface ResetTokenValidationResponse {
  valid: boolean;
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
  passwordConfirm: string;
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

export async function forgotPasswordRequest(
  email: string,
): Promise<MessageResponse> {
  const response = await fetch("/api/auth/forgot-password", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  return readResponse<MessageResponse>(response);
}

export async function validateResetTokenRequest(
  token: string,
): Promise<ResetTokenValidationResponse> {
  const response = await fetch("/api/auth/validate-reset-token", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  return readResponse<ResetTokenValidationResponse>(response);
}

export async function resetPasswordRequest(input: {
  token: string;
  newPassword: string;
}): Promise<MessageResponse> {
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  return readResponse<MessageResponse>(response);
}

export async function changePasswordRequest(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const response = await fetch("/api/auth/change-password", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;

    throw new AuthApiError(
      body?.code ?? "CHANGE_PASSWORD_FAILED",
      body?.message ?? "비밀번호를 변경하지 못했습니다.",
    );
  }
}
