const Joi = require("joi")

const validateUrl = (req, res, next) => {
  const schema = Joi.object({
    originalUrl: Joi.string()
      .uri()
      .required()
      .custom((value, helpers) => {
        const youtubeRegex =
          /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        if (!youtubeRegex.test(value)) {
          return helpers.error("any.invalid")
        }
        return value
      })
      .messages({
        "any.invalid": "Must be a valid YouTube URL",
      }),
    customAlias: Joi.string()
      .pattern(/^[a-zA-Z0-9_-]+$/) // Allow letters, numbers, underscores, and hyphens
      .min(3)
      .max(30)
      .optional()
      .messages({
        "string.pattern.base":
          "Custom alias can only contain letters, numbers, underscores, and hyphens",
      }),
    timestamp: Joi.object({
      hours: Joi.number().integer().min(0).max(23).default(0),
      minutes: Joi.number().integer().min(0).max(59).default(0),
      seconds: Joi.number().integer().min(0).max(59).default(0),
    }).optional(),
    analyticsEnabled: Joi.boolean().default(true),
    domain: Joi.string().default(process.env.NODE_ENV === 'production' ? 'youtube-mate-backend.onrender.com' : 'localhost:5000'),
    expiryDate: Joi.date().greater("now").optional(),
    tags: Joi.array().items(Joi.string().max(50)).max(10).default([]),
    notes: Joi.string().max(500).optional(),
    fetchMetaOnly: Joi.boolean().optional(),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

const validateBulkUrls = (req, res, next) => {
  const schema = Joi.object({
    urls: Joi.array()
      .items(
        Joi.object({
          url: Joi.string()
            .uri()
            .required()
            .custom((value, helpers) => {
              const youtubeRegex =
                /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
              if (!youtubeRegex.test(value)) {
                return helpers.error("any.invalid")
              }
              return value
            }),
          customAlias: Joi.string()
            .pattern(/^[a-zA-Z0-9_-]+$/) // Allow letters, numbers, underscores, and hyphens
            .min(3)
            .max(30)
            .optional()
            .messages({
              "string.pattern.base":
                "Custom alias can only contain letters, numbers, underscores, and hyphens",
            }),
          timestamp: Joi.object({
            hours: Joi.number().integer().min(0).max(23).default(0),
            minutes: Joi.number().integer().min(0).max(59).default(0),
            seconds: Joi.number().integer().min(0).max(59).default(0),
          }).optional(),
        }),
      )
      .min(1)
      .max(100)
      .required(),
    domain: Joi.string().default(process.env.NODE_ENV === 'production' ? 'youtube-mate-backend.onrender.com' : 'localhost:5000'),
    analyticsEnabled: Joi.boolean().default(true),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

const validateRegistration = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).max(50).required(),
    recaptchaToken: Joi.string().optional(),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    recaptchaToken: Joi.string().optional(),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

// New validation rules for downloads
const validateDownloadRequest = (req, res, next) => {
  const schema = Joi.object({
    youtube_url: Joi.string()
      .uri()
      .required()
      .custom((value, helpers) => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/
        if (!youtubeRegex.test(value)) {
          return helpers.error("any.invalid")
        }
        return value
      })
      .messages({
        "any.invalid": "Only YouTube URLs are allowed",
      }),
    format: Joi.string()
      .valid("mp4", "mp3", "webm", "mkv", "aac", "ogg", "wav", "flac", "audio", "video")
      .required()
      .messages({
        "any.only": "Invalid format selected",
      }),
    quality: Joi.string().required().messages({
      "any.required": "Quality is required",
    }),
    options: Joi.object({
      // Audio advanced options (real yt-dlp post-processing flags)
      audio_format: Joi.string().optional(),
      normalize: Joi.boolean().optional(),
      trimSilence: Joi.boolean().optional(),
      embedArtwork: Joi.boolean().optional(),
      sampleRate: Joi.number().integer().valid(48000, 44100, 22050, 16000).optional(),
      // Video advanced options
      video_format: Joi.string().optional(),
      subtitles: Joi.boolean().optional(),
      thumbnail: Joi.boolean().optional(),
      description: Joi.boolean().optional(),
      metadata: Joi.boolean().optional(),
      // Playlist download context
      playlist_position: Joi.number().integer().min(1).optional(),
      playlist_folder: Joi.string().max(120).optional(),
      // Legacy keys kept for compatibility
      include_subtitles: Joi.boolean().optional(),
      subtitle_language: Joi.string().min(2).max(5).optional(),
      userEmail: Joi.string().email().optional(),
    }).optional(),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    console.log('Download validation failed:')
    console.log('Request body:', req.body)
    console.log('Validation errors:', error.details)
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

const validatePlaylistRequest = (req, res, next) => {
  const schema = Joi.object({
    playlist_url: Joi.string()
      .uri()
      .required()
      .custom((value, helpers) => {
        const playlistRegex = /^(https?:\/\/)?(www\.)?youtube\.com\/playlist\?list=.+/
        if (!playlistRegex.test(value)) {
          return helpers.error("any.invalid")
        }
        return value
      })
      .messages({
        "any.invalid": "Only YouTube playlist URLs are allowed",
      }),
    download_options: Joi.object({
      format: Joi.string()
        .valid("mp4", "mp3", "webm")
        .required()
        .messages({
          "any.only": "Invalid format selected. Must be one of: mp4, mp3, webm",
        }),
      quality: Joi.string()
        .valid("4K", "1440p", "1080p", "720p", "480p", "360p", "highest", "highestaudio", "320k", "256k", "192k", "128k")
        .required()
        .messages({
          "any.required": "Quality is required",
          "any.only": "Invalid quality selected. Must be one of: 4K, 1440p, 1080p, 720p, 480p, 360p, highest, highestaudio, 320k, 256k, 192k, 128k",
        }),
      include_subtitles: Joi.boolean().optional(),
      add_numbering: Joi.boolean().optional(),
      create_folder: Joi.boolean().optional(),
    }).required(),
    selected_videos: Joi.array()
      .items(Joi.string())
      .min(1)
      .required()
      .messages({
        "array.min": "At least one video must be selected",
        "any.required": "Selected videos list is required",
      }),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

const validateTranscriptRequest = (req, res, next) => {
  const schema = Joi.object({
    youtubeUrl: Joi.string()
      .uri()
      .required()
      .custom((value, helpers) => {
        const youtubeRegex =
          /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        if (!youtubeRegex.test(value)) {
          return helpers.error("any.invalid")
        }
        return value
      })
      .messages({
        "any.invalid": "Must be a valid YouTube URL",
      }),
    language: Joi.string()
      .valid("en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh", "ar", "hi")
      .default("en"),
    summaryType: Joi.string()
      .valid("brief", "detailed", "bullets", "keyMoments")
      .default("brief"),
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

// Playlist creation validation
const validatePlaylistCreate = (req, res, next) => {
  // Handle both JSON and FormData
  let data = req.body
  
  // If it's FormData, convert relevant fields
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    data = {
      name: req.body.name,
      description: req.body.description || "",
      is_public: req.body.is_public === 'true' || req.body.is_public === true,
      is_collaborative: req.body.is_collaborative === 'true' || req.body.is_collaborative === true,
      category: req.body.category || "other",
      tags: req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : [],
      thumbnail_url: req.body.thumbnail_url || null,
      import_url: req.body.import_url || null,
      status: req.body.status || "active",
      save_as_draft: req.body.save_as_draft === 'true' || req.body.save_as_draft === true
    }
  }

  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(200).required().messages({
      "string.min": "Playlist name must be between 1 and 200 characters",
      "string.max": "Playlist name must be between 1 and 200 characters",
      "any.required": "Playlist name is required"
    }),
    description: Joi.string().max(1000).optional().allow('').messages({
      "string.max": "Description must be less than 1000 characters"
    }),
    is_public: Joi.boolean().optional(),
    is_collaborative: Joi.boolean().optional(),
    category: Joi.string()
      .valid("music", "education", "entertainment", "gaming", "technology", "sports", "cooking", "travel", "other")
      .optional()
      .messages({
        "any.only": "Invalid category"
      }),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(10).optional().messages({
      "array.base": "Tags must be an array",
      "string.min": "Each tag must be between 1 and 50 characters",
      "string.max": "Each tag must be between 1 and 50 characters"
    }),
    thumbnail_url: Joi.string().uri().optional().allow(null, '').messages({
      "string.uri": "Thumbnail URL must be a valid URL"
    }),
    import_url: Joi.string()
      .optional()
      .allow(null, '')
      .custom((value, helpers) => {
        if (value && value.trim()) {
          const playlistRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(playlist\?list=|watch\?.*list=)|youtu\.be\/.*list=)([a-zA-Z0-9_-]+)/
          if (!playlistRegex.test(value)) {
            return helpers.error("any.invalid")
          }
        }
        return value
      })
      .messages({
        "any.invalid": "Import URL must be a valid YouTube playlist URL"
      }),
    status: Joi.string().valid("active", "draft", "archived").optional().messages({
      "any.only": "Invalid status"
    }),
    save_as_draft: Joi.boolean().optional()
  })

  const { error, value } = schema.validate(data)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  // Update req.body with validated data
  Object.assign(req.body, value)
  next()
}

// Playlist update validation
const validatePlaylistUpdate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(200).optional().messages({
      "string.min": "Playlist name must be between 1 and 200 characters",
      "string.max": "Playlist name must be between 1 and 200 characters"
    }),
    description: Joi.string().max(1000).optional().messages({
      "string.max": "Description must be less than 1000 characters"
    }),
    is_public: Joi.boolean().optional(),
    is_collaborative: Joi.boolean().optional(),
    category: Joi.string()
      .valid("music", "education", "entertainment", "gaming", "technology", "sports", "cooking", "travel", "other")
      .optional()
      .messages({
        "any.only": "Invalid category"
      }),
    tags: Joi.array().items(Joi.string().trim().min(1).max(50)).max(10).optional().messages({
      "array.base": "Tags must be an array",
      "string.min": "Each tag must be between 1 and 50 characters",
      "string.max": "Each tag must be between 1 and 50 characters"
    }),
    thumbnail_url: Joi.string().uri().optional().messages({
      "string.uri": "Thumbnail URL must be a valid URL"
    }),
    status: Joi.string().valid("active", "draft", "archived").optional().messages({
      "any.only": "Invalid status"
    })
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

// Playlist item validation
const validatePlaylistItem = (req, res, next) => {
  const schema = Joi.object({
    youtube_url: Joi.string()
      .required()
      .custom((value, helpers) => {
        const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
        if (!youtubeRegex.test(value)) {
          return helpers.error("any.invalid")
        }
        return value
      })
      .messages({
        "any.invalid": "Please provide a valid YouTube URL",
        "any.required": "YouTube URL is required"
      }),
    position: Joi.number().integer().min(0).optional().messages({
      "number.min": "Position must be a non-negative integer"
    })
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

// Playlist collaborator validation
const validatePlaylistCollaborator = (req, res, next) => {
  const schema = Joi.object({
    user_email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address",
      "any.required": "Email is required"
    }),
    permission_level: Joi.string()
      .valid("viewer", "editor", "admin")
      .required()
      .messages({
        "any.only": "Permission level must be viewer, editor, or admin",
        "any.required": "Permission level is required"
      })
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

// Playlist comment validation
const validatePlaylistComment = (req, res, next) => {
  const schema = Joi.object({
    content: Joi.string().trim().min(1).max(1000).required().messages({
      "string.min": "Comment must be between 1 and 1000 characters",
      "string.max": "Comment must be between 1 and 1000 characters",
      "any.required": "Comment content is required"
    }),
    parent_comment_id: Joi.string().optional().messages({
      "string.base": "Parent comment ID must be a valid ID"
    })
  })

  const { error, value } = schema.validate(req.body)
  if (error) {
    return res.status(400).json({
      error: "Validation error",
      details: error.details.map((detail) => detail.message),
    })
  }

  req.body = value
  next()
}

module.exports = {
  validateUrl,
  validateBulkUrls,
  validateRegistration,
  validateLogin,
  validateDownloadRequest,
  validatePlaylistRequest,
  validateTranscriptRequest,
  validatePlaylistCreate,
  validatePlaylistUpdate,
  validatePlaylistItem,
  validatePlaylistCollaborator,
  validatePlaylistComment,
}