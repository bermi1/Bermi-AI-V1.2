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

export interface Vital {
  id: string
  label: string
  score: number
  good_high: boolean
  status: 'good' | 'watch' | 'high'
  note: string
}

export interface Emotion {
  label: string
  score: number
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
  wellbeing_pct: number
  emotion: Emotion
  vitals: Vital[]
  recommendations: string[]
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
  badge_labels?: Record<string, string>
  topic_list?: { topic: string; count: number; steps: string[] }[]
}

export interface StudyAward {
  stats: StudyStats
  gained: number
  leveledUp: boolean
  newBadges: { id: string; label: string }[]
}

// ---------- Bermi Learn ----------
// Not education-only: an "institution" here can be a school, but just as
// easily a bank, NGO, company, government body, or event host — org_type
// only tailors language and AI defaults. A "course" can be a taught course,
// or a program/event/resource — see OfferingKind below.

export type OrgType = 'education' | 'business' | 'nonprofit' | 'government' | 'community' | 'media' | 'other'
export type OfferingKind = 'course' | 'program' | 'event' | 'resource'

export interface Institution {
  id: string
  owner_id?: string
  name: string
  slug: string
  about: string
  website?: string
  logo_url?: string | null
  published: boolean
  org_type?: OrgType
  created_at: string
}

export interface Course {
  id: string
  institution_id: string
  title: string
  slug: string
  summary: string
  description: string
  cover_emoji: string
  level: string
  category?: string
  published: boolean
  enrollment: 'open' | 'approval'
  kind?: OfferingKind
  event_at?: string | null
  event_location?: string
  objectives?: string
  evaluation?: string
  tracking?: string
  institution?: { name: string; slug: string; org_type?: OrgType } | null
}

export interface InstitutionLearner {
  user_id: string
  name: string
  email: string
  total_courses: number
  completed: number
  avg_understanding: number | null
  avg_dependency: number | null
  courses: { course_id: string; title: string; status: string; understanding: number | null; dependency: number | null }[]
}

export interface ActivityItem {
  type: 'enrolled' | 'completed'
  learner: string
  course: string
  at: string
}

export interface LearnerRow {
  name: string
  status: string
  lessons_done: number
  lessons_total: number
  understanding: number | null
  dependency: number | null
}

export interface Lesson {
  id: string
  course_id: string
  ordinal: number
  title: string
  content: string
  material?: string
  video_url?: string
  attachment_url?: string
}

export interface Enrollment {
  id: string
  course_id: string
  user_id: string
  status: 'applied' | 'enrolled' | 'completed'
  progress: Record<string, { done: boolean; score?: number }>
  score: number | null
  course?: Course
}

export interface Certificate {
  code: string
  learner_name: string
  course_title: string
  institution_name: string
  score: number | null
  issued_at: string
}

export interface QuizQuestion {
  q: string
  options: string[]
}

export interface QuizResult {
  q: string
  options: string[]
  chosen: number
  correctIndex: number
  correct: boolean
}

export interface QuizSubmitResponse {
  score: number
  passed: boolean
  threshold: number
  results: QuizResult[]
  enrollment?: Enrollment
  certificate?: Certificate | null
}

export interface InstitutionAnalytics {
  courses: number
  enrollments: number
  completions: number
  completion_rate: number
  avg_understanding: number | null
  recent_activity: ActivityItem[]
  top_courses: { id: string; title: string; enrollments: number; completions: number }[]
  per_course: {
    id: string
    title: string
    published: boolean
    enrollments: number
    completions: number
    avg_score: number | null
    learners?: LearnerRow[]
  }[]
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
