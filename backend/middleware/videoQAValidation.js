/**
 * Validation middleware for Video Q&A endpoints
 * Provides input validation, sanitization, and security checks
 */

const validator = require("express-validator")

// Sanitize and validate question input
const sanitizeQuestion = (question) => {
  // Remove HTML tags
  let sanitized = question.replace(/<[^>]*>/g, "")
  
  // Remove script tags and javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, "")
  sanitized = sanitized.replace(/on\w+\s*=/gi, "")
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  return sanitized
}

// Check for prompt injection attempts
const detectPromptInjection = (text) => {
  const suspiciousPatterns = [
    /ignore (previous|all|above) (instructions?|prompts?|rules?)/i,
    /disregard (previous|all|above) (instructions?|prompts?|rules?)/i,
    /you are (now|actually) (a|an)/i,
    /forget (everything|all|previous)/i,
    /new (instructions?|rules?|role)/i,
    /system (prompt|message|role):/i,
    /act as if you (are|were)/i,
    /pretend (you are|to be)/i,
    /roleplay as/i,
    /###\s*System/i,
    /<\|.*?\|>/,  // Special tokens
    /\[SYSTEM\]/i,
    /\[INST\]/i,
  ]
  
  return suspiciousPatterns.some(pattern => pattern.test(text))
}

// Validate create session request
const validateCreateSession = [
  validator.body("videoId")
    .notEmpty()
    .withMessage("Video ID is required")
    .isLength({ min: 11, max: 11 })
    .withMessage("Invalid YouTube video ID")
    .matches(/^[a-zA-Z0-9_-]{11}$/)
    .withMessage("Invalid YouTube video ID format"),
  
  validator.body("videoUrl")
    .notEmpty()
    .withMessage("Video URL is required")
    .matches(/^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/)
    .withMessage("Invalid YouTube URL"),
  
  validator.body("videoMetadata.title")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Video title too long"),
  
  (req, res, next) => {
    const errors = validator.validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      })
    }
    next()
  },
]

// Validate ask question request
const validateAskQuestion = [
  validator.body("videoId")
    .notEmpty()
    .withMessage("Video ID is required")
    .isLength({ min: 11, max: 11 })
    .withMessage("Invalid YouTube video ID"),
  
  validator.body("videoUrl")
    .notEmpty()
    .withMessage("Video URL is required"),
  
  validator.body("sessionId")
    .notEmpty()
    .withMessage("Session ID is required")
    .isUUID()
    .withMessage("Invalid session ID format"),
  
  validator.body("question")
    .notEmpty()
    .withMessage("Question is required")
    .isLength({ min: 1, max: 500 })
    .withMessage("Question must be between 1 and 500 characters")
    .custom((value) => {
      // Check for excessive whitespace
      const nonWhitespaceChars = value.replace(/\s/g, "").length
      if (nonWhitespaceChars < 3) {
        throw new Error("Question must contain at least 3 non-whitespace characters")
      }
      
      // Check for prompt injection
      if (detectPromptInjection(value)) {
        throw new Error("Question contains suspicious patterns and cannot be processed")
      }
      
      return true
    }),
  
  validator.body("questionType")
    .notEmpty()
    .withMessage("Question type is required")
    .isIn(["premium", "standard"])
    .withMessage("Question type must be 'premium' or 'standard'"),
  
  validator.body("images")
    .optional()
    .isArray({ max: 2 })
    .withMessage("Maximum 2 images allowed"),
  
  validator.body("images.*")
    .optional()
    .custom((val) => {
      if (typeof val !== "string") {
        throw new Error("Image must be a string")
      }
      const isStandardUrl = /^https?:\/\/.+/.test(val)
      const isDataUri = /^data:image\/[a-zA-Z+]+;base64,.+/.test(val)
      if (!isStandardUrl && !isDataUri) {
        throw new Error("Invalid image format. Must be HTTP/HTTPS URL or Base64 data URI.")
      }
      return true
    }),
  
  // Sanitization middleware
  (req, res, next) => {
    const errors = validator.validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      })
    }
    
    // Sanitize question
    if (req.body.question) {
      req.body.question = sanitizeQuestion(req.body.question)
    }
    
    next()
  },
]

// Validate session ID parameter
const validateSessionId = [
  validator.param("sessionId")
    .notEmpty()
    .withMessage("Session ID is required")
    .isUUID()
    .withMessage("Invalid session ID format"),
  
  (req, res, next) => {
    const errors = validator.validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      })
    }
    next()
  },
]

// Validate video ID parameter
const validateVideoId = [
  validator.param("videoId")
    .notEmpty()
    .withMessage("Video ID is required")
    .isLength({ min: 11, max: 11 })
    .withMessage("Invalid YouTube video ID")
    .matches(/^[a-zA-Z0-9_-]{11}$/)
    .withMessage("Invalid YouTube video ID format"),
  
  (req, res, next) => {
    const errors = validator.validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: "Validation failed",
        details: errors.array(),
      })
    }
    next()
  },
]

module.exports = {
  validateCreateSession,
  validateAskQuestion,
  validateSessionId,
  validateVideoId,
  sanitizeQuestion,
  detectPromptInjection,
}
