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
    const dataDir = join(__dirname, '..', '..', 'data')
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
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS connectors (
        provider TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'connected',
        account TEXT,
        tokens TEXT,
        connected_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
  }

  backend() {
    return 'sqlite'
  }

  // --- conversations ---
  async listConversations() {
    return this.db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all()
  }
  async getConversation(id) {
    return this.db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) ?? null
  }
  async createConversation(row) {
    this.db
      .prepare(
        'INSERT INTO conversations (id, title, model, created_at, updated_at) VALUES (@id, @title, @model, @created_at, @updated_at)',
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
  async listDocuments() {
    return this.db.prepare('SELECT * FROM documents ORDER BY updated_at DESC').all()
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
          'INSERT INTO documents (id, type, title, status, current_version, created_at, updated_at) VALUES (@id, @type, @title, @status, 1, @created_at, @updated_at)',
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

  // --- brains ---
  async listBrains() {
    return this.db
      .prepare('SELECT id, name, content, enabled, updated_at FROM brains ORDER BY id')
      .all()
      .map((b) => ({ ...b, enabled: Boolean(b.enabled) }))
  }
  async upsertBrain({ id, name, content, enabled, updated_at }) {
    this.db
      .prepare(
        `INSERT INTO brains (id, name, content, enabled, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, content = excluded.content,
           enabled = excluded.enabled, updated_at = excluded.updated_at`,
      )
      .run(id, name, content, enabled ? 1 : 0, updated_at)
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
}
