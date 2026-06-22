-- CreateEnum
CREATE TYPE "AiQuestionKind" AS ENUM (
  'BRAND',
  'DISCOVERY',
  'FEATURE',
  'USE_CASE',
  'TRUST',
  'COMPARISON',
  'CUSTOM'
);

-- CreateEnum
CREATE TYPE "AiQuestionSource" AS ENUM (
  'SYSTEM',
  'USER',
  'GENERATED'
);

-- CreateEnum
CREATE TYPE "AiQuestionStatus" AS ENUM (
  'ACTIVE',
  'ARCHIVED'
);

-- CreateEnum
CREATE TYPE "AiAnswerRunStatus" AS ENUM (
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'PARTIAL',
  'FAILED'
);

-- CreateTable
CREATE TABLE "ai_questions" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" "AiQuestionKind" NOT NULL,
  "source" "AiQuestionSource" NOT NULL DEFAULT 'USER',
  "status" "AiQuestionStatus" NOT NULL DEFAULT 'ACTIVE',
  "question" TEXT NOT NULL,
  "expected_fact_keys" JSONB NOT NULL,
  "is_required" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_answer_runs" (
  "id" TEXT NOT NULL,
  "scan_id" TEXT NOT NULL,
  "question_id" TEXT,
  "run_number" INTEGER NOT NULL DEFAULT 1,
  "question_code" TEXT NOT NULL,
  "question_kind" "AiQuestionKind" NOT NULL,
  "question_text" TEXT NOT NULL,
  "expected_facts_snapshot" JSONB NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" "AiAnswerRunStatus" NOT NULL DEFAULT 'QUEUED',
  "response_id" TEXT,
  "answer_text" TEXT,
  "answer_sha256" TEXT,
  "brand_mentioned" BOOLEAN,
  "target_domain_cited" BOOLEAN,
  "citations_json" JSONB,
  "sources_json" JSONB,
  "automatic_metrics_json" JSONB,
  "factual_evaluation_json" JSONB,
  "consistency_signature" TEXT,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "error_code" TEXT,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_answer_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_answer_summaries" (
  "id" TEXT NOT NULL,
  "scan_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "methodology_version" TEXT NOT NULL,
  "planned_question_count" INTEGER NOT NULL,
  "completed_question_count" INTEGER NOT NULL,
  "total_run_count" INTEGER NOT NULL,
  "completed_run_count" INTEGER NOT NULL,
  "partial_run_count" INTEGER NOT NULL,
  "failed_run_count" INTEGER NOT NULL,
  "answer_completion_rate" DOUBLE PRECISION,
  "brand_mention_rate" DOUBLE PRECISION,
  "target_citation_rate" DOUBLE PRECISION,
  "factual_accuracy" DOUBLE PRECISION,
  "completeness" DOUBLE PRECISION,
  "consistency" DOUBLE PRECISION,
  "performance_score" DOUBLE PRECISION,
  "score_coverage" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_answer_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_questions_site_id_code_key"
ON "ai_questions"("site_id", "code");

-- CreateIndex
CREATE INDEX "ai_questions_site_id_status_sort_order_idx"
ON "ai_questions"("site_id", "status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "ai_answer_runs_scan_id_question_code_run_number_key"
ON "ai_answer_runs"("scan_id", "question_code", "run_number");

-- CreateIndex
CREATE INDEX "ai_answer_runs_scan_id_status_idx"
ON "ai_answer_runs"("scan_id", "status");

-- CreateIndex
CREATE INDEX "ai_answer_runs_question_id_created_at_idx"
ON "ai_answer_runs"("question_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_answer_summaries_scan_id_key"
ON "ai_answer_summaries"("scan_id");

-- CreateIndex
CREATE INDEX "ai_answer_summaries_provider_model_idx"
ON "ai_answer_summaries"("provider", "model");

-- AddForeignKey
ALTER TABLE "ai_questions"
ADD CONSTRAINT "ai_questions_site_id_fkey"
FOREIGN KEY ("site_id") REFERENCES "sites"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_answer_runs"
ADD CONSTRAINT "ai_answer_runs_scan_id_fkey"
FOREIGN KEY ("scan_id") REFERENCES "scans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_answer_runs"
ADD CONSTRAINT "ai_answer_runs_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "ai_questions"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_answer_summaries"
ADD CONSTRAINT "ai_answer_summaries_scan_id_fkey"
FOREIGN KEY ("scan_id") REFERENCES "scans"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
