-- AlterTable: Add per-function model columns to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultModel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "simulationModel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "chatbotModel" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "analysisModel" TEXT;
