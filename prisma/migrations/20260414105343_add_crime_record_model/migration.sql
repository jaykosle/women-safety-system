-- CreateTable
CREATE TABLE "crime_records" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "crimeType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "year" INTEGER NOT NULL,
    "timeOfDay" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "caseCount" INTEGER NOT NULL DEFAULT 1,
    "source" TEXT NOT NULL DEFAULT 'synthetic',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crime_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crime_records_latitude_longitude_idx" ON "crime_records"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "crime_records_district_idx" ON "crime_records"("district");

-- CreateIndex
CREATE INDEX "crime_records_crimeType_idx" ON "crime_records"("crimeType");
