-- Kollegans semesterplanering: enskilda vardagar per vecka (null = hel vecka).
ALTER TABLE "VacationWeek" ADD COLUMN IF NOT EXISTS "days" TEXT;
