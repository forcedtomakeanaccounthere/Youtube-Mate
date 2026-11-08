/**
 * Guardrails Service
 *
 * Layered protection for the AI Q&A pipeline:
 *
 *   1. normalizeText        — defeats homoglyph/zero-width/spacing evasion
 *   2. detectPromptInjection — role-hijack, instruction-override, exfiltration
 *   3. detectSystemLeak      — attempts to extract system prompts / secrets
 *   4. detectOffTopic        — file generation / general-assistant misuse
 *   5. scanOutput            — redacts secrets & leaked instructions from
 *                              model output BEFORE it reaches the user
 *
 * The HTTP contract (which category maps to which status/response) stays in
 * middleware/videoQAValidation.js and the videoQA controller — this module
 * only classifies and redacts.
 */

// ─── Evasion-resistant normalization ────────────────────────────────────────

// Homoglyph fold: characters commonly swapped for latin letters to evade filters
const HOMOGLYPHS = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i",
  "օ": "o", "ս": "u", "տ": "t", "ո": "n", "հ": "h", "կ": "k", "զ": "z", "ծ": "c",
  "ａ": "a", "ｅ": "e", "ｉ": "i", "ｏ": "o", "ｕ": "u", "ｓ": "s", "ｒ": "r",
  "𝐚": "a", "𝑎": "a", "𝒂": "a", "𝓪": "a", "𝔞": "a", "𝕒": "a", "𝖆": "a",
  "𝗮": "a", "𝘢": "a", "𝙖": "a", "𝚊": "a",
}

function normalizeText(text) {
  if (typeof text !== "string") return ""

  let normalized = text
    .normalize("NFKC")
    // strip zero-width & invisible characters used to split filter keywords
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2061-\u2064\uFEFF]/g, "")
    // strip control characters (except newline/tab)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")

  // Homoglyph fold: NFKC handles fullwidth/math-alphanumeric forms; the map
  // covers Cyrillic/Armenian lookalikes that NFKC does not fold.
  normalized = normalized.replace(/[\u0400-\u04FF\u0560-\u058F]/g, (ch) => HOMOGLYPHS[ch.toLowerCase()] || ch)

  return normalized
}

/**
 * Collapse per-letter spacing used to slip past keyword filters
 * ("i g n o r e   a l l") while preserving normal words. Each gap must be
 * exactly ONE space so that multi-space word boundaries ("e  a") do not
 * merge distinct words into a single blob.
 */
function collapseSpacedOut(text) {
  return text.replace(/\b([\p{L}](?: [\p{L}]){1,})\b/gu, (match) =>
    match.replace(/\s+/g, "")
  )
}

// ─── Category 1: prompt injection / instruction hijack ──────────────────────

// Reusable fragment: zero or more qualifier words before the target noun
const QUALIFIERS = String.raw`(?:(?:all|any|the|your|their|previous|prior|above|earlier|earlier's|original|initial|old|past|system|developer|hidden|internal|preceding|earlier-mentioned)\s+){0,4}`

