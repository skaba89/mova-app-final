import { PrismaClient } from '@prisma/client'
import path from 'path'

// Resolve DATABASE_URL to absolute path for SQLite WASM engine
function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  if (!envUrl) {
    throw new Error('DATABASE_URL non defini')
  }

  // If already an absolute file: URL (file:/path), return as-is
  if (envUrl.startsWith('file:/') && !envUrl.startsWith('file://')) {
    return envUrl
  }

  // If relative file: URL, resolve to absolute from CWD
  if (envUrl.startsWith('file:')) {
    const relativePath = envUrl.replace('file:', '')
    const absolutePath = path.resolve(process.cwd(), relativePath)
    return `file:${absolutePath}`
  }

  return envUrl
}

const databaseUrl = resolveDatabaseUrl()

// Force fresh PrismaClient (clear stale singleton from hot reloads)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

if (globalForPrisma.prisma) {
  // Disconnect old instance to avoid stale connections
  try { globalForPrisma.prisma.$disconnect() } catch { /* ignore */ }
  delete globalForPrisma.prisma
}

const prismaClient = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient
}

export const db = prismaClient
export default db
