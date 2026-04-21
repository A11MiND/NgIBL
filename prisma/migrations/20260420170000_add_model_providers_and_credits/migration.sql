-- AlterTable: add dynamic provider configs and starter credits
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "modelProviders" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deepseekCredits" INTEGER NOT NULL DEFAULT 200;
