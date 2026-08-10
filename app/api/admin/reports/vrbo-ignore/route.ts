import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin-auth';

/**
 * Delete an unmatched VRBO payout and remember its reservation ID so future
 * CSV imports skip it.
 *
 * Body: { reservationId: string }
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    const body = await request.json();
    const reservationId =
      typeof body.reservationId === 'string' ? body.reservationId.trim() : '';

    if (!reservationId) {
      return NextResponse.json({ error: 'reservationId is required' }, { status: 400 });
    }

    const payout = await prisma.vrboPayout.findUnique({
      where: { reservationId },
      select: { reservationId: true, bookingRequestId: true },
    });

    if (payout?.bookingRequestId != null) {
      return NextResponse.json(
        {
          error:
            'This payout is already matched to a booking. Unlink it first if you want to ignore it.',
        },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.vrboIgnoredReservation.upsert({
        where: { reservationId },
        create: { reservationId },
        update: {},
      }),
      ...(payout
        ? [
            prisma.vrboPayout.delete({
              where: { reservationId },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({
      success: true,
      reservationId,
      message: `Deleted ${reservationId} and will skip it on future imports.`,
    });
  } catch (error: any) {
    console.error('VRBO ignore failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to ignore reservation' },
      { status: 500 }
    );
  }
}
