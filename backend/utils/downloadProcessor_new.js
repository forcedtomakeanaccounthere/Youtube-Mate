const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, '../downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Active downloads tracking
const activeDownloads = new Map();
const MAX_CONCURRENT_DOWNLOADS = 3;

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url) {
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/);
  return match ? match[1] : null;
}

/**
 * Get video info using yt-dlp
 */
async function getVideoInfo(youtubeUrl, userEmail = null) {
  return new Promise((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-warnings',
      youtubeUrl
    ];

    // Add user email as user agent if provided
    if (userEmail) {
      args.push('--user-agent', `YouTube-Mate-User-${Buffer.from(userEmail).toString('base64')}`);
    }

    const process = spawn('yt-dlp', args);
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
  });
}

/**
 * Get available formats for a YouTube video using yt-dlp
 */
async function getAvailableFormats(youtubeUrl, userEmail = null) {
  return new Promise((resolve, reject) => {
    const args = [
      '--list-formats',
      '--dump-json',
      '--no-warnings',
      youtubeUrl
    ];

    // Add user email as user agent if provided
    if (userEmail) {
      args.push('--user-agent', `YouTube-Mate-User-${Buffer.from(userEmail).toString('base64')}`);
    }

    const process = spawn('yt-dlp', args);
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
  });
}

/**
 * Download audio from YouTube video using yt-dlp
 */
async function downloadAudio(youtubeUrl, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting audio download for:', youtubeUrl);
      
      // Extract video ID for filename
      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Generate safe filename
      const timestamp = Date.now();
      const filename = `audio_${videoId}_${timestamp}.%(ext)s`;
      const outputTemplate = path.join(DOWNLOADS_DIR, filename);

      const args = [
        '-f', 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio',
        '--extract-audio',
        '--audio-format', options.audio_format || 'mp3',
        '--audio-quality', '0', // Best quality
        '-o', outputTemplate,
        '--no-warnings',
        '--progress',
        youtubeUrl
      ];

      // Add user email as user agent if provided
      if (options.userEmail) {
        args.push('--user-agent', `YouTube-Mate-User-${Buffer.from(options.userEmail).toString('base64')}`);
      }

      // Add additional options to avoid bot detection
      args.push(
        '--no-check-certificate',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '--referer', 'https://www.youtube.com/',
        '--add-header', 'Accept-Language:en-US,en;q=0.9'
      );

      console.log('yt-dlp command:', 'yt-dlp', args.join(' '));

      const process = spawn('yt-dlp', args);
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
            file.includes(videoId) && 
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
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting video download for:', youtubeUrl);
      
      // Extract video ID for filename
      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL');
      }

      // Generate safe filename
      const timestamp = Date.now();
      const filename = `video_${videoId}_${timestamp}.%(ext)s`;
      const outputTemplate = path.join(DOWNLOADS_DIR, filename);

      const args = [
        '-f', 'best[height<=?1080]/best', // Prefer 1080p or best available
        '-o', outputTemplate,
        '--no-warnings',
        '--progress',
        youtubeUrl
      ];

      // Add user email as user agent if provided
      if (options.userEmail) {
        args.push('--user-agent', `YouTube-Mate-User-${Buffer.from(options.userEmail).toString('base64')}`);
      }

      // Add additional options to avoid bot detection
      args.push(
        '--no-check-certificate',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        '--referer', 'https://www.youtube.com/',
        '--add-header', 'Accept-Language:en-US,en;q=0.9'
      );

      console.log('yt-dlp command:', 'yt-dlp', args.join(' '));

      const process = spawn('yt-dlp', args);
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
            file.includes(videoId) && 
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

    } catch (error) {
      console.error('Download video error:', error);
      reject(error);
    }
  });
}

/**
 * Process download request
 */
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

module.exports = {
  processDownload,
  getAvailableFormats,
  downloadAudio,
  downloadVideo,
  getVideoInfo,
  extractVideoId,
  DOWNLOADS_DIR
};
