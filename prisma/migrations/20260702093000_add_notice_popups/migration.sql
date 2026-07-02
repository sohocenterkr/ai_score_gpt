CREATE TABLE "notice_popups" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notice_popups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notice_popups_starts_at_idx" ON "notice_popups"("starts_at");
CREATE INDEX "notice_popups_ends_at_idx" ON "notice_popups"("ends_at");
