ALTER TYPE "PaidPlan" ADD VALUE IF NOT EXISTS 'EXTRA_VERIFICATION';

ALTER TABLE "payment_orders"
  ADD COLUMN IF NOT EXISTS "work_order_id" TEXT;

ALTER TABLE "paid_entitlements"
  ADD COLUMN IF NOT EXISTS "work_order_id" TEXT;

CREATE INDEX IF NOT EXISTS "payment_orders_work_order_id_status_idx"
  ON "payment_orders"("work_order_id", "status");

CREATE INDEX IF NOT EXISTS "paid_entitlements_work_order_id_status_idx"
  ON "paid_entitlements"("work_order_id", "status");

ALTER TABLE "payment_orders"
  ADD CONSTRAINT "payment_orders_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "paid_entitlements"
  ADD CONSTRAINT "paid_entitlements_work_order_id_fkey"
  FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
