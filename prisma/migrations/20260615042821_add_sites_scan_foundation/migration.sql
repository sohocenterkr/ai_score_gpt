-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('CUSTOMER', 'AGENCY');

-- CreateEnum
CREATE TYPE "OrganizationMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SiteFactSource" AS ENUM ('USER', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('QUICK', 'DEEP', 'VERIFICATION', 'MONITORING');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('PASS', 'FAIL', 'BLOCKED', 'NA');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'CUSTOMER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "final_url" TEXT,
    "site_type" TEXT,
    "country" TEXT NOT NULL DEFAULT 'KR',
    "region" TEXT,
    "primary_locale" TEXT NOT NULL DEFAULT 'ko',
    "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_facts" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "fact_key" TEXT NOT NULL,
    "expected_value" JSONB NOT NULL,
    "source" "SiteFactSource" NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "type" "ScanType" NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
    "rules_version" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "grade" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_code" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_pages" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status_code" INTEGER,
    "final_url" TEXT,
    "content_type" TEXT,
    "raw_html_hash" TEXT,
    "rendered_html_hash" TEXT,
    "initial_text_length" INTEGER,
    "rendered_text_length" INTEGER,
    "iframe_count" INTEGER,
    "screenshot_asset_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "scan_page_id" TEXT,
    "rule_code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "status" "FindingStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_json" JSONB,
    "recommendation" TEXT,
    "score_delta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "sites_organization_id_status_idx" ON "sites"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sites_organization_id_base_url_key" ON "sites"("organization_id", "base_url");

-- CreateIndex
CREATE INDEX "site_facts_site_id_idx" ON "site_facts"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_facts_site_id_fact_key_key" ON "site_facts"("site_id", "fact_key");

-- CreateIndex
CREATE INDEX "scans_site_id_created_at_idx" ON "scans"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "scans_status_created_at_idx" ON "scans"("status", "created_at");

-- CreateIndex
CREATE INDEX "scans_created_by_idx" ON "scans"("created_by");

-- CreateIndex
CREATE INDEX "scan_pages_scan_id_idx" ON "scan_pages"("scan_id");

-- CreateIndex
CREATE INDEX "findings_scan_id_status_idx" ON "findings"("scan_id", "status");

-- CreateIndex
CREATE INDEX "findings_scan_page_id_idx" ON "findings"("scan_page_id");

-- CreateIndex
CREATE INDEX "findings_rule_code_idx" ON "findings"("rule_code");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_facts" ADD CONSTRAINT "site_facts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_pages" ADD CONSTRAINT "scan_pages_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_scan_page_id_fkey" FOREIGN KEY ("scan_page_id") REFERENCES "scan_pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
