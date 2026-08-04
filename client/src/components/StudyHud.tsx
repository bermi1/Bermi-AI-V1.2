import { Flame, GraduationCap, Star } from 'lucide-react'
import type { StudyStats } from '../lib/types'

/** Compact XP/level/streak bar shown at the top of chat while in Study Mode. */
export function StudyHud({ stats }: { stats: StudyStats }) {
  const pct = Math.round((stats.xp_into_level / stats.xp_for_level) * 100)
  return (
    <div className="border-b border-edge bg-primary-soft/40 px-4 py-2">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
          <GraduationCap size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold text-ink">Level {stats.level}</span>
            <span className="text-ink-faint">
              {stats.xp_into_level}/{stats.xp_for_level} XP
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg bg-surface-raised px-2 py-1 text-[12px] font-medium text-ink">
          <Flame size={13} className="text-amber-500" />
          {stats.streak}
        </div>
        <div className="hidden shrink-0 items-center gap-1 rounded-lg bg-surface-raised px-2 py-1 text-[12px] font-medium text-ink sm:flex">
          <Star size={13} className="text-primary" />
          {stats.xp}
        </div>
      </div>
    </div>
  )
}

/** Celebratory toast for XP gains, level-ups, and new badges. */
export function StudyToast({
  gained,
  leveledUp,
  level,
  badges,
}: {
  gained: number
  leveledUp: boolean
  level: number
  badges: { id: string; label: string }[]
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(1rem,env(safe-area-inset-top))] z-[60] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-primary/30 bg-surface-raised px-4 py-2.5 shadow-lg animate-fade-up">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white">
          {leveledUp ? <GraduationCap size={18} /> : <Star size={16} />}
        </div>
        <div className="text-[13px]">
          {leveledUp ? (
            <div className="font-semibold text-primary">Level up! You reached Level {level} 🎉</div>
          ) : (
            <div className="font-semibold text-ink">+{gained} XP</div>
          )}
          {badges.length > 0 && (
            <div className="text-[12px] text-ink-muted">
              New badge{badges.length > 1 ? 's' : ''}: {badges.map((b) => b.label).join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
