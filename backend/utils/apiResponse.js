/**
 * API Response Formatter Utility
 * Provides consistent response format across all endpoints
 */

class ApiResponse {
  /**
   * Success response
   * @param {Object} res - Express response object
   * @param {Object} data - Response data
   * @param {String} message - Success message
   * @param {Number} statusCode - HTTP status code (default: 200)
   */
  static success(res, data = {}, message = "Success", statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Error response
   * @param {Object} res - Express response object
   * @param {String} error - Error message
   * @param {Number} statusCode - HTTP status code (default: 500)
   * @param {Object} details - Additional error details
   */
  static error(res, error = "Internal server error", statusCode = 500, details = null) {
    const response = {
      success: false,
      error,
      timestamp: new Date().toISOString(),
    }

    if (details) {
      response.details = details
    }

    return res.status(statusCode).json(response)
  }

  /**
   * Validation error response
   * @param {Object} res - Express response object
   * @param {Array} errors - Validation errors
   */
  static validationError(res, errors = []) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      errors,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Not found response
   * @param {Object} res - Express response object
   * @param {String} resource - Resource name
   */
  static notFound(res, resource = "Resource") {
    return res.status(404).json({
      success: false,
      error: `${resource} not found`,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Unauthorized response
   * @param {Object} res - Express response object
   * @param {String} message - Unauthorized message
   */
  static unauthorized(res, message = "Authentication required") {
    return res.status(401).json({
      success: false,
      error: "Unauthorized",
      message,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Forbidden response
   * @param {Object} res - Express response object
   * @param {String} message - Forbidden message
   */
  static forbidden(res, message = "Access denied") {
    return res.status(403).json({
      success: false,
      error: "Forbidden",
      message,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Rate limit exceeded response
   * @param {Object} res - Express response object
   * @param {Number} retryAfter - Seconds until retry allowed
   */
  static rateLimitExceeded(res, retryAfter = 60) {
    return res.status(429).json({
      success: false,
      error: "Rate limit exceeded",
      message: "Too many requests. Please try again later.",
      retryAfter,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Service unavailable response
   * @param {Object} res - Express response object
   * @param {String} service - Service name
   */
  static serviceUnavailable(res, service = "Service") {
    return res.status(503).json({
      success: false,
      error: "Service unavailable",
      message: `${service} is temporarily unavailable. Please try again later.`,
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Usage limit exceeded response
   * @param {Object} res - Express response object
   * @param {Object} usage - Usage details
   */
  static usageLimitExceeded(res, usage = {}) {
    return res.status(429).json({
      success: false,
      error: "Daily limit reached",
      message: "You've used all your daily questions. Upgrade to premium for unlimited access.",
      usage,
      timestamp: new Date().toISOString(),
    })
  }
}

module.exports = ApiResponse
