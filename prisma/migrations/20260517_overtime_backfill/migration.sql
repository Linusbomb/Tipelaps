-- Övertid per dag (kollegans modell: total arbetstid minus 8 h).
ALTER TABLE "TimeReport" ADD COLUMN IF NOT EXISTS "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "TimeReport"
SET "overtimeHours" = GREATEST(0, ROUND(("totalHours" - 8)::numeric, 2))
WHERE "overtimeHours" IS DISTINCT FROM GREATEST(0, ROUND(("totalHours" - 8)::numeric, 2));
