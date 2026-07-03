CREATE TYPE "PaymentProvider" AS ENUM ('PORTONE', 'POLAR');

CREATE TYPE "PaymentOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED');

CREATE TYPE "PaidPlan" AS ENUM ('BASIC', 'CASE_STUDY_DISCOUNT');

CREATE TYPE "PaidEntitlementStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "payment_orders" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "scan_id" TEXT,
  "provider" "PaymentProvider" NOT NULL,
  "status" "PaymentOrderStatus" NOT NULL DEFAULT 'PENDING',
  "plan" "PaidPlan" NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "provider_order_id" TEXT,
  "provider_payment_id" TEXT,
  "idempotency_key" TEXT,
  "metadata" JSONB,
  "paid_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "canceled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "paid_entitlements" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "scan_id" TEXT,
  "payment_order_id" TEXT,
  "plan" "PaidPlan" NOT NULL,
  "status" "PaidEntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "paid_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_orders_idempotency_key_key" ON "payment_orders"("idempotency_key");
CREATE UNIQUE INDEX "payment_orders_provider_provider_order_id_key" ON "payment_orders"("provider", "provider_order_id");
CREATE UNIQUE INDEX "payment_orders_provider_provider_payment_id_key" ON "payment_orders"("provider", "provider_payment_id");
CREATE INDEX "payment_orders_user_id_status_created_at_idx" ON "payment_orders"("user_id", "status", "created_at");
CREATE INDEX "payment_orders_site_id_status_idx" ON "payment_orders"("site_id", "status");
CREATE INDEX "payment_orders_scan_id_status_idx" ON "payment_orders"("scan_id", "status");

CREATE UNIQUE INDEX "paid_entitlements_payment_order_id_key" ON "paid_entitlements"("payment_order_id");
CREATE INDEX "paid_entitlements_user_id_status_granted_at_idx" ON "paid_entitlements"("user_id", "status", "granted_at");
CREATE INDEX "paid_entitlements_site_id_status_idx" ON "paid_entitlements"("site_id", "status");
CREATE INDEX "paid_entitlements_scan_id_status_idx" ON "paid_entitlements"("scan_id", "status");

ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "paid_entitlements" ADD CONSTRAINT "paid_entitlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_entitlements" ADD CONSTRAINT "paid_entitlements_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paid_entitlements" ADD CONSTRAINT "paid_entitlements_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "scans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "paid_entitlements" ADD CONSTRAINT "paid_entitlements_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
