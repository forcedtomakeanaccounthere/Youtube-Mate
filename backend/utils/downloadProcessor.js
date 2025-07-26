const ytdl = require('@distube/ytdl-core');
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
 * Get available formats for a YouTube video
 */
async function getAvailableFormats(youtubeUrl) {
  try {
    console.log('Fetching formats for:', youtubeUrl);
    
    // Validate YouTube URL
    if (!ytdl.validateURL(youtubeUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    // Get video info
    const info = await ytdl.getInfo(youtubeUrl);
    const formats = info.formats;

    // Separate audio and video formats
    const audioFormats = formats.filter(format => 
      format.hasAudio && !format.hasVideo && format.audioBitrate
    );

    const videoFormats = formats.filter(format => 
      format.hasVideo && format.height
    );

    // Process audio formats
    const processedAudioFormats = audioFormats.map(format => ({
      quality: `${format.audioBitrate}kbps`,
      format: format.container || 'mp4',
      fileSize: format.contentLength ? `${(format.contentLength / (1024 * 1024)).toFixed(1)} MB` : 'Unknown',
      bitrate: format.audioBitrate,
      available: true,
      type: 'audio',
      itag: format.itag,
      mimeType: format.mimeType
    }));

    // Process video formats
    const processedVideoFormats = videoFormats.map(format => ({
      quality: `${format.height}p`,
      format: format.container || 'mp4',
      fileSize: format.contentLength ? `${(format.contentLength / (1024 * 1024)).toFixed(1)} MB` : 'Unknown',
      fps: format.fps,
      available: true,
      type: 'video',
      itag: format.itag,
      mimeType: format.mimeType,
      hasAudio: format.hasAudio
    }));

    // Sort by quality
    const sortedAudio = processedAudioFormats.sort((a, b) => b.bitrate - a.bitrate);
    const sortedVideo = processedVideoFormats.sort((a, b) => parseInt(b.quality) - parseInt(a.quality));

    return {
      video: sortedVideo,
      audio: sortedAudio,
      title: info.videoDetails.title,
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails[0]?.url
    };
  } catch (error) {
    console.error('Error getting formats:', error);
    throw new Error(`Failed to get video formats: ${error.message}`);
  }
}

/**
 * Download audio from YouTube video
 */
async function downloadAudio(youtubeUrl, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Starting audio download for:', youtubeUrl);
      
      // Validate URL
      if (!ytdl.validateURL(youtubeUrl)) {
        throw new Error('Invalid YouTube URL');
      }

      // Get video info
      const info = await ytdl.getInfo(youtubeUrl);
      const title = info.videoDetails.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      
      // Find best audio format
      const audioFormats = info.formats.filter(format => 
        format.hasAudio && !format.hasVideo && format.audioBitrate
      );

      if (audioFormats.length === 0) {
        throw new Error('No audio formats available');
      }

      // Sort by quality and pick the best one
      const bestAudio = audioFormats.sort((a, b) => b.audioBitrate - a.audioBitrate)[0];
      console.log('Selected audio format:', bestAudio.audioBitrate + 'kbps', bestAudio.mimeType);

      // Generate filename
      const filename = `${title}_audio.${bestAudio.container || 'mp4'}`;
      const filepath = path.join(DOWNLOADS_DIR, filename);

      // Create download stream
      const audioStream = ytdl(youtubeUrl, {
        format: bestAudio,
        quality: 'highestaudio'
      });

      const writeStream = fs.createWriteStream(filepath);
      
      let downloadedBytes = 0;
      const totalBytes = parseInt(bestAudio.contentLength) || 0;

      // Track progress
      audioStream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        
        // Update progress in active downloads
        if (options.onProgress) {
          options.onProgress(progress);
        }
      });

      audioStream.on('error', (error) => {
        console.error('Audio stream error:', error);
        fs.unlink(filepath, () => {}); // Clean up partial file
        reject(new Error(`Download failed: ${error.message}`));
      });

      writeStream.on('error', (error) => {
        console.error('Write stream error:', error);
        fs.unlink(filepath, () => {}); // Clean up partial file
        reject(new Error(`File write failed: ${error.message}`));
      });

      writeStream.on('finish', () => {
        console.log('Audio download completed:', filename);
        resolve({
          filename: filename,
          filepath: filepath,
          size: fs.statSync(filepath).size,
          format: bestAudio.container || 'mp4',
          bitrate: bestAudio.audioBitrate
        });
      });

      // Pipe the audio stream to file
      audioStream.pipe(writeStream);

    } catch (error) {
      console.error('Download audio error:', error);
      reject(error);
    }
  });
}

