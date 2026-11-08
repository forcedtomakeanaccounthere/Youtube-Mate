import { loadStripe } from '@stripe/stripe-js'

// Make sure to replace this with your actual publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'stripe key')

export default stripePromise
