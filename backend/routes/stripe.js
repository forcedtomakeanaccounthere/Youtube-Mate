const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');

/**
 * Stripe Routes
 * Handles billing, subscriptions, and Stripe webhooks
 */

// Create checkout session for subscription purchase
router.post('/create-checkout-session', stripeController.createCheckoutSession.bind(stripeController));

// Verify payment session status
router.get('/verify-session/:sessionId', stripeController.verifySession.bind(stripeController));

// Stripe webhook endpoint (requires express.raw() middleware - configured in app.js)
// IMPORTANT: This route MUST use raw body parsing for Stripe signature verification
router.post('/webhook', express.raw({type: 'application/json'}), stripeController.handleWebhook.bind(stripeController));

// Test route to manually update user plan (development only)
router.post('/test-update-user', stripeController.testUpdateUser.bind(stripeController));

// Get plan pricing information
router.get('/plans', stripeController.getPlanPrices.bind(stripeController));

// Get plan features
router.get('/plans/:planId/features', stripeController.getPlanFeatures.bind(stripeController));

module.exports = router;
