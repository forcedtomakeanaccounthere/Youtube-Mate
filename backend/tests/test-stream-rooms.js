/**
 * test-stream-rooms.js — Synchronized Group Streaming API Tests
 *
 * Covers:
 *   POST /api/stream/rooms                              — create room
 *   GET  /api/stream/rooms/:roomId                      — fetch room
 *   PATCH /api/stream/rooms/:roomId                     — update playback state / queue
 *   POST /api/stream/join-requests                      — request to join (approval mode)
 *   GET  /api/stream/join-requests/:roomId              — list pending requests
 *   POST /api/stream/join-requests/:roomId/:reqId/decision — approve / reject
 *   GET  /api/stream/join-requests/:roomId/:reqId/decision — poll decision
 *   POST /api/stream/rooms/:roomId/end                  — end stream
 *
 * Edge cases:
 *   - Missing required fields → 400
 *   - Bad room code format → 400
 *   - Non-existent room → 404
 *   - Accessing ended room → 410
 *
 * Usage:
 *   node tests/test-stream-rooms.js
 */

'use strict'

const axios = require('axios')
const log   = require('./helpers/logger')
const { BASE_URL } = require('./helpers/auth')

const http = axios.create({ baseURL: BASE_URL, timeout: 15000 })

const VIDEO_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const VIDEO_ID  = 'dQw4w9WgXcQ'
const HOST_ID   = `host-test-${Date.now()}`

let roomCode      = null
let joinRequestId = null

// ─── tests ───────────────────────────────────────────────────────────────────

async function testCreateRoom() {
  log.section('POST /api/stream/rooms')

  // 1. Valid creation
  try {
    const res = await http.post('/api/stream/rooms', {
      name: 'Test Watch Party',
      videoUrl: VIDEO_URL,
      videoId: VIDEO_ID,
      joinPolicy: 'open',
      hostId: HOST_ID,
      hostName: 'Test Host',
    })
    if (res.data.success && res.data.room?.id) {
      roomCode = res.data.room.id
      log.pass('Room created', `code: ${roomCode}`)
      log.info(`joinPolicy: ${res.data.room.joinPolicy}  status: ${res.data.room.status}`)
    } else {
      log.fail('Create room', new Error('Missing room.id in response'))
    }
  } catch (err) {
    log.fail('Create room', err)
  }

  // 2. Missing required fields → 400
  try {
    await http.post('/api/stream/rooms', {
      name: 'No video info',
    })
    log.fail('Missing videoUrl/videoId should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Missing videoUrl/videoId returns 400')
    } else {
      log.fail('Missing videoUrl/videoId should return 400', err)
    }
  }

  // 3. Custom room code format check
  try {
    const customCode = 'zzz-zzzz-zzz'
    const res = await http.post('/api/stream/rooms', {
      roomId: customCode,
      name: 'Custom Code Room',
      videoUrl: VIDEO_URL,
      videoId: VIDEO_ID,
      hostId: HOST_ID,
    })
    if (res.data.room?.id === customCode) {
      log.pass('Custom room code accepted', `code: ${customCode}`)
      // Clean up this room by ending it
      await http.post(`/api/stream/rooms/${customCode}/end`).catch(() => {})
    } else {
      log.fail('Custom room code', new Error(`Expected ${customCode}, got ${res.data.room?.id}`))
    }
  } catch (err) {
    if (err.response?.status === 409) {
      log.pass('Custom code already taken returns 409 (acceptable)')
    } else {
      log.fail('Custom room code creation', err)
    }
  }

  // 4. Bad room code format → 400
  try {
    await http.post('/api/stream/rooms', {
      roomId: 'BADFORMAT123',
      name: 'Bad Code',
      videoUrl: VIDEO_URL,
      videoId: VIDEO_ID,
      hostId: HOST_ID,
    })
    log.fail('Bad room code format should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Bad room code format returns 400')
    } else {
      log.fail('Bad room code format should return 400', err)
    }
  }
}

