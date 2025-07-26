const Joi = require("joi")

const validateUrl = (req, res, next) => {
  const schema = Joi.object({
    originalUrl: Joi.string()
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
    domain: Joi.string().valid("ytmate.co", "short.ytmate.com", "yt.link").default("ytmate.co"),
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
                /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
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
    domain: Joi.string().valid("ytmate.co", "short.ytmate.com", "yt.link").default("ytmate.co"),
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
}