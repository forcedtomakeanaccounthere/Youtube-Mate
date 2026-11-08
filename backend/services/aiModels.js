/**
 * AI Model Chains
 *
 * Single source of truth for the AI model fallback chains. Providers are
 * tried in order — the newest model first, then progressively older ones —
 * so a retired/deprecated model (e.g. Gemini 2.0 Flash being sunset) never
 * breaks summaries or Q&A; the chain simply moves on.
 *
 * "latest" aliases (Mistral) track the vendor's current models automatically.
 */

// Text tasks: newest first. gemini-3.8-flash is the current recommended
// model (Google's deprecation notices point here); 3.5/2.5/1.5 are the
// graceful-degradation tail.
const GEMINI_TEXT_CHAIN = [
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
]

// Vision/OCR tasks: gemini-2.5-flash has notably better text extraction than
// the 3.x flash tier for dense images, but newest-first is still the default
// contract; 2.5 and 1.5-pro are the OCR-strong fallbacks.
const GEMINI_VISION_CHAIN = [
  "gemini-3.8-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-1.5-pro",
]

// Text tasks: the -latest aliases always point at the vendor's current
// models; large → medium → small degrades capability and cost together.
const MISTRAL_TEXT_CHAIN = [
  "mistral-large-latest",
  "mistral-medium-latest",
  "mistral-small-latest",
]

// Vision/OCR tasks: pixtral-large is the strongest OCR model; the 12b variant
// and mistral-medium are the fallbacks (both accept image_url content).
const MISTRAL_VISION_CHAIN = [
  "pixtral-large-2411",
  "pixtral-12b-2409",
  "mistral-medium-latest",
]

module.exports = {
  GEMINI_TEXT_CHAIN,
  GEMINI_VISION_CHAIN,
  MISTRAL_TEXT_CHAIN,
  MISTRAL_VISION_CHAIN,
}
