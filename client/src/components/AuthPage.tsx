import { useEffect, useState } from 'react'
import { ArrowRight, ChevronLeft, Eye, EyeOff, MailCheck } from 'lucide-react'
import { BermiMark } from './Logo'
import * as api from '../lib/api'
import { ApiError } from '../lib/api'

interface AuthPageProps {
  onAuthed: () => Promise<boolean>
  onBack?: () => void
  initialView?: 'login' | 'signup'
}

type View = 'login' | 'signup' | 'confirm'

// Defined at module level so it keeps its identity across renders — a shell
// created inside AuthPage would remount (and drop input focus) on every keystroke.
function Shell({ onBack, children }: { onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="aurora flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {onBack ? (
          <button onClick={onBack} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20"><ChevronLeft size={20} /></button>
        ) : <span className="h-11 w-11" />}
        <BermiMark size={30} className="text-white" />
        <span className="h-11 w-11" />
      </header>
      <main className="flex flex-1 flex-col justify-center px-6 pb-10 pt-4">
        <div className="mx-auto w-full max-w-sm animate-fade-up">{children}</div>
      </main>
    </div>
  )
}


export function AuthPage({ onAuthed, onBack, initialView = 'login' }: AuthPageProps) {
  const [view, setView] = useState<View>(initialView)
  const [showPw, setShowPw] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [backendDown, setBackendDown] = useState(false)

  useEffect(() => {
    // Instant diagnosis: if the backend is unreachable, say so up front
    // instead of letting the submit button discover it.
    api
      .health()
      .then(() => setBackendDown(false))
      .catch(() => setBackendDown(true))
  }, [])

  const switchView = (v: View) => {
    setView(v)
    setError(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (view === 'signup') {
        const res = await api.signup(name, email, password)
        if (res.needsConfirmation) {
          // Supabase sent its confirmation email; user signs in after clicking it.
          setConfirmEmail(res.email || email)
          setView('confirm')
          setBusy(false)
          return
        }
      } else {
        await api.login(email, password)
      }
      // Never leave the button spinning: if the session did not stick,
      // say so instead of hanging on "One moment…".
      const ok = await onAuthed()
      if (!ok) {
        setError(
          'Your account is ready, but the session could not be established in this browser. ' +
            'Please try signing in again (and check that cookies are allowed).',
        )
        setBusy(false)
      }
    } catch (err) {
      if ((err as ApiError).code === 'unconfirmed') {
        setConfirmEmail((err as ApiError).email || email)
        setView('confirm')
      } else {
        setError((err as Error).message)
      }
      setBusy(false)
    }
  }

  const resend = async () => {
    setError(null)
    try {
      await api.resendVerification(confirmEmail)
      setResent(true)
      setTimeout(() => setResent(false), 30000)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (view === 'confirm') {
    return (
      <Shell onBack={onBack}>
        <div className="text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-white/12 text-white backdrop-blur"><MailCheck size={24} /></div>
          <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Check your email</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/70">
            We sent a link to <span className="font-medium text-white">{confirmEmail}</span>. Tap it, then come back and sign in.
          </p>
          {error && <p role="alert" className="mt-4 rounded-2xl bg-red-500/20 px-4 py-2.5 text-[13.5px] text-red-100">{error}</p>}
          <button onClick={() => switchView('login')} className="mt-7 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-[#0B1020]">
            I’ve confirmed — sign in <ArrowRight size={18} />
          </button>
          <p className="mt-5 text-[13.5px] text-white/65">
            Didn’t get it?{' '}
            {resent ? <span className="text-white/45">Sent — check spam too.</span> : <button onClick={resend} className="font-semibold text-white underline underline-offset-2">Resend</button>}
          </p>
          <button onClick={() => switchView('signup')} className="mt-6 text-[13px] text-white/50 hover:text-white/80">Use a different email</button>
        </div>
      </Shell>
    )
  }

  const signup = view === 'signup'
  return (
    <Shell onBack={onBack}>
      <div className="mb-8 text-center">
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em]">{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="mt-2 text-[15px] text-white/70">{signup ? 'Free for early users.' : 'Sign in to pick up where you left off.'}</p>
      </div>

      {backendDown && (
        <p role="alert" className="mb-4 rounded-2xl bg-amber-400/20 px-4 py-2.5 text-[13px] leading-relaxed text-amber-100">
          The Bermi server is not responding. Check your connection and reload this page.
        </p>
      )}

      <form onSubmit={submit} className="space-y-3">
        {signup && (
          <div>
            <label className="sr-only" htmlFor="auth-name">Full name</label>
            <input id="auth-name" className="glass-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoComplete="name" required />
          </div>
        )}
        <div>
          <label className="sr-only" htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" className="glass-field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" required />
        </div>
        <div className="relative">
          <label className="sr-only" htmlFor="auth-password">Password</label>
          <input id="auth-password" type={showPw ? 'text' : 'password'} className="glass-field pr-12" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={signup ? 'Password (8+ characters)' : 'Password'} autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required />
          <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-white/60 hover:text-white">
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p role="alert" className="rounded-2xl bg-red-500/20 px-4 py-2.5 text-[13.5px] text-red-100">{error}</p>}

        <button type="submit" disabled={busy} className="!mt-5 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-white text-[16px] font-semibold text-[#0B1020] shadow-[0_14px_34px_-10px_rgba(255,255,255,0.45)] transition-transform active:scale-[0.98] disabled:opacity-60">
          {busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}
          {!busy && <ArrowRight size={18} />}
        </button>
      </form>

      <p className="mt-6 text-center text-[14px] text-white/70">
        {signup ? 'Already have an account? ' : 'New to Bermi? '}
        <button onClick={() => switchView(signup ? 'login' : 'signup')} className="font-semibold text-white underline underline-offset-2">{signup ? 'Sign in' : 'Create an account'}</button>
      </p>
      <p className="mt-8 text-center text-[11.5px] leading-relaxed text-white/45">By continuing you agree to use Bermi responsibly.</p>
    </Shell>
  )
}
