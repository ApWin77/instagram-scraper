import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampLimit, randomDelayMs } from '../../server/playwright/humanize.js'

test('clampLimit enforces max 50', () => {
  assert.equal(clampLimit(100), 50)
  assert.equal(clampLimit(10), 10)
  assert.equal(clampLimit(0), 1)
})

test('randomDelayMs stays within bounds', () => {
  for (let i = 0; i < 20; i++) {
    const ms = randomDelayMs(1500, 4000)
    assert.ok(ms >= 1500 && ms <= 4000)
  }
})
