import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { storage } from './storage/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function catalog() {
  const raw = readFileSync(join(__dirname, '..', 'config', 'models.json'), 'utf8')
  return JSON.parse(raw)
}

/** Public model list for the UI — Bermi-branded, no underlying provider shown. */
export function listBermiModels() {
  return catalog().map(({ id, label, description }) => ({ id, label, description }))
}

async function customModels() {
  const raw = await storage.getSetting('custom_models')
  try {
    const parsed = JSON.parse(raw ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function listAllModels() {
  const custom = await customModels()
  return [...listBermiModels(), ...custom.map((m) => ({ ...m, custom: true }))]
}

/**
 * Resolves a UI model id to an ordered list of real OpenRouter model ids to
 * try. Bermi aliases expand to their free-first fallback chain; a custom or
 * raw provider/model id passes through unchanged.
 */
export async function resolveModelChain(uiModelId) {
  const entry = catalog().find((m) => m.id === uiModelId)
  if (entry) return entry.models
  const custom = await customModels()
  const c = custom.find((m) => m.id === uiModelId)
  if (c) return [c.model || c.id]
  // Raw OpenRouter id (advanced users) or unknown — try as-is.
  return [uiModelId]
}

export async function addCustomModel(id, label) {
  const custom = await customModels()
  if (!custom.some((m) => m.id === id) && !catalog().some((m) => m.id === id)) {
    custom.push({ id, label: label || id, description: 'Custom model', model: id })
    await storage.setSetting('custom_models', JSON.stringify(custom))
  }
  return custom
}

export async function removeCustomModel(id) {
  const custom = await customModels()
  const next = custom.filter((m) => m.id !== id)
  await storage.setSetting('custom_models', JSON.stringify(next))
  return next
}
