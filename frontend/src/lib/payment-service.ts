import { API_BASE, authHeaders } from './authClient'

interface CreateCheckoutSessionRequest {
  planId: string
  idempotencyKey: string
  recaptchaToken?: string
  // userId/email are derived from the JWT server-side; kept optional here so
  // existing callers compile, but they are no longer sent.
  userId?: string
  email?: string
}

interface CheckoutSessionResponse {
  sessionId: string
  url: string
}

export const createCheckoutSession = async (data: CreateCheckoutSessionRequest): Promise<CheckoutSessionResponse> => {
  const { userId: _ignoredUserId, email: _ignoredEmail, ...payload } = data
  const response = await fetch(`${API_BASE}/stripe/create-checkout-session`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
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
