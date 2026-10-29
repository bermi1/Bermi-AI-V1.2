import { storage } from './storage/index.js'

// Auditable AI credits. Credits are an ALLOWANCE for Bermi's AI processing —
// not a promise of N messages, and never money. Every change is an
// append-only ledger row (see storage.creditApply), made atomic and
// idempotent in the database, so concurrent or repeated requests can neither
// overspend a balance nor be charged twice.
//
// Deterministic features (planner, saved notes, budgets) never touch this.

export const DEFAULT_ENTITLEMENTS = {
  plans: {
    free: { label: 'Free (early access)', monthlyCredits: 150 },
    plus: { label: 'Plus', monthlyCredits: 600 },
    pro: { label: 'Pro', monthlyCredits: 2500 },
    sponsored: { label: 'Sponsored access', monthlyCredits: 300 },
  },
  // Estimated cost per AI operation, in credits. Cheap, small-model work
  // costs little; heavier document work costs more.
  costs: { companion_plan: 2, daily_concept: 1, study_materials: 5, idea_shape: 3, quiz: 3, summarize: 3 },
}

/** Central, admin-editable entitlement config (falls back to the defaults). */
export async function getEntitlements() {
  try {
    const raw = await storage.getSetting('entitlements')
    const parsed = raw ? JSON.parse(raw) : {}
    return {
      plans: { ...DEFAULT_ENTITLEMENTS.plans, ...(parsed.plans ?? {}) },
      costs: { ...DEFAULT_ENTITLEMENTS.costs, ...(parsed.costs ?? {}) },
    }
  } catch {
    return DEFAULT_ENTITLEMENTS
  }
}

/** The plan is only ever set server-side (admin or a verified payment). */
export async function getPlanId(userId) {
  const id = await storage.getSetting(`u:${userId}:plan`)
  return id || 'free'
}

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7)

/** Tops the balance up to the plan's monthly allowance, once per month. */
export async function ensureMonthlyGrant(userId) {
  const { plans } = await getEntitlements()
  const planId = await getPlanId(userId)
  const allowance = (plans[planId] ?? plans.free).monthlyCredits
  const balance = await storage.creditBalance(userId)
  const topUp = Math.max(0, allowance - balance)
  // The idempotency key makes this a no-op after the first call each month,
  // even when two requests race.
  await storage.creditApply({
    userId,
    idemKey: `grant:${monthKey()}`,
    kind: 'grant',
    amount: topUp,
    feature: 'monthly_allowance',
    meta: { plan: planId, allowance },
  })
  return { planId, allowance }
}

export async function aiAvailability() {
  if ((await storage.getSetting('ai_emergency_disabled')) === '1') {
    return { ok: false, code: 'ai_disabled', message: 'AI features are temporarily switched off. Everything else in Bermi still works.' }
  }
  const cap = Number(await storage.getSetting('ai_daily_credit_cap'))
  if (cap > 0) {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString()
    const spent = await storage.creditSpentSince(since)
    if (spent >= cap) {
      return { ok: false, code: 'global_cap', message: 'Bermi has reached its AI limit for today. Please try again later — your credits were not used.' }
    }
  }
  return { ok: true }
}

/**
 * Reserves the estimated cost before any AI work happens. Returns
 * { ok:false, code } when it cannot — the caller must stop and not call a
 * model. A repeated idemKey is reported as `duplicate` and is not charged
 * again.
 */
export async function reserve(userId, { feature, idemKey }) {
  const avail = await aiAvailability()
  if (!avail.ok) return avail
  const { costs } = await getEntitlements()
  const cost = costs[feature]
  if (!cost) return { ok: false, code: 'unknown_feature', message: 'Unknown AI feature.' }
  await ensureMonthlyGrant(userId)
  const r = await storage.creditApply({
    userId,
    idemKey: `reserve:${idemKey}`,
    kind: 'reserve',
    amount: -cost,
    feature,
    ref: idemKey,
    requireBalance: true,
  })
  if (!r.ok) {
    return { ok: false, code: 'insufficient_credits', balance: r.balance, cost, message: `This needs about ${cost} credits and you have ${r.balance}. Your allowance renews monthly.` }
  }
  if (r.duplicate) return { ok: false, code: 'duplicate', balance: r.balance, message: 'This request was already processed.' }
  return { ok: true, cost, feature, idemKey, balance: r.balance }
}

/** Reconciles estimate vs actual (returns the difference when actual < estimate). */
export async function settle(userId, reservation, actualCost) {
  const diff = reservation.cost - Math.max(0, actualCost)
  if (diff <= 0) return
  await storage.creditApply({
    userId,
    idemKey: `settle:${reservation.idemKey}`,
    kind: 'settle',
    amount: diff,
    feature: reservation.feature,
    ref: reservation.idemKey,
  })
}

/** Full refund for an eligible failure (provider error, validation rejection). */
export async function refund(userId, reservation, reason) {
  await storage.creditApply({
    userId,
    idemKey: `refund:${reservation.idemKey}`,
    kind: 'refund',
    amount: reservation.cost,
    feature: reservation.feature,
    ref: reservation.idemKey,
    meta: { reason: String(reason ?? 'failed').slice(0, 200) },
  })
}

/** Admin adjustment — always written to the audit log too. */
export async function adjust(actorEmail, userId, amount, reason) {
  const idemKey = `adjust:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`
  const r = await storage.creditApply({
    userId,
    idemKey,
    kind: 'adjust',
    amount,
    feature: 'admin_adjustment',
    meta: { by: actorEmail, reason: String(reason).slice(0, 300) },
    requireBalance: amount < 0,
  })
  if (r.ok) {
    await storage.auditLog({ actor: actorEmail, action: 'credits.adjust', target: userId, meta: { amount, reason: String(reason).slice(0, 300) } })
  }
  return r
}

export async function accountSummary(userId) {
  const { plans, costs } = await getEntitlements()
  const { planId, allowance } = await ensureMonthlyGrant(userId)
  const [balance, ledger] = await Promise.all([storage.creditBalance(userId), storage.creditLedger(userId, 40)])
  return { plan: { id: planId, label: (plans[planId] ?? plans.free).label }, monthlyAllowance: allowance, balance, costs, ledger }
}
