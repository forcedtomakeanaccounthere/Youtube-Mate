const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Enhanced request management
const activeDownloads = new Map();
const requestQueue = [];
const lastRequestTime = new Map(); // Track last request time per IP/user
const MAX_CONCURRENT_DOWNLOADS = 2; // Reduced for better stability
const REQUEST_DELAY = 3000; // 3 seconds between requests
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0'
];

/**
 * Get random user agent
 */
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Delay execution for specified milliseconds
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if user needs to wait before making another request
 */
function shouldThrottleRequest(userIdentifier) {
  const lastTime = lastRequestTime.get(userIdentifier);
  if (!lastTime) return false;
  
  const timeSinceLastRequest = Date.now() - lastTime;
  return timeSinceLastRequest < REQUEST_DELAY;
}

/**
 * Get wait time for throttled requests
 */
function getWaitTime(userIdentifier) {
  const lastTime = lastRequestTime.get(userIdentifier);
  if (!lastTime) return 0;
  
  const timeSinceLastRequest = Date.now() - lastTime;
  return Math.max(0, REQUEST_DELAY - timeSinceLastRequest);
}

/**
 * Update last request time for user
 */
function updateRequestTime(userIdentifier) {
  lastRequestTime.set(userIdentifier, Date.now());
}

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
  return title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100)
    .trim('_');
}

/**
 * Enhanced yt-dlp execution with better bot detection bypass
 */
