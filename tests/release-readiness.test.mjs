import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('health contract identifies the app and authority', () => {
  const health = JSON.parse(read('public/health.json'))
  assert.equal(health.app, 'luxe-on-demand-app')
  assert.equal(health.authority, 'MCP Gateway public.lod_*')
  assert.equal(health.schema_version, 1)
})

test('handoff protects appointment and qualification rules', () => {
  const handoff = read('docs/HANDOFF.md')
  assert.match(handoff, /lod_appointments/)
  assert.match(handoff, /double[- ]booking/i)
  assert.match(handoff, /licensing|certification/i)
})
