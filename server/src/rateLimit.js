// Lightweight in-memory rate limiter — no external dependency. Protects the
// AI-cost endpoints from a single runaway client (bug, bot, or bulk script)
// starving the shared free-tier provider quota that every other user
// depends on. This is per-instance, not distributed — on Vercel's
// serverless model that means it's a first line of defense on sustained/warm
// traffic, not a hard global cap; the real fix for launch-scale headroom is
// provisioning enough provider quota (see providers.js / openrouter.js).
const buckets = new Map()

/** Raw check, reusable outside Express middleware (e.g. inside chat's own
 * agentic actions, which can trigger the same expensive AI drafting an HTTP
 * route would). Returns true if the call is allowed. */
export function checkRateLimit(key, { windowMs, max }) {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 }
    buckets.set(key, bucket)
  }
  bucket.count += 1
  return bucket.count <= max
}

/** Read-only status for a bucket — does not consume it. Used to show a user
 * their remaining quota/reset time without counting the check itself as a
 * request. */
export function peekRateLimit(key, { windowMs, max }) {
  const now = Date.now()
  const bucket = buckets.get(key)
  const fresh = !bucket || now - bucket.start > windowMs
  const used = fresh ? 0 : bucket.count
  const resetAt = fresh ? now + windowMs : bucket.start + windowMs
  return { used, max, remaining: Math.max(0, max - used), resetAt }
}

export function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const key = req.user?.id || req.ip
    if (!checkRateLimit(key, { windowMs, max })) {
      const bucket = buckets.get(key)
      res.setHeader('Retry-After', String(Math.ceil((bucket.start + windowMs - Date.now()) / 1000)))
      return res.status(429).json({ error: message || "You're sending requests a bit fast — try again shortly." })
    }
    next()
  }
}

// Periodic sweep so the map doesn't grow unbounded across many distinct users.
setInterval(
  () => {
    const cutoff = Date.now() - 10 * 60_000
    for (const [key, bucket] of buckets) if (bucket.start < cutoff) buckets.delete(key)
  },
  5 * 60_000,
).unref()
