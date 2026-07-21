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
  custom?: boolean
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

export interface Profile {
  name: string
  role: string
  preferences: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  email_verified: boolean
  is_guest?: boolean
}

export interface SettingsInfo {
  aiReady: boolean
  storageBackend: 'sqlite' | 'supabase'
  account: { name: string; email: string }
  profile: Profile
}

export interface Attachment {
  name: string
  text: string
  truncated: boolean
}

export interface Brain {
  id: 'company' | 'personal' | 'vibecoding'
  name: string
  content: string
  enabled: boolean
  updated_at: string | null
}

export interface Connector {
  id: string
  label: string
  description: string
  status: 'connected' | 'available' | 'setup_required' | 'coming_soon'
  account: string | null
  connected_at: string | null
}

export interface GmailMessage {
  id: string
  subject: string
  from: string
  date: string
  snippet: string
}
