import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksLikeUserId } from '../../server/sessionUser.js'

test('looksLikeUserId detects numeric Instagram ids', () => {
  assert.equal(looksLikeUserId('27046986213'), true)
  assert.equal(looksLikeUserId(''), true)
  assert.equal(looksLikeUserId(null), true)
  assert.equal(looksLikeUserId('my_username'), false)
  assert.equal(looksLikeUserId('user.name'), false)
})
