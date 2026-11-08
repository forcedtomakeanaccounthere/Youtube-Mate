const Stripe = require('stripe');
const User = require('../models/User');
const { sendSubscriptionUpgradeEmail } = require('./emailService');
const { verifyRecaptcha } = require('../utils/recaptcha');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Plan pricing configuration
const PLAN_PRICES = {
  free: {
    amount: 0,
    name: 'Free Plan',
  },
  pro: {
    amount: 79900, // ₹799 in paise
    name: 'Pro Plan',
  },
  exclusive: {
    amount: 199900, // ₹1999 in paise
    name: 'Exclusive Plan',
  },
};

// Plan features configuration
const PLAN_FEATURES = {
  pro: [
    '100 AI summaries per day',
    'Unlimited URL shortener',
    'High quality downloads (1080p)',
    '10 collaborators per playlist',
    '50 private playlists',
    'Bulk playlist downloads',
    'Custom domain for URLs',
    'Priority support'
  ],
  exclusive: [
    'Unlimited AI summaries',
    'Unlimited URL shortener',
    '4K quality downloads',
    'Unlimited collaborators',
    'Unlimited private playlists',
    'Advanced playlist downloads',
    'Custom domain + branding',
    '24/7 priority support',
    'Advanced analytics & insights'
  ]
};

// Plan display names
const PLAN_DISPLAY_NAMES = {
  pro: 'Pro Plan',
  exclusive: 'Exclusive Plan'
};

/**
 * Billing Service
 * Handles Stripe payment processing, subscriptions, and user plan updates
 */
class BillingService {
  
