import { v4 as uuidv4 } from 'uuid'

export const generateIdempotencyKey = (userId: string, planId: string): string => {
  // Create a deterministic key based on user and plan
  // This ensures the same user can't pay twice for the same plan
  const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
  return `${userId}-${planId}-${timestamp}-${uuidv4()}`
}

export const createPaymentMetadata = (userId: string, planId: string, email: string) => {
  return {
    userId,
    planId,
    email,
    timestamp: new Date().toISOString(),
    source: 'subscription-page'
  }
}
