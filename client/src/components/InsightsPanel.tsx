import { useEffect, useState } from 'react'
import {
  Activity,
  Award,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import * as api from '../lib/api'
import type { InsightsReport } from '../lib/types'

function Ring({
  value,
  label,
  hint,
  color,
  invert,
}: {
  value: number
  label: string
  hint: string
  color: string
  invert?: boolean
}) {
  const r = 34
  const c = 2 * Math.PI * r
  const off = c - (value / 100) * c
  // For "dependency" a lower number is healthier — tint accordingly.
  const tone = invert
    ? value <= 40
      ? '#12b76a'
      : value <= 70
        ? '#f79009'
        : '#f04438'
    : color
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[86px] w-[86px]">
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--edge)" strokeWidth="8" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={off}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[18px] font-semibold">
          {value}
          <span className="text-[10px] text-ink-faint">%</span>
        </div>
      </div>
      <div className="mt-1.5 text-center text-[12.5px] font-semibold">{label}</div>
      <div className="text-center text-[10.5px] leading-tight text-ink-faint">{hint}</div>
    </div>
  )
}

export function InsightsPanel() {
  const [period, setPeriod] = useState<'day' | 'week'>('week')
  const [report, setReport] = useState<InsightsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api
      .getInsights(period)
      .then((r) => setReport(r.report))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const refresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const r = await api.refreshInsights(period)
      setReport(r.report)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-edge bg-surface-raised p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity size={17} className="text-primary" />
          <h2 className="text-[16px] font-semibold tracking-tight">Interaction health</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-edge p-0.5">
            {(['day', 'week'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1 text-[12.5px] font-medium capitalize transition-colors ${
                  period === p ? 'bg-primary text-white' : 'text-ink-muted hover:bg-surface-sunken'
                }`}
              >
                {p === 'day' ? 'Today' : 'This week'}
              </button>
            ))}
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {refreshing ? 'Analyzing…' : report ? 'Refresh' : 'Analyze'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-ink-faint">Loading…</p>
      ) : !report || report.user_turns < 2 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-edge-strong px-6 py-8 text-center">
          <Sparkles size={22} className="mb-2 text-primary" />
          <p className="text-[14px] font-medium">Your interaction health report</p>
          <p className="mt-1 max-w-md text-[12.5px] text-ink-faint">
            {report?.summary ??
              'Chat with Bermi, then run an analysis. Like a health app, you\'ll see how productive your sessions are, whether you\'re over-relying on AI, your prompt quality, skills gained, and your strengths and blind spots.'}
          </p>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {refreshing ? 'Analyzing…' : 'Analyze my chats'}
          </button>
          {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Rings */}
          <div className="grid grid-cols-3 gap-2">
            <Ring value={report.productivity_pct} label="Productive" hint="goal-directed sessions" color="#3B2FBF" />
            <Ring value={report.prompt_quality_pct} label="Prompt quality" hint="clear & specific" color="#7C6FF0" />
            <Ring value={report.dependency_pct} label="AI reliance" hint="lower is healthier" color="#3B2FBF" invert />
          </div>

          <p className="rounded-xl bg-primary-soft/60 px-4 py-3 text-[13px] leading-relaxed text-ink">
            {report.summary}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Traits */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <ThumbsUp size={13} className="text-emerald-500" /> Strengths
              </div>
              {report.positive_traits.map((t, i) => (
                <div key={i} className="rounded-lg border border-edge px-3 py-2">
                  <div className="text-[12.5px] font-medium">{t.trait}</div>
                  <div className="text-[11.5px] text-ink-faint">{t.note}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                <ThumbsDown size={13} className="text-amber-500" /> Watch-outs
              </div>
              {report.negative_traits.map((t, i) => (
                <div key={i} className="rounded-lg border border-edge px-3 py-2">
                  <div className="text-[12.5px] font-medium">{t.trait}</div>
                  <div className="text-[11.5px] text-ink-faint">{t.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {report.skills.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
                  <Award size={13} className="text-primary" /> Skills you're building
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {report.skills.map((s, i) => (
                    <span key={i} className="rounded-full bg-primary-soft px-2.5 py-1 text-[11.5px] text-primary">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {report.prompt_tips.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
                  <TrendingUp size={13} className="text-primary" /> Improve your prompts
                </div>
                <ul className="space-y-1">
                  {report.prompt_tips.map((t, i) => (
                    <li key={i} className="flex gap-1.5 text-[12px] text-ink-muted">
                      <Plus size={12} className="mt-0.5 shrink-0 text-primary" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {report.adaptation && (
            <div className="flex items-start gap-2 rounded-xl border border-edge px-4 py-3 text-[12.5px] text-ink-muted">
              <Minus size={13} className="mt-0.5 shrink-0 rotate-90 text-primary" />
              <span>
                <span className="font-medium text-ink">How Bermi is adapting: </span>
                {report.adaptation}
              </span>
            </div>
          )}

          <p className="text-right text-[11px] text-ink-faint">
            Updated {new Date(report.generated_at).toLocaleString()}
          </p>
        </div>
      )}
    </section>
  )
}
