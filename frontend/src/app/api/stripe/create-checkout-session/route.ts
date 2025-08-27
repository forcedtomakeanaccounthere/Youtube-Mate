import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51S0LDLDlX8qx480wcC60sXhCT2sYJz1pBOyxImxBW9boIgV1TT1fSXOK5EF6DoWleKeuX6YuaIysI5DZOaSYV1if00SqBRyXJ2', {
  apiVersion: '2024-12-18.acacia',
})

const planPrices = {
  free: {
    amount: 0,
    name: 'Free Plan',
  },
  pro: {
    amount: 999, // $9.99 in cents
    name: 'Pro Plan',
  },
  exclusive: {
    amount: 2499, // $24.99 in cents
    name: 'Exclusive Plan',
  },
}

export async function POST(request: NextRequest) {
  try {
    const { planId, userId, email, idempotencyKey } = await request.json()

    if (!planId || !userId || !email || !idempotencyKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const plan = planPrices[planId as keyof typeof planPrices]
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      )
    }

    // For free plan, don't create a checkout session
    if (planId === 'free') {
      return NextResponse.json(
        { error: 'Free plan does not require payment' },
        { status: 400 }
      )
    }

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
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
        success_url: `${request.headers.get('origin')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${request.headers.get('origin')}/subscription?canceled=true`,
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
    )

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
