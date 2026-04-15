// seed-risk-zones.ts
// Run: npx ts-node --project tsconfig.seed.json seed-risk-zones.ts

import { PrismaClient } from './app/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

function parseCSV(filePath: string): Record<string, string>[] {
  const content = readFileSync(filePath, 'utf-8')
  const lines   = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const values: Record<string, string> = {}
    // Handle quoted fields
    const parts = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) ?? line.split(',')
    headers.forEach((h, i) => { values[h] = (parts[i] ?? '').trim().replace(/^"|"$/g, '') })
    return values
  })
}

const BATCH = 500

async function seedRiskZones() {
  const path = join(process.cwd(), 'risk_zones.csv')
  console.log('📍 Seeding risk_zones...')
  const rows = parseCSV(path)
  console.log(`   ${rows.length} rows`)

  let done = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await prisma.riskZone.createMany({
      data: batch.map(r => ({
        latitude:       parseFloat(r.latitude),
        longitude:      parseFloat(r.longitude),
        gridResolution: parseFloat(r.gridResolution) || 0.005,
        riskScore:      parseFloat(r.riskScore),
        riskLevel:      r.riskLevel as any,
        crimeDensity:   parseFloat(r.crimeDensity),
        nightCrimeRate: parseFloat(r.nightCrimeRate),
        severityScore:  parseFloat(r.severityScore),
        crimeCount:     parseInt(r.crimeCount) || 0,
        year:           r.year && r.year !== 'None' ? parseInt(r.year) : null,
      })),
      skipDuplicates: true,
    })
    done += batch.length
    process.stdout.write(`\r   ${done}/${rows.length}`)
  }
  console.log('\n✅ risk_zones done')
}

async function seedCrimeRecords() {
  const path = join(process.cwd(), 'crime_records_sample.csv')
  console.log('🔴 Seeding crime_records (sample)...')
  const rows = parseCSV(path)
  console.log(`   ${rows.length} rows`)

  let done = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    await prisma.crimeRecord.createMany({
      data: batch.map(r => ({
        latitude:   parseFloat(r.latitude),
        longitude:  parseFloat(r.longitude),
        district:   r.district,
        state:      r.state,
        crimeType:  r.crimeType,
        severity:   r.severity,
        year:       parseInt(r.year),
        timeOfDay:  r.timeOfDay,
        caseCount:  parseInt(r.caseCount) || 1,
        source:     r.source || 'synthetic',
        isVerified: false,
      })),
      skipDuplicates: true,
    })
    done += batch.length
    process.stdout.write(`\r   ${done}/${rows.length}`)
  }
  console.log('\n✅ crime_records done')
}

async function main() {
  await seedRiskZones()
  await seedCrimeRecords()
  console.log('\n🎉 All seeding complete!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())