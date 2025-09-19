const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const os = require('os');

// Get the correct yt-dlp executable path
const YT_DLP_PATH = process.env.YT_DLP_PATH || 
  (process.platform === 'win32' 
    ? path.join(__dirname, '../../.venv/Scripts/yt-dlp.exe')
    : 'yt-dlp'); // Use global yt-dlp on Linux/production

// Cookies file path - check multiple locations
const getCookiesFile = () => {
  // If we have base64 encoded cookies in environment (for production)
  if (process.env.YOUTUBE_COOKIES_BASE64) {
    const cookiesPath = path.join(TEMP_DIR, 'cookies.txt');
    try {
      const cookiesContent = Buffer.from(process.env.YOUTUBE_COOKIES_BASE64, 'base64').toString('utf8');
      fs.writeFileSync(cookiesPath, cookiesContent);
      console.log(`📄 Created cookies file from environment: ${cookiesPath}`);
      return cookiesPath;
    } catch (error) {
      console.error('❌ Failed to decode cookies from environment:', error.message);
    }
  }
  
  const possiblePaths = [
    path.join(__dirname, '../www.youtube.com_cookies.txt'),
    path.join(process.cwd(), 'www.youtube.com_cookies.txt'),
    path.join(process.cwd(), 'backend/www.youtube.com_cookies.txt'),
    '/opt/render/project/src/backend/www.youtube.com_cookies.txt'
  ];
  
  for (const cookiePath of possiblePaths) {
    if (fs.existsSync(cookiePath)) {
      console.log(`📄 Using cookies file: ${cookiePath}`);
      return cookiePath;
    }
  }
  
  console.warn('⚠️ No cookies file found. Downloads may be limited.');
  return null;
};

const COOKIES_FILE = getCookiesFile();

// Use temporary directory for processing, but stream to user
const TEMP_DIR = path.join(os.tmpdir(), 'youtube-mate-temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Legacy downloads directory for compatibility (will be phased out)
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Log environment info on startup
console.log('🔧 Download Processor Configuration:');
console.log(`   yt-dlp path: ${YT_DLP_PATH}`);
console.log(`   Cookies file: ${COOKIES_FILE || 'None'}`);
console.log(`   Platform: ${process.platform}`);
console.log(`   Node env: ${process.env.NODE_ENV}`);

// Active downloads tracking
const activeDownloads = new Map();
const MAX_CONCURRENT_DOWNLOADS = 3;

/**
 * Get common yt-dlp arguments with cookies and rate limiting
 */
function getCommonArgs(userEmail = null) {
  const args = [
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '--add-header', 'Accept-Language:en-US,en;q=0.9',
    '--add-header', 'Accept-Encoding:gzip, deflate',
    '--extractor-retries', '5',
    '--retry-sleep', 'linear=1:10',
    '--sleep-interval', '3',
    '--max-sleep-interval', '10',
    '--no-warnings',
    '--no-check-certificate'
  ];

  // Add cookies if file exists
  if (COOKIES_FILE && fs.existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
    console.log('🍪 Using cookies for authentication');
  } else {
    console.warn('⚠️ No cookies file available - may encounter bot detection');
  }

  // Additional production-specific args
  if (process.env.NODE_ENV === 'production') {
    args.push(
      '--socket-timeout', '30',
      '--fragment-retries', '10',
      '--abort-on-unavailable-fragment', 'false'
    );
  }

  // Add user email as user agent if provided
  if (userEmail) {
    args[1] = `YouTube-Mate-User-${Buffer.from(userEmail).toString('base64')}`;
  }

  return args;
}

/**
 * Test yt-dlp availability and configuration
 */
async function testYtDlpAvailability() {
  return new Promise((resolve) => {
    console.log('🧪 Testing yt-dlp availability...');
    
    const testProcess = spawn(YT_DLP_PATH, ['--version'], { stdio: 'pipe' });
    
    let output = '';
    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ yt-dlp is available: ${output.trim()}`);
        resolve(true);
      } else {
        console.error(`❌ yt-dlp test failed with code: ${code}`);
        console.error(`   Path: ${YT_DLP_PATH}`);
        resolve(false);
      }
    });
    
    testProcess.on('error', (error) => {
      console.error(`❌ yt-dlp error: ${error.message}`);
      console.error(`   Path: ${YT_DLP_PATH}`);
      resolve(false);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      testProcess.kill();
      console.error('❌ yt-dlp test timed out');
      resolve(false);
    }, 10000);
  });
}

// Test yt-dlp on module load
testYtDlpAvailability().then(available => {
  if (!available) {
    console.error('⚠️ WARNING: yt-dlp is not available. Downloads will fail!');
  }
});

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url) {
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : null;
}

/**
 * Sanitize filename to remove invalid characters
 */
function sanitizeFilename(title) {
  // Remove or replace invalid characters for filenames
  return title
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filesystem characters
    .replace(/[^\w\s.\-()[\]{}!@#$%^&+=~`]/g, '') // Keep more characters including parentheses, brackets, and some symbols (escaped dash)
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\.{2,}/g, '.') // Replace multiple dots with single
    .substring(0, 150) // Increase length limit to 150 characters
    .trim(); // Remove leading/trailing spaces
}

/**
 * Get video info using yt-dlp
 */
async function getVideoInfo(youtubeUrl, userEmail = null) {
  return new Promise((resolve, reject) => {
    const args = [
      ...getCommonArgs(userEmail),
      '--dump-json',
      youtubeUrl
    ];

    const process = spawn(YT_DLP_PATH, args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp getInfo error:', stderr);
        return reject(new Error(`Failed to get video info: ${stderr}`));
      }

      try {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title || 'Unknown Title',
          duration: info.duration || 0,
          thumbnail: info.thumbnail,
          videoId: info.id,
          uploader: info.uploader || 'Unknown',
          description: info.description || '',
          view_count: info.view_count || 0
        });
      } catch (error) {
        console.error('Error parsing yt-dlp JSON:', error);
        reject(new Error('Failed to parse video info'));
      }
    });

    process.on('error', (error) => {
      console.error('yt-dlp spawn error:', error);
      reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
    });
  });
}

/**
 * Get available formats for a YouTube video using yt-dlp
 */
async function getAvailableFormats(youtubeUrl, userEmail = null) {
  return new Promise((resolve, reject) => {
    const args = [
      ...getCommonArgs(userEmail),
      '--list-formats',
      '--dump-json',
      youtubeUrl
    ];

    const process = spawn(YT_DLP_PATH, args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        console.error('yt-dlp formats error:', stderr);
        return reject(new Error(`Failed to get formats: ${stderr}`));
      }

      try {
        const lines = stdout.split('\n').filter(line => line.trim());
        const jsonLine = lines.find(line => line.startsWith('{'));
        
        if (!jsonLine) {
          return reject(new Error('No video info found'));
        }

        const info = JSON.parse(jsonLine);
        
        // Extract available formats
        const formats = info.formats || [];
        
        // Process audio formats
        const audioFormats = formats
          .filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'))
          .map(f => ({
            quality: `${f.abr || 128}kbps`,
            format: f.ext || 'mp3',
            fileSize: f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(1)} MB` : 'Unknown',
            bitrate: f.abr || 128,
            available: true,
            type: 'audio',
            format_id: f.format_id
          }));

        // Process video formats
        const videoFormats = formats
          .filter(f => f.vcodec && f.vcodec !== 'none' && f.height)
          .map(f => ({
            quality: `${f.height}p`,
            format: f.ext || 'mp4',
            fileSize: f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(1)} MB` : 'Unknown',
            fps: f.fps || 30,
            available: true,
            type: 'video',
            format_id: f.format_id,
            hasAudio: f.acodec && f.acodec !== 'none'
          }));

        // Sort formats
        const sortedAudio = audioFormats.sort((a, b) => b.bitrate - a.bitrate);
        const sortedVideo = videoFormats.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

        resolve({
          video: sortedVideo,
          audio: sortedAudio,
          title: info.title,
          duration: info.duration,
          thumbnail: info.thumbnail
        });
      } catch (error) {
        console.error('Error parsing yt-dlp formats:', error);
        reject(new Error('Failed to parse video formats'));
      }
    });

    process.on('error', (error) => {
      console.error('yt-dlp spawn error:', error);
      reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
    });
  });
}

/**
 * Download audio from YouTube video using yt-dlp
 */
async function downloadAudio(youtubeUrl, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Starting audio download for:', youtubeUrl);
      
      // Extract video ID for fallback
      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Get video info first to extract title
      let videoTitle = 'unknown_video';
      try {
        const videoInfo = await getVideoInfo(youtubeUrl, options.userEmail);
        videoTitle = sanitizeFilename(videoInfo.title);
        console.log('Video title:', videoInfo.title, '-> sanitized:', videoTitle);
      } catch (error) {
        console.warn('Could not get video title, using fallback:', error.message);
        videoTitle = `video_${videoId}`;
      }

      // Generate filename with video title
      const outputTemplate = path.join(DOWNLOADS_DIR, `${videoTitle}.%(ext)s`);

      const args = [
        ...getCommonArgs(options.userEmail),
        '-f', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
        '--extract-audio',
        '--audio-format', options.audio_format || 'mp3',
        '--audio-quality', '0', // Best quality
        '-o', outputTemplate,
        '--progress',
        '--no-check-certificate',
        '--referer', 'https://www.youtube.com/',
        youtubeUrl
      ];

      console.log('yt-dlp command:', YT_DLP_PATH, args.join(' '));

      const process = spawn(YT_DLP_PATH, args);
      let downloadPath = null;
      let progress = 0;

      process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('yt-dlp output:', output);

        // Parse progress
        const progressMatch = output.match(/(\d+(?:\.\d+)?)%/);
        if (progressMatch) {
          progress = parseFloat(progressMatch[1]);
          if (options.onProgress) {
            options.onProgress(progress);
          }
        }

        // Extract final filename
        const pathMatch = output.match(/\[ExtractAudio\] Destination: (.+)/);
        if (pathMatch) {
          downloadPath = pathMatch[1].trim();
        }
      });

      process.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('yt-dlp error:', error);
        
        // Check for specific YouTube bot detection errors
        if (error.includes('Sign in to confirm you\'re not a bot') || 
            error.includes('This helps protect our community')) {
          reject(new Error('YouTube detected bot behavior. Please try again later or use a different network.'));
          return;
        }
        
        if (error.includes('Private video') || error.includes('Video unavailable')) {
          reject(new Error('Video is private or unavailable'));
          return;
        }
      });

      process.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`yt-dlp process failed with code ${code}`));
        }

        // Find the downloaded file if path wasn't captured
        if (!downloadPath) {
          const files = fs.readdirSync(DOWNLOADS_DIR);
          const audioFile = files.find(file => 
            (file.includes(videoTitle) || file.includes(videoId)) && 
            (file.endsWith('.mp3') || file.endsWith('.m4a') || file.endsWith('.opus'))
          );
          
          if (audioFile) {
            downloadPath = path.join(DOWNLOADS_DIR, audioFile);
          }
        }

        if (!downloadPath || !fs.existsSync(downloadPath)) {
          return reject(new Error('Download completed but file not found'));
        }

        const stats = fs.statSync(downloadPath);
        const actualFilename = path.basename(downloadPath);

        console.log('Audio download completed:', actualFilename);
        resolve({
          filename: actualFilename,
          filepath: downloadPath,
          size: stats.size,
          format: path.extname(downloadPath).substring(1),
          bitrate: 'best available'
        });
      });

      process.on('error', (error) => {
        console.error('yt-dlp spawn error:', error);
        reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
      });

    } catch (error) {
      console.error('Download audio error:', error);
      reject(error);
    }
  });
}

/**
 * Download video from YouTube using yt-dlp
 */
async function downloadVideo(youtubeUrl, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🎥 Starting video download for:', youtubeUrl);
      console.log('🔧 Environment:', process.env.NODE_ENV);
      console.log('🛠️ yt-dlp path:', YT_DLP_PATH);
      
      // Extract video ID for fallback
      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Get video info first to extract title
      let videoTitle = 'unknown_video';
      try {
        const videoInfo = await getVideoInfo(youtubeUrl, options.userEmail);
        videoTitle = sanitizeFilename(videoInfo.title);
        console.log('📋 Video title:', videoInfo.title, '-> sanitized:', videoTitle);
      } catch (error) {
        console.warn('⚠️ Could not get video title, using fallback:', error.message);
        videoTitle = `video_${videoId}`;
      }

      // Generate filename with video title
      const outputTemplate = path.join(DOWNLOADS_DIR, `${videoTitle}.%(ext)s`);

      const args = [
        ...getCommonArgs(options.userEmail),
        '-f', 'best[height<=?1080]/best', // Prefer 1080p or best available
        '-o', outputTemplate,
        '--progress',
        '--no-check-certificate',
        '--referer', 'https://www.youtube.com/',
        youtubeUrl
      ];

      console.log('🔨 yt-dlp command:', YT_DLP_PATH, args.join(' '));

      const process = spawn(YT_DLP_PATH, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });
      let downloadPath = null;
      let progress = 0;

      process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('yt-dlp output:', output);

        // Parse progress
        const progressMatch = output.match(/(\d+(?:\.\d+)?)%/);
        if (progressMatch) {
          progress = parseFloat(progressMatch[1]);
          if (options.onProgress) {
            options.onProgress(progress);
          }
        }

        // Extract filename
        const pathMatch = output.match(/\[download\] Destination: (.+)/);
        if (pathMatch) {
          downloadPath = pathMatch[1].trim();
        }
      });

      process.stderr.on('data', (data) => {
        const error = data.toString();
        console.error('yt-dlp error:', error);
        
        // Check for specific YouTube bot detection errors
        if (error.includes('Sign in to confirm you\'re not a bot') || 
            error.includes('This helps protect our community')) {
          reject(new Error('YouTube detected bot behavior. Please try again later or use a different network.'));
          return;
        }
        
        if (error.includes('Private video') || error.includes('Video unavailable')) {
          reject(new Error('Video is private or unavailable'));
          return;
        }
      });

      process.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`yt-dlp process failed with code ${code}`));
        }

        // Find the downloaded file if path wasn't captured
        if (!downloadPath) {
          const files = fs.readdirSync(DOWNLOADS_DIR);
          const videoFile = files.find(file => 
            (file.includes(videoTitle) || file.includes(videoId)) && 
            (file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mkv'))
          );
          
          if (videoFile) {
            downloadPath = path.join(DOWNLOADS_DIR, videoFile);
          }
        }

        if (!downloadPath || !fs.existsSync(downloadPath)) {
          return reject(new Error('Download completed but file not found'));
        }

        const stats = fs.statSync(downloadPath);
        const actualFilename = path.basename(downloadPath);

        console.log('Video download completed:', actualFilename);
        resolve({
          filename: actualFilename,
          filepath: downloadPath,
          size: stats.size,
          format: path.extname(downloadPath).substring(1)
        });
      });

      process.on('error', (error) => {
        console.error('yt-dlp spawn error:', error);
        reject(new Error(`Failed to spawn yt-dlp: ${error.message}`));
      });

    } catch (error) {
      console.error('Download video error:', error);
      reject(error);
    }
  });
}

/**
 * Stream video/audio directly to client without storing on server
 */
