CREATE TABLE "SciTechPresentation" (
    "id" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "presenterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SciTechPresentation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SciTechRating" (
    "id" TEXT NOT NULL,
    "presentationId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "score" DECIMAL(2,1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SciTechRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SciTechPresentation_localDate_key" ON "SciTechPresentation"("localDate");
CREATE UNIQUE INDEX "SciTechRating_presentationId_evaluatorId_key" ON "SciTechRating"("presentationId", "evaluatorId");
ALTER TABLE "SciTechPresentation" ADD CONSTRAINT "SciTechPresentation_presenterId_fkey" FOREIGN KEY ("presenterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SciTechRating" ADD CONSTRAINT "SciTechRating_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "SciTechPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SciTechRating" ADD CONSTRAINT "SciTechRating_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
