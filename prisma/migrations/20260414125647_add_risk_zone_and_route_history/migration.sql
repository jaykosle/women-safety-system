-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('SAFE', 'MODERATE', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "risk_zones" (
    "id" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "gridResolution" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "crimeDensity" DOUBLE PRECISION NOT NULL,
    "nightCrimeRate" DOUBLE PRECISION NOT NULL,
    "severityScore" DOUBLE PRECISION NOT NULL,
    "crimeCount" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "year" INTEGER,

    CONSTRAINT "risk_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "endLat" DOUBLE PRECISION NOT NULL,
    "endLng" DOUBLE PRECISION NOT NULL,
    "safeRoute" JSONB NOT NULL,
    "shortRoute" JSONB NOT NULL,
    "safeDistance" DOUBLE PRECISION NOT NULL,
    "shortDistance" DOUBLE PRECISION NOT NULL,
    "avgRiskScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_zones_latitude_longitude_idx" ON "risk_zones"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "risk_zones_riskLevel_idx" ON "risk_zones"("riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "risk_zones_latitude_longitude_gridResolution_key" ON "risk_zones"("latitude", "longitude", "gridResolution");

-- AddForeignKey
ALTER TABLE "route_history" ADD CONSTRAINT "route_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