async function streamDownload(youtubeUrl, format, quality, res, userEmail = null) {
  return new Promise((resolve, reject) => {
    let args;
    
    if (format === 'audio') {
      args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', quality === 'highestaudio' ? '0' : '5',
        '--output', '-',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--add-header', 'Accept-Encoding:gzip, deflate',
        '--extractor-retries', '3',
        '--retry-sleep', 'linear=1:3',
        '--sleep-interval', '1',
        '--max-sleep-interval', '3',
        youtubeUrl
      ];
    } else {
      const heightMatch = quality.match(/(\d+)p/);
      const height = heightMatch ? heightMatch[1] : '720';
      args = [
        '--format', `best[height<=${height}]/best`,
        '--output', '-',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--add-header', 'Accept-Encoding:gzip, deflate',
        '--extractor-retries', '3',
        '--retry-sleep', 'linear=1:3',
        '--sleep-interval', '1',
        '--max-sleep-interval', '3',
        youtubeUrl
      ];
    }

    // Add user email as user agent if provided
    if (userEmail) {
      args[7] = `YouTube-Mate-User-${Buffer.from(userEmail).toString('base64')}`;
    }

    console.log('Streaming download with yt-dlp args:', args.slice(0, 5), '...');

    const ytDlpProcess = spawn(YT_DLP_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let hasStarted = false;

    ytDlpProcess.stdout.on('data', (chunk) => {
      if (!hasStarted) {
        hasStarted = true;
        // Set appropriate headers for download
        const extension = format === 'audio' ? 'mp3' : 'mp4';
        const mimeType = format === 'audio' ? 'audio/mpeg' : 'video/mp4';
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="download.${extension}"`);
        res.setHeader('Transfer-Encoding', 'chunked');
      }
      
      res.write(chunk);
    });

    ytDlpProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('yt-dlp streaming error:', error);
      
      if (error.includes('Sign in to confirm you\'re not a bot') || 
          error.includes('This helps protect our community')) {
        if (!hasStarted) {
          reject(new Error('YouTube detected bot behavior. Please try again later.'));
        }
        return;
      }
      
      if (error.includes('Private video') || error.includes('Video unavailable')) {
        if (!hasStarted) {
          reject(new Error('Video is private or unavailable'));
        }
        return;
      }
    });

    ytDlpProcess.on('close', (code) => {
      if (code !== 0 && !hasStarted) {
        reject(new Error(`yt-dlp process failed with code ${code}`));
        return;
      }
      
      if (hasStarted) {
        res.end();
        resolve({ success: true, streamed: true });
      } else {
        reject(new Error('No data received from yt-dlp'));
      }
    });

    ytDlpProcess.on('error', (error) => {
      console.error('yt-dlp process error:', error);
      if (!hasStarted) {
        reject(new Error(`Process error: ${error.message}`));
      }
    });

    // Handle client disconnect
    res.on('close', () => {
      if (ytDlpProcess && !ytDlpProcess.killed) {
        ytDlpProcess.kill('SIGTERM');
      }
    });
  });
}

async function processDownload(downloadData) {
  const { youtube_url, format, quality, options = {} } = downloadData;

  try {
    console.log(`Processing ${format} download for:`, youtube_url);

    if (format === 'audio') {
      return await downloadAudio(youtube_url, {
        audio_format: options.audio_format || 'mp3',
        userEmail: options.userEmail,
        onProgress: options.onProgress
      });
    } else if (format === 'video') {
      return await downloadVideo(youtube_url, {
        video_format: options.video_format || 'mp4',
        quality: quality,
        userEmail: options.userEmail,
        onProgress: options.onProgress
      });
    } else {
      throw new Error('Invalid format specified');
    }
  } catch (error) {
    console.error('Process download error:', error);
    throw error;
  }
}

/**
 * Stream video/audio directly to client without storing on server
 */
async function streamDownload(youtubeUrl, format, quality, res, userEmail = null) {
  return new Promise((resolve, reject) => {
    let args;
    
    if (format === 'audio') {
      args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', quality === 'highestaudio' ? '0' : '5',
        '--output', '-',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--add-header', 'Accept-Encoding:gzip, deflate',
        '--extractor-retries', '3',
        '--retry-sleep', 'linear=1:3',
        '--sleep-interval', '1',
        '--max-sleep-interval', '3',
        youtubeUrl
      ];
    } else {
      const heightMatch = quality.match(/(\d+)p/);
      const height = heightMatch ? heightMatch[1] : '720';
      args = [
        '--format', `best[height<=${height}]/best`,
        '--output', '-',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--add-header', 'Accept-Encoding:gzip, deflate',
        '--extractor-retries', '3',
        '--retry-sleep', 'linear=1:3',
        '--sleep-interval', '1',
        '--max-sleep-interval', '3',
        youtubeUrl
      ];
    }

    // Add user email as user agent if provided
    if (userEmail) {
      args[7] = `YouTube-Mate-User-${Buffer.from(userEmail).toString('base64')}`;
    }

    console.log('Streaming download with yt-dlp args:', args.slice(0, 5), '...');

    const ytDlpProcess = spawn(YT_DLP_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let hasStarted = false;

    ytDlpProcess.stdout.on('data', (chunk) => {
      if (!hasStarted) {
        hasStarted = true;
        // Set appropriate headers for download
        const extension = format === 'audio' ? 'mp3' : 'mp4';
        const mimeType = format === 'audio' ? 'audio/mpeg' : 'video/mp4';
        
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="download.${extension}"`);
        res.setHeader('Transfer-Encoding', 'chunked');
      }
      
      res.write(chunk);
    });

    ytDlpProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('yt-dlp streaming error:', error);
      
      if (error.includes('Sign in to confirm you\'re not a bot') || 
          error.includes('This helps protect our community')) {
        if (!hasStarted) {
          reject(new Error('YouTube detected bot behavior. Please try again later.'));
        }
        return;
      }
      
      if (error.includes('Private video') || error.includes('Video unavailable')) {
        if (!hasStarted) {
          reject(new Error('Video is private or unavailable'));
        }
        return;
      }
    });

    ytDlpProcess.on('close', (code) => {
      if (code !== 0 && !hasStarted) {
        reject(new Error(`yt-dlp process failed with code ${code}`));
        return;
      }
      
      if (hasStarted) {
        res.end();
        resolve({ success: true, streamed: true });
      } else {
        reject(new Error('No data received from yt-dlp'));
      }
    });

    ytDlpProcess.on('error', (error) => {
      console.error('yt-dlp process error:', error);
      if (!hasStarted) {
        reject(new Error(`Process error: ${error.message}`));
      }
    });

    // Handle client disconnect
    res.on('close', () => {
      if (ytDlpProcess && !ytDlpProcess.killed) {
        ytDlpProcess.kill('SIGTERM');
      }
    });
  });
}

