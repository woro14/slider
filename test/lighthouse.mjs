// Compares the playground page with the same page built on Splide.
// Needs a running playground build: `npm run build:playground && PORT=3123 node playground/.output/server/index.mjs`
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:3123'
const runs = Number(process.env.RUNS ?? 3)
const dir = mkdtempSync(join(tmpdir(), 'lh-'))
const pages = { 'nuxt-a11y-slider': '/', 'splide': '/splide' }

const median = xs => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const rows = []
for (const [name, path] of Object.entries(pages)) {
  const results = []
  for (let i = 0; i < runs; i++) {
    const out = join(dir, `${name}-${i}.json`)
    execFileSync('npx', ['lighthouse', base + path, '--quiet', '--output=json', `--output-path=${out}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--chrome-flags=--headless=new --no-sandbox'], { stdio: 'ignore' })
    results.push(JSON.parse(readFileSync(out, 'utf8')))
  }
  const pick = fn => median(results.map(fn))
  rows.push({
    page: name,
    performance: pick(r => Math.round(r.categories.performance.score * 100)),
    accessibility: pick(r => Math.round(r.categories.accessibility.score * 100)),
    LCP_ms: pick(r => Math.round(r.audits['largest-contentful-paint'].numericValue)),
    TBT_ms: pick(r => Math.round(r.audits['total-blocking-time'].numericValue)),
    CLS: pick(r => Number(r.audits['cumulative-layout-shift'].numericValue.toFixed(3))),
  })
}
console.table(rows)
