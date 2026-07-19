import { useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { Modal, ghostBtnCls, inputCls, labelCls, primaryBtnCls } from './Modal'
import { createInvoice } from '../lib/api'
import type { DocumentDetail } from '../lib/types'

interface InvoiceFormProps {
  onClose: () => void
  onCreated: (doc: DocumentDetail) => void
}

interface ItemDraft {
  description: string
  quantity: string
  unit_price: string
}

const emptyItem = (): ItemDraft => ({ description: '', quantity: '1', unit_price: '' })

export function InvoiceForm({ onClose, onCreated }: InvoiceFormProps) {
  const [fromName, setFromName] = useState('')
  const [fromDetails, setFromDetails] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientDetails, setClientDetails] = useState('')
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()])
  const [currency, setCurrency] = useState('USD')
  const [taxRate, setTaxRate] = useState('0')
  const [instructions, setInstructions] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setItem = (i: number, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))

  const subtotal = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0,
  )
  const total = subtotal * (1 + (Number(taxRate) || 0) / 100)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const doc = await createInvoice({
        from_name: fromName,
        from_details: fromDetails,
        client_name: clientName,
        client_details: clientDetails,
        items: items
          .filter((it) => it.description.trim())
          .map((it) => ({
            description: it.description.trim(),
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0,
          })),
        currency,
        tax_rate: Number(taxRate) || 0,
        instructions,
      })
      onCreated(doc)
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const valid = clientName.trim() && items.some((it) => it.description.trim())

  return (
    <Modal
      title="New invoice"
      subtitle="AI drafts the copy; you review, edit, and export"
      onClose={onClose}
      wide
    >
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelCls}>Your business name</label>
            <input
              className={inputCls}
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Acme Studio LLC"
            />
          </div>
          <div>
            <label className={labelCls}>Client name *</label>
            <input
              className={inputCls}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Globex Corporation"
            />
          </div>
          <div>
            <label className={labelCls}>Your details (address, email)</label>
            <textarea
              className={inputCls + ' min-h-[70px] resize-y'}
              value={fromDetails}
              onChange={(e) => setFromDetails(e.target.value)}
              placeholder={'123 Main St\nhello@acme.studio'}
            />
          </div>
          <div>
            <label className={labelCls}>Client details</label>
            <textarea
              className={inputCls + ' min-h-[70px] resize-y'}
              value={clientDetails}
              onChange={(e) => setClientDetails(e.target.value)}
              placeholder={'456 Client Ave\nbilling@globex.com'}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Line items *</label>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className={inputCls + ' flex-1'}
                  value={it.description}
                  onChange={(e) => setItem(i, { description: e.target.value })}
                  placeholder="Description of work"
                />
                <input
                  className={inputCls + ' w-16 text-right md:w-20'}
                  value={it.quantity}
                  onChange={(e) => setItem(i, { quantity: e.target.value })}
                  placeholder="Qty"
                  inputMode="decimal"
                />
                <input
                  className={inputCls + ' w-24 text-right md:w-28'}
                  value={it.unit_price}
                  onChange={(e) => setItem(i, { unit_price: e.target.value })}
                  placeholder="Price"
                  inputMode="decimal"
                />
                <button
                  onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={items.length === 1}
                  className="shrink-0 rounded-lg p-2 text-ink-faint hover:text-red-500 disabled:opacity-30"
                  aria-label="Remove line item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
          >
            <Plus size={13} />
            Add line item
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className={labelCls}>Currency</label>
            <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['USD', 'EUR', 'GBP', 'TZS', 'KES', 'ZAR', 'NGN'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Tax rate (%)</label>
            <input
              className={inputCls}
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="flex items-end justify-end pb-2 text-sm text-ink-muted">
            Total:&nbsp;
            <span className="font-semibold text-ink">
              {currency} {total.toFixed(2)}
            </span>
          </div>
        </div>

        <div>
          <label className={labelCls}>Instructions for the AI draft (optional)</label>
          <textarea
            className={inputCls + ' min-h-[60px] resize-y'}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. formal tone, mention the 50% deposit already paid, net-14 payment terms"
          />
        </div>

        {error && <p className="text-[13px] text-red-500">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-edge pt-4">
          <button onClick={onClose} className={ghostBtnCls} disabled={busy}>
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!valid || busy}
            className={primaryBtnCls + ' flex items-center gap-2'}
          >
            <Sparkles size={15} />
            {busy ? 'Drafting…' : 'Generate invoice'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
