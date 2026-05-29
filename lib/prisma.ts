import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '@/app/generated/prisma/client'

/**
 * Prisma Client Singleton for Next.js + Neon (Prisma 7+)
 *
 * Uses the official Prisma PostgreSQL adapter + connection pooling.
 * This is the recommended approach for Prisma 7 with Neon in serverless environments.
 *
 * - In development: Reuses the same client across hot reloads
 * - In production (Vercel): Fresh client per serverless function invocation
 */

// Create a connection pool using Neon's pooled DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

// Create the Prisma adapter
const adapter = new PrismaPg(pool)

// Prisma Client with adapter
const prismaClientSingleton = () => {
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined
} & typeof global

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}

export default prisma
