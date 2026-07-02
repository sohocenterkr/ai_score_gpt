import { env } from "../config/env";
import { AuthError } from "./auth-service";

interface GoogleTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface GoogleProfile {
  providerAccountId: string;
  email: string;
  name: string;
}

export function getGoogleRedirectUri(): string {
  return new URL("/api/auth/google/callback", env.APP_BASE_URL).toString();
}

function assertGoogleOAuthConfigured(): void {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AuthError(
      "AUTH_GOOGLE_NOT_CONFIGURED",
      "Google 로그인 설정이 완료되지 않았습니다.",
      503,
    );
  }
}

export function createGoogleAuthorizationUrl(state: string): string {
  assertGoogleOAuthConfigured();

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", getGoogleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "online");

  return url.toString();
}

export async function exchangeGoogleCodeForProfile(
  code: string,
): Promise<GoogleProfile> {
  assertGoogleOAuthConfigured();

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? "",
      client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  const tokenJson = (await tokenResponse.json().catch(() => null)) as
    | GoogleTokenResponse
    | null;

  if (!tokenResponse.ok || !tokenJson?.access_token) {
    throw new AuthError(
      "AUTH_GOOGLE_TOKEN_FAILED",
      "Google 인증을 완료하지 못했습니다.",
      502,
    );
  }

  const userInfoResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: {
        authorization: `Bearer ${tokenJson.access_token}`,
      },
    },
  );

  const userInfo = (await userInfoResponse.json().catch(() => null)) as
    | GoogleUserInfoResponse
    | null;

  if (
    !userInfoResponse.ok ||
    !userInfo?.sub ||
    !userInfo.email ||
    userInfo.email_verified !== true
  ) {
    throw new AuthError(
      "AUTH_GOOGLE_PROFILE_INVALID",
      "Google 계정의 이메일 인증 정보를 확인할 수 없습니다.",
      403,
    );
  }

  return {
    providerAccountId: userInfo.sub,
    email: userInfo.email,
    name: userInfo.name?.trim() || userInfo.email.split("@")[0] || "Google 사용자",
  };
}
