import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  deleteAccountRequest,
  fetchSession,
  loginRequest,
  logoutRequest,
  signupRequest,
} from "./auth-api";
import {
  canUseDevUserPreviewClient,
  readDevUserPreview,
  writeDevUserPreview,
} from "./dev-user-preview";
import type { AuthState, AuthUser } from "./types";

interface AuthContextValue {
  state: AuthState;
  canUseUserPreview: boolean;
  isUserPreview: boolean;
  setUserPreview(enabled: boolean): void;
  login(input: { email: string; password: string }): Promise<void>;
  signup(input: {
    email: string;
    name: string;
    password: string;
    passwordConfirm: string;
    locale: string;
    termsAccepted: true;
    privacyAccepted: true;
  }): Promise<void>;
  deleteAccount(input: {
    currentPassword: string;
    confirmation: string;
  }): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function isActualSuperAdmin(user: AuthUser): boolean {
  return (
    user.role === "SUPER_ADMIN" &&
    user.email.trim().toLowerCase() === "sohocenter.kr@gmail.com"
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [actualState, setActualState] = useState<AuthState>({
    status: "loading",
  });
  const [isUserPreview, setIsUserPreviewState] = useState(() =>
    readDevUserPreview(),
  );

  async function refresh() {
    try {
      const session = await fetchSession();
      setActualState(
        session.authenticated && session.user
          ? { status: "authenticated", user: session.user }
          : { status: "anonymous" },
      );
    } catch {
      setActualState({ status: "anonymous" });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const canUseUserPreview =
    canUseDevUserPreviewClient() &&
    actualState.status === "authenticated" &&
    isActualSuperAdmin(actualState.user);

  useEffect(() => {
    if (
      actualState.status !== "loading" &&
      !canUseUserPreview &&
      isUserPreview
    ) {
      writeDevUserPreview(false);
      setIsUserPreviewState(false);
    }
  }, [actualState.status, canUseUserPreview, isUserPreview]);

  const state = useMemo<AuthState>(() => {
    if (
      isUserPreview &&
      canUseUserPreview &&
      actualState.status === "authenticated"
    ) {
      return {
        status: "authenticated",
        user: {
          ...actualState.user,
          role: "USER",
        },
      };
    }

    return actualState;
  }, [actualState, canUseUserPreview, isUserPreview]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      canUseUserPreview,
      isUserPreview,
      setUserPreview(enabled) {
        const nextEnabled = Boolean(enabled && canUseUserPreview);
        writeDevUserPreview(nextEnabled);
        setIsUserPreviewState(nextEnabled);
      },
      async login(input) {
        const response = await loginRequest(input);
        writeDevUserPreview(false);
        setIsUserPreviewState(false);
        setActualState({ status: "authenticated", user: response.user });
      },
      async signup(input) {
        await signupRequest(input);
      },
      async deleteAccount(input) {
        await deleteAccountRequest(input);
        writeDevUserPreview(false);
        setIsUserPreviewState(false);
        setActualState({ status: "anonymous" });
      },
      async logout() {
        await logoutRequest();
        writeDevUserPreview(false);
        setIsUserPreviewState(false);
        setActualState({ status: "anonymous" });
      },
      refresh,
    }),
    [canUseUserPreview, isUserPreview, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("AuthProvider 안에서 useAuth를 사용해야 합니다.");
  }

  return context;
}
