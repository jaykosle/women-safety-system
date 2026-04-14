// lib/utils.ts
export function getRiskLevel(score: number): 'SAFE' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
  if (score < 30) return 'SAFE'
  if (score < 60) return 'MODERATE'
  if (score < 80) return 'HIGH'
  return 'CRITICAL'
}