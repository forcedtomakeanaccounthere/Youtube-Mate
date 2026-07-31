/**
 * test-playlists.js — Collaborative Playlist API Tests
 *
 * Covers:
 *   GET  /api/playlists/test-auth   — auth sanity check
 *   GET  /api/playlists             — public listing with filters
 *   POST /api/playlists             — create playlist (with & without draft mode)
 *   GET  /api/playlists/mine        — user's own playlists + stats
 *   GET  /api/playlists/favorites   — favourites list
 *   GET  /api/playlists/:id         — single playlist with items/collaborators
 *   PUT  /api/playlists/:id         — update name/description/visibility
 *   POST /api/playlists/:id/collaborators  — invite collaborator by email
 *   DELETE /api/playlists/:id       — delete owned playlist
 *
 * Usage:
 *   node tests/test-playlists.js
 */

'use strict'

const axios = require('axios')
const log   = require('./helpers/logger')
const { authedClient, BASE_URL } = require('./helpers/auth')

const http = axios.create({ baseURL: BASE_URL, timeout: 20000 })

let createdPlaylistId = null
const PLAYLIST_NAME = `Test Playlist ${Date.now()}`

// ─── tests ───────────────────────────────────────────────────────────────────

async function testAuthCheck() {
  log.section('GET /api/playlists/test-auth')

  try {
    const { client, user } = await authedClient()
    const res = await client.get('/api/playlists/test-auth')
    if (res.data.message && res.data.user?.email) {
      log.pass('Auth check passes', `user: ${user.email}`)
    } else {
      log.fail('Auth check', new Error('Unexpected response'))
    }
  } catch (err) {
    log.fail('Auth check', err)
  }
}

async function testListPublicPlaylists() {
  log.section('GET /api/playlists (public listing)')

  // Default listing
  try {
    const res = await http.get('/api/playlists?limit=5')
    if (Array.isArray(res.data.playlists)) {
      log.pass(`Public listing returned ${res.data.playlists.length} playlists`, `total: ${res.data.pagination?.count}`)
    } else {
      log.fail('Public listing', new Error('playlists array missing'))
    }
  } catch (err) {
    log.fail('Public listing', err)
  }

  // Filter: collaborative
  try {
    const res = await http.get('/api/playlists?filter=collaborative&limit=3')
    log.pass(`Filter=collaborative returned ${res.data.playlists?.length} playlists`)
  } catch (err) {
    log.fail('Filter collaborative', err)
  }

  // Sort: name
  try {
    const res = await http.get('/api/playlists?sort=name&limit=3')
    log.pass(`Sort=name returned ${res.data.playlists?.length} playlists`)
  } catch (err) {
    log.fail('Sort by name', err)
  }

  // Search
  try {
    const res = await http.get('/api/playlists?search=music&limit=3')
    log.pass(`Search "music" returned ${res.data.playlists?.length} playlists`)
  } catch (err) {
    log.fail('Search playlists', err)
  }
}

async function testCreatePlaylist() {
  log.section('POST /api/playlists')

  const { client } = await authedClient()

  // 1. Normal playlist
  try {
    const res = await client.post('/api/playlists', {
      name: PLAYLIST_NAME,
      description: 'Created by automated test suite',
      is_public: false,
      is_collaborative: false,
      category: 'education',
      tags: JSON.stringify(['test', 'automated']),
    })
    if (res.data.id) {
      createdPlaylistId = res.data.id
      log.pass('Create playlist succeeds', `id: ${createdPlaylistId}`)
      log.info(`status: ${res.data.status}`)
    } else {
      log.fail('Create playlist', new Error('Missing id in response'))
    }
  } catch (err) {
    log.fail('Create playlist', err)
  }

  // 2. Draft mode
  try {
    const res = await client.post('/api/playlists', {
      name: `Draft ${Date.now()}`,
      save_as_draft: 'true',
    })
    if (res.data.status === 'draft') {
      log.pass('Draft playlist created with status=draft')
    } else {
      log.fail('Draft playlist status', new Error(`Expected "draft", got "${res.data.status}"`))
    }
    // Clean up draft
    if (res.data.id) await client.delete(`/api/playlists/${res.data.id}`).catch(() => {})
  } catch (err) {
    log.fail('Draft playlist creation', err)
  }

  // 3. Missing name → 4xx
  try {
    await client.post('/api/playlists', { description: 'no name' })
    log.fail('Missing name should return 4xx', new Error('Expected error'))
  } catch (err) {
    if (err.response?.status >= 400 && err.response?.status < 500) {
      log.pass('Missing playlist name returns 4xx')
    } else {
      log.fail('Missing name should return 4xx', err)
    }
  }

  // 4. Unauthenticated → 401
  try {
    await http.post('/api/playlists', { name: 'anon playlist' })
    log.fail('Unauthenticated create should return 401', new Error('Expected 401'))
  } catch (err) {
    if (err.response?.status === 401) {
      log.pass('Unauthenticated create returns 401')
    } else {
      log.fail('Unauthenticated create should return 401', err)
    }
  }
}

