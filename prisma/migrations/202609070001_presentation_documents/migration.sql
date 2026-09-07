ALTER TABLE "SciTechPresentation"
  ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Sci-Tech Presentation',
  ADD COLUMN "description" TEXT,
  ADD COLUMN "submissionDeadline" TIMESTAMP(3),
  ADD COLUMN "eligibleEvaluatorCount" INTEGER,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "submittedAt" TIMESTAMP(3);

CREATE TABLE "PresentationFile" (
  "id" TEXT NOT NULL,
  "presentationId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PresentationFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PresentationFile_storedName_key" ON "PresentationFile"("storedName");
CREATE UNIQUE INDEX "PresentationFile_presentationId_version_key" ON "PresentationFile"("presentationId", "version");
CREATE INDEX "PresentationFile_presentationId_active_idx" ON "PresentationFile"("presentationId", "active");
ALTER TABLE "SciTechPresentation" ADD CONSTRAINT "SciTechPresentation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PresentationFile" ADD CONSTRAINT "PresentationFile_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "SciTechPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresentationFile" ADD CONSTRAINT "PresentationFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
