import { Router } from 'express'
import { storage } from '../storage/index.js'

export const dataRouter = Router()

/**
 * Full data export — the user owns their data. Returns a single JSON document
 * with every conversation, message, document, knowledge base, and profile
 * setting for the signed-in user.
 */
dataRouter.get('/data/export', async (req, res, next) => {
  try {
    const userId = req.user.id
    const conversations = await storage.listConversations(userId)
    const withMessages = []
    for (const c of conversations) {
      withMessages.push({ ...c, messages: await storage.listMessages(c.id) })
    }
    const docs = await storage.listDocuments(userId)
    const documents = []
    for (const d of docs) {
      const versions = await storage.listDocumentVersions(d.id)
      const fullVersions = []
      for (const v of versions) {
        const row = await storage.getDocumentVersion(d.id, v.version)
        fullVersions.push({ version: v.version, created_at: v.created_at, data: row?.data })
      }
      documents.push({ ...d, versions: fullVersions })
    }
    const brains = await storage.listBrains(userId)
    const profileKeys = ['name', 'role', 'preferences']
    const profile = {}
    for (const k of profileKeys) {
      profile[k] = (await storage.getSetting(`u:${userId}:profile_${k}`)) ?? ''
    }

    const bundle = {
      exported_at: new Date().toISOString(),
      account: { id: userId, name: req.user.name, email: req.user.email },
      profile,
      conversations: withMessages,
      documents,
      knowledge_bases: brains,
    }
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', 'attachment; filename="bermi-data-export.json"')
    res.send(JSON.stringify(bundle, null, 2))
  } catch (err) {
    next(err)
  }
})

/** Delete all of the user's content but keep the account. */
dataRouter.post('/data/wipe', async (req, res, next) => {
  try {
    const userId = req.user.id
    for (const c of await storage.listConversations(userId)) {
      await storage.deleteConversation(c.id)
    }
    for (const d of await storage.listDocuments(userId)) {
      await storage.deleteDocument(d.id)
    }
    for (const b of await storage.listBrains(userId)) {
      await storage.deleteBrain(userId, b.id)
    }
    await storage.deleteSettingsByPrefix(`u:${userId}:`)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

/** Delete everything AND the account itself. */
dataRouter.post('/data/delete-account', async (req, res, next) => {
  try {
    const userId = req.user.id
    for (const c of await storage.listConversations(userId)) {
      await storage.deleteConversation(c.id)
    }
    for (const d of await storage.listDocuments(userId)) {
      await storage.deleteDocument(d.id)
    }
    for (const b of await storage.listBrains(userId)) {
      await storage.deleteBrain(userId, b.id)
    }
    await storage.deleteSettingsByPrefix(`u:${userId}:`)
    await storage.deleteUser(userId)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
