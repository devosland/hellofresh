-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

-- CreateIndex
CREATE INDEX "Recipe_language_idx" ON "Recipe"("language");
