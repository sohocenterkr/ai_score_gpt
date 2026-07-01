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
import type { AuthState } from "./types";

interface AuthContextValue {
  state: AuthState;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  async function refresh() {
    try {
      const session = await fetchSession();
      setState(
        session.authenticated && session.user
          ? { status: "authenticated", user: session.user }
          : { status: "anonymous" },
      );
    } catch {
      setState({ status: "anonymous" });
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      async login(input) {
        const response = await loginRequest(input);
        setState({ status: "authenticated", user: response.user });
      },
      async signup(input) {
        await signupRequest(input);
      },
      async deleteAccount(input) {
        await deleteAccountRequest(input);
        setState({ status: "anonymous" });
      },
      async logout() {
        await logoutRequest();
        setState({ status: "anonymous" });
      },
      refresh,
    }),
    [state],
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
