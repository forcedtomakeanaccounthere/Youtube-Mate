const LETTERS = "abcdefghijklmnopqrstuvwxyz"
const ROOM_CODE_REGEX = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/

function randomLetters(length) {
  let output = ""
  for (let i = 0; i < length; i += 1) {
    output += LETTERS.charAt(Math.floor(Math.random() * LETTERS.length))
  }
  return output
}

function generateMeetingCode() {
  return `${randomLetters(3)}-${randomLetters(4)}-${randomLetters(3)}`
}

function normalizeRoomCode(roomCode) {
  return String(roomCode || "").trim().toLowerCase()
}

function isValidRoomCode(roomCode) {
  return ROOM_CODE_REGEX.test(normalizeRoomCode(roomCode))
}

function slugify(value) {
  return String(value || "stream-room")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-") || "stream-room"
}

function normalizeJoinPolicy(policy) {
  return policy === "approval" ? "approval" : "open"
}

function sanitizeQueue(queue, fallbackAddedBy) {
  if (!Array.isArray(queue)) return []

  return queue
    .map((item, index) => {
      if (!item || typeof item !== "object") return null
      const videoId = String(item.videoId || "").trim()
      if (!videoId) return null
      const safeId = String(item.id || `q-${Date.now()}-${index}`).trim()
      return {
        id: safeId,
        videoId,
        title: String(item.title || "Queued Video").trim() || "Queued Video",
        thumbnail: String(item.thumbnail || "").trim(),
        duration: String(item.duration || "").trim(),
        url: String(item.url || `https://youtube.com/watch?v=${videoId}`).trim(),
        addedBy: String(item.addedBy || fallbackAddedBy || "Host").trim() || "Host",
      }
    })
    .filter(Boolean)
}

function clampQueueIndex(index, queueLength) {
  if (!Number.isInteger(index)) return 0
  if (queueLength <= 0) return 0
  return Math.min(Math.max(index, 0), queueLength - 1)
}

function resolvePlayback(playback) {
  const payload = playback || {}
  const currentTime = Number(payload.currentTime || 0)
  const playbackRate = Number(payload.playbackRate || 1) || 1
  const isPlaying = Boolean(payload.isPlaying)
  const updatedAt = payload.updatedAt ? new Date(payload.updatedAt) : new Date()

  let computedTime = Number.isFinite(currentTime) ? currentTime : 0
  if (isPlaying && Number.isFinite(updatedAt.getTime())) {
    const elapsed = (Date.now() - updatedAt.getTime()) / 1000
    if (elapsed > 0) {
      computedTime += elapsed * playbackRate
    }
  }

  return {
    isPlaying,
    currentTime: Math.max(0, computedTime),
    playbackRate,
    updatedAt,
    updatedBy: String(payload.updatedBy || ""),
  }
}

module.exports = {
  ROOM_CODE_REGEX,
  generateMeetingCode,
  normalizeRoomCode,
  isValidRoomCode,
  normalizeJoinPolicy,
  sanitizeQueue,
  clampQueueIndex,
  resolvePlayback,
  slugify,
}
