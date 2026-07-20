import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { BermiMark } from './Logo'
import * as api from '../lib/api'
import type { AuthUser } from '../lib/types'

interface VerifyEmailPageProps {
  user: AuthUser
  onVerified: (user: AuthUser) => void
  onSignOut: () => void
}

export function VerifyEmailPage({ user, onVerified, onSignOut }: VerifyEmailPageProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.trim().length !== 6) return
    setBusy(true)
    setError(null)
    try {
      const { user: verified } = await api.verifyEmail(code.trim())
      onVerified(verified)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const resend = async () => {
    setError(null)
    try {
      await api.resendVerification()
      setResent(true)
      setTimeout(() => setResent(false), 30000)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 py-10">
      <div className="w-full max-w-sm text-center animate-fade-up">
        <BermiMark size={48} className="mx-auto mb-6 text-primary" />
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <MailCheck size={22} />
        </div>
        <h1 className="font-serif text-[26px] font-medium tracking-tight">Check your email</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          We sent a 6-digit code to <span className="font-medium text-ink">{user.email}</span>.
          Enter it below to activate your account.
        </p>

        <form onSubmit={submit} className="mt-6">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            className="w-full rounded-xl border border-edge bg-surface-raised px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none transition-colors placeholder:text-ink-faint focus:border-primary"
            aria-label="Verification code"
          />
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-[14.5px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40"
          >
            {busy ? 'Verifying…' : 'Verify email'}
          </button>
        </form>

        <p className="mt-5 text-[13px] text-ink-muted">
          Didn't get it?{' '}
          {resent ? (
            <span className="text-ink-faint">Sent — check spam too.</span>
          ) : (
            <button onClick={resend} className="font-medium text-primary hover:underline">
              Resend code
            </button>
          )}
        </p>
        <button
          onClick={onSignOut}
          className="mt-8 text-[12.5px] text-ink-faint hover:text-ink-muted hover:underline"
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  )
}
