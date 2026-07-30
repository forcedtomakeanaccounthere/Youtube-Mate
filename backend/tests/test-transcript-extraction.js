/**
 * Test script to diagnose transcript extraction issues
 * 
 * Usage: node scripts/test-transcript-extraction.js <youtube-video-id>
 * Example: node scripts/test-transcript-extraction.js dQw4w9WgXcQ
 */

require('dotenv').config()
const { YoutubeTranscript } = require('youtube-transcript')

async function testTranscriptExtraction(videoId) {
  console.log('\n' + '='.repeat(60))
  console.log('🔍 TRANSCRIPT EXTRACTION DIAGNOSTIC TEST')
  console.log('='.repeat(60))
  console.log(`Video ID: ${videoId}`)
  console.log(`Test URL: https://www.youtube.com/watch?v=${videoId}`)
  console.log('='.repeat(60) + '\n')

  // Test 1: Try without language specification
  console.log('📝 TEST 1: Fetching transcript without language specification')
  console.log('-'.repeat(60))
  try {
    const transcript1 = await YoutubeTranscript.fetchTranscript(videoId)
    console.log(`✅ SUCCESS!`)
    console.log(`   Segments retrieved: ${transcript1.length}`)
    console.log(`   First segment: ${JSON.stringify(transcript1[0])}`)
    console.log(`   Language detected: ${transcript1[0]?.lang || 'unknown'}`)
  } catch (error) {
    console.log(`❌ FAILED`)
    console.log(`   Error name: ${error.name}`)
    console.log(`   Error message: ${error.message}`)
    console.log(`   Error code: ${error.code || 'N/A'}`)
    console.log(`   Status code: ${error.statusCode || 'N/A'}`)
  }

  console.log('\n')

  // Test 2: Try with English language
  console.log('📝 TEST 2: Fetching transcript with English language (en)')
  console.log('-'.repeat(60))
  try {
    const transcript2 = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })
    console.log(`✅ SUCCESS!`)
    console.log(`   Segments retrieved: ${transcript2.length}`)
    console.log(`   First segment: ${JSON.stringify(transcript2[0])}`)
  } catch (error) {
    console.log(`❌ FAILED`)
    console.log(`   Error name: ${error.name}`)
    console.log(`   Error message: ${error.message}`)
    console.log(`   Error code: ${error.code || 'N/A'}`)
    console.log(`   Status code: ${error.statusCode || 'N/A'}`)
  }

  console.log('\n')

  // Test 3: List available languages
  console.log('📝 TEST 3: Attempting to list available caption languages')
  console.log('-'.repeat(60))
  try {
    // Some versions of youtube-transcript may expose available languages
    if (YoutubeTranscript.listTranscripts) {
      const transcripts = await YoutubeTranscript.listTranscripts(videoId)
      console.log(`✅ Available transcripts:`)
      console.log(JSON.stringify(transcripts, null, 2))
    } else {
      console.log(`⚠️  listTranscripts method not available in this package version`)
    }
  } catch (error) {
    console.log(`❌ FAILED or not supported`)
    console.log(`   Error: ${error.message}`)
  }

  console.log('\n')

  // Test 4: Package info
  console.log('📦 PACKAGE INFORMATION')
  console.log('-'.repeat(60))
  try {
    const packageJson = require('../package.json')
    const ytTranscriptVersion = packageJson.dependencies['youtube-transcript']
    console.log(`   youtube-transcript version: ${ytTranscriptVersion}`)
    console.log(`   Node version: ${process.version}`)
    console.log(`   Platform: ${process.platform}`)
  } catch (error) {
    console.log(`   Could not read package info: ${error.message}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ Diagnostic test completed')
  console.log('='.repeat(60) + '\n')
}

// Get video ID from command line
const videoId = process.argv[2]

if (!videoId) {
  console.error('❌ Error: Please provide a YouTube video ID')
  console.log('\nUsage: node scripts/test-transcript-extraction.js <video-id>')
  console.log('Example: node scripts/test-transcript-extraction.js dQw4w9WgXcQ')
  console.log('\nTip: Test with a video you know has captions enabled\n')
  process.exit(1)
}

// Run the test
testTranscriptExtraction(videoId).catch(error => {
  console.error('❌ Fatal error running diagnostic:', error)
  process.exit(1)
})