function executeYtDlp(args, userIdentifier = 'default') {
  return new Promise(async (resolve, reject) => {
    try {
      // Apply throttling
      if (shouldThrottleRequest(userIdentifier)) {
        const waitTime = getWaitTime(userIdentifier);
        console.log(`Throttling request for ${userIdentifier}, waiting ${waitTime}ms`);
        await delay(waitTime);
      }

      updateRequestTime(userIdentifier);

      // Enhanced arguments for better bot detection bypass
      const enhancedArgs = [
        ...args,
        '--user-agent', getRandomUserAgent(),
        '--sleep-interval', '2',
        '--max-sleep-interval', '5',
        '--sleep-subtitles', '2',
        '--extractor-retries', '3',
        '--fragment-retries', '3',
        '--retry-sleep', 'linear=2:10',
        '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        '--add-header', 'Accept-Language:en-US,en;q=0.9',
        '--add-header', 'Accept-Encoding:gzip, deflate',
        '--add-header', 'DNT:1',
        '--add-header', 'Connection:keep-alive',
        '--add-header', 'Upgrade-Insecure-Requests:1',
        '--no-check-certificate',
        '--prefer-free-formats',
        '--no-warnings'
      ];

      console.log('Executing yt-dlp with enhanced args:', enhancedArgs.slice(0, 5), '...');

      const childProcess = spawn('yt-dlp', enhancedArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      let stdout = '';
      let stderr = '';

      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Set timeout for the process
      const timeout = setTimeout(() => {
        childProcess.kill('SIGTERM');
        reject(new Error('Process timeout - operation took too long'));
      }, 120000); // 2 minutes timeout

      childProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code !== 0) {
          console.error('yt-dlp error:', stderr);
          
          // Check for specific error types
          if (stderr.includes('Sign in to confirm you\'re not a bot') || 
              stderr.includes('too many requests') ||
              stderr.includes('429')) {
            // Exponential backoff for rate limiting
            const backoffTime = Math.min(30000, REQUEST_DELAY * 2); // Max 30 seconds
            lastRequestTime.set(userIdentifier, Date.now() + backoffTime);
            return reject(new Error('Rate limited by YouTube. Please try again in a moment.'));
          }
          
          if (stderr.includes('Video unavailable') || stderr.includes('Private video')) {
            return reject(new Error('Video is unavailable or private'));
          }
          
          return reject(new Error(`Download failed: ${stderr || 'Unknown error'}`));
        }

        resolve({ stdout, stderr });
      });

      childProcess.on('error', (error) => {
        clearTimeout(timeout);
        console.error('Process error:', error);
        reject(new Error(`Process error: ${error.message}`));
      });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get video info using enhanced yt-dlp
 */
async function getVideoInfo(youtubeUrl, userEmail = null) {
  const userIdentifier = userEmail || 'anonymous';
  
  try {
    const args = [
      '--dump-json',
      '--no-playlist',
      youtubeUrl
    ];

    const result = await executeYtDlp(args, userIdentifier);
    
    try {
      const info = JSON.parse(result.stdout);
      return {
        title: info.title || 'Unknown Title',
        duration: info.duration || 0,
        thumbnail: info.thumbnail,
        videoId: info.id,
        uploader: info.uploader || 'Unknown',
        description: info.description || '',
        view_count: info.view_count || 0
      };
    } catch (error) {
      console.error('Error parsing yt-dlp JSON:', error);
      throw new Error('Failed to parse video info');
    }
  } catch (error) {
    console.error('getVideoInfo error:', error);
    throw error;
  }
}

/**
 * Get available formats with enhanced error handling
 */
async function getAvailableFormats(youtubeUrl, userEmail = null) {
  const userIdentifier = userEmail || 'anonymous';
  
  try {
    const args = [
      '--list-formats',
      '--dump-json',
      '--no-playlist',
      youtubeUrl
    ];

    const result = await executeYtDlp(args, userIdentifier);
    
    try {
      const lines = result.stdout.split('\n').filter(line => line.trim());
      const jsonLine = lines.find(line => line.startsWith('{'));
      
      if (!jsonLine) {
        throw new Error('No video info found');
      }

      const info = JSON.parse(jsonLine);
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
        }))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
        .slice(0, 5); // Limit to top 5 audio formats

      // Process video formats
      const videoFormats = formats
        .filter(f => f.vcodec && f.vcodec !== 'none' && f.height)
        .map(f => ({
          quality: `${f.height}p`,
          format: f.ext || 'mp4',
          fileSize: f.filesize ? `${(f.filesize / (1024 * 1024)).toFixed(1)} MB` : 'Unknown',
          resolution: `${f.width}x${f.height}`,
          fps: f.fps || 30,
          available: true,
          type: 'video',
          format_id: f.format_id
        }))
        .sort((a, b) => parseInt(b.quality) - parseInt(a.quality))
        .slice(0, 8); // Limit to top 8 video formats

      return {
        audioFormats: audioFormats.length > 0 ? audioFormats : [
          { quality: '128kbps', format: 'mp3', available: true, type: 'audio' }
        ],
        videoFormats: videoFormats.length > 0 ? videoFormats : [
          { quality: '720p', format: 'mp4', available: true, type: 'video' }
        ]
      };
    } catch (error) {
      console.error('Error parsing formats:', error);
      throw new Error('Failed to parse video formats');
    }
  } catch (error) {
    console.error('getAvailableFormats error:', error);
    throw error;
  }
}

/**
 * Enhanced download function with better error handling
 */
