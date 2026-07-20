import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { BermiMark } from './Logo'
import { inputCls, labelCls } from './Modal'
import * as api from '../lib/api'
import type { AuthUser } from '../lib/types'

interface AuthPageProps {
  onAuthed: (user: AuthUser) => void
}

export function AuthPage({ onAuthed }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { user } =
        mode === 'signup'
          ? await api.signup(name, email, password)
          : await api.login(email, password)
      onAuthed(user)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface px-5 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <BermiMark size={56} className="mb-5 text-primary" />
          <h1 className="font-serif text-[28px] font-medium leading-tight tracking-tight md:text-[32px]">
            {mode === 'login' ? 'Welcome back' : 'Your ideas, amplified'}
          </h1>
          <p className="mt-2 text-[14.5px] leading-relaxed text-ink-muted">
            {mode === 'login'
              ? 'Sign in to continue to Bermi AI.'
              : 'Create your Bermi AI account — chat, documents, and your own AI brains.'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          {mode === 'signup' && (
            <div>
              <label className={labelCls} htmlFor="auth-name">
                Full name
              </label>
              <input
                id="auth-name"
                className={inputCls + ' py-2.5'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Saul Basil"
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
              placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
            {busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}
            {!busy && <ArrowRight size={16} />}
          </button>
        </form>

        <p className="mt-6 text-center text-[13.5px] text-ink-muted">
          {mode === 'login' ? (
            <>
              New to Bermi?{' '}
              <button
                onClick={() => {
                  setMode('signup')
                  setError(null)
                }}
                className="font-medium text-primary hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setMode('login')
                  setError(null)
                }}
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
