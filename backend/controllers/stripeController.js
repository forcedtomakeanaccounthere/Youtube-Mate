const billingService = require('../services/billingService');

/**
 * Stripe Controller
 * Handles HTTP requests for Stripe billing and subscription management
 */
class StripeController {

  /**
   * Create a Stripe checkout session
   * POST /api/stripe/create-checkout-session
   */
  async createCheckoutSession(req, res) {
    try {
      const { planId, userId, email, idempotencyKey, recaptchaToken } = req.body;

      // Validate required fields
      if (!planId || !userId || !email || !idempotencyKey) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }

      // Prepare session data
      const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';
      const sessionData = {
        planId,
        userId,
        email,
        idempotencyKey,
        recaptchaToken,
        clientIp: req.ip,
        origin
      };

      // Create checkout session
      const result = await billingService.createCheckoutSession(sessionData);

      res.json(result);
    } catch (error) {
      console.error('Error creating checkout session:', error);
      
      // Handle specific error messages
      if (error.message.includes('Invalid plan') || 
          error.message.includes('Free plan') || 
          error.message.includes('reCAPTCHA')) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({
        error: 'Internal server error'
      });
    }
  }

  /**
   * Verify a payment session
   * GET /api/stripe/verify-session/:sessionId
   */
  async verifySession(req, res) {
    try {
      const { sessionId } = req.params;
      
      const result = await billingService.verifySession(sessionId);
      
      res.json(result);
    } catch (error) {
      console.error('Error verifying session:', error);
      res.status(500).json({
        error: 'Failed to verify session'
      });
    }
  }

  /**
   * Handle Stripe webhook events
   * POST /api/stripe/webhook
   * 
   * IMPORTANT: This endpoint requires express.raw() middleware
   * to preserve the raw body for Stripe signature verification
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers['stripe-signature'];
      
      // Construct webhook event with signature verification
      const event = billingService.constructWebhookEvent(req.body, signature);
      
      // Handle the webhook event
      await billingService.handleWebhookEvent(event);
      
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error.message);
      return res.status(400).json({
        error: `Webhook Error: ${error.message}`
      });
    }
  }

  /**
   * Test route to manually update user plan (development only)
   * POST /api/stripe/test-update-user
   */
  async testUpdateUser(req, res) {
    try {
      const { userId, planId } = req.body;
      
      if (!userId || !planId) {
        return res.status(400).json({
          error: 'Missing userId or planId'
        });
      }

      const result = await billingService.testUpdateUser(userId, planId);
      
      res.json(result);
    } catch (error) {
      console.error('Error in test update:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({ error: error.message });
      }

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get plan pricing information
   * GET /api/stripe/plans
   */
  async getPlanPrices(req, res) {
    try {
      const plans = billingService.getPlanPrices();
      res.json({ plans });
    } catch (error) {
      console.error('Error getting plan prices:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get plan features
   * GET /api/stripe/plans/:planId/features
   */
  async getPlanFeatures(req, res) {
    try {
      const { planId } = req.params;
      const features = billingService.getPlanFeatures(planId);
      
      if (features.length === 0) {
        return res.status(404).json({ error: 'Plan not found' });
      }

      res.json({ planId, features });
    } catch (error) {
      console.error('Error getting plan features:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new StripeController();
