const crypto = require('crypto');

/**
 * Generate a secure random token for invites, passwords, etc.
 * @param {number} length - Length of the token (default: 32)
 * @returns {string} - Random hex token
 */
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a shorter token for URLs
 * @returns {string} - 24 character hex token
 */
function generateShortToken() {
    return crypto.randomBytes(12).toString('hex');
}

/**
 * Generate a numeric token (for OTPs, etc.)
 * @param {number} length - Number of digits (default: 6)
 * @returns {string} - Numeric token
 */
function generateNumericToken(length = 6) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

module.exports = {
    generateToken,
    generateShortToken,
    generateNumericToken
};