async function testGetRoom() {
  log.section('GET /api/stream/rooms/:roomId')

  if (!roomCode) {
    log.skip('Get room', 'no room created')
    return
  }

  // 1. Fetch existing room
  try {
    const res = await http.get(`/api/stream/rooms/${roomCode}`)
    const r = res.data.room
    if (r.id === roomCode && typeof r.playback === 'object') {
      log.pass('Fetch room by code', `queue items: ${r.queue?.length}`)
      log.info(`isPlaying: ${r.playback.isPlaying}  currentTime: ${r.playback.currentTime}`)
    } else {
      log.fail('Fetch room', new Error('Missing expected room fields'))
    }
  } catch (err) {
    log.fail('Fetch room', err)
  }

  // 2. Non-existent room → 404
  try {
    await http.get('/api/stream/rooms/zzz-zzzz-zzz')
    log.fail('Non-existent room should return 404', new Error('Expected 404'))
  } catch (err) {
    if (err.response?.status === 404) {
      log.pass('Non-existent room returns 404')
    } else {
      log.fail('Non-existent room should return 404', err)
    }
  }
}

async function testUpdateRoom() {
  log.section('PATCH /api/stream/rooms/:roomId')

  if (!roomCode) {
    log.skip('Update room', 'no room created')
    return
  }

  // 1. Update playback state
  try {
    const res = await http.patch(`/api/stream/rooms/${roomCode}`, {
      playback: {
        isPlaying: true,
        currentTime: 42.5,
        playbackRate: 1,
        updatedBy: HOST_ID,
      },
    })
    const p = res.data.room?.playback
    if (p?.isPlaying === true && Math.abs(p.currentTime - 42.5) < 0.1) {
      log.pass('Update playback state (isPlaying=true, currentTime=42.5)')
    } else {
      log.fail('Update playback', new Error(`Unexpected: ${JSON.stringify(p)}`))
    }
  } catch (err) {
    log.fail('Update room playback', err)
  }

  // 2. Toggle loop
  try {
    const res = await http.patch(`/api/stream/rooms/${roomCode}`, {
      loopEnabled: true,
    })
    if (res.data.room?.loopEnabled === true) {
      log.pass('Enable loop via PATCH')
    } else {
      log.fail('Enable loop', new Error('loopEnabled not true in response'))
    }
  } catch (err) {
    log.fail('Enable loop', err)
  }

  // 3. Update queue
  try {
    const res = await http.patch(`/api/stream/rooms/${roomCode}`, {
      queue: [
        {
          id: 'q-1',
          videoId: VIDEO_ID,
          url: VIDEO_URL,
          title: 'Test Video',
          addedBy: 'Test Host',
        },
        {
          id: 'q-2',
          videoId: 'jNQXAC9IVRw',
          url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
          title: 'Me at the zoo',
          addedBy: 'Test Host',
        },
      ],
      currentQueueIndex: 0,
    })
    if (res.data.room?.queue?.length === 2) {
      log.pass('Queue update — 2 items in queue')
    } else {
      log.fail('Queue update', new Error(`Expected 2 items, got ${res.data.room?.queue?.length}`))
    }
  } catch (err) {
    log.fail('Queue update', err)
  }
}

