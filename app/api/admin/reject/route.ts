import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  try {
    const booking = await prisma.bookingRequest.findUnique({
      where: { approvalToken: token },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 })
    }

    if (booking.status !== 'PENDING') {
      return NextResponse.json(
        { message: `Booking is already ${booking.status.toLowerCase()}.` },
        { status: 400 }
      )
    }

    // Reject the booking
    const updated = await prisma.bookingRequest.update({
      where: { id: booking.id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Booking rejected.',
      booking: {
        id: updated.id,
        guestName: updated.guestName,
        status: updated.status,
      },
    })
  } catch (error) {
    console.error('Error rejecting booking:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