async function testGetMyPlaylists() {
  log.section('GET /api/playlists/mine')

  try {
    const { client } = await authedClient()
    const res = await client.get('/api/playlists/mine?limit=5')
    const { playlists, stats, pagination } = res.data
    if (Array.isArray(playlists)) {
      log.pass(`My playlists: ${playlists.length} (total: ${pagination?.count})`)
      log.info(`Stats — total: ${stats?.totalPlaylists}, videos: ${stats?.totalVideos}`)
    } else {
      log.fail('My playlists', new Error('playlists array missing'))
    }
  } catch (err) {
    log.fail('My playlists', err)
  }

  // Status filter
  try {
    const { client } = await authedClient()
    const res = await client.get('/api/playlists/mine?status=draft')
    log.pass(`Mine with status=draft: ${res.data.playlists?.length} results`)
  } catch (err) {
    log.fail('My playlists status=draft', err)
  }
}

async function testGetFavorites() {
  log.section('GET /api/playlists/favorites')

  try {
    const { client } = await authedClient()
    const res = await client.get('/api/playlists/favorites')
    if (Array.isArray(res.data.playlists)) {
      log.pass(`Favorites: ${res.data.playlists.length} playlists`)
    } else {
      log.fail('Favorites', new Error('playlists array missing'))
    }
  } catch (err) {
    log.fail('Favorites', err)
  }
}

async function testGetSinglePlaylist() {
  log.section('GET /api/playlists/:id')

  if (!createdPlaylistId) {
    log.skip('Get single playlist', 'no playlist created')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.get(`/api/playlists/${createdPlaylistId}`)
    const p = res.data
    if (p.id && Array.isArray(p.videos) && Array.isArray(p.collaborators)) {
      log.pass('Get playlist returns id + videos + collaborators arrays')
      log.info(`videos: ${p.videos.length}  collaborators: ${p.collaborators.length}`)
    } else {
      log.fail('Get single playlist', new Error('Missing expected fields'))
    }
  } catch (err) {
    log.fail('Get single playlist', err)
  }

  // Non-existent
  try {
    await http.get('/api/playlists/000000000000000000000000')
    log.fail('Non-existent playlist should return 404', new Error('Expected 404'))
  } catch (err) {
    if (err.response?.status === 404) {
      log.pass('Non-existent playlist returns 404')
    } else {
      log.fail('Non-existent playlist should return 404', err)
    }
  }
}

async function testUpdatePlaylist() {
  log.section('PUT /api/playlists/:id')

  if (!createdPlaylistId) {
    log.skip('Update playlist', 'no playlist created')
    return
  }

  try {
    const { client } = await authedClient()
    const newName = `${PLAYLIST_NAME} — Updated`
    const res = await client.put(`/api/playlists/${createdPlaylistId}`, {
      name: newName,
      description: 'Updated by automated test',
      is_public: false,
    })
    if (res.data.title === newName || res.data.name === newName) {
      log.pass('Update playlist name succeeds', `new name: "${newName}"`)
    } else {
      log.fail('Update playlist', new Error(`Name not updated — got: ${res.data.title || res.data.name}`))
    }
  } catch (err) {
    log.fail('Update playlist', err)
  }
}

async function testInviteCollaborator() {
  log.section('POST /api/playlists/:id/collaborators')

  if (!createdPlaylistId) {
    log.skip('Invite collaborator', 'no playlist created')
    return
  }

  // Invite a dummy email (will get 400 "user not found" — that's acceptable)
  try {
    const { client } = await authedClient()
    await client.post(`/api/playlists/${createdPlaylistId}/collaborators`, {
      email: 'nonexistent-collab@example.com',
      permission_level: 'viewer',
    })
    log.pass('Invite collaborator — request accepted')
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 400) {
      log.pass('Invite unknown email returns 404/400 (expected — user not found)')
      log.info(err.response?.data?.error)
    } else {
      log.fail('Invite collaborator', err)
    }
  }

  // Missing email
  try {
    const { client } = await authedClient()
    await client.post(`/api/playlists/${createdPlaylistId}/collaborators`, {})
    log.fail('Missing email should return 4xx', new Error('Expected error'))
  } catch (err) {
    if (err.response?.status >= 400 && err.response?.status < 500) {
      log.pass('Missing email for collaborator returns 4xx')
    } else {
      log.fail('Missing email should return 4xx', err)
    }
  }
}

async function testDeletePlaylist() {
  log.section('DELETE /api/playlists/:id')

  if (!createdPlaylistId) {
    log.skip('Delete playlist', 'no playlist created')
    return
  }

  try {
    const { client } = await authedClient()
    const res = await client.delete(`/api/playlists/${createdPlaylistId}`)
    if (res.data.message?.toLowerCase().includes('deleted')) {
      log.pass('Delete playlist succeeds')
    } else {
      log.fail('Delete playlist', new Error('Unexpected response: ' + JSON.stringify(res.data)))
    }
  } catch (err) {
    log.fail('Delete playlist', err)
  }
}

// ─── runner ──────────────────────────────────────────────────────────────────

;(async () => {
  log.header('Collaborative Playlists API Tests')

  await testAuthCheck()
  await testListPublicPlaylists()
  await testCreatePlaylist()
  await testGetMyPlaylists()
  await testGetFavorites()
  await testGetSinglePlaylist()
  await testUpdatePlaylist()
  await testInviteCollaborator()
  await testDeletePlaylist()

  const allPassed = log.summary()
  process.exit(allPassed ? 0 : 1)
})()
