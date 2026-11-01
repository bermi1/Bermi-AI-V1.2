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
    <div className="aurora flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm text-center animate-fade-up">
        <BermiMark size={34} className="mx-auto mb-6 text-white" />
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-white/12 text-white backdrop-blur"><MailCheck size={24} /></div>
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Check your email</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-white/70">
          We sent a 6-digit code to <span className="font-medium text-white">{user.email}</span>. Enter it to activate your account.
        </p>

        <form onSubmit={submit} className="mt-7">
          <label htmlFor="verify-code" className="sr-only">Verification code</label>
          <input
            id="verify-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            className="glass-field text-center font-mono text-2xl tracking-[0.5em]"
          />
          {error && <p role="alert" className="mt-3 rounded-2xl bg-red-500/20 px-4 py-2.5 text-[13.5px] text-red-100">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="mt-4 min-h-[54px] w-full rounded-full bg-white text-[16px] font-semibold text-[#0B1020] shadow-[0_14px_34px_-10px_rgba(255,255,255,0.45)] transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {busy ? 'Verifying…' : 'Verify email'}
          </button>
        </form>

        <p className="mt-5 text-[13.5px] text-white/65">
          Didn’t get it?{' '}
          {resent ? <span className="text-white/45">Sent — check spam too.</span> : <button onClick={resend} className="font-semibold text-white underline underline-offset-2">Resend code</button>}
        </p>
        <button onClick={onSignOut} className="mt-8 text-[13px] text-white/50 hover:text-white/80">
          Sign out and use a different account
        </button>
      </div>
    </div>
  )
}
