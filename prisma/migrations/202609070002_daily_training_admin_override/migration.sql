ALTER TABLE "DailyProgress"
ADD COLUMN "adminScore" DECIMAL(3,2),
ADD COLUMN "adminPassed" BOOLEAN;

ALTER TABLE "DailyProgress"
ADD CONSTRAINT "DailyProgress_adminScore_check"
CHECK ("adminScore" IS NULL OR ("adminScore" >= 0 AND "adminScore" <= 5));
