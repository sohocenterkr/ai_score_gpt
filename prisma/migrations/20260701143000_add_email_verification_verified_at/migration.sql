-- Track when an email verification link has been confirmed.
ALTER TABLE "email_verification_tokens" ADD COLUMN "verified_at" TIMESTAMP(3);
