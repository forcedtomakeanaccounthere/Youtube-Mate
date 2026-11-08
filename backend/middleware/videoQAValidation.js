/**
 * Validation middleware for Video Q&A endpoints
 * Provides input validation, sanitization, and security checks
 */

const validator = require("express-validator")
const guardrailsService = require("../services/guardrailsService")

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

// Check for prompt injection attempts (delegates to the guardrails service,
// which normalizes homoglyph/zero-width/spacing evasion before matching)
const detectPromptInjection = (text) => {
  const { blocked, category } = guardrailsService.classifyInput(text)
  return blocked && category === "prompt_injection"
}

// Check for off-topic / misuse requests (file generation, general tasks, etc.)
const detectOffTopicRequest = (text) => {
  const { blocked, category } = guardrailsService.classifyInput(text)
  return blocked && category === "off_topic"
}

// Check for attempts to extract system / confidential information
const detectSystemLeak = (text) => {
  const { blocked, category } = guardrailsService.classifyInput(text)
  return blocked && category === "system_leak"
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
    .optional({ checkFalsy: true })
    .isLength({ max: 500 })
    .withMessage("Question must be under 500 characters")
    .custom((value) => {
      if (!value) return true // empty question is allowed when images present
      
      // Check for excessive whitespace (only if question is provided)
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

    // Require at least a question or at least one image
    const hasQuestion = typeof req.body.question === 'string' && req.body.question.trim().length >= 3
    const hasImages = Array.isArray(req.body.images) && req.body.images.length > 0
    if (!hasQuestion && !hasImages) {
      return res.status(400).json({
        error: "Validation failed",
        details: [{ msg: "Please provide a question or attach at least one image" }],
      })
    }

    // Sanitize question
    if (req.body.question) {
      req.body.question = sanitizeQuestion(req.body.question)
    } else {
      req.body.question = "Please describe or analyze the attached image(s)."
    }

    // Guardrail: block attempts to extract system information
    if (req.body.question && detectSystemLeak(req.body.question)) {
      return res.status(403).json({
        error: "Request blocked",
        message: "Your question appears to be asking for confidential system information. I can only help with questions about this video.",
      })
    }

    // Guardrail: block off-topic requests (file generation, general tasks)
    if (req.body.question && detectOffTopicRequest(req.body.question)) {
      return res.status(403).json({
        error: "Request blocked",
        message: "I can only help with questions about this YouTube video or the images you attached. I cannot generate files, write code, or answer general questions.",
      })
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
  detectOffTopicRequest,
  detectSystemLeak,
}

