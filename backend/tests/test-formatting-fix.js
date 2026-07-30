/**
 * Test script to verify summary formatting fixes:
 * - No markdown artifacts (**, ****, etc.)
 * - Key moments show time ranges
 * - Bullet points are complete sentences
 */

require('dotenv').config()
const axios = require('axios')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const Transcript = require('../models/Transcript')

const VIDEO_URL = 'https://youtu.be/gfoqygqCW38'

async function getToken() {
  await mongoose.connect(process.env.MONGODB_URI)
  const user = await User.findOne({ isEmailVerified: true }).lean()
  if (!user) throw new Error('No verified user found')
  
  const token = jwt.sign(
    { id: user._id, email: user.email, name: user.name, authProvider: user.authProvider },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
  await mongoose.disconnect()
  return token
}

async function testFormatting() {
  console.log('🧪 Testing Summary Formatting Fixes\n')
  console.log('=' .repeat(60))
  
  const token = await getToken()
  console.log('✅ Authenticated\n')
  
  // First, clear the cache for this video
  await mongoose.connect(process.env.MONGODB_URI)
  const videoId = VIDEO_URL.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)[1]
  await Transcript.deleteMany({ videoId })
  await mongoose.disconnect()
  console.log(`🗑️  Cleared cache for video ${videoId}\n`)
  
  // Submit new transcript request
  console.log('📤 Submitting transcript request...')
  const submitRes = await axios.post('http://localhost:5000/api/transcript', {
    youtubeUrl: VIDEO_URL,
    language: 'en',
    summaryType: 'brief'
  }, {
    headers: { Authorization: `Bearer ${token}` }
  })
  
  const transcriptId = submitRes.data.transcriptId || submitRes.data._id
  console.log(`✅ Submitted (ID: ${transcriptId})\n`)
  
  // Poll until complete
  console.log('⏳ Waiting for processing...')
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const statusRes = await axios.get(`http://localhost:5000/api/transcript/${transcriptId}/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    const { status, progress } = statusRes.data
    process.stdout.write(`\r   Progress: ${progress}% [${status}]`)
    
    if (status === 'completed' || status === 'failed') {
      console.log('\n')
      if (status === 'failed') {
        console.log('❌ Processing failed:', statusRes.data.error)
        return
      }
      break
    }
  }
  
  // Fetch full transcript
  const fullRes = await axios.get(`http://localhost:5000/api/transcript/${transcriptId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  
  const transcript = fullRes.data
  console.log('✅ Transcript completed\n')
  console.log('=' .repeat(60))
  console.log('📊 FORMATTING CHECK RESULTS')
  console.log('='.repeat(60))
  
  // Check 1: Brief summary
  console.log('\n1️⃣  BRIEF SUMMARY:')
  console.log(transcript.summary?.brief || '(none)')
  const hasMarkdownBrief = /\*\*|\*\*\*\*/.test(transcript.summary?.brief || '')
  console.log(`   ${hasMarkdownBrief ? '❌' : '✅'} Markdown check: ${hasMarkdownBrief ? 'FAILED (contains **)' : 'PASSED (clean)'}`)
  
  // Check 2: Bullet points
  console.log('\n2️⃣  BULLET POINTS:')
  const bullets = transcript.summary?.bulletPoints || []
  bullets.forEach((point, i) => {
    console.log(`   • ${point}`)
  })
  const hasMarkdownBullets = bullets.some(p => /\*\*|\*\*\*\*/.test(p))
  const hasColonSplits = bullets.some((p, i) => i > 0 && /^[a-z]/.test(p))
  console.log(`   ${hasMarkdownBullets ? '❌' : '✅'} Markdown check: ${hasMarkdownBullets ? 'FAILED' : 'PASSED'}`)
  console.log(`   ${hasColonSplits ? '❌' : '✅'} Split check: ${hasColonSplits ? 'FAILED (lowercase starts)' : 'PASSED'}`)
  
  // Check 3: Key moments
  console.log('\n3️⃣  KEY MOMENTS:')
  const moments = transcript.summary?.keyMoments || []
  moments.forEach((moment, i) => {
    const timeLabel = moment.timeLabel || `${formatTime(moment.timestamp)}`
    console.log(`   [${timeLabel}] ${moment.text}`)
  })
  const hasTimeRanges = moments.some(m => m.timeLabel && m.timeLabel.includes('-'))
  const allZeroTime = moments.every(m => m.timestamp === 0 || !m.timestamp)
  const hasMarkdownMoments = moments.some(m => /\*\*|\*\*\*\*/.test(m.text))
  console.log(`   ${hasTimeRanges ? '✅' : '❌'} Time range check: ${hasTimeRanges ? 'PASSED (has ranges)' : 'FAILED (no ranges)'}`)
  console.log(`   ${allZeroTime ? '❌' : '✅'} Timestamp check: ${allZeroTime ? 'FAILED (all 0:00)' : 'PASSED'}`)
  console.log(`   ${hasMarkdownMoments ? '❌' : '✅'} Markdown check: ${hasMarkdownMoments ? 'FAILED' : 'PASSED'}`)
  
  console.log('\n' + '='.repeat(60))
  console.log('✨ SUMMARY')
  console.log('='.repeat(60))
  const allPassed = !hasMarkdownBrief && !hasMarkdownBullets && !hasColonSplits && 
                    hasTimeRanges && !allZeroTime && !hasMarkdownMoments
  console.log(allPassed ? '✅ ALL CHECKS PASSED!' : '⚠️  SOME CHECKS FAILED')
  console.log('')
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`
}

testFormatting().catch(e => {
  console.error('\n❌ Test failed:', e.message)
  process.exit(1)
})
