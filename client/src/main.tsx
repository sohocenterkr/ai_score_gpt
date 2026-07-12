import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { installDevUserPreviewFetch } from "./auth/dev-user-preview";
import "@fontsource/noto-sans-kr/400.css";
import "@fontsource/noto-sans-kr/700.css";
import "@fontsource/noto-sans-kr/800.css";
import "@fontsource/noto-sans-kr/900.css";
import "./styles.css";
import "./auth.css";

installDevUserPreviewFetch();

const root = document.getElementById("root");

if (!root) {
  throw new Error("루트 요소를 찾을 수 없습니다.");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