async function testJoinRequests() {
  log.section('Join Request Flow (approval mode)')

  // Create an approval-mode room first
  let approvalRoomCode
  try {
    const res = await http.post('/api/stream/rooms', {
      name: 'Approval Room',
      videoUrl: VIDEO_URL,
      videoId: VIDEO_ID,
      joinPolicy: 'approval',
      hostId: HOST_ID,
      hostName: 'Test Host',
    })
    approvalRoomCode = res.data.room?.id
    log.pass('Approval mode room created', `code: ${approvalRoomCode}`)
  } catch (err) {
    log.fail('Create approval room', err)
    return
  }

  const REQUESTER_ID = `viewer-${Date.now()}`

  // 1. Submit join request
  try {
    const res = await http.post('/api/stream/join-requests', {
      roomId: approvalRoomCode,
      requesterId: REQUESTER_ID,
      name: 'Alice Viewer',
    })
    if (res.data.success && res.data.request?.id) {
      joinRequestId = res.data.request.id
      log.pass('Join request submitted', `id: ${joinRequestId}`)
    } else {
      log.fail('Submit join request', new Error('Missing request.id'))
    }
  } catch (err) {
    log.fail('Submit join request', err)
  }

  // 2. Re-submit same requester → reuse existing
  try {
    const res = await http.post('/api/stream/join-requests', {
      roomId: approvalRoomCode,
      requesterId: REQUESTER_ID,
      name: 'Alice Viewer',
    })
    if (res.data.reused) {
      log.pass('Duplicate join request reuses existing (reused: true)')
    } else {
      log.fail('Duplicate join request should be reused', new Error('reused not true'))
    }
  } catch (err) {
    log.fail('Duplicate join request', err)
  }

  // 3. List pending requests
  try {
    const res = await http.get(`/api/stream/join-requests/${approvalRoomCode}`)
    if (Array.isArray(res.data.requests)) {
      log.pass(`Pending requests: ${res.data.requests.length}`)
    } else {
      log.fail('List join requests', new Error('requests array missing'))
    }
  } catch (err) {
    log.fail('List join requests', err)
  }

  // 4. Approve
  if (joinRequestId) {
    try {
      const res = await http.post(
        `/api/stream/join-requests/${approvalRoomCode}/${joinRequestId}/decision`,
        { decision: 'approved' }
      )
      if (res.data.success) {
        log.pass('Approve join request succeeds')
      } else {
        log.fail('Approve join request', new Error('success not true'))
      }
    } catch (err) {
      log.fail('Approve join request', err)
    }

    // 5. Poll decision
    try {
      const res = await http.get(
        `/api/stream/join-requests/${approvalRoomCode}/${joinRequestId}/decision`
      )
      if (res.data.decision === 'approved') {
        log.pass('Poll decision returns "approved"')
      } else {
        log.fail('Poll decision', new Error(`Expected approved, got ${res.data.decision}`))
      }
    } catch (err) {
      log.fail('Poll decision', err)
    }
  }

  // 6. Missing requesterId → 400
  try {
    await http.post('/api/stream/join-requests', {
      roomId: approvalRoomCode,
    })
    log.fail('Missing requesterId should return 400', new Error('Expected 400'))
  } catch (err) {
    if (err.response?.status === 400) {
      log.pass('Missing requesterId returns 400')
    } else {
      log.fail('Missing requesterId should return 400', err)
    }
  }

  // Clean up approval room
  await http.post(`/api/stream/rooms/${approvalRoomCode}/end`).catch(() => {})
}

async function testEndRoom() {
  log.section('POST /api/stream/rooms/:roomId/end')

  if (!roomCode) {
    log.skip('End room', 'no room to end')
    return
  }

  // 1. End room
  try {
    const res = await http.post(`/api/stream/rooms/${roomCode}/end`)
    if (res.data.success) {
      log.pass('End stream succeeds', `code: ${roomCode}`)
    } else {
      log.fail('End room', new Error('success not true'))
    }
  } catch (err) {
    log.fail('End room', err)
  }

  // 2. Fetch ended room → 410
  try {
    await http.get(`/api/stream/rooms/${roomCode}`)
    log.fail('Ended room GET should return 410', new Error('Expected 410'))
  } catch (err) {
    if (err.response?.status === 410) {
      log.pass('Ended room GET returns 410 Gone')
    } else {
      log.fail('Ended room GET should return 410', err)
    }
  }
}

// ─── runner ──────────────────────────────────────────────────────────────────

;(async () => {
  log.header('Stream Rooms API Tests')

  await testCreateRoom()
  await testGetRoom()
  await testUpdateRoom()
  await testJoinRequests()
  await testEndRoom()

  const allPassed = log.summary()
  process.exit(allPassed ? 0 : 1)
})()