async function downloadVideo(youtubeUrl, format, quality, userEmail = null, customFilename = null) {
  const userIdentifier = userEmail || 'anonymous';
  const videoId = extractVideoId(youtubeUrl);
  
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  // Check concurrent downloads limit
  if (activeDownloads.size >= MAX_CONCURRENT_DOWNLOADS) {
    throw new Error('Too many active downloads. Please try again later.');
  }

  const downloadId = `${videoId}_${Date.now()}`;
  activeDownloads.set(downloadId, { status: 'starting', progress: 0 });

  try {
    // Get video info first
    const videoInfo = await getVideoInfo(youtubeUrl, userEmail);
    const filename = customFilename || sanitizeFilename(videoInfo.title);
    
    let outputTemplate;
    let formatSelector;

    if (format === 'audio') {
      outputTemplate = path.join(DOWNLOADS_DIR, `${filename}.%(ext)s`);
      formatSelector = quality === 'highestaudio' ? 'bestaudio/best' : `bestaudio[abr<=${quality.replace('kbps', '')}]/bestaudio/best`;
    } else {
      outputTemplate = path.join(DOWNLOADS_DIR, `${filename}.%(ext)s`);
      const heightMatch = quality.match(/(\d+)p/);
      const height = heightMatch ? heightMatch[1] : '720';
      formatSelector = `best[height<=${height}]/best`;
    }

    const args = [
      '--format', formatSelector,
      '--output', outputTemplate,
      '--no-playlist',
      youtubeUrl
    ];

    // Add audio-specific options
    if (format === 'audio') {
      args.push('--extract-audio', '--audio-format', 'mp3');
    }

    console.log(`Starting download for ${videoId} with format: ${formatSelector}`);
    
    const result = await executeYtDlp(args, userIdentifier);
    
    // Find the downloaded file
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const downloadedFile = files.find(file => file.includes(filename) || file.includes(videoId));
    
    if (!downloadedFile) {
      throw new Error('Downloaded file not found');
    }

    const filePath = path.join(DOWNLOADS_DIR, downloadedFile);
    const stats = fs.statSync(filePath);

    activeDownloads.delete(downloadId);

    return {
      success: true,
      filename: downloadedFile,
      path: filePath,
      size: stats.size,
      title: videoInfo.title,
      videoId: videoId
    };

  } catch (error) {
    activeDownloads.delete(downloadId);
    console.error('Download error:', error);
    throw error;
  }
}

/**
 * Enhanced playlist download with better error handling
 */
async function downloadPlaylist(playlistUrl, format, quality, userEmail = null) {
  const userIdentifier = userEmail || 'anonymous';
  
  try {
    // First get playlist info
    const args = [
      '--dump-json',
      '--flat-playlist',
      playlistUrl
    ];

    const result = await executeYtDlp(args, userIdentifier);
    
    const lines = result.stdout.split('\n').filter(line => line.trim());
    const videos = [];
    
    for (const line of lines) {
      try {
        const videoInfo = JSON.parse(line);
        if (videoInfo.id && videoInfo.title) {
          videos.push({
            id: videoInfo.id,
            title: videoInfo.title,
            url: `https://www.youtube.com/watch?v=${videoInfo.id}`
          });
        }
      } catch (e) {
        // Skip invalid JSON lines
        continue;
      }
    }

    if (videos.length === 0) {
      throw new Error('No videos found in playlist');
    }

    // Limit playlist downloads to prevent abuse
    const maxVideos = 10;
    const videosToDownload = videos.slice(0, maxVideos);
    
    console.log(`Downloading ${videosToDownload.length} videos from playlist`);

    const results = [];
    for (let i = 0; i < videosToDownload.length; i++) {
      const video = videosToDownload[i];
      
      try {
        // Add delay between playlist downloads
        if (i > 0) {
          await delay(5000); // 5 seconds between downloads
        }
        
        const result = await downloadVideo(video.url, format, quality, userEmail, `${i + 1}_${video.title}`);
        results.push({ ...result, originalTitle: video.title });
        
        console.log(`Downloaded ${i + 1}/${videosToDownload.length}: ${video.title}`);
      } catch (error) {
        console.error(`Failed to download ${video.title}:`, error);
        results.push({
          success: false,
          error: error.message,
          originalTitle: video.title,
          videoId: video.id
        });
      }
    }

    return {
      success: true,
      totalVideos: videos.length,
      downloadedVideos: videosToDownload.length,
      results: results
    };

  } catch (error) {
    console.error('Playlist download error:', error);
    throw error;
  }
}

module.exports = {
  getVideoInfo,
  getAvailableFormats,
  downloadVideo,
  downloadPlaylist,
  extractVideoId,
  sanitizeFilename,
  activeDownloads
};
