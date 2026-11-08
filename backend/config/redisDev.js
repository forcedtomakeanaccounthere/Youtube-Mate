const { execFile } = require("child_process")

/**
 * Dev-only Redis container lifecycle
 *
 * Local development: `npm start` automatically spins up the Redis container
 * defined in docker-compose.yml, and a graceful shutdown stops it again.
 * If Docker Desktop isn't running (or docker is missing) the app logs a
 * clear notice and continues with the in-memory fallback — Redis stays
 * optional.
 *
 * Production: this module is a NO-OP — point REDIS_URL at managed
 * instance (e.g. Aiven Valkey `rediss://...`) and nothing gets spawned.
 */

const COMPOSE_FILE = require("path").join(__dirname, "..", "docker-compose.yml")
const CONTAINER_NAME = "ytmate-redis"
const LOCAL_REDIS_URL = "redis://127.0.0.1:6379"

let managingRedis = false

function exitHookStopRedis() {
  try {
    require("child_process").execFileSync(
      "docker",
      ["compose", "-f", COMPOSE_FILE, "stop", "redis"],
      { timeout: 15000, stdio: "ignore", windowsHide: true }
    )
  } catch {
    /* docker gone or container already stopped — nothing to do */
  }
}

function run(cmd, args, timeoutMs = 30000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || ""), stderr: String(stderr || "") })
    })
  })
}

function isLocalRedisTargeted() {
  const url = (process.env.REDIS_URL || "").trim()
  if (!url) return true // default target is local
  return /127\.0\.0\.1|localhost/.test(url)
}

/**
 * Ensure a local Redis container is running (dev only). Returns the Redis
 * URL to use, or null when Redis stays disabled.
 */
async function ensureDevRedis() {
  if (process.env.NODE_ENV === "production") return process.env.REDIS_URL || null
  if (!isLocalRedisTargeted()) return process.env.REDIS_URL // remote (dev staging) — leave it alone

  // Already something listening on 6379? Use it as-is.
  const net = require("net")
  const portOpen = await new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(1500)
    socket.once("connect", () => { socket.destroy(); resolve(true) })
    socket.once("timeout", () => { socket.destroy(); resolve(false) })
    socket.once("error", () => resolve(false))
    socket.connect(6379, "127.0.0.1")
  })
  if (portOpen) {
    console.log("✅ Redis already running on 127.0.0.1:6379")
    claimDevRedisManagement()
    return process.env.REDIS_URL || LOCAL_REDIS_URL
  }

  // Docker available?
  const dockerCheck = await run("docker", ["ps"], 10000)
  if (!dockerCheck.ok) {
    console.warn("⚠️  Docker not available (is Docker Desktop running?) — Redis disabled, using in-memory fallback.")
    return null
  }

  // Start the compose service (idempotent — reuses the existing container)
  console.log("🐳 Starting Redis container (docker compose up -d redis)...")
  const up = await run("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d", "redis"], 90000)
  if (!up.ok) {
    console.warn("⚠️  Failed to start Redis container:", (up.stderr || up.stdout).trim().slice(0, 160))
    return null
  }
  claimDevRedisManagement()

  // Wait for it to accept connections
  for (let i = 0; i < 30; i++) {
    const probe = await run("docker", ["exec", CONTAINER_NAME, "redis-cli", "ping"], 5000)
    if (probe.ok && probe.stdout.includes("PONG")) {
      console.log("✅ Redis container ready (docker, dev mode)")
      return process.env.REDIS_URL || LOCAL_REDIS_URL
    }
    await new Promise((r) => setTimeout(r, 1000))
  }

  console.warn("⚠️  Redis container did not become ready in time — using in-memory fallback.")
  return null
}

/**
 * Claim management of the dev Redis container: once this process is serving
 * against it, shutdown (graceful OR hard exit) stops the container.
 */
function claimDevRedisManagement() {
  if (managingRedis) return
  managingRedis = true

  // Synchronous last-resort hook: covers terminal closes and other exits
  // where async cleanup never runs. Runs on EVERY exit path; stopping an
  // already-stopped container is a fast no-op.
  process.on("exit", exitHookStopRedis)
}

/**
 * Stop the container on graceful shutdown (dev only).
 */
async function stopDevRedis() {
  if (process.env.NODE_ENV === "production" || !managingRedis) return
  managingRedis = false
  process.removeListener("exit", exitHookStopRedis) // clean stop — no exit-hook re-run
  try {
    await run("docker", ["compose", "-f", COMPOSE_FILE, "stop", "redis"], 30000)
    console.log("🐳 Redis container stopped")
  } catch (error) {
    console.warn("⚠️  Could not stop Redis container:", error.message)
  }
}

module.exports = { ensureDevRedis, stopDevRedis }
