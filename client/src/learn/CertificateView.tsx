import { useEffect, useState } from 'react'
import { ArrowLeft, Award, BadgeCheck, Download } from 'lucide-react'
import * as api from '../lib/api'
import type { Certificate } from '../lib/types'
import { Btn, ErrorNote, Spinner, type LearnRoute } from './ui'
import { BermiMark } from '../components/Logo'

export function CertificateView({ code, navigate }: { code: string; navigate: (r: LearnRoute) => void }) {
  const [cert, setCert] = useState<Certificate | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setCert(null)
    setError(null)
    api.learnCertificate(code).then(setCert).catch((e) => setError((e as Error).message))
  }, [code])

  if (error) return <div className="mx-auto max-w-2xl px-4 py-10"><ErrorNote>{error}</ErrorNote></div>
  if (!cert) return <Spinner label="Loading certificate…" />

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 md:py-10">
      <button
        onClick={() => navigate({ name: 'mylearning' })}
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> My learning
      </button>

      <div className="overflow-hidden rounded-3xl border-2 border-primary/30 bg-surface-raised shadow-lg">
        <div className="border-b border-edge bg-gradient-to-br from-primary/8 to-transparent px-8 py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
            <Award size={28} />
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-primary">Certificate of Completion</p>
          <p className="mt-6 text-[13px] text-ink-muted">This certifies that</p>
          <h1 className="mt-1 text-[28px] font-bold text-ink">{cert.learner_name}</h1>
          <p className="mt-4 text-[13px] text-ink-muted">has successfully completed</p>
          <h2 className="mt-1 text-[20px] font-semibold text-ink">{cert.course_title}</h2>
          <p className="mt-4 text-[14px] text-ink-muted">
            issued by <span className="font-semibold text-ink">{cert.institution_name}</span>
            {cert.score != null && <> · scored <span className="font-semibold text-ink">{cert.score}%</span></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-8 py-4 text-[12px] text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <BadgeCheck size={14} className="text-emerald-500" /> Verification code: <strong className="text-ink-muted">{cert.code}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BermiMark size={13} className="text-primary" /> Issued {new Date(cert.issued_at).toLocaleDateString()} via Bermi Learn
          </span>
        </div>
      </div>

      <div className="mt-5 flex justify-center">
        <a href={api.learnCertificatePdfUrl(cert.code)} target="_blank" rel="noreferrer">
          <Btn><Download size={16} /> Download PDF</Btn>
        </a>
      </div>
      <p className="mt-4 text-center text-[11.5px] text-ink-faint">
        This is a certificate of completion issued by the organization, not an accredited academic degree.
      </p>
    </div>
  )
}
