-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'VERIFYING', 'REWORK_REQUIRED', 'PASSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkOrderItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "work_orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "initial_scan_id" TEXT NOT NULL,
    "customer_organization_id" TEXT NOT NULL,
    "agency_organization_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "rules_version" TEXT NOT NULL,
    "score_before" DOUBLE PRECISION,
    "grade_before" TEXT,
    "expected_score_min" INTEGER NOT NULL,
    "expected_score_max" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_order_items" (
    "id" TEXT NOT NULL,
    "work_order_id" TEXT NOT NULL,
    "finding_id" TEXT,
    "item_code" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "developer_message" TEXT NOT NULL,
    "acceptance_criteria_json" JSONB NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL,
    "status" "WorkOrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_orders_site_id_created_at_idx" ON "work_orders"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "work_orders_initial_scan_id_idx" ON "work_orders"("initial_scan_id");

-- CreateIndex
CREATE INDEX "work_orders_customer_organization_id_status_idx" ON "work_orders"("customer_organization_id", "status");

-- CreateIndex
CREATE INDEX "work_orders_agency_organization_id_idx" ON "work_orders"("agency_organization_id");

-- CreateIndex
CREATE INDEX "work_orders_created_by_idx" ON "work_orders"("created_by");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_order_number_version_key" ON "work_orders"("order_number", "version");

-- CreateIndex
CREATE INDEX "work_order_items_work_order_id_status_idx" ON "work_order_items"("work_order_id", "status");

-- CreateIndex
CREATE INDEX "work_order_items_finding_id_idx" ON "work_order_items"("finding_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_order_items_work_order_id_finding_id_key" ON "work_order_items"("work_order_id", "finding_id");

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_initial_scan_id_fkey" FOREIGN KEY ("initial_scan_id") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_customer_organization_id_fkey" FOREIGN KEY ("customer_organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_agency_organization_id_fkey" FOREIGN KEY ("agency_organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_work_order_id_fkey" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