/**
 * Download video from YouTube
 */
async function downloadVideo(youtubeUrl, options = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Starting video download for:', youtubeUrl);
      
      // Validate URL
      if (!ytdl.validateURL(youtubeUrl)) {
        throw new Error('Invalid YouTube URL');
      }

      // Get video info
      const info = await ytdl.getInfo(youtubeUrl);
      const title = info.videoDetails.title.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
      
      // Find best video format with audio
      const videoFormats = info.formats.filter(format => 
        format.hasVideo && format.hasAudio && format.height
      );

      if (videoFormats.length === 0) {
        throw new Error('No video formats with audio available');
      }

      // Sort by quality and pick the best one
      const bestVideo = videoFormats.sort((a, b) => b.height - a.height)[0];
      console.log('Selected video format:', bestVideo.height + 'p', bestVideo.mimeType);

      // Generate filename
      const filename = `${title}_video.${bestVideo.container || 'mp4'}`;
      const filepath = path.join(DOWNLOADS_DIR, filename);

      // Create download stream
      const videoStream = ytdl(youtubeUrl, {
        format: bestVideo,
        quality: 'highest'
      });

      const writeStream = fs.createWriteStream(filepath);
      
      let downloadedBytes = 0;
      const totalBytes = parseInt(bestVideo.contentLength) || 0;

      // Track progress
      videoStream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
        
        // Update progress in active downloads
        if (options.onProgress) {
          options.onProgress(progress);
        }
      });

      videoStream.on('error', (error) => {
        console.error('Video stream error:', error);
        fs.unlink(filepath, () => {}); // Clean up partial file
        reject(new Error(`Download failed: ${error.message}`));
      });

      writeStream.on('error', (error) => {
        console.error('Write stream error:', error);
        fs.unlink(filepath, () => {}); // Clean up partial file
        reject(new Error(`File write failed: ${error.message}`));
      });

      writeStream.on('finish', () => {
        console.log('Video download completed:', filename);
        resolve({
          filename: filename,
          filepath: filepath,
          size: fs.statSync(filepath).size,
          format: bestVideo.container || 'mp4',
          quality: bestVideo.height + 'p'
        });
      });

      // Pipe the video stream to file
      videoStream.pipe(writeStream);

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
    console.log('Processing download:', { youtube_url, format, quality });

    let result;
    if (format === 'audio' || format === 'mp3' || format === 'aac') {
      result = await downloadAudio(youtube_url, options);
    } else {
      result = await downloadVideo(youtube_url, options);
    }

    return {
      success: true,
      ...result
    };
  } catch (error) {
    console.error('Process download error:', error);
    throw error;
  }
}

/**
 * Get video info for preview
 */
async function getVideoInfo(youtubeUrl) {
  try {
    if (!ytdl.validateURL(youtubeUrl)) {
      throw new Error('Invalid YouTube URL');
    }

    const info = await ytdl.getInfo(youtubeUrl);
    return {
      title: info.videoDetails.title,
      duration: info.videoDetails.lengthSeconds,
      thumbnail: info.videoDetails.thumbnails[0]?.url,
      author: info.videoDetails.author.name,
      viewCount: info.videoDetails.viewCount
    };
  } catch (error) {
    console.error('Error getting video info:', error);
    throw error;
  }
}

module.exports = {
  getAvailableFormats,
  downloadAudio,
  downloadVideo,
  processDownload,
  getVideoInfo,
  activeDownloads,
  DOWNLOADS_DIR
};
