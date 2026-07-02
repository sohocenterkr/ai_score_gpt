import { Navigate, Route, Routes } from "react-router-dom";
import { defaultLocale } from "../../shared/locales";
import { RequireAuth } from "./auth/RequireAuth";
import { LocaleLayout } from "./components/LocaleLayout";
import { AdminPage } from "./pages/AdminPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeepDiagnosticSetupPage } from "./pages/DeepDiagnosticSetupPage";
import { DeleteAccountPage } from "./pages/DeleteAccountPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ScanResultPage } from "./pages/ScanResultPage";
import { SignupPage } from "./pages/SignupPage";
import { SitesPage } from "./pages/SitesPage";
import { WorkOrderPage } from "./pages/WorkOrderPage";
import { WorkOrdersPage } from "./pages/WorkOrdersPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${defaultLocale}`} replace />} />
      <Route path="/:locale" element={<LocaleLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="dashboard" element={<Navigate to="../sites" replace />} />
        <Route
          path="settings"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="sites"
          element={
            <RequireAuth>
              <SitesPage />
            </RequireAuth>
          }
        />
        <Route
          path="sites/:siteId/deep-diagnostic"
          element={
            <RequireAuth>
              <DeepDiagnosticSetupPage />
            </RequireAuth>
          }
        />
        <Route
          path="sites/:siteId/scans/:scanId"
          element={
            <RequireAuth>
              <ScanResultPage />
            </RequireAuth>
          }
        />
        <Route
          path="work-orders"
          element={
            <RequireAuth>
              <WorkOrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="work-orders/:workOrderId"
          element={
            <RequireAuth>
              <WorkOrderPage />
            </RequireAuth>
          }
        />
        <Route
          path="change-password"
          element={
            <RequireAuth>
              <ChangePasswordPage />
            </RequireAuth>
          }
        />
        <Route
          path="account/delete"
          element={
            <RequireAuth>
              <DeleteAccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="admin"
          element={
            <RequireAuth>
              <AdminPage />
            </RequireAuth>
          }
        />
        <Route path="system" element={<Navigate to="../settings" replace />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
