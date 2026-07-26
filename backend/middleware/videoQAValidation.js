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
    /DAN mode/i,
    /jailbreak/i,
    /bypass (your |the )?(restrictions?|filters?|rules?|guidelines?)/i,
    /without (any |your )?(restrictions?|filters?|rules?|guidelines?)/i,
    /override (your )?(safety|instructions?|restrictions?)/i,
  ]
  
  return suspiciousPatterns.some(pattern => pattern.test(text))
}

// Check for off-topic / misuse requests (file generation, general tasks, etc.)
const detectOffTopicRequest = (text) => {
  const offTopicPatterns = [
    // File/document generation
    /generate (an? )?(image|pdf|document|spreadsheet|csv|word|excel|powerpoint|ppt|docx?|audio|video|mp3|mp4)/i,
    /create (an? )?(image|pdf|document|spreadsheet|csv|word|excel|presentation|poster|resume|cv|report)/i,
    /make (an? )?(image|pdf|document|logo|banner|flyer|brochure)/i,
    /draw (me |a |an )?/i,
    /write (me )?(a |an )?(poem|song|story|essay|novel|script|report|email|letter|cover letter|thesis)/i,
    // General coding tasks
    /write (me )?(a |an )?(function|class|program|script|code|algorithm|snippet)/i,
    /debug (this|my|the) code/i,
    /fix (this|my|the) (bug|code|error)/i,
    // General knowledge / off-topic queries
    /what is the (capital|population|currency|president|prime minister) of/i,
    /solve (this|the) (math|equation|problem)/i,
    /calculate (the )?/i,
    /translate (this|the|it) (to|into)/i,
    /what is (the )?(weather|stock price|exchange rate|current time)/i,
  ]

  return offTopicPatterns.some(pattern => pattern.test(text))
}

// Check for attempts to extract system / confidential information
const detectSystemLeak = (text) => {
  const leakPatterns = [
    /what (is|are) (your|the) (system |initial |original )?(prompt|instruction|rule|directive)/i,
    /show (me |us )?(your|the) (system |initial |original )?(prompt|instruction)/i,
    /reveal (your|the) (system |internal |hidden )?(prompt|instruction|configuration)/i,
    /print (your|the) (system|internal) (prompt|instruction)/i,
    /(api|secret|private) key/i,
    /database (schema|password|credentials|connection string)/i,
    /(password|credentials|token|secret) (for|of|to)/i,
    /what (is|are) (your|the) (api|access|secret) (key|token|credential)/i,
    /internal (configuration|settings|secrets)/i,
  ]

  return leakPatterns.some(pattern => pattern.test(text))
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

