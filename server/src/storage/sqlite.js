import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Local SQLite storage — the zero-config default. Same async interface as
 * SupabaseStorage so routes never care which backend is active.
 */
export class SqliteStorage {
  constructor() {
    // Serverless filesystems are read-only outside /tmp (and ephemeral —
    // Supabase should be the backend there; this is a non-crashing fallback).
    const dataDir = process.env.VERCEL
      ? '/tmp/bermi-data'
      : join(__dirname, '..', '..', 'data')
    mkdirSync(dataDir, { recursive: true })
    this.db = new Database(join(dataDir, 'bermi.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        model TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages(conversation_id, created_at);
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
        current_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS document_versions (
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (document_id, version)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS brains (
        user_id TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, id)
      );
      CREATE TABLE IF NOT EXISTS connectors (
        provider TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'connected',
        account TEXT,
        tokens TEXT,
        connected_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        verify_code TEXT,
        verify_expires TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS institutions (
        id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE, about TEXT DEFAULT '', logo_url TEXT, website TEXT,
        published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY, institution_id TEXT NOT NULL, title TEXT NOT NULL, slug TEXT NOT NULL,
        summary TEXT DEFAULT '', description TEXT DEFAULT '', cover_emoji TEXT DEFAULT '📘',
        level TEXT DEFAULT 'All levels', published INTEGER NOT NULL DEFAULT 0,
        enrollment TEXT NOT NULL DEFAULT 'open',
        objectives TEXT DEFAULT '', evaluation TEXT DEFAULT '', tracking TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY, course_id TEXT NOT NULL, ordinal INTEGER NOT NULL DEFAULT 0,
        title TEXT NOT NULL, content TEXT DEFAULT '', material TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS enrollments (
        id TEXT PRIMARY KEY, course_id TEXT NOT NULL, user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'enrolled', progress TEXT NOT NULL DEFAULT '{}', score REAL,
        enrolled_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT,
        UNIQUE (course_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS certificates (
        code TEXT PRIMARY KEY, course_id TEXT NOT NULL, user_id TEXT NOT NULL,
        learner_name TEXT NOT NULL, course_title TEXT NOT NULL, institution_name TEXT NOT NULL,
        score REAL, issued_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
    // Older databases predate per-user scoping / email verification.
    const migrations = [
      'ALTER TABLE conversations ADD COLUMN user_id TEXT',
      'ALTER TABLE documents ADD COLUMN user_id TEXT',
      'ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0',
      'ALTER TABLE users ADD COLUMN verify_code TEXT',
      'ALTER TABLE users ADD COLUMN verify_expires TEXT',
      "ALTER TABLE courses ADD COLUMN objectives TEXT DEFAULT ''",
      "ALTER TABLE courses ADD COLUMN evaluation TEXT DEFAULT ''",
      "ALTER TABLE courses ADD COLUMN tracking TEXT DEFAULT ''",
    ]
    for (const sql of migrations) {
      try {
        this.db.exec(sql)
      } catch {
        /* column already exists */
      }
    }
  }

  backend() {
    return 'sqlite'
  }

  // --- users & sessions ---
  async createUser(row) {
    this.db
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, email_verified, verify_code, verify_expires, created_at)
         VALUES (@id, @name, @email, @password_hash, @email_verified, @verify_code, @verify_expires, @created_at)`,
      )
      .run({
        verify_code: null,
        verify_expires: null,
        ...row,
        email_verified: row.email_verified ? 1 : 0,
      })
    return row
  }
  async upsertUser(row) {
    this.db
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, email_verified, created_at)
         VALUES (@id, @name, @email, @password_hash, @email_verified, @created_at)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email,
           email_verified = excluded.email_verified`,
      )
      .run({ password_hash: null, ...row, email_verified: row.email_verified ? 1 : 0 })
    return row
  }
  async updateUser(id, patch) {
    const allowed = ['name', 'email_verified', 'verify_code', 'verify_expires', 'password_hash']
    const keys = Object.keys(patch).filter((k) => allowed.includes(k))
    if (keys.length === 0) return this.getUserById(id)
    const sets = keys.map((k) => `${k} = @${k}`).join(', ')
    const values = { ...patch, id }
    if ('email_verified' in values) values.email_verified = values.email_verified ? 1 : 0
    this.db.prepare(`UPDATE users SET ${sets} WHERE id = @id`).run(values)
    return this.getUserById(id)
  }
  async getUserByEmail(email) {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) ?? null
  }
  async getUserById(id) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null
  }
  async listUsers() {
    return this.db
      .prepare('SELECT id, name, email, email_verified, created_at FROM users ORDER BY created_at DESC')
      .all()
      .map((u) => ({ ...u, email_verified: Boolean(u.email_verified) }))
  }
  async adminStats() {
    const count = (t) => {
      try {
        return this.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
      } catch {
        return 0
      }
    }
    return {
      users: count('users'),
      conversations: count('conversations'),
      messages: count('messages'),
      documents: count('documents'),
      institutions: count('institutions'),
      courses: count('courses'),
      enrollments: count('enrollments'),
      certificates: count('certificates'),
    }
  }
  async createSession(row) {
    this.db
      .prepare(
        'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (@token, @user_id, @created_at, @expires_at)',
      )
      .run(row)
  }
  async getSession(token) {
    return this.db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) ?? null
  }
  async deleteSession(token) {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }

  // --- conversations ---
  async listConversations(userId) {
    return this.db
      .prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId)
  }
  async getConversation(id) {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) ?? null
  }
  async createConversation(row) {
    this.db
      .prepare(
        'INSERT INTO conversations (id, user_id, title, model, created_at, updated_at) VALUES (@id, @user_id, @title, @model, @created_at, @updated_at)',
      )
      .run(row)
    return row
  }
  async updateConversation(id, { title, model, updated_at }) {
    const cur = await this.getConversation(id)
    if (!cur) return null
    this.db
      .prepare('UPDATE conversations SET title = ?, model = ?, updated_at = ? WHERE id = ?')
      .run(title ?? cur.title, model ?? cur.model, updated_at ?? cur.updated_at, id)
    return this.getConversation(id)
  }
  async deleteConversation(id) {
    return this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id).changes > 0
  }

  // --- messages ---
  async listMessages(conversationId) {
    return this.db
      .prepare(
        'SELECT id, role, content, model, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at, rowid',
      )
      .all(conversationId)
  }
  async addMessage(row) {
    this.db
      .prepare(
        'INSERT INTO messages (id, conversation_id, role, content, model, created_at) VALUES (@id, @conversation_id, @role, @content, @model, @created_at)',
      )
      .run({ model: null, ...row })
  }

  // --- documents ---
  async listDocuments(userId) {
    return this.db
      .prepare('SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId)
  }
  async getDocument(id) {
    return this.db.prepare('SELECT * FROM documents WHERE id = ?').get(id) ?? null
  }
  async countDocuments(type) {
    return this.db.prepare('SELECT COUNT(*) AS n FROM documents WHERE type = ?').get(type).n
  }
  async createDocument(row, data) {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO documents (id, user_id, type, title, status, current_version, created_at, updated_at) VALUES (@id, @user_id, @type, @title, @status, 1, @created_at, @updated_at)',
        )
        .run(row)
      this.db
        .prepare(
          'INSERT INTO document_versions (document_id, version, data, created_at) VALUES (?, 1, ?, ?)',
        )
        .run(row.id, JSON.stringify(data), row.created_at)
    })
    tx()
  }
  async addDocumentVersion(id, { version, data, title, status, updated_at }) {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO document_versions (document_id, version, data, created_at) VALUES (?, ?, ?, ?)',
        )
        .run(id, version, JSON.stringify(data), updated_at)
      this.db
        .prepare(
          'UPDATE documents SET current_version = ?, title = ?, status = ?, updated_at = ? WHERE id = ?',
        )
        .run(version, title, status, updated_at, id)
    })
    tx()
  }
  async getDocumentVersion(id, version) {
    const row = this.db
      .prepare('SELECT * FROM document_versions WHERE document_id = ? AND version = ?')
      .get(id, version)
    return row ? { ...row, data: JSON.parse(row.data) } : null
  }
  async listDocumentVersions(id) {
    return this.db
      .prepare(
        'SELECT version, created_at FROM document_versions WHERE document_id = ? ORDER BY version DESC',
      )
      .all(id)
  }
  async deleteDocument(id) {
    return this.db.prepare('DELETE FROM documents WHERE id = ?').run(id).changes > 0
  }

  // --- settings ---
  async getSetting(key) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return row ? row.value : null
  }
  async setSetting(key, value) {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value)
  }
  async deleteSetting(key) {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key)
  }
  async deleteSettingsByPrefix(prefix) {
    this.db.prepare('DELETE FROM settings WHERE key LIKE ?').run(prefix + '%')
  }
  async deleteUser(id) {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id)
  }

  // --- brains (per user) ---
  async listBrains(userId) {
    return this.db
      .prepare(
        'SELECT id, name, content, enabled, updated_at FROM brains WHERE user_id = ? ORDER BY rowid',
      )
      .all(userId)
      .map((b) => ({ ...b, enabled: Boolean(b.enabled) }))
  }
  async upsertBrain(userId, { id, name, content, enabled, updated_at }) {
    this.db
      .prepare(
        `INSERT INTO brains (user_id, id, name, content, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, id) DO UPDATE SET name = excluded.name, content = excluded.content,
           enabled = excluded.enabled, updated_at = excluded.updated_at`,
      )
      .run(userId, id, name, content, enabled ? 1 : 0, updated_at)
  }
  async deleteBrain(userId, id) {
    return (
      this.db.prepare('DELETE FROM brains WHERE user_id = ? AND id = ?').run(userId, id).changes > 0
    )
  }

  // --- connectors ---
  async listConnectors() {
    return this.db
      .prepare('SELECT provider, status, account, connected_at FROM connectors')
      .all()
  }
  async getConnector(provider) {
    const row = this.db.prepare('SELECT * FROM connectors WHERE provider = ?').get(provider)
    return row ? { ...row, tokens: row.tokens ? JSON.parse(row.tokens) : null } : null
  }
  async upsertConnector({ provider, status, account, tokens, connected_at }) {
    this.db
      .prepare(
        `INSERT INTO connectors (provider, status, account, tokens, connected_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(provider) DO UPDATE SET status = excluded.status, account = excluded.account,
           tokens = excluded.tokens, connected_at = excluded.connected_at`,
      )
      .run(provider, status, account ?? null, tokens ? JSON.stringify(tokens) : null, connected_at)
  }
  async deleteConnector(provider) {
    return this.db.prepare('DELETE FROM connectors WHERE provider = ?').run(provider).changes > 0
  }

  // --- LMS (Bermi Learn) ---
  #toBool(row, keys) {
    if (!row) return row
    for (const k of keys) if (k in row) row[k] = Boolean(row[k])
    return row
  }
  async createInstitution(r) {
    this.db.prepare(
      `INSERT INTO institutions (id, owner_id, name, slug, about, logo_url, website, published, created_at)
       VALUES (@id,@owner_id,@name,@slug,@about,@logo_url,@website,@published,@created_at)`,
    ).run({ about: '', logo_url: null, website: null, published: 1, ...r, published: r.published ? 1 : 0 })
    return this.getInstitution(r.id)
  }
  async getInstitution(id) {
    return this.#toBool(this.db.prepare('SELECT * FROM institutions WHERE id = ?').get(id), ['published'])
  }
  async getInstitutionBySlug(slug) {
    return this.#toBool(this.db.prepare('SELECT * FROM institutions WHERE slug = ?').get(slug), ['published'])
  }
  async listInstitutionsByOwner(ownerId) {
    return this.db.prepare('SELECT * FROM institutions WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId)
  }
  async listPublishedInstitutions() {
    return this.db.prepare('SELECT * FROM institutions WHERE published = 1 ORDER BY created_at DESC').all()
  }
  async updateInstitution(id, patch) {
    const cur = await this.getInstitution(id); if (!cur) return null
    const m = {
      id,
      name: patch.name ?? cur.name,
      about: patch.about ?? cur.about,
      logo_url: patch.logo_url ?? cur.logo_url,
      website: patch.website ?? cur.website,
      published: (patch.published ?? cur.published) ? 1 : 0,
    }
    this.db.prepare('UPDATE institutions SET name=@name, about=@about, logo_url=@logo_url, website=@website, published=@published WHERE id=@id').run(m)
    return this.getInstitution(id)
  }

  async createCourse(r) {
    this.db.prepare(
      `INSERT INTO courses (id, institution_id, title, slug, summary, description, cover_emoji, level, published, enrollment, objectives, evaluation, tracking, created_at, updated_at)
       VALUES (@id,@institution_id,@title,@slug,@summary,@description,@cover_emoji,@level,@published,@enrollment,@objectives,@evaluation,@tracking,@created_at,@updated_at)`,
    ).run({ summary: '', description: '', cover_emoji: '📘', level: 'All levels', enrollment: 'open', objectives: '', evaluation: '', tracking: '', ...r, published: r.published ? 1 : 0 })
    return this.getCourse(r.id)
  }
  async getCourse(id) {
    return this.#toBool(this.db.prepare('SELECT * FROM courses WHERE id = ?').get(id), ['published'])
  }
  async listCoursesByInstitution(institutionId) {
    return this.db.prepare('SELECT * FROM courses WHERE institution_id = ? ORDER BY created_at DESC').all(institutionId).map((c) => this.#toBool(c, ['published']))
  }
  async listPublishedCourses() {
    return this.db.prepare('SELECT * FROM courses WHERE published = 1 ORDER BY updated_at DESC').all().map((c) => this.#toBool(c, ['published']))
  }
  async updateCourse(id, patch) {
    const cur = await this.getCourse(id); if (!cur) return null
    const m = {
      id,
      title: patch.title ?? cur.title,
      summary: patch.summary ?? cur.summary,
      description: patch.description ?? cur.description,
      cover_emoji: patch.cover_emoji ?? cur.cover_emoji,
      level: patch.level ?? cur.level,
      published: (patch.published ?? cur.published) ? 1 : 0,
      enrollment: patch.enrollment ?? cur.enrollment,
      objectives: patch.objectives ?? cur.objectives ?? '',
      evaluation: patch.evaluation ?? cur.evaluation ?? '',
      tracking: patch.tracking ?? cur.tracking ?? '',
      updated_at: new Date().toISOString(),
    }
    this.db.prepare('UPDATE courses SET title=@title, summary=@summary, description=@description, cover_emoji=@cover_emoji, level=@level, published=@published, enrollment=@enrollment, objectives=@objectives, evaluation=@evaluation, tracking=@tracking, updated_at=@updated_at WHERE id=@id').run(m)
    return this.getCourse(id)
  }
  async deleteCourse(id) {
    this.db.prepare('DELETE FROM lessons WHERE course_id = ?').run(id)
    this.db.prepare('DELETE FROM enrollments WHERE course_id = ?').run(id)
    return this.db.prepare('DELETE FROM courses WHERE id = ?').run(id).changes > 0
  }

  async createLesson(r) {
    this.db.prepare('INSERT INTO lessons (id, course_id, ordinal, title, content, material, created_at) VALUES (@id,@course_id,@ordinal,@title,@content,@material,@created_at)')
      .run({ ordinal: 0, content: '', material: '', ...r })
    return this.getLesson(r.id)
  }
  async getLesson(id) {
    return this.db.prepare('SELECT * FROM lessons WHERE id = ?').get(id) ?? null
  }
  async listLessons(courseId) {
    return this.db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY ordinal, created_at').all(courseId)
  }
  async updateLesson(id, patch) {
    const cur = await this.getLesson(id); if (!cur) return null
    const m = {
      id,
      title: patch.title ?? cur.title,
      content: patch.content ?? cur.content,
      material: patch.material ?? cur.material,
      ordinal: patch.ordinal ?? cur.ordinal,
    }
    this.db.prepare('UPDATE lessons SET title=@title, content=@content, material=@material, ordinal=@ordinal WHERE id=@id').run(m)
    return this.getLesson(id)
  }
  async deleteLesson(id) {
    return this.db.prepare('DELETE FROM lessons WHERE id = ?').run(id).changes > 0
  }

  async createEnrollment(r) {
    this.db.prepare('INSERT INTO enrollments (id, course_id, user_id, status, progress, score, enrolled_at) VALUES (@id,@course_id,@user_id,@status,@progress,@score,@enrolled_at)')
      .run({ status: 'enrolled', progress: '{}', score: null, ...r, progress: JSON.stringify(r.progress ?? {}) })
    return this.getEnrollment(r.course_id, r.user_id)
  }
  async getEnrollment(courseId, userId) {
    const row = this.db.prepare('SELECT * FROM enrollments WHERE course_id = ? AND user_id = ?').get(courseId, userId)
    return row ? { ...row, progress: JSON.parse(row.progress || '{}') } : null
  }
  async listEnrollmentsByUser(userId) {
    return this.db.prepare('SELECT * FROM enrollments WHERE user_id = ? ORDER BY enrolled_at DESC').all(userId).map((r) => ({ ...r, progress: JSON.parse(r.progress || '{}') }))
  }
  async listEnrollmentsByCourse(courseId) {
    return this.db.prepare('SELECT * FROM enrollments WHERE course_id = ? ORDER BY enrolled_at DESC').all(courseId).map((r) => ({ ...r, progress: JSON.parse(r.progress || '{}') }))
  }
  async updateEnrollment(id, patch) {
    const row = this.db.prepare('SELECT * FROM enrollments WHERE id = ?').get(id); if (!row) return null
    const m = {
      id,
      status: patch.status ?? row.status,
      progress: JSON.stringify(patch.progress ?? JSON.parse(row.progress || '{}')),
      score: patch.score ?? row.score ?? null,
      completed_at: patch.completed_at ?? row.completed_at ?? null,
    }
    this.db.prepare('UPDATE enrollments SET status=@status, progress=@progress, score=@score, completed_at=@completed_at WHERE id=@id').run(m)
    const out = this.db.prepare('SELECT * FROM enrollments WHERE id = ?').get(id)
    return { ...out, progress: JSON.parse(out.progress || '{}') }
  }

  async createCertificate(r) {
    this.db.prepare('INSERT OR REPLACE INTO certificates (code, course_id, user_id, learner_name, course_title, institution_name, score, issued_at) VALUES (@code,@course_id,@user_id,@learner_name,@course_title,@institution_name,@score,@issued_at)').run(r)
    return this.getCertificate(r.code)
  }
  async getCertificate(code) {
    return this.db.prepare('SELECT * FROM certificates WHERE code = ?').get(code) ?? null
  }
}