const INJECTION_PATTERNS = [
  new RegExp(`ignore\\s+${QUALIFIERS}(instructions?|prompts?|rules?|directions?|constraints?|filters?|guardrails?)`, "i"),
  new RegExp(`disregard\\s+${QUALIFIERS}(instructions?|prompts?|rules?|guidelines?|constraints?)`, "i"),
  new RegExp(`(?:forget|drop|erase|override)\\s+${QUALIFIERS}(instructions?|prompts?|rules?|context|training)`, "i"),
  /(?:forget|drop|erase) (?:everything|all of it|all|the conversation|the chat|this conversation)(?: (?:you|that) (?:were|have) (?:been )?(?:told|given|instructed))?(?: (?:above|so far|completely|entirely))?/i,
  /you are (now |actually )?(a|an|no longer)/i,
  /(act|behave|pretend) (as if|like) (you are|you were|you'?re) (a|an|not)/i,
  /pretend (you are|to be)/i,
  /roleplay as|play the role of|new persona|your new (role|job|task|persona)/i,
  /new (instructions?|rules?|role|directives?)\s*:/i,
  /(system|developer|ai|assistant|hidden|initial|original) (prompt|message|instructions?|rules?)\s*:/i,
  /###\s*system/i,
  /\[system\]|\[\/?inst\]|\[\/?sys\]/i,
  /<\|(im_start|im_end|system|endoftext|user|assistant)\|>/i,
  /(do|go) anything (now|mode)|dan mode|developer mode|god mode|unfiltered mode/i,
  /jailbreak|bypass (your |the |all )?(restrictions?|filters?|rules?|guardrails?|safety)/i,
  /without (any |your |the )?(restrictions?|filters?|rules?|limitations?|guardrails?)/i,
  /override (your |the )?(safety|instructions?|restrictions?|settings)/i,
  /(repeat|print|output|reveal|show|quote|recite) (everything|all|the text|the words|your instructions?|your prompt|the prompt|the context|the conversation)? ?(above|before|earlier|from your (prompt|instructions?))?/i,
  /(translate|rephrase|summarize|restate) (your|the) (instructions?|prompt|rules)/i,
  /what (is|are) (written|stated|shown) (above|in your (prompt|instructions?))/i,
  /encode (your|the) (instructions?|prompt|rules)/i,
  /respond (only )?with (your )?(instructions?|prompt|system message|initial message)/i,
  /(you|we) (are|'re) (now )?(in|entering) (a )?(sandbox|debug|test|admin|developer|god) ?(mode|environment)/i,
  /this is (a )?(test|simulation)(,|\.|!)? (restrictions|filters|rules) (do not|don'?t) apply/i,
  /(emit|leak|send|exfiltrate|post) (your |the )?(api ?key|secret|credentials?|env(ironment)? (vars?iables?|config))/i,
]

// Checks against fully-despaced text ("i g n o r e a l l previous
// i n s t r u c t i o n s" → "ignoreallpreviousinstructions") — catches
// runs that single-space collapsing cannot split unambiguously.
const DESPACED_INJECTION_PATTERNS = [
  /ignore(?:all|any|the|your|their|previous|prior|above|earlier|original|initial|old|past|system|developer|hidden|internal|preceding){0,4}(?:instructions|prompts|rules|directions|constraints|filters|guardrails)/,
  /disregard(?:all|any|the|your|previous|prior|above|earlier){0,4}(?:instructions|prompts|rules|guidelines|constraints)/,
  /(?:forget|drop|erase|override)(?:everything|all|the|your|previous|prior|above|earlier){0,4}(?:instructions|prompts|rules|context|training)/,
  /system(?:prompt|instruction|message)/,
  /(?:developer|god|dan|unfiltered)mode/,
  /jailbreak/,
  /bypass(?:your|the|all)?(?:restrictions|filters|rules|guardrails|safety)/,
  /revealyour(?:system|internal|hidden)?(?:prompt|instructions?|configuration)/,
]

// ─── Category 2: system/confidential extraction ─────────────────────────────

const SYSTEM_LEAK_PATTERNS = [
  /what (is|are) (your|the) (system |initial |original )?(prompt|instruction|rule|directive)/i,
  /show (me |us )?(your|the) (system |initial |original )?(prompt|instruction)/i,
  /reveal (your|the) (system |internal |hidden )?(prompt|instruction|configuration)/i,
  /print (your|the) (system|internal) (prompt|instruction)/i,
  /(api|secret|private) key/i,
  /database (schema|password|credentials|connection string)/i,
  /(password|credentials|token|secret) (for|of|to)/i,
  /what (is|are) (your|the) (api|access|secret) (key|token|credential)/i,
  /internal (configuration|settings|secrets)/i,
  /how (are|were) you (prompted|configured|built|implemented)/i,
  /list (your|the) (rules|constraints|guardrails|restrictions)/i,
]

// ─── Category 3: off-topic misuse ───────────────────────────────────────────

const OFF_TOPIC_PATTERNS = [
  // File/document generation
  /generate (an? )?(image|pdf|document|spreadsheet|csv|word|excel|powerpoint|ppt|docx?|audio|video|mp3|mp4)/i,
  /create (an? )?(image|pdf|document|spreadsheet|csv|word|excel|presentation|poster|resume|cv|report)/i,
  /make (an? )?(image|pdf|document|logo|banner|flyer|brochure)/i,
  /draw (me |a |an )?/i,
  /write (me )?(a |an )?(poem|song|story|essay|novel|script|report|email|letter|cover letter|thesis)/i,
  // General coding tasks
  /write (me )?(a |an )?(function|class|program|script|code|algorithm|snippet)/i,
  /debug (this|my|the) code/i,
  /fix (this|my|the) (bug|code|error)/i,
  // General knowledge / off-topic queries
  /what is the (capital|population|currency|president|prime minister) of/i,
  /solve (this|the) (math|equation|problem)/i,
  /calculate (the )?/i,
  /translate (this|the|it) (to|into)/i,
  /what is (the )?(weather|stock price|exchange rate|current time)/i,
]

// ─── Output scanning ────────────────────────────────────────────────────────

// Shapes of real credentials that must never appear in model output
const SECRET_SHAPES = [
  { re: /sk-[A-Za-z0-9_-]{20,}/g, label: "[redacted-api-key]" },            // stripe/openai-style
  { re: /AIza[A-Za-z0-9_-]{30,}/g, label: "[redacted-api-key]" },           // google
  { re: /gh[pousr]_[A-Za-z0-9]{30,}/g, label: "[redacted-token]" },         // github
  { re: /xox[baprs]-[A-Za-z0-9-]{20,}/g, label: "[redacted-token]" },       // slack
  { re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, label: "[redacted-jwt]" }, // JWTs
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, label: "[redacted-private-key]" },
  { re: /\b[A-Fa-f0-9]{32,}\b/g, label: "[redacted-hex-secret]" },          // raw hex secrets
]

/**
 * Classify user input before it reaches an AI provider.
 * @returns {{ blocked: Boolean, category: String|null }} category ∈
 *   "prompt_injection" | "system_leak" | "off_topic"
 */
function classifyInput(rawQuestion) {
  const normalized = collapseSpacedOut(normalizeText(rawQuestion))
  if (!normalized) return { blocked: false, category: null }

  if (INJECTION_PATTERNS.some((re) => re.test(normalized))) {
    return { blocked: true, category: "prompt_injection" }
  }

  // Second pass: fully-despaced text catches letter-spaced runs that the
  // single-space collapse cannot split ("ignoreallpreviousinstructions")
  const despaced = normalized.replace(/\s+/g, "")
  if (despaced !== normalized && DESPACED_INJECTION_PATTERNS.some((re) => re.test(despaced))) {
    return { blocked: true, category: "prompt_injection" }
  }

  if (SYSTEM_LEAK_PATTERNS.some((re) => re.test(normalized))) {
    return { blocked: true, category: "system_leak" }
  }
  if (OFF_TOPIC_PATTERNS.some((re) => re.test(normalized))) {
    return { blocked: true, category: "off_topic" }
  }

  return { blocked: false, category: null }
}

/**
 * Scan model output before persisting/returning it: redact anything shaped
 * like a credential and neutralize leaked instruction blocks.
 * @returns {String} safe text
 */
function scanOutput(text) {
  if (typeof text !== "string" || !text) return text

  let safe = text
  for (const { re, label } of SECRET_SHAPES) {
    safe = safe.replace(re, label)
  }

  // If the model starts echoing a system-prompt style block, cut it off
  const systemEcho = /((?:STRICT )?RULES? you must (?:ALWAYS )?follow|You are a focused AI assistant embedded inside)/i
  if (systemEcho.test(safe)) {
    safe = safe.replace(systemEcho, "[leaked-instructions removed]")
  }

  return safe
}

module.exports = {
  normalizeText,
  collapseSpacedOut,
  classifyInput,
  scanOutput,
}