  /**
   * Create a Stripe checkout session for plan purchase
   */
  async createCheckoutSession(sessionData) {
    const { planId, userId, email, idempotencyKey, recaptchaToken, clientIp, origin } = sessionData;

    // Validate plan
    const plan = PLAN_PRICES[planId];
    if (!plan) {
      throw new Error('Invalid plan ID');
    }

    // Free plan doesn't require payment
    if (planId === 'free') {
      throw new Error('Free plan does not require payment');
    }

    // Verify reCAPTCHA if enabled
    if (process.env.RECAPTCHA_SECRET_KEY && recaptchaToken) {
      const isHuman = await verifyRecaptcha(recaptchaToken, clientIp);
      if (!isHuman) {
        throw new Error('reCAPTCHA verification failed. Please try again.');
      }
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'inr',
              product_data: {
                name: plan.name,
                description: `YouTube Mate ${plan.name} - Monthly Subscription`,
              },
              unit_amount: plan.amount,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/subscription?canceled=true`,
        customer_email: email,
        metadata: {
          userId,
          planId,
          email,
          timestamp: new Date().toISOString(),
        },
        subscription_data: {
          metadata: {
            userId,
            planId,
            email,
          },
        },
      },
      {
        idempotencyKey,
      }
    );

    // In development mode, update user plan immediately (webhooks may not work on localhost)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Development mode: Updating user plan immediately');
      try {
        await this.updateUserSubscription(userId, planId, {
          stripeSubscriptionId: 'dev_pending_' + session.id,
          stripeCustomerId: session.customer || 'dev_customer',
          status: 'active',
        });

        // Send subscription upgrade email immediately in dev mode
        const user = await User.findById(userId);
        if (user) {
          await this.sendUpgradeEmail(user.email, user.name, planId);
          console.log(`📧 Subscription upgrade email sent to ${user.email}`);
        }
      } catch (error) {
        console.error('❌ Error updating user subscription immediately:', error);
      }
    }

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Verify a checkout session
   */
  async verifySession(sessionId, requestingUser = null) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Users may only verify their own checkout sessions
    if (requestingUser && session.metadata?.userId) {
      if (String(session.metadata.userId) !== String(requestingUser._id)) {
        const error = new Error('Session does not belong to the authenticated user');
        error.status = 403;
        throw error;
      }
    }

    // If payment is successful and we have metadata, ensure user is updated
    if (session.payment_status === 'paid' && session.metadata?.userId && session.metadata?.planId) {
      console.log('💳 Payment verified as paid, checking user plan update...');
      
      try {
        const user = await User.findById(session.metadata.userId);
        if (user && user.plan !== session.metadata.planId) {
          console.log(`🔄 Updating user ${user.email} plan from ${user.plan} to ${session.metadata.planId}`);
          
          await this.updateUserSubscription(user._id, session.metadata.planId, {
            stripeSubscriptionId: session.subscription,
            stripeCustomerId: session.customer,
            status: 'active',
          });
          
          console.log(`✅ User plan updated successfully during verification`);
        } else if (user) {
          console.log(`✓ User plan already up to date: ${user.plan}`);
        }
      } catch (updateError) {
        console.error('❌ Error updating user during verification:', updateError);
        // Don't fail the verification response
      }
    }
    
    return {
      status: session.payment_status,
      customer_email: session.customer_email,
      metadata: session.metadata,
      subscription_id: session.subscription,
    };
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event) {
    console.log('📧 Webhook received:', event.type);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle checkout session completed event
   */
  async handleCheckoutCompleted(session) {
    console.log('Payment successful:', session.metadata);
    
    try {
      const user = await User.findById(session.metadata.userId);
      
      if (user) {
        await this.updateUserSubscription(user._id, session.metadata.planId, {
          stripeSubscriptionId: session.subscription,
          stripeCustomerId: session.customer,
          status: 'active',
        });
        
        console.log(`Updated user ${user.email} to ${session.metadata.planId} plan`);

        // Send subscription upgrade email
        await this.sendUpgradeEmail(user.email, user.name, session.metadata.planId);
        console.log(`Subscription upgrade email sent to ${user.email}`);
      }
    } catch (error) {
      console.error('Error updating user subscription:', error);
    }
  }

  /**
   * Handle invoice payment succeeded event (subscription renewal)
   */
  async handlePaymentSucceeded(invoice) {
    console.log('Subscription payment succeeded:', invoice.subscription);
    
    try {
      const user = await User.findOne({ 'subscription.stripeSubscriptionId': invoice.subscription });
      
      if (user) {
        user.subscription.status = 'active';
        user.subscription.currentPeriodStart = new Date(invoice.period_start * 1000);
        user.subscription.currentPeriodEnd = new Date(invoice.period_end * 1000);
        await user.save();
        console.log(`Renewed subscription for user ${user.email}`);
      }
    } catch (error) {
      console.error('Error updating subscription renewal:', error);
    }
  }

  /**
   * Handle invoice payment failed event
   */
  async handlePaymentFailed(invoice) {
    console.log('Subscription payment failed:', invoice.subscription);
    
    try {
      const user = await User.findOne({ 'subscription.stripeSubscriptionId': invoice.subscription });
      
      if (user) {
        user.subscription.status = 'past_due';
        await user.save();
        console.log(`Payment failed for user ${user.email}`);
      }
    } catch (error) {
      console.error('Error updating failed payment:', error);
    }
  }

  /**
   * Handle subscription deleted event (cancellation)
   */
  async handleSubscriptionDeleted(subscription) {
    console.log('Subscription canceled:', subscription.id);
    
    try {
      const user = await User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
      
      if (user) {
        user.plan = 'free';
        user.subscription.status = 'canceled';
        await user.save();
        console.log(`Subscription canceled for user ${user.email}`);
      }
    } catch (error) {
      console.error('Error updating canceled subscription:', error);
    }
  }

  /**
   * Update user subscription in database
   */
  async updateUserSubscription(userId, planId, subscriptionData) {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    user.plan = planId;
    user.subscription = {
      stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
      stripeCustomerId: subscriptionData.stripeCustomerId,
      status: subscriptionData.status,
      currentPeriodStart: subscriptionData.currentPeriodStart || new Date(),
      currentPeriodEnd: subscriptionData.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd || false,
    };
    
    await user.save();
    console.log(`✅ User ${user.email} plan updated to ${planId}`);
    
    return user;
  }

  /**
   * Send subscription upgrade email
   */
  async sendUpgradeEmail(email, name, planId) {
    try {
      await sendSubscriptionUpgradeEmail(
        email,
        name,
        PLAN_DISPLAY_NAMES[planId],
        PLAN_FEATURES[planId] || []
      );
    } catch (emailError) {
      console.error('❌ Error sending subscription upgrade email:', emailError);
    }
  }

  /**
   * Construct Stripe webhook event from raw body
   */
  constructWebhookEvent(rawBody, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Skip signature verification in development if no webhook secret is provided
    if (process.env.NODE_ENV === 'development' && !webhookSecret) {
      console.log('⚠️  Development mode: Skipping webhook signature verification');
      return rawBody;
    }

    try {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      throw new Error(`Webhook signature verification failed: ${err.message}`);
    }
  }

  /**
   * Get plan pricing information
   */
  getPlanPrices() {
    return PLAN_PRICES;
  }

  /**
   * Get plan features
   */
  getPlanFeatures(planId) {
    return PLAN_FEATURES[planId] || [];
  }
}

module.exports = new BillingService();
