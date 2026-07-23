import { useEffect, useState } from 'react'
import {
  Award,
  Check,
  Copy,
  HeartPulse,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react'
import * as api from '../lib/api'
import type { InsightsReport, Vital } from '../lib/types'

const STATUS_COLOR = { good: '#12b76a', watch: '#f79009', high: '#f04438' } as const

function Ring({ value, size = 86 }: { value: number; size?: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  const off = c - (value / 100) * c
  const tone = value >= 67 ? '#12b76a' : value >= 34 ? '#f79009' : '#f04438'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
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
      <div className="absolute inset-0 flex items-center justify-center text-[20px] font-semibold">
        {value}
        <span className="text-[10px] text-ink-faint">%</span>
      </div>
    </div>
  )
}

function Meter({ v }: { v: Vital }) {
  const color = STATUS_COLOR[v.status]
  return (
    <div className="rounded-xl border border-edge px-3 py-2.5">
      <div className="flex items-center justify-between text-[12.5px]">
        <span className="font-medium text-ink">{v.label}</span>
        <span className="font-semibold" style={{ color }}>
          {v.score}%
        </span>
      </div>
      <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full" style={{ width: `${v.score}%`, background: color, transition: 'width .6s ease' }} />
      </div>
      {v.note && <div className="text-[11px] leading-snug text-ink-faint">{v.note}</div>}
    </div>
  )
}

function ReportActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* blocked */
    }
  }
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text })
      } catch {
        /* cancelled */
      }
    } else copy()
  }
  const btn =
    'inline-flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken'
  return (
    <div className="flex items-center gap-1.5">
      <button onClick={copy} className={btn}>
        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <button onClick={share} className={btn}>
        <Share2 size={13} /> Share
      </button>
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

  const vitals = report?.vitals ?? []
  const emotion = report?.emotion ?? { label: '—', score: 0, note: '' }
  const wellbeing = report?.wellbeing_pct ?? report?.productivity_pct ?? 0
  const recommendations = report?.recommendations ?? []

  const shareText = report
    ? `Bermi AI Health check-in (${period === 'day' ? 'today' : 'this week'})\n` +
      `Wellbeing: ${wellbeing}%  ·  Mood: ${emotion.label}\n\n` +
      vitals.map((v) => `${v.label}: ${v.score}%`).join('\n') +
      (recommendations.length ? `\n\nSuggestions:\n${recommendations.map((r) => `- ${r}`).join('\n')}` : '') +
      `\n\n${report.summary}`
    : ''

  return (
    <section className="mb-8 rounded-2xl border border-edge bg-surface-raised p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HeartPulse size={17} className="text-primary" />
          <h2 className="text-[16px] font-semibold tracking-tight">AI Health check-in</h2>
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
          <p className="text-[14px] font-medium">Your AI wellbeing check-in</p>
          <p className="mt-1 max-w-md text-[12.5px] text-ink-faint">
            {report?.summary ??
              "Chat with Bermi, then run a check-in. Like a health app, you'll see your emotional balance, focus, growth, healthy-usage, AI dependency and brain-rot risk — with gentle suggestions. It's a mirror, not a diagnosis."}
          </p>
          <button
            onClick={refresh}
            disabled={refreshing}
            className="mt-4 flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {refreshing ? 'Analyzing…' : 'Run my check-in'}
          </button>
          {error && <p className="mt-2 text-[12px] text-red-500">{error}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Wellbeing hero */}
          <div className="flex items-center gap-4 rounded-2xl border border-edge bg-gradient-to-br from-primary-soft/60 to-transparent p-4">
            <Ring value={wellbeing} />
            <div className="min-w-0">
              <div className="text-[11.5px] font-medium uppercase tracking-wide text-ink-faint">Overall AI wellbeing</div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-primary">
                  {emotion.label} mood
                </span>
              </div>
              {emotion.note && <p className="mt-1.5 text-[12.5px] leading-snug text-ink-muted">{emotion.note}</p>}
            </div>
          </div>

          {/* Vitals — health-app meters */}
          {vitals.length > 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {vitals.map((v) => (
                <Meter key={v.id} v={v} />
              ))}
            </div>
          )}

          <p className="rounded-xl bg-primary-soft/60 px-4 py-3 text-[13px] leading-relaxed text-ink">{report.summary}</p>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <Lightbulb size={14} className="text-emerald-500" /> Gentle suggestions
              </div>
              <ul className="space-y-1.5">
                {recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-ink-muted">
                    <Plus size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge pt-3">
            <span className="text-[11px] text-ink-faint">
              Updated {new Date(report.generated_at).toLocaleString()} · a mirror, not a diagnosis
            </span>
            <ReportActions text={shareText} />
          </div>
        </div>
      )}
    </section>
  )
}
