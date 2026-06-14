export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "AGENCY" | "SUPER_ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  emailVerifiedAt: string | null;
  loginCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AuthUser };
