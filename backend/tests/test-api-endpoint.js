/**
 * Test the actual /api/transcript endpoint
 * Run this while the server is running on port 5000
 */

const axios = require('axios')

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'
const VIDEO_URL = 'https://youtu.be/gfoqygqCW38'

async function testTranscriptAPI() {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 TESTING /api/transcript ENDPOINT')
  console.log('='.repeat(60))
  console.log(`Backend URL: ${BACKEND_URL}`)
  console.log(`Video URL: ${VIDEO_URL}`)
  console.log('='.repeat(60) + '\n')

  try {
    // First, you need to get an auth token
    console.log('⚠️  NOTE: This endpoint requires authentication')
    console.log('If you get a 401 error, you need to:')
    console.log('1. Login via the frontend')
    console.log('2. Get your JWT token from localStorage')
    console.log('3. Pass it in the Authorization header\n')

    // For now, try without auth to see what happens
    console.log('📝 Sending POST request to /api/transcript...\n')
    
    const response = await axios.post(
      `${BACKEND_URL}/api/transcript`,
      {
        youtubeUrl: VIDEO_URL,
        language: 'en',
        summaryType: 'brief'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          // Add your token here if you have one:
          // 'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
        },
        timeout: 60000 // 60 second timeout
      }
    )

    console.log('✅ Response received:')
    console.log(JSON.stringify(response.data, null, 2))
    console.log(`\nStatus: ${response.status}`)
    
    if (response.data.transcriptId) {
      console.log('\n📊 Transcript is being processed!')
      console.log(`Transcript ID: ${response.data.transcriptId}`)
      console.log('\nYou can check status at:')
      console.log(`GET ${BACKEND_URL}/api/transcript/${response.data.transcriptId}/status`)
    }

  } catch (error) {
    console.log('❌ ERROR:')
    
    if (error.response) {
      // Server responded with error
      console.log(`Status: ${error.response.status}`)
      console.log(`Message: ${JSON.stringify(error.response.data, null, 2)}`)
      
      if (error.response.status === 401) {
        console.log('\n💡 Authentication required!')
        console.log('To test with auth:')
        console.log('1. Start frontend: cd ../frontend && npm run dev')
        console.log('2. Login at http://localhost:3000')
        console.log('3. Open browser console and run: localStorage.getItem("token")')
        console.log('4. Copy the token and add it to this script')
      }
    } else if (error.request) {
      // No response from server
      console.log('No response from server. Is the backend running?')
      console.log(`Tried to connect to: ${BACKEND_URL}`)
      console.log('\nStart the backend with: npm start')
    } else {
      // Other error
      console.log(`Error: ${error.message}`)
    }
  }

  console.log('\n' + '='.repeat(60) + '\n')
}

testTranscriptAPI()
