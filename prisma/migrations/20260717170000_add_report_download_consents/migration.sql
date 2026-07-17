CREATE TABLE "report_download_consents" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "scan_id" TEXT NOT NULL,
  "payment_order_id" TEXT,
  "consent_version" TEXT NOT NULL,
  "consent_locale" TEXT NOT NULL,
  "consent_text" TEXT NOT NULL,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "report_download_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "report_download_consents_user_id_scan_id_consent_version_key"
  ON "report_download_consents"("user_id", "scan_id", "consent_version");

CREATE INDEX "report_download_consents_scan_id_accepted_at_idx"
  ON "report_download_consents"("scan_id", "accepted_at");

CREATE INDEX "report_download_consents_payment_order_id_idx"
  ON "report_download_consents"("payment_order_id");

ALTER TABLE "report_download_consents"
  ADD CONSTRAINT "report_download_consents_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_download_consents"
  ADD CONSTRAINT "report_download_consents_scan_id_fkey"
  FOREIGN KEY ("scan_id") REFERENCES "scans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "report_download_consents"
  ADD CONSTRAINT "report_download_consents_payment_order_id_fkey"
  FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
