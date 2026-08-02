// Shared aggregation for the admin "engagement" dashboard. Both storage
// backends fetch the same three shapes — users, {id,user_id} conversations,
// {conversation_id,created_at} messages — and hand them here so the daily
// bucketing / leaderboard logic isn't duplicated per backend.
export function summarizeActivity({ users, conversations, messages, sinceMs }) {
  const dayKey = (iso) => String(iso).slice(0, 10)
  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1)
  const toSeries = (map) =>
    [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, n]) => ({ day, n }))

  const convUser = new Map(conversations.map((c) => [c.id, c.user_id]))
  const messagesByDay = new Map()
  const activeByDay = new Map() // day -> Set(userId)
  const messageCountByUser = new Map()

  for (const m of messages) {
    const uid = convUser.get(m.conversation_id)
    if (uid) bump(messageCountByUser, uid)
    const t = new Date(m.created_at).getTime()
    if (!(t >= sinceMs)) continue
    const day = dayKey(m.created_at)
    bump(messagesByDay, day)
    if (uid) {
      if (!activeByDay.has(day)) activeByDay.set(day, new Set())
      activeByDay.get(day).add(uid)
    }
  }

  const signupsByDay = new Map()
  for (const u of users) {
    if (new Date(u.created_at).getTime() >= sinceMs) bump(signupsByDay, dayKey(u.created_at))
  }

  const topUsers = users
    .map((u) => ({ id: u.id, name: u.name, email: u.email, message_count: messageCountByUser.get(u.id) || 0 }))
    .sort((a, b) => b.message_count - a.message_count)
    .slice(0, 10)

  return {
    messagesByDay: toSeries(messagesByDay),
    signupsByDay: toSeries(signupsByDay),
    activeUsersByDay: [...activeByDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, set]) => ({ day, n: set.size })),
    topUsers,
    recentUsers: users
      .slice(0, 10)
      .map((u) => ({ id: u.id, name: u.name, email: u.email, created_at: u.created_at })),
  }
}