/**
 * Stream download directly to user (no server storage)
 */
async function streamDownload(youtubeUrl, format, quality, res, userEmail = null) {
  return new Promise((resolve, reject) => {
    try {
      // Get video info first for filename
      getVideoInfo(youtubeUrl, userEmail)
        .then(videoInfo => {
          const filename = sanitizeFilename(videoInfo.title);
          let args;
          let contentType;
          let fileExtension;

          if (format === 'audio') {
            args = [
              '--extract-audio',
              '--audio-format', 'mp3',
              '--audio-quality', quality === 'highestaudio' ? '0' : '5',
              '--output', '-',
              '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              '--add-header', 'Accept-Language:en-US,en;q=0.9',
              '--add-header', 'Accept-Encoding:gzip, deflate',
              '--extractor-retries', '3',
              '--retry-sleep', 'linear=1:3',
              '--sleep-interval', '1',
              '--max-sleep-interval', '3',
              youtubeUrl
            ];
            contentType = 'audio/mpeg';
            fileExtension = 'mp3';
          } else {
            const heightMatch = quality.match(/(\d+)p/);
            const height = heightMatch ? heightMatch[1] : '720';
            
            args = [
              '--format', `best[height<=${height}]/best`,
              '--output', '-',
              '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              '--add-header', 'Accept-Language:en-US,en;q=0.9',
              '--add-header', 'Accept-Encoding:gzip, deflate',
              '--extractor-retries', '3',
              '--retry-sleep', 'linear=1:3',
              '--sleep-interval', '1',
              '--max-sleep-interval', '3',
              youtubeUrl
            ];
            contentType = 'video/mp4';
            fileExtension = 'mp4';
          }

          // Create descriptive filename with quality
          let finalFilename;
          if (format === 'audio') {
            finalFilename = `${filename}_${quality}.${fileExtension}`;
          } else {
            finalFilename = `${filename}_${quality}.${fileExtension}`;
          }

          // Set response headers for download
          res.setHeader('Content-Type', contentType);
          res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(finalFilename)}`);
          res.setHeader('Transfer-Encoding', 'chunked');

          // Spawn yt-dlp process
          const ytdlpProcess = spawn(YT_DLP_PATH, args);
          
          // Pipe the output directly to response
          ytdlpProcess.stdout.pipe(res);

          let stderr = '';
          ytdlpProcess.stderr.on('data', (data) => {
            stderr += data.toString();
          });

          ytdlpProcess.on('close', async (code) => {
            if (code !== 0) {
              console.error('yt-dlp streaming error:', stderr);
              if (!res.headersSent) {
                res.status(500).json({ error: `Download failed: ${stderr}` });
              }
              return reject(new Error(`Download failed: ${stderr}`));
            }
            
            // Save download record to database
            try {
              const Download = require('../models/Download');
              await Download.create({
                youtube_url: youtubeUrl,
                video_id: extractVideoId(youtubeUrl),
                format: format,
                quality: quality,
                file_name: finalFilename,
                status: 'completed',
                metadata: {
                  title: videoInfo.title,
                  duration: videoInfo.duration,
                  thumbnail: videoInfo.thumbnail,
                  uploader: videoInfo.uploader
                },
                user_email: userEmail,
                ip_address: res.req ? res.req.ip : null,
                created_at: new Date(),
                completed_at: new Date()
              });
            } catch (dbError) {
              console.error('Error saving download record:', dbError);
              // Don't fail the download if database save fails
            }
            
            resolve({
              success: true,
              filename: finalFilename,
              streamed: true
            });
          });

          ytdlpProcess.on('error', (error) => {
            console.error('yt-dlp process error:', error);
            if (!res.headersSent) {
              res.status(500).json({ error: `Process error: ${error.message}` });
            }
            reject(error);
          });
        })
        .catch(error => {
          console.error('Error getting video info for streaming:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to get video information' });
          }
          reject(error);
        });
    } catch (error) {
      console.error('Stream download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
      reject(error);
    }
  });
}

module.exports = {
  processDownload,
  getAvailableFormats,
  downloadAudio,
  downloadVideo,
  getVideoInfo,
  extractVideoId,
  streamDownload,
  DOWNLOADS_DIR
};
