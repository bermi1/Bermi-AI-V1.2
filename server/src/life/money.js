// Deterministic money planning. These are PLANS and estimates over numbers the
// user entered — Bermi holds no money and these figures are never presented as
// a bank balance. No AI is involved, so nothing here consumes credits.

const MS_DAY = 86_400_000
const daysBetween = (fromYmd, toYmd) =>
  Math.round((new Date(`${toYmd}T00:00:00Z`) - new Date(`${fromYmd}T00:00:00Z`)) / MS_DAY)

export function monthBounds(ymd) {
  const [y, m] = ymd.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(last).padStart(2, '0')}`, daysInMonth: last }
}

export const contributed = (saving) => saving.contributions.reduce((n, c) => n + c.amount, 0)

/**
 * "I want to spend 40,000 on a day out in two weeks." → how much to set aside
 * per week/day, and whether that is realistic against what is left of the
 * month's plan. `available` is null when the user has not set an income.
 */
export function planSaving({ target, saved = 0, today, due, available = null }) {
  const remaining = Math.max(0, target - saved)
  const days = daysBetween(today, due)
  if (remaining === 0) return { remaining: 0, days, state: 'reached', perWeek: 0, perDay: 0, realistic: true, note: 'Goal amount already planned.' }
  if (days < 0) return { remaining, days, state: 'overdue', perWeek: null, perDay: null, realistic: false, note: 'The target date has passed — adjust the date or the amount.' }
  const effDays = Math.max(days, 1)
  const perDay = remaining / effDays
  const perWeek = days >= 7 ? remaining / (days / 7) : remaining
  let realistic = null
  let note = 'Set a monthly income in Budget to check whether this fits.'
  if (available != null) {
    const monthly = perDay * 30
    realistic = monthly <= available
    note = realistic
      ? `This needs about ${Math.round(monthly).toLocaleString()} a month — within the ${Math.round(available).toLocaleString()} you have left after planned spending.`
      : `This needs about ${Math.round(monthly).toLocaleString()} a month but only ${Math.round(Math.max(0, available)).toLocaleString()} is left after planned spending. Consider a later date or a smaller amount.`
  }
  return { remaining, days, state: 'active', perWeek: Math.round(perWeek * 100) / 100, perDay: Math.round(perDay * 100) / 100, realistic, note }
}

/** Month summary from the budget, planned expenses and active saving plans. */
export function monthSummary({ budget, expenses, savings, today }) {
  const { start, end } = monthBounds(today)
  const inMonth = expenses.filter((e) => e.data.date >= start && e.data.date <= end)
  const plannedByCategory = new Map()
  for (const c of budget?.categories ?? []) plannedByCategory.set(c.id, { id: c.id, name: c.name, planned: c.planned, upcoming: 0 })
  let upcomingTotal = 0
  for (const e of inMonth) {
    upcomingTotal += e.data.amount
    const hit = [...plannedByCategory.values()].find((c) => c.name.toLowerCase() === e.data.category.toLowerCase())
    if (hit) hit.upcoming += e.data.amount
  }
  const budgetedTotal = [...plannedByCategory.values()].reduce((n, c) => n + c.planned, 0)
  const income = budget?.monthlyIncome ?? 0
  const activeSavings = savings.filter((s) => s.data.status === 'active')
  const savingsPlanThisMonth = activeSavings.reduce((n, s) => {
    const p = planSaving({ target: s.data.targetAmount, saved: contributed(s.data), today, due: s.data.dueDate })
    return n + (p.perDay ? p.perDay * 30 : 0)
  }, 0)
  const committed = Math.max(budgetedTotal, upcomingTotal)
  return {
    month: start.slice(0, 7),
    currency: budget?.currency ?? 'TZS',
    income,
    budgetedTotal,
    upcomingTotal,
    // What is left after the larger of "budgeted" and "expected" spending —
    // an estimate to plan with, not a balance.
    availableAfterPlan: income > 0 ? income - committed : null,
    suggestedSavingsPerMonth: Math.round(savingsPlanThisMonth),
    categories: [...plannedByCategory.values()],
  }
}
