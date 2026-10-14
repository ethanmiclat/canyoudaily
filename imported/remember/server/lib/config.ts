import fs from 'node:fs'
import path from 'node:path'

export interface Config {
  launchDate: string
  timezone: string
  typeCooldownDays: number
  familyGapDays: number
  skinCooldownDays: number
  featureDaysPerWeek: number
  minFeatureTypesForFeatureDays: number
  aheadDays: number
  launchPlanDays: number
  maxPlaySeconds: number
  submitGraceMs: number
  studyToleranceMs: number
  targetMedian: number
  seedVersion: string
}

/** Content lives in ./content standalone; the Can You Daily hub points CYR_CONTENT_DIR at its imported copy. */
export function contentDir(): string {
  return process.env.CYR_CONTENT_DIR || path.join(process.cwd(), 'content')
}

let cached: Config | undefined
export function config(): Config {
  cached ??= JSON.parse(fs.readFileSync(path.join(contentDir(), 'config.json'), 'utf8')) as Config
  return cached
}
