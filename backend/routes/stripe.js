const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { sendSubscriptionUpgradeEmail } = require('../services/emailService');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51S0LDLDlX8qx480wcC60sXhCT2sYJz1pBOyxImxBW9boIgV1TT1fSXOK5EF6DoWleKeuX6YuaIysI5DZOaSYV1if00SqBRyXJ2');

const planPrices = {
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

// Create checkout session
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { planId, userId, email, idempotencyKey } = req.body;

    if (!planId || !userId || !email || !idempotencyKey) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    const plan = planPrices[planId];
    if (!plan) {
      return res.status(400).json({
        error: 'Invalid plan ID'
      });
    }

    // For free plan, don't create a checkout session
    if (planId === 'free') {
      return res.status(400).json({
        error: 'Free plan does not require payment'
      });
    }

    const origin = req.headers.origin || 'http://localhost:3000';

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

    // For development: Update user plan immediately since webhooks might not work on localhost
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Development mode: Updating user plan immediately');
      try {
        const user = await User.findById(userId);
        if (user) {
          user.plan = planId;
          user.subscription = {
            stripeSubscriptionId: 'pending', // Will be updated by webhook later
            stripeCustomerId: session.customer,
            status: 'pending',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            cancelAtPeriodEnd: false,
          };
          await user.save();
          console.log(`✅ User ${user.email} plan updated to ${planId} immediately`);

          // Send subscription upgrade email immediately
          const planFeatures = {
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

          const planDisplayNames = {
            pro: 'Pro Plan',
            exclusive: 'Exclusive Plan'
          };

          try {
            await sendSubscriptionUpgradeEmail(
              user.email,
              user.name,
              planDisplayNames[planId],
              planFeatures[planId] || []
            );
            console.log(`📧 Subscription upgrade email sent to ${user.email}`);
          } catch (emailError) {
            console.error('❌ Error sending subscription upgrade email:', emailError);
          }
        }
      } catch (error) {
        console.error('❌ Error updating user subscription immediately:', error);
      }
    }

    res.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Verify payment session
router.get('/verify-session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    res.json({
      status: session.payment_status,
      customer_email: session.customer_email,
      metadata: session.metadata,
      subscription_id: session.subscription,
    });
  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({
      error: 'Failed to verify session'
    });
  }
});

// Webhook for handling Stripe events
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  // Skip signature verification in development if no webhook secret is provided
  if (process.env.NODE_ENV === 'development' && !webhookSecret) {
    console.log('⚠️  Development mode: Skipping webhook signature verification');
    event = req.body;
  } else {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.log(`Webhook signature verification failed.`, err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  console.log('📧 Webhook received:', event.type);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Payment successful:', session.metadata);
      
      try {
        // Update user subscription in database
        const User = require('../models/User');
        const user = await User.findById(session.metadata.userId);
        
        if (user) {
          user.plan = session.metadata.planId;
          user.subscription = {
            stripeSubscriptionId: session.subscription,
            stripeCustomerId: session.customer,
            status: 'active',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            cancelAtPeriodEnd: false,
          };
          
          await user.save();
          console.log(`Updated user ${user.email} to ${session.metadata.planId} plan`);

          // Send subscription upgrade email
          const planFeatures = {
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

          const planDisplayNames = {
            pro: 'Pro Plan',
            exclusive: 'Exclusive Plan'
          };

          try {
            await sendSubscriptionUpgradeEmail(
              user.email,
              user.name,
              planDisplayNames[session.metadata.planId],
              planFeatures[session.metadata.planId] || []
            );
            console.log(`Subscription upgrade email sent to ${user.email}`);
          } catch (emailError) {
            console.error('Error sending subscription upgrade email:', emailError);
          }
        }
      } catch (error) {
        console.error('Error updating user subscription:', error);
      }
      break;
      
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      console.log('Subscription payment succeeded:', invoice.subscription);
      
      try {
        const User = require('../models/User');
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
      break;
      
    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      console.log('Subscription payment failed:', failedInvoice.subscription);
      
      try {
        const User = require('../models/User');
        const user = await User.findOne({ 'subscription.stripeSubscriptionId': failedInvoice.subscription });
        
        if (user) {
          user.subscription.status = 'past_due';
          await user.save();
          console.log(`Payment failed for user ${user.email}`);
        }
      } catch (error) {
        console.error('Error updating failed payment:', error);
      }
      break;
      
    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object;
      console.log('Subscription canceled:', deletedSubscription.id);
      
      try {
        const User = require('../models/User');
        const user = await User.findOne({ 'subscription.stripeSubscriptionId': deletedSubscription.id });
        
        if (user) {
          user.plan = 'free';
          user.subscription.status = 'canceled';
          await user.save();
          console.log(`Subscription canceled for user ${user.email}`);
        }
      } catch (error) {
        console.error('Error updating canceled subscription:', error);
      }
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

// Test route to manually update user plan (for development testing)
router.post('/test-update-user', async (req, res) => {
  try {
    const { userId, planId } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.plan = planId;
    user.subscription = {
      stripeSubscriptionId: 'test_subscription',
      stripeCustomerId: 'test_customer',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    };
    
    await user.save();
    
    res.json({
      success: true,
      message: `User ${user.email} updated to ${planId} plan`,
      user: {
        email: user.email,
        plan: user.plan,
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Error in test update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
