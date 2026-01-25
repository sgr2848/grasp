import { verifyToken } from '@clerk/backend'
import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../types/index.js'

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // Verify the session token with Clerk
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!
    })

    if (!payload.sub) {
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    req.userId = payload.sub
    next()
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

// Optional auth - continues even without valid token
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (token) {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!
      })
      req.userId = payload.sub
    }

    next()
  } catch {
    // Continue without auth
    next()
  }
}
