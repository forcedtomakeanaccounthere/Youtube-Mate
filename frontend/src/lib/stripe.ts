import { loadStripe } from '@stripe/stripe-js'

// Make sure to replace this with your actual publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_51S0LDLDlX8qx480wBIH8gzyAVPTO9BD81QdUvWRyBkfjmW3MPwdQm0vBl7oPk5aF89sN3UZsIwNvXPdg8SrpjZnr00WUWaGWip')

export default stripePromise
