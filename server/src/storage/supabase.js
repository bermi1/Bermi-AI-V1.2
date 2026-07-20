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
}

/**
 * Supabase (Postgres) storage via the Data API. Enabled when SUPABASE_URL and
 * SUPABASE_KEY are set in the server environment. The key stays server-side;
 * prefer the service_role key in production so RLS can be locked down.
 */
export class SupabaseStorage {
  constructor(url, key) {
    this.sb = createClient(url, key, { auth: { persistSession: false } })
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
  async getUserByEmail(email) {
    const rows = await this.#one(this.sb.from(T.users).select('*').eq('email', email).limit(1))
    return rows[0] ?? null
  }
  async getUserById(id) {
    const rows = await this.#one(this.sb.from(T.users).select('*').eq('id', id).limit(1))
    return rows[0] ?? null
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

  // --- brains ---
  async listBrains() {
    return this.#one(this.sb.from(T.brains).select('*').order('id'))
  }
  async upsertBrain(brain) {
    await this.#one(this.sb.from(T.brains).upsert(brain))
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
}
