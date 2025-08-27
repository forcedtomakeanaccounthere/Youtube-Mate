interface CreateCheckoutSessionRequest {
  planId: string
  userId: string
  email: string
  idempotencyKey: string
}

interface CheckoutSessionResponse {
  sessionId: string
  url: string
}

export const createCheckoutSession = async (data: CreateCheckoutSessionRequest): Promise<CheckoutSessionResponse> => {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error('Failed to create checkout session')
  }

  return response.json()
}

export const redirectToCheckout = async (sessionId: string) => {
  const stripe = await import('@/lib/stripe').then(mod => mod.default)
  const stripeInstance = await stripe
  
  if (!stripeInstance) {
    throw new Error('Stripe failed to load')
  }

  const { error } = await stripeInstance.redirectToCheckout({
    sessionId,
  })

  if (error) {
    throw error
  }
}
