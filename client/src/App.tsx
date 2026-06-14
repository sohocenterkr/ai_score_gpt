import { Navigate, Route, Routes } from "react-router-dom";
import { defaultLocale } from "../../shared/locales";
import { LocaleLayout } from "./components/LocaleLayout";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SystemPage } from "./pages/SystemPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${defaultLocale}`} replace />} />
      <Route path="/:locale" element={<LocaleLayout />}>
        <Route index element={<HomePage />} />
        <Route path="system" element={<SystemPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
