-- CreateEnum
CREATE TYPE "VerificationAttemptStatus" AS ENUM ('QUEUED', 'RUNNING', 'EVALUATING', 'PASSED', 'REWORK_REQUIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "VerificationItemResultStatus" AS ENUM ('PASS', 'FAIL', 'BLOCKED', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "scans" ADD COLUMN "target_url" TEXT;

-- CreateTable
CREATE TABLE "verification_attempts" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "submitted_url" TEXT NOT NULL,
    "status" "VerificationAttemptStatus" NOT NULL DEFAULT 'QUEUED',
    "score_after" DOUBLE PRECISION,
    "grade_after" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_code" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_item_results" (
    "id" TEXT NOT NULL,
    "verification_attempt_id" TEXT NOT NULL,
    "work_order_item_id" TEXT NOT NULL,
    "status" "VerificationItemResultStatus" NOT NULL,
    "criteria_results_json" JSONB NOT NULL,
    "evidence_json" JSONB,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_item_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_attempts_scan_id_key" ON "verification_attempts"("scan_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_attempts_work_order_id_attempt_number_key" ON "verification_attempts"("work_order_id", "attempt_number");

-- CreateIndex
CREATE INDEX "verification_attempts_work_order_id_created_at_idx" ON "verification_attempts"("work_order_id", "created_at");

-- CreateIndex
CREATE INDEX "verification_attempts_status_created_at_idx" ON "verification_attempts"("status", "created_at");

-- CreateIndex
CREATE INDEX "verification_attempts_created_by_idx" ON "verification_attempts"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "verification_item_results_verification_attempt_id_work_order_item_id_key" ON "verification_item_results"("verification_attempt_id", "work_order_item_id");

-- CreateIndex
CREATE INDEX "verification_item_results_verification_attempt_id_status_idx" ON "verification_item_results"("verification_attempt_id", "status");

-- CreateIndex
CREATE INDEX "verification_item_results_work_order_item_id_idx" ON "verification_item_results"("work_order_item_id");

-- AddForeignKey
ALTER TABLE "verification_attempts" ADD CONSTRAINT "verification_attempts_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_attempts" ADD CONSTRAINT "verification_attempts_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_attempts" ADD CONSTRAINT "verification_attempts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_item_results" ADD CONSTRAINT "verification_item_results_verification_attempt_id_fkey" FOREIGN KEY ("verification_attempt_id") REFERENCES "verification_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_item_results" ADD CONSTRAINT "verification_item_results_work_order_item_id_fkey" FOREIGN KEY ("work_order_item_id") REFERENCES "work_order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
