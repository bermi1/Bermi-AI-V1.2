import { useEffect, useState } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'

// A new service worker waits until the person chooses to reload, so a deploy
// never replaces the code under a half-written note or form.
export function UpdateNotice() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let cancelled = false
    const watch = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting)
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller && !cancelled) setWaiting(w)
        })
      })
    }
    navigator.serviceWorker.getRegistration().then((r) => r && watch(r))
    const onReg = () => navigator.serviceWorker.getRegistration().then((r) => r && watch(r))
    window.addEventListener('load', onReg)
    return () => {
      cancelled = true
      window.removeEventListener('load', onReg)
    }
  }, [])

  if (!waiting && online) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      {!online ? (
        <div role="status" className="pointer-events-auto flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-surface shadow-lg">
          <WifiOff size={15} aria-hidden /> You’re offline — what you see may be out of date, and changes can’t be saved.
        </div>
      ) : (
        <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-full bg-ink py-1.5 pl-4 pr-1.5 text-[13px] font-medium text-surface shadow-lg">
          A new version of Bermi is ready.
          <button
            className="min-h-[36px] rounded-full bg-primary px-3.5 font-semibold text-on-primary"
            onClick={() => {
              navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true })
              waiting?.postMessage('SKIP_WAITING')
            }}
          >
            <RefreshCw size={13} className="mr-1.5 inline" aria-hidden />Reload
          </button>
        </div>
      )}
    </div>
  )
}
