-- Add explicit commerce confirmation without changing legacy rows.
ALTER TABLE "sites" ADD COLUMN "has_commerce_feature" BOOLEAN;
