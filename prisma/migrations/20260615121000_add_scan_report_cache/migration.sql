-- CreateEnum
CREATE TYPE "ScanReportCacheStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "scan_report_caches" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "report_type" TEXT NOT NULL DEFAULT 'DIAGNOSTIC',
    "cache_key" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "renderer_version" TEXT NOT NULL,
    "font_hash" TEXT NOT NULL,
    "status" "ScanReportCacheStatus" NOT NULL DEFAULT 'GENERATING',
    "pdf_bytes" BYTEA,
    "pdf_sha256" TEXT,
    "size_bytes" INTEGER,
    "generation_token" TEXT,
    "lock_expires_at" TIMESTAMP(3),
    "generated_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_report_caches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scan_report_caches_scan_id_report_type_key"
ON "scan_report_caches"("scan_id", "report_type");

-- CreateIndex
CREATE INDEX "scan_report_caches_status_lock_expires_at_idx"
ON "scan_report_caches"("status", "lock_expires_at");

-- AddForeignKey
ALTER TABLE "scan_report_caches"
ADD CONSTRAINT "scan_report_caches_scan_id_fkey"
FOREIGN KEY ("scan_id") REFERENCES "scans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
