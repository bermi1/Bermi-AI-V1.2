import { createClient } from '@supabase/supabase-js'

// Bermi tables are prefixed so they coexist with anything else in the project.
const T = {
  users: 'bermi_users',
  sessions: 'bermi_sessions',
  conversations: 'bermi_conversations',
  messages: 'bermi_messages',
  documents: 'bermi_documents',
  document_versions: 'bermi_document_versions',
  settings: 'bermi_settings',
  brains: 'bermi_brains',
  connectors: 'bermi_connectors',
  institutions: 'bermi_institutions',
  courses: 'bermi_courses',
  lessons: 'bermi_lessons',
  enrollments: 'bermi_enrollments',
  certificates: 'bermi_certificates',
}

/**
 * Supabase (Postgres) storage via the Data API. Enabled when SUPABASE_URL and
 * SUPABASE_KEY are set in the server environment. The key stays server-side;
 * prefer the service_role key in production so RLS can be locked down.
 */
export class SupabaseStorage {
  constructor(url, key) {
    this.sb = createClient(url, key, {
      auth: { persistSession: false },
      // A hanging network path must fail fast, not stall every request
      // (a stalled auth lookup is how login buttons hang forever).
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(8000) }),
      },
    })
  }

  backend() {
    return 'supabase'
  }

  async #one(query) {
    const { data, error } = await query
    if (error) throw new Error(`Supabase: ${error.message}`)
    return data
  }

  // --- users & sessions ---
  async createUser(row) {
    await this.#one(this.sb.from(T.users).insert(row))
    return row
  }
  async upsertUser(row) {
    await this.#one(this.sb.from(T.users).upsert(row))
    return row
  }
  async updateUser(id, patch) {
    const allowed = ['name', 'email_verified', 'verify_code', 'verify_expires', 'password_hash']
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([k]) => allowed.includes(k)),
    )
    if (Object.keys(clean).length > 0) {
      await this.#one(this.sb.from(T.users).update(clean).eq('id', id))
    }
    return this.getUserById(id)
  }
  async getUserByEmail(email) {
    const rows = await this.#one(this.sb.from(T.users).select('*').eq('email', email).limit(1))
    return rows[0] ?? null
  }
  async getUserById(id) {
    const rows = await this.#one(this.sb.from(T.users).select('*').eq('id', id).limit(1))
    return rows[0] ?? null
  }
  async listUsers() {
    return this.#one(
      this.sb
        .from(T.users)
        .select('id, name, email, email_verified, created_at')
        .order('created_at', { ascending: false }),
    )
  }
  async adminStats() {
    const count = async (table) => {
      const { count, error } = await this.sb.from(table).select('*', { count: 'exact', head: true })
      if (error) return 0
      return count ?? 0
    }
    const [users, conversations, messages, documents, institutions, courses, enrollments, certificates] =
      await Promise.all([
        count(T.users),
        count(T.conversations),
        count(T.messages),
        count(T.documents),
        count(T.institutions),
        count(T.courses),
        count(T.enrollments),
        count(T.certificates),
      ])
    return { users, conversations, messages, documents, institutions, courses, enrollments, certificates }
  }
  async createSession(row) {
    await this.#one(this.sb.from(T.sessions).insert(row))
  }
  async getSession(token) {
    const rows = await this.#one(this.sb.from(T.sessions).select('*').eq('token', token).limit(1))
    return rows[0] ?? null
  }
  async deleteSession(token) {
    await this.#one(this.sb.from(T.sessions).delete().eq('token', token))
  }

  // --- conversations ---
  async listConversations(userId) {
    return this.#one(
      this.sb
        .from(T.conversations)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
    )
  }
  async getConversation(id) {
    const rows = await this.#one(this.sb.from(T.conversations).select('*').eq('id', id).limit(1))
    return rows[0] ?? null
  }
  async createConversation(row) {
    await this.#one(this.sb.from(T.conversations).insert(row))
    return row
  }
  async updateConversation(id, patch) {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
    await this.#one(this.sb.from(T.conversations).update(clean).eq('id', id))
    return this.getConversation(id)
  }
  async deleteConversation(id) {
    await this.#one(this.sb.from(T.conversations).delete().eq('id', id))
    return true
  }

  // --- messages ---
  async listMessages(conversationId) {
    return this.#one(
      this.sb
        .from(T.messages)
        .select('id, role, content, model, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
    )
  }
  async addMessage(row) {
    await this.#one(this.sb.from(T.messages).insert({ model: null, ...row }))
  }

  // --- documents ---
  async listDocuments(userId) {
    return this.#one(
      this.sb
        .from(T.documents)
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
    )
  }
  async getDocument(id) {
    const rows = await this.#one(this.sb.from(T.documents).select('*').eq('id', id).limit(1))
    return rows[0] ?? null
  }
  async countDocuments(type) {
    const { count, error } = await this.sb
      .from(T.documents)
      .select('id', { count: 'exact', head: true })
      .eq('type', type)
    if (error) throw new Error(`Supabase: ${error.message}`)
    return count ?? 0
  }
  async createDocument(row, data) {
    await this.#one(this.sb.from(T.documents).insert(row))
    await this.#one(
      this.sb.from(T.document_versions).insert({
        document_id: row.id,
        version: 1,
        data,
        created_at: row.created_at,
      }),
    )
  }
  async addDocumentVersion(id, { version, data, title, status, updated_at }) {
    await this.#one(
      this.sb.from(T.document_versions).insert({
        document_id: id,
        version,
        data,
        created_at: updated_at,
      }),
    )
    await this.#one(
      this.sb
        .from(T.documents)
        .update({ current_version: version, title, status, updated_at })
        .eq('id', id),
    )
  }
  async getDocumentVersion(id, version) {
    const rows = await this.#one(
      this.sb
        .from(T.document_versions)
        .select('*')
        .eq('document_id', id)
        .eq('version', version)
        .limit(1),
    )
    return rows[0] ?? null
  }
  async listDocumentVersions(id) {
    return this.#one(
      this.sb
        .from(T.document_versions)
        .select('version, created_at')
        .eq('document_id', id)
        .order('version', { ascending: false }),
    )
  }
  async deleteDocument(id) {
    await this.#one(this.sb.from(T.documents).delete().eq('id', id))
    return true
  }

  // --- settings ---
  async getSetting(key) {
    const rows = await this.#one(this.sb.from(T.settings).select('value').eq('key', key).limit(1))
    return rows[0]?.value ?? null
  }
  async setSetting(key, value) {
    await this.#one(this.sb.from(T.settings).upsert({ key, value }))
  }
  async deleteSetting(key) {
    await this.#one(this.sb.from(T.settings).delete().eq('key', key))
  }
  async deleteSettingsByPrefix(prefix) {
    await this.#one(this.sb.from(T.settings).delete().like('key', `${prefix}%`))
  }
  async deleteUser(id) {
    await this.#one(this.sb.from(T.sessions).delete().eq('user_id', id))
    await this.#one(this.sb.from(T.users).delete().eq('id', id))
  }

  // --- brains (per user) ---
  async listBrains(userId) {
    return this.#one(
      this.sb.from(T.brains).select('id, name, content, enabled, updated_at').eq('user_id', userId),
    )
  }
  async upsertBrain(userId, brain) {
    await this.#one(this.sb.from(T.brains).upsert({ user_id: userId, ...brain }))
  }
  async deleteBrain(userId, id) {
    await this.#one(this.sb.from(T.brains).delete().eq('user_id', userId).eq('id', id))
    return true
  }

  // --- connectors ---
  async listConnectors() {
    return this.#one(this.sb.from(T.connectors).select('provider, status, account, connected_at'))
  }
  async getConnector(provider) {
    const rows = await this.#one(
      this.sb.from(T.connectors).select('*').eq('provider', provider).limit(1),
    )
    return rows[0] ?? null
  }
  async upsertConnector(row) {
    await this.#one(this.sb.from(T.connectors).upsert(row))
  }
  async deleteConnector(provider) {
    await this.#one(this.sb.from(T.connectors).delete().eq('provider', provider))
    return true
  }

  // --- LMS (Bermi Learn) ---
  async #first(q) {
    const rows = await this.#one(q.limit(1))
    return rows[0] ?? null
  }
  async createInstitution(r) {
    await this.#one(this.sb.from(T.institutions).insert(r))
    return this.getInstitution(r.id)
  }
  getInstitution(id) {
    return this.#first(this.sb.from(T.institutions).select('*').eq('id', id))
  }
  getInstitutionBySlug(slug) {
    return this.#first(this.sb.from(T.institutions).select('*').eq('slug', slug))
  }
  listInstitutionsByOwner(ownerId) {
    return this.#one(this.sb.from(T.institutions).select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }))
  }
  listPublishedInstitutions() {
    return this.#one(this.sb.from(T.institutions).select('*').eq('published', true).order('created_at', { ascending: false }))
  }
  async updateInstitution(id, patch) {
    await this.#one(this.sb.from(T.institutions).update(patch).eq('id', id))
    return this.getInstitution(id)
  }

  async createCourse(r) {
    await this.#one(this.sb.from(T.courses).insert(r))
    return this.getCourse(r.id)
  }
  getCourse(id) {
    return this.#first(this.sb.from(T.courses).select('*').eq('id', id))
  }
  listCoursesByInstitution(institutionId) {
    return this.#one(this.sb.from(T.courses).select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }))
  }
  listPublishedCourses() {
    return this.#one(this.sb.from(T.courses).select('*').eq('published', true).order('updated_at', { ascending: false }))
  }
  async updateCourse(id, patch) {
    await this.#one(this.sb.from(T.courses).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id))
    return this.getCourse(id)
  }
  async deleteCourse(id) {
    await this.#one(this.sb.from(T.lessons).delete().eq('course_id', id))
    await this.#one(this.sb.from(T.enrollments).delete().eq('course_id', id))
    await this.#one(this.sb.from(T.courses).delete().eq('id', id))
    return true
  }

  async createLesson(r) {
    await this.#one(this.sb.from(T.lessons).insert(r))
    return this.getLesson(r.id)
  }
  getLesson(id) {
    return this.#first(this.sb.from(T.lessons).select('*').eq('id', id))
  }
  listLessons(courseId) {
    return this.#one(this.sb.from(T.lessons).select('*').eq('course_id', courseId).order('ordinal', { ascending: true }))
  }
  async updateLesson(id, patch) {
    await this.#one(this.sb.from(T.lessons).update(patch).eq('id', id))
    return this.getLesson(id)
  }
  async deleteLesson(id) {
    await this.#one(this.sb.from(T.lessons).delete().eq('id', id))
    return true
  }

  async createEnrollment(r) {
    await this.#one(this.sb.from(T.enrollments).insert(r))
    return this.getEnrollment(r.course_id, r.user_id)
  }
  getEnrollment(courseId, userId) {
    return this.#first(this.sb.from(T.enrollments).select('*').eq('course_id', courseId).eq('user_id', userId))
  }
  listEnrollmentsByUser(userId) {
    return this.#one(this.sb.from(T.enrollments).select('*').eq('user_id', userId).order('enrolled_at', { ascending: false }))
  }
  listEnrollmentsByCourse(courseId) {
    return this.#one(this.sb.from(T.enrollments).select('*').eq('course_id', courseId).order('enrolled_at', { ascending: false }))
  }
  async updateEnrollment(id, patch) {
    await this.#one(this.sb.from(T.enrollments).update(patch).eq('id', id))
    const rows = await this.#one(this.sb.from(T.enrollments).select('*').eq('id', id).limit(1))
    return rows[0] ?? null
  }

  async createCertificate(r) {
    await this.#one(this.sb.from(T.certificates).upsert(r))
    return this.getCertificate(r.code)
  }
  getCertificate(code) {
    return this.#first(this.sb.from(T.certificates).select('*').eq('code', code))
  }
}
