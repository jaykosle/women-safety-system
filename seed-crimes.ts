import { PrismaClient } from './app/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config({ path: '.env.local' })

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function parseCSV(filePath: string) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const values = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = values[i]?.trim() })
    return row
  })
}

async function main() {
  const CSV_PATH = join(process.cwd(), 'synthetic_crime_data.csv')
  console.log('Reading CSV...')
  const rows = parseCSV(CSV_PATH)
  console.log(`Total rows: ${rows.length}`)

  const BATCH_SIZE = 500
  let inserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    await prisma.crimeRecord.createMany({
      data: batch.map(row => ({
        latitude:   parseFloat(row.latitude),
        longitude:  parseFloat(row.longitude),
        district:   row.district,
        state:      row.state,
        crimeType:  row.crimeType,
        severity:   row.severity,
        year:       parseInt(row.year),
        timeOfDay:  row.timeOfDay,
        caseCount:  parseInt(row.caseCount) || 1,
        source:     row.source || 'synthetic',
        isVerified: false,
      })),
      skipDuplicates: true,
    })
    inserted += batch.length
    console.log(`Seeded ${inserted}/${rows.length}...`)
  }
  console.log('✅ Seeding complete!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())