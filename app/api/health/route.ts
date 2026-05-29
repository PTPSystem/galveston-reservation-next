import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * Simple health check endpoint that verifies the database connection.
 * 
 * Visit: /api/health
 */
export async function GET() {
  try {
    // Test the connection by counting records in one table
    const bookingCount = await prisma.bookingRequest.count()

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      bookingRequests: bookingCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Database connection error:', error)

    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
