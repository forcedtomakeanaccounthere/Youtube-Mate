const axios = require("axios")

/**
 * Verifies a Google reCAPTCHA v2 token.
 * @param {string} token - The reCAPTCHA token from the client.
 * @param {string} [remoteIp] - The user's IP address.
 * @returns {Promise<boolean>} - True if verified successfully, false otherwise.
 */
async function verifyRecaptcha(token, remoteIp) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY
  
  if (!secretKey) {
    console.warn("RECAPTCHA_SECRET_KEY is not defined in environment variables. Skipping validation.")
    return true
  }

  if (!token) {
    console.warn("No reCAPTCHA token provided but verification was requested.")
    return false
  }

  try {
    const response = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      new URLSearchParams({
        secret: secretKey,
        response: token,
        ...(remoteIp ? { remoteip: remoteIp } : {})
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    )

    return !!response.data.success
  } catch (error) {
    console.error("reCAPTCHA verification request failed:", error.message)
    return false
  }
}

module.exports = { verifyRecaptcha }
