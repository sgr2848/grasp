import { Router } from 'express'
import { workspaceQueries, subjectQueries, userQueries } from '../db/queries.js'
import { authMiddleware } from '../middleware/auth.js'
import type { AuthRequest, CreateWorkspaceInput, UpdateWorkspaceInput, CreateSubjectInput, UpdateSubjectInput } from '../types/index.js'

const router = Router()

// GET /api/workspaces - List all workspaces for user
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const workspaces = await workspaceQueries.findByUserId(req.userId!)
    res.json(workspaces)
  } catch (error) {
    console.error('Workspaces fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch workspaces' })
  }
})

// GET /api/workspaces/:id - Get single workspace with subjects
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string
    const workspace = await workspaceQueries.findById(id, req.userId!)
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    const subjects = await subjectQueries.findByWorkspaceId(workspace.id)
    res.json({ ...workspace, subjects })
  } catch (error) {
    console.error('Workspace fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch workspace' })
  }
})

// POST /api/workspaces - Create new workspace
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const input = req.body as CreateWorkspaceInput
    if (!input.name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }

    await userQueries.upsert(req.userId!)

    const workspace = await workspaceQueries.create({
      userId: req.userId!,
      name: input.name,
      description: input.description
    })

    res.status(201).json(workspace)
  } catch (error) {
    console.error('Workspace create error:', error)
    res.status(500).json({ error: 'Failed to create workspace' })
  }
})

// PATCH /api/workspaces/:id - Update workspace
router.patch('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string
    const input = req.body as UpdateWorkspaceInput
    const workspace = await workspaceQueries.update(id, req.userId!, input)

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    res.json(workspace)
  } catch (error) {
    console.error('Workspace update error:', error)
    res.status(500).json({ error: 'Failed to update workspace' })
  }
})

// DELETE /api/workspaces/:id - Delete workspace
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string
    const deleted = await workspaceQueries.delete(id, req.userId!)
    if (!deleted) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }
    res.status(204).send()
  } catch (error) {
    console.error('Workspace delete error:', error)
    res.status(500).json({ error: 'Failed to delete workspace' })
  }
})

// === Subject routes nested under workspace ===

// GET /api/workspaces/:id/subjects - List subjects in workspace
router.get('/:id/subjects', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string
    const workspace = await workspaceQueries.findById(id, req.userId!)
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    const subjects = await subjectQueries.findByWorkspaceId(workspace.id)
    res.json(subjects)
  } catch (error) {
    console.error('Subjects fetch error:', error)
    res.status(500).json({ error: 'Failed to fetch subjects' })
  }
})

// POST /api/workspaces/:id/subjects - Create subject in workspace
router.post('/:id/subjects', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string
    const workspace = await workspaceQueries.findById(id, req.userId!)
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    const input = req.body as Omit<CreateSubjectInput, 'workspaceId'>
    if (!input.name) {
      res.status(400).json({ error: 'Name is required' })
      return
    }

    const subject = await subjectQueries.create({
      workspaceId: workspace.id,
      name: input.name,
      description: input.description
    })

    res.status(201).json(subject)
  } catch (error) {
    console.error('Subject create error:', error)
    res.status(500).json({ error: 'Failed to create subject' })
  }
})

// PATCH /api/workspaces/:workspaceId/subjects/:subjectId - Update subject
router.patch('/:workspaceId/subjects/:subjectId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.workspaceId as string
    const subjectId = req.params.subjectId as string
    const workspace = await workspaceQueries.findById(workspaceId, req.userId!)
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    const input = req.body as UpdateSubjectInput
    const subject = await subjectQueries.update(subjectId, input)

    if (!subject) {
      res.status(404).json({ error: 'Subject not found' })
      return
    }

    res.json(subject)
  } catch (error) {
    console.error('Subject update error:', error)
    res.status(500).json({ error: 'Failed to update subject' })
  }
})

// DELETE /api/workspaces/:workspaceId/subjects/:subjectId - Delete subject
router.delete('/:workspaceId/subjects/:subjectId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const workspaceId = req.params.workspaceId as string
    const subjectId = req.params.subjectId as string
    const workspace = await workspaceQueries.findById(workspaceId, req.userId!)
    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' })
      return
    }

    const deleted = await subjectQueries.delete(subjectId)
    if (!deleted) {
      res.status(404).json({ error: 'Subject not found' })
      return
    }
    res.status(204).send()
  } catch (error) {
    console.error('Subject delete error:', error)
    res.status(500).json({ error: 'Failed to delete subject' })
  }
})

export default router
