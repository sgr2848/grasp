import dotenv from 'dotenv'
dotenv.config()

import { neon, neonConfig } from '@neondatabase/serverless'
import ws from 'ws'

// Enable WebSocket for connection pooling - dramatically reduces latency
// from ~1200ms (HTTP per query) to ~50-100ms (persistent WebSocket)
neonConfig.webSocketConstructor = ws
neonConfig.poolQueryViaFetch = false // Use WebSocket for queries

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

export const sql = neon(process.env.DATABASE_URL)
