const cloudinary = require("cloudinary").v2
const { CloudinaryStorage } = require("multer-storage-cloudinary")
const multer = require("multer")

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Configure Cloudinary storage for User Avatars
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "youtube-mate/avatars", // Folder in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      {
        width: 400,
        height: 400,
        crop: "fill",
        gravity: "face", // Focus on face if detected
        quality: "auto",
        format: "webp" // Convert to WebP for better compression
      }
    ],
    public_id: (req, file) => {
      // Use user ID as public_id for easier management
      return `user_${req.user.id}_avatar_${Date.now()}`
    }
  }
})

// Configure Cloudinary storage for Playlist Thumbnails
const thumbnailStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "youtube-mate/thumbnails", // Folder in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      {
        width: 1280,
        height: 720,
        crop: "fill",
        quality: "auto",
        format: "webp" // Convert to WebP for better compression
      }
    ],
    public_id: (req, file) => {
      // Use user ID and timestamp for unique public_id
      return `playlist_${req.user.id}_thumbnail_${Date.now()}`
    }
  }
})

// Configure Multer with Cloudinary storage for avatars
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {  // MIME type (Multipurpose Internet Mail Extensions type)
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed!"), false)
    }
  }
})

// Configure Multer with Cloudinary storage for playlist thumbnails
const uploadThumbnail = multer({
  storage: thumbnailStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for thumbnails
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error("Only image files are allowed!"), false)
    }
  }
})

module.exports = {
  cloudinary,
  uploadAvatar,
  uploadThumbnail
}
