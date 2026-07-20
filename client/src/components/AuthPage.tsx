import { useEffect, useState } from 'react'
import { ArrowRight, MailCheck } from 'lucide-react'
import { BermiMark } from './Logo'
import { inputCls, labelCls } from './Modal'
import * as api from '../lib/api'
import { ApiError } from '../lib/api'

interface AuthPageProps {
  onAuthed: () => Promise<boolean>
}

type View = 'login' | 'signup' | 'confirm'

function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export function AuthPage({ onAuthed }: AuthPageProps) {
  const [view, setView] = useState<View>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resent, setResent] = useState(false)
  const [googleReady, setGoogleReady] = useState<boolean | null>(null)
  const [backendDown, setBackendDown] = useState(false)

  useEffect(() => {
    // Instant diagnosis: if the backend is unreachable, say so up front
    // instead of letting the submit button discover it.
    api
      .health()
      .then(() => setBackendDown(false))
      .catch(() => setBackendDown(true))
    api
      .authProviders()
      .then((p) => setGoogleReady(p.google))
      .catch(() => setGoogleReady(false))
    const params = new URLSearchParams(window.location.search)
    if (params.get('auth_error') === 'google_not_configured') {
      setError('Google sign-in is not configured yet — continue with email instead.')
    } else if (params.get('auth_error') === 'google') {
      setError('Google sign-in was cancelled or failed — try again or use email.')
    }
    if (params.has('auth_error')) {
      window.history.replaceState(null, '', window.location.pathname)
    }
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
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 py-10">
        <div className="w-full max-w-sm text-center animate-fade-up">
          <BermiMark size={48} className="mx-auto mb-6 text-primary" />
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <MailCheck size={22} />
          </div>
          <h1 className="font-serif text-[26px] font-medium tracking-tight">
            Confirm your email
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
            We sent a confirmation link to{' '}
            <span className="font-medium text-ink">{confirmEmail}</span>. Click it, then come
            back and sign in.
          </p>
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}
          <button
            onClick={() => switchView('login')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[14.5px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            I've confirmed — sign in
            <ArrowRight size={16} />
          </button>
          <p className="mt-5 text-[13px] text-ink-muted">
            Didn't get it?{' '}
            {resent ? (
              <span className="text-ink-faint">Sent — check spam too.</span>
            ) : (
              <button onClick={resend} className="font-medium text-primary hover:underline">
                Resend email
              </button>
            )}
          </p>
          <button
            onClick={() => switchView('signup')}
            className="mt-8 text-[12.5px] text-ink-faint hover:text-ink-muted hover:underline"
          >
            Use a different email address
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <BermiMark size={56} className="mb-5 text-primary" />
          <h1 className="font-serif text-[28px] font-medium leading-tight tracking-tight md:text-[32px]">
            {view === 'login' ? 'Welcome back' : 'Your ideas, amplified'}
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">
            {view === 'login'
              ? 'Sign in to continue to Bermi AI.'
              : 'Create your Bermi AI account — chat, documents, and your own AI brains.'}
          </p>
        </div>

        {backendDown && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            The Bermi server is not responding. Start the backend (npm start) or check your
            connection, then reload this page.
          </p>
        )}
        <a
          href={api.googleLoginUrl()}
          onClick={(e) => {
            if (googleReady === false) {
              e.preventDefault()
              setError('Google sign-in is not configured yet — continue with email instead.')
            }
          }}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-edge bg-surface-raised px-4 py-2.5 text-[14.5px] font-medium text-ink shadow-sm transition-colors hover:bg-surface-sunken"
        >
          <GoogleG />
          Continue with Google
        </a>
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-edge" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
            or
          </span>
          <div className="h-px flex-1 bg-edge" />
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          {view === 'signup' && (
            <div>
              <label className={labelCls} htmlFor="auth-name">
                Full name
              </label>
              <input
                id="auth-name"
                className={inputCls + ' py-2.5'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
                required
              />
            </div>
          )}
          <div>
            <label className={labelCls} htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              className={inputCls + ' py-2.5'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              className={inputCls + ' py-2.5'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={view === 'signup' ? 'At least 8 characters' : '••••••••'}
              autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[14.5px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {busy ? 'One moment…' : view === 'login' ? 'Sign in' : 'Create account'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="mt-6 text-center text-[13.5px] text-ink-muted">
          {view === 'login' ? (
            <>
              New to Bermi?{' '}
              <button
                onClick={() => switchView('signup')}
                className="font-medium text-primary hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => switchView('login')}
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="mt-10 text-center text-xs leading-relaxed text-ink-faint">
          AI access is included — powered by Bermi's managed models.
          <br />
          By continuing you agree to use Bermi responsibly.
        </p>
      </div>
    </div>
  )
}
