import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFeedItems, parseProfileFromSharedData } from '../../server/playwright/network.js'

test('parseFeedItems maps Instagram feed items', async () => {
  const raw = await readFile('tests/fixtures/instagram-feed-user.json', 'utf8')
  const data = JSON.parse(raw)
  const items = parseFeedItems(data.items, 'targetuser')
  assert.equal(items.length, 1)
  assert.equal(items[0].shortCode, 'ABC123')
  assert.equal(items[0].url, 'https://www.instagram.com/p/ABC123/')
  assert.equal(items[0].caption, 'Hello world')
  assert.equal(items[0].likesCount, 42)
  assert.equal(items[0].ownerUsername, 'targetuser')
})

test('parseProfileFromSharedData extracts username and bio', () => {
  const profile = parseProfileFromSharedData({
    username: 'jane',
    full_name: 'Jane Doe',
    biography: 'Bio text',
    edge_followed_by: { count: 100 },
    edge_follow: { count: 50 },
    edge_owner_to_timeline_media: { count: 10 },
    is_private: true,
    profile_pic_url_hd: 'https://cdn.example/pic.jpg',
  })
  assert.equal(profile.username, 'jane')
  assert.equal(profile.followersCount, 100)
  assert.equal(profile.isPrivate, true)
})
