import { Resend } from "resend";
import { env } from "../config/env";
import type { EmailVerificationDelivery } from "../auth/email-verification-service";

export interface EmailVerificationMailer {
  isConfigured(): boolean;
  sendEmailVerification(delivery: EmailVerificationDelivery): Promise<void>;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}

export function createResendEmailVerificationMailer(): EmailVerificationMailer {
  return {
    isConfigured() {
      return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL);
    },

    async sendEmailVerification(delivery) {
      if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
        throw new Error("Resend 발송 환경변수가 설정되지 않았습니다.");
      }

      const resend = new Resend(env.RESEND_API_KEY);
      const baseUrl = env.APP_BASE_URL.replace(/\/$/, "");
      const verificationUrl =
        `${baseUrl}/${delivery.locale}/signup?email=${encodeURIComponent(
          delivery.to,
        )}&emailVerificationId=${encodeURIComponent(
          delivery.verificationId,
        )}&emailVerificationToken=${encodeURIComponent(delivery.token)}`;
      const fromName = env.RESEND_FROM_NAME || "Site AI Score";
      const from = `${fromName} <${env.RESEND_FROM_EMAIL}>`;
      const safeUrl = escapeHtml(verificationUrl);

      const result = await resend.emails.send({
        from,
        to: delivery.to,
        subject: "[Site AI Score] 회원가입 이메일 인증",
        text: [
          "Site AI Score 회원가입 이메일 인증 요청을 받았습니다.",
          "",
          "아래 링크는 30분 동안 한 번만 사용할 수 있습니다.",
          verificationUrl,
          "",
          "본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
        ].join("\n"),
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.7;color:#172033">
            <h1 style="font-size:24px">회원가입 이메일 인증</h1>
            <p>Site AI Score 회원가입을 계속하려면 아래 버튼을 눌러 이메일 인증을 완료해 주세요.</p>
            <p>아래 버튼은 30분 동안 한 번만 사용할 수 있습니다.</p>
            <p>
              <a href="${safeUrl}"
                 style="display:inline-block;padding:12px 18px;border-radius:8px;background:#3157e5;color:#fff;text-decoration:none;font-weight:700">
                이메일 인증 완료
              </a>
            </p>
            <p style="font-size:13px;color:#647089">
              본인이 요청하지 않았다면 이 메일을 무시해 주세요.
            </p>
          </div>
        `,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }
    },
  };
}
