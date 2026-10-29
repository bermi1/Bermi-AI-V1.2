import { useCallback, useEffect, useRef, useState } from 'react'
import { lifeApi, LifeError, type Item } from './api'
import { useAsync, useToast } from './ui'

/** All items of a kind (optionally date-bounded), with optimistic-free reload. */
export function useItems<T>(kind: string, range?: { from?: string; to?: string }) {
  const from = range?.from
  const to = range?.to
  const q = useAsync(() => lifeApi.items<T>(kind, { from, to }), [kind, from, to])
  return { ...q, items: q.data ?? [] }
}

/** A one-per-user record (budget, profile, preferences). Creates on first save. */
export function useSingleton<T extends object>(kind: string) {
  const q = useAsync(() => lifeApi.items<T>(kind).then((l) => l[0] ?? null), [kind])
  const save = useCallback(
    async (patch: Partial<T>) => {
      const cur = q.data
      const next = cur ? await lifeApi.update<T>(cur.id, patch) : await lifeApi.create<T>(kind, patch)
      q.setData(next)
      return next
    },
    [kind, q],
  )
  return { item: q.data as Item<T> | null, data: (q.data?.data ?? null) as T | null, loading: q.loading, error: q.error, reload: q.reload, save }
}

export const errText = (e: unknown) => {
  if (e instanceof LifeError) return e.message
  return e instanceof Error ? e.message : 'Something went wrong'
}

/** Wraps a mutation: surfaces failure honestly, never claims a save that failed. */
export function useAct() {
  const toast = useToast()
  return useCallback(
    async <R,>(fn: () => Promise<R>, ok?: string): Promise<R | undefined> => {
      try {
        const r = await fn()
        if (ok) toast(ok)
        return r
      } catch (e) {
        toast(errText(e), 'error')
        return undefined
      }
    },
    [toast],
  )
}

/** Today's local date; rolls over at midnight while the app stays open. */
export function useToday() {
  const [d, setD] = useState(() => localToday())
  useEffect(() => {
    const t = setInterval(() => setD((cur) => (localToday() === cur ? cur : localToday())), 60_000)
    return () => clearInterval(t)
  }, [])
  return d
}
const localToday = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function useMedia(query: string) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

/** Debounced autosave helper for text fields (notes, reflections). */
export function useDebounced<T>(value: T, ms = 700) {
  const [v, setV] = useState(value)
  const t = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    t.current = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t.current)
  }, [value, ms])
  return v
}

export const newIdemKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k_${Date.now()}_${Math.random().toString(36).slice(2)}`
