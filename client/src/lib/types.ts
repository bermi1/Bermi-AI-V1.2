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
  type: 'invoice' | 'studio'
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
  id: string
  name: string
  content: string
  enabled: boolean
  updated_at: string | null
  builtin?: boolean
}

export type StudioFormat = 'pdf' | 'docx' | 'pptx'

export interface StudioDoc {
  id: string
  type: 'studio'
  title: string
  status: string
  version: number
  created_at: string
  updated_at: string
  data: { title: string; kind: string; format: StudioFormat; markdown: string }
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

export interface Trait {
  trait: string
  note: string
}

export interface InsightsReport {
  period: 'day' | 'week'
  generated_at: string
  conversations: number
  user_turns: number
  assistant_turns: number
  productivity_pct: number
  dependency_pct: number
  prompt_quality_pct: number
  prompt_tips: string[]
  skills: string[]
  positive_traits: Trait[]
  negative_traits: Trait[]
  adaptation: string
  summary: string
}

export interface NicheQuestion {
  id: string
  q: string
}

export interface StudyStats {
  xp: number
  level: number
  streak: number
  sessions: number
  topic_count: number
  xp_into_level: number
  xp_for_level: number
  badges: string[]
  badges_detailed?: { id: string; label: string }[]
  topic_list?: { topic: string; count: number }[]
}

export interface StudyAward {
  stats: StudyStats
  gained: number
  leveledUp: boolean
  newBadges: { id: string; label: string }[]
}

export interface NicheReport {
  niche: string
  tagline: string
  why_you: string
  audience: string
  positioning: string
  content_pillars: string[]
  first_moves: string[]
  skills_to_build: string[]
  monetization: string[]
  self_improvement: string[]
  ninety_day_goal: string
  generated_at?: string
}
