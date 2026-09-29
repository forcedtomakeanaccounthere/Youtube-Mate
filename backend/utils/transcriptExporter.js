/**
 * Transcript Export Utility
 *
 * Pure format converters for exporting a completed Transcript document.
 * Produces downloadable text in txt, json, srt, or vtt format.
 *
 * Consumers: services/transcriptService.js (exportTranscript)
 */

/**
 * Format seconds as SRT/VTT timestamp, e.g. "01:23:45,678" (srt) or "01:23:45.678" (vtt)
 */
function formatTimestamp(seconds, msSeparator = ",") {
  const totalMs = Math.max(0, Math.round((Number(seconds) || 0) * 1000))
  const hours = Math.floor(totalMs / 3600000)
  const minutes = Math.floor((totalMs % 3600000) / 60000)
  const secs = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000

  const pad = (value, length = 2) => String(value).padStart(length, "0")

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${msSeparator}${pad(ms, 3)}`
}

/**
 * Format seconds as a short clock label for plain text, e.g. "12:34" or "1:02:34"
 */
function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  const pad = (value) => String(value).padStart(2, "0")

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`
  }
  return `${minutes}:${pad(secs)}`
}

/**
 * Build the plain-text export: metadata header, summary, and timestamped lines
 */
function buildTxt(transcript) {
  const videoInfo = transcript.videoInfo || {}
  const lines = []

  lines.push("YOUTUBE TRANSCRIPT")
  lines.push("=".repeat(60))
  lines.push(`Title: ${videoInfo.title || "Unknown"}`)
  lines.push(`Channel: ${videoInfo.channel || "Unknown"}`)
  lines.push(`Duration: ${videoInfo.duration || "Unknown"}`)
  lines.push(`URL: ${transcript.youtubeUrl || `https://www.youtube.com/watch?v=${transcript.videoId || ""}`}`)
  lines.push(`Language: ${transcript.language || "en"}`)
  lines.push(`Exported: ${new Date().toISOString()}`)
  lines.push("=".repeat(60))

  const summary = transcript.summary
  if (summary && (summary.brief || summary.detailed)) {
    lines.push("")
    lines.push("SUMMARY")
    lines.push("-".repeat(60))
    if (summary.brief) {
      lines.push("")
      lines.push(summary.brief.trim())
    }
    if (summary.detailed) {
      lines.push("")
      lines.push(summary.detailed.trim())
    }
    if (Array.isArray(summary.bulletPoints) && summary.bulletPoints.length > 0) {
      lines.push("")
      lines.push("Key Points:")
      for (const point of summary.bulletPoints) {
        lines.push(`  • ${point}`)
      }
    }
  }

  if (Array.isArray(transcript.chapters) && transcript.chapters.length > 0) {
    lines.push("")
    lines.push("CHAPTERS")
    lines.push("-".repeat(60))
    for (const chapter of transcript.chapters) {
      lines.push(`  [${chapter.timeString || formatClock(chapter.timestamp)}] ${chapter.title}`)
    }
  }

  lines.push("")
  lines.push("TRANSCRIPT")
  lines.push("-".repeat(60))
  lines.push("")

  for (const segment of transcript.content || []) {
    if (!segment || typeof segment.text !== "string") continue
    lines.push(`[${formatClock(segment.start)}] ${segment.text.trim()}`)
  }

  return lines.join("\n")
}

/**
 * Build the JSON export with the transcript's data in a stable shape
 */
function buildJson(transcript) {
  const videoInfo = transcript.videoInfo || {}

  return JSON.stringify(
    {
      videoId: transcript.videoId,
      youtubeUrl: transcript.youtubeUrl,
      language: transcript.language,
      exportedAt: new Date().toISOString(),
      videoInfo: {
        title: videoInfo.title || "Unknown",
        channel: videoInfo.channel || "Unknown",
        duration: videoInfo.duration || "Unknown",
        videoId: videoInfo.videoId || transcript.videoId,
      },
      summary: transcript.summary || null,
      chapters: transcript.chapters || [],
      statistics: transcript.statistics || null,
      segments: (transcript.content || []).map((segment, index) => ({
        id: segment.id || `segment_${index + 1}`,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        speaker: segment.speaker || "Speaker",
      })),
    },
    null,
    2
  )
}

/**
 * Build the SubRip (SRT) subtitle export
 */
function buildSrt(transcript) {
  const blocks = []

  ;(transcript.content || []).forEach((segment, index) => {
    if (!segment || typeof segment.text !== "string") return
    blocks.push(
      [
        String(blocks.length + 1),
        `${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end || segment.start)}`,
        segment.text.trim(),
      ].join("\n")
    )
  })

  return blocks.join("\n\n") + "\n"
}

/**
 * Build the WebVTT (VTT) subtitle export
 */
function buildVtt(transcript) {
  const blocks = []

  ;(transcript.content || []).forEach((segment) => {
    if (!segment || typeof segment.text !== "string") return
    blocks.push(
      [
        `${formatTimestamp(segment.start, ".")} --> ${formatTimestamp(segment.end || segment.start, ".")}`,
        segment.text.trim(),
      ].join("\n")
    )
  })

  return "WEBVTT\n\n" + blocks.join("\n\n") + "\n"
}

/**
 * Convert a completed Transcript document into the requested export format
 * @param {Object} transcript - Transcript mongoose document (must be populated)
 * @param {String} format - One of "txt" | "json" | "srt" | "vtt"
 * @returns {String} The formatted transcript content
 */
function exportTranscript(transcript, format) {
  const formatters = {
    txt: buildTxt,
    json: buildJson,
    srt: buildSrt,
    vtt: buildVtt,
  }

  const formatter = formatters[format]
  if (!formatter) {
    throw new Error(`Unsupported export format: ${format}`)
  }

  return formatter(transcript)
}

module.exports = {
  exportTranscript,
  formatTimestamp,
  formatClock,
}
