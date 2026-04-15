-- CreateTable
CREATE TABLE "AnalyticsCache" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "cacheType" TEXT NOT NULL,
    "crimeType" TEXT,
    "data" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeStatistic" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rape" INTEGER NOT NULL DEFAULT 0,
    "kidnapping" INTEGER NOT NULL DEFAULT 0,
    "dowryDeath" INTEGER NOT NULL DEFAULT 0,
    "assaultWomen" INTEGER NOT NULL DEFAULT 0,
    "insultModesty" INTEGER NOT NULL DEFAULT 0,
    "crueltyHusband" INTEGER NOT NULL DEFAULT 0,
    "importationGirls" INTEGER NOT NULL DEFAULT 0,
    "totalCrimes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrimeStatistic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrimeForecast" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT,
    "crimeType" TEXT NOT NULL,
    "forecastYear" INTEGER NOT NULL,
    "predictedValue" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT NOT NULL,
    "modelR2" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrimeForecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsCache_expiresAt_idx" ON "AnalyticsCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsCache_state_district_cacheType_crimeType_key" ON "AnalyticsCache"("state", "district", "cacheType", "crimeType");

-- CreateIndex
CREATE INDEX "CrimeStatistic_state_idx" ON "CrimeStatistic"("state");

-- CreateIndex
CREATE INDEX "CrimeStatistic_state_district_idx" ON "CrimeStatistic"("state", "district");

-- CreateIndex
CREATE UNIQUE INDEX "CrimeStatistic_state_district_year_key" ON "CrimeStatistic"("state", "district", "year");

-- CreateIndex
CREATE INDEX "CrimeForecast_state_crimeType_idx" ON "CrimeForecast"("state", "crimeType");

-- CreateIndex
CREATE UNIQUE INDEX "CrimeForecast_state_district_crimeType_forecastYear_key" ON "CrimeForecast"("state", "district", "crimeType", "forecastYear");
