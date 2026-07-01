-- Keep a non-reversible hash of withdrawn account emails to block re-registration.
CREATE TABLE "deleted_account_emails" (
  "id" TEXT NOT NULL,
  "email_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deleted_account_emails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deleted_account_emails_email_hash_key"
ON "deleted_account_emails"("email_hash");
