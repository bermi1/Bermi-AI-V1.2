export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: string | null
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  model: string
  created_at: string
  updated_at: string
}

export interface ModelOption {
  id: string
  label: string
  description?: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
}

export interface InvoiceData {
  invoice_number: string
  issue_date: string
  due_date: string
  from_name: string
  from_details: string
  client_name: string
  client_details: string
  items: InvoiceItem[]
  tax_rate: number
  currency: string
  terms: string
  notes: string
}

export interface DocumentSummary {
  id: string
  type: 'invoice'
  title: string
  status: 'draft' | 'final'
  version: number
  created_at: string
  updated_at: string
}

export interface DocumentDetail extends DocumentSummary {
  data: InvoiceData
}

export interface DocumentVersion {
  version: number
  created_at: string
}

export interface SettingsInfo {
  hasApiKey: boolean
  apiKeySource: 'env' | 'settings' | null
  apiKeyHint: string | null
}
