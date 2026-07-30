import { useEffect, useState } from 'react'
import { Award, Flame, GraduationCap, Star } from 'lucide-react'
import * as api from '../lib/api'
import type { StudyStats } from '../lib/types'

export function StudyPanel({ onStartStudy }: { onStartStudy: () => void }) {
  const [stats, setStats] = useState<StudyStats | null>(null)

  useEffect(() => {
    api.getStudyStats().then(setStats).catch(() => {})
  }, [])

  const pct = stats ? Math.round((stats.xp_into_level / stats.xp_for_level) * 100) : 0
  const started = stats && stats.sessions > 0

  return (
    <section className="mb-8 rounded-2xl border border-edge bg-surface-raised p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap size={17} className="text-primary" />
          <h2 className="text-[16px] font-semibold tracking-tight">Study Mode</h2>
        </div>
        <button
          onClick={onStartStudy}
          className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {started ? 'Continue learning' : 'Start studying'}
        </button>
      </div>

      {!started ? (
        <p className="text-[13.5px] leading-relaxed text-ink-muted">
          Turn on Study Mode in chat and Bermi becomes your personal tutor — teaching step by
          step with the Socratic method, checking your understanding, and quizzing you. Earn XP,
          level up, keep a daily streak, and collect badges as you learn.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Tile icon={GraduationCap} label="Level" value={String(stats!.level)} />
            <Tile icon={Flame} label="Day streak" value={String(stats!.streak)} tint="text-amber-500" />
            <Tile icon={Star} label="Total XP" value={String(stats!.xp)} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="font-medium text-ink-muted">Progress to Level {stats!.level + 1}</span>
              <span className="text-ink-faint">
                {stats!.xp_into_level}/{stats!.xp_for_level} XP
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {stats!.badges_detailed && stats!.badges_detailed.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
                <Award size={14} className="text-primary" /> Badges
              </div>
              <div className="flex flex-wrap gap-1.5">
                {stats!.badges_detailed.map((b) => (
                  <span
                    key={b.id}
                    className="rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] font-medium text-primary"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats!.topic_list && stats!.topic_list.length > 0 && (
            <div className="space-y-3">
              <div className="text-[13px] font-semibold">Topics studied</div>
              {stats!.topic_list.slice(0, 6).map((t) => (
                <div key={t.topic} className="rounded-xl border border-edge bg-surface p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[12.5px] font-medium text-ink">{t.topic}</span>
                    <span className="text-[11px] text-ink-faint">
                      {t.count} step{t.count === 1 ? '' : 's'} mastered
                    </span>
                  </div>
                  {t.steps.length > 0 && (
                    <ul className="space-y-1">
                      {t.steps.slice(0, 6).map((step, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-ink-muted">
                          <span className="mt-[3px] text-primary">✓</span>
                          <span className="min-w-0">{step}</span>
                        </li>
                      ))}
                      {t.steps.length > 6 && (
                        <li className="text-[11px] text-ink-faint">+{t.steps.length - 6} more</li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function Tile({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Star
  label: string
  value: string
  tint?: string
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-3 text-center">
      <Icon size={16} className={`mx-auto mb-1 ${tint ?? 'text-primary'}`} />
      <div className="text-[20px] font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-ink-faint">{label}</div>
    </div>
  )
}
