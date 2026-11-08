const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const stripeController = require('../controllers/stripeController');

/**
 * Stripe Routes
 * Handles billing, subscriptions, and Stripe webhooks
 */

// Create checkout session for subscription purchase
// Authenticated: the server derives userId/email from the JWT — the client
// is never trusted to name the paying user.
router.post('/create-checkout-session', authenticateToken, stripeController.createCheckoutSession.bind(stripeController));

// Verify payment session status (authenticated: users may only verify
// sessions that belong to them)
router.get('/verify-session/:sessionId', authenticateToken, stripeController.verifySession.bind(stripeController));

// Stripe webhook endpoint (requires express.raw() middleware - configured in app.js)
// IMPORTANT: This route MUST use raw body parsing for Stripe signature verification
router.post('/webhook', express.raw({type: 'application/json'}), stripeController.handleWebhook.bind(stripeController));

// Get plan pricing information
router.get('/plans', stripeController.getPlanPrices.bind(stripeController));

// Get plan features
router.get('/plans/:planId/features', stripeController.getPlanFeatures.bind(stripeController));

module.exports = router;
