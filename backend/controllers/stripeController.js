const billingService = require('../services/billingService');

/**
 * Stripe Controller
 * Handles HTTP requests for Stripe billing and subscription management
 */
class StripeController {

  /**
   * Create a Stripe checkout session
   * POST /api/stripe/create-checkout-session (authenticated)
   *
   * Security: userId and email are taken from the authenticated user (JWT),
   * never from the request body — clients cannot create checkouts for
   * other users.
   */
  async createCheckoutSession(req, res) {
    try {
      const { planId, idempotencyKey, recaptchaToken } = req.body;

      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate required fields
      if (!planId || !idempotencyKey) {
        return res.status(400).json({
          error: 'Missing required fields'
        });
      }

      // Prepare session data (identity from the JWT, not the client)
      const origin = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';
      const sessionData = {
        planId,
        userId: req.user._id.toString(),
        email: req.user.email,
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
   * GET /api/stripe/verify-session/:sessionId (authenticated)
   */
  async verifySession(req, res) {
    try {
      const { sessionId } = req.params;

      const result = await billingService.verifySession(sessionId, req.user);

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
