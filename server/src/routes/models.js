import { Router } from 'express'
import { addCustomModel, listAllModels, removeCustomModel } from '../models.js'

export const modelsRouter = Router()

// Bermi-branded models (free-first, provider hidden) plus any custom ones.
modelsRouter.get('/models', async (_req, res, next) => {
  try {
    res.json(await listAllModels())
  } catch (err) {
    next(err)
  }
})

modelsRouter.post('/models/custom', async (req, res, next) => {
  try {
    const { id, label } = req.body ?? {}
    if (typeof id !== 'string' || !id.includes('/')) {
      return res
        .status(400)
        .json({ error: 'Model id must look like provider/model, e.g. mistralai/mistral-large' })
    }
    res.status(201).json(await addCustomModel(id, label?.trim()))
  } catch (err) {
    next(err)
  }
})

modelsRouter.delete('/models/custom', async (req, res, next) => {
  try {
    res.json(await removeCustomModel(req.query.id))
  } catch (err) {
    next(err)
  }
})
