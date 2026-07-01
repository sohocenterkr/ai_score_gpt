-- Add persistent login failure tracking and temporary account lock fields.
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);

CREATE INDEX "users_locked_until_idx" ON "users"("locked_until");
