import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { bookingRequestSchema, validateBookingDates } from '@/lib/validations/booking';
import { randomBytes } from 'crypto';
import { sendBookingConfirmationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod
    const validation = bookingRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Additional business rules
    const dateErrors = validateBookingDates({
      startDate: data.startDate,
      endDate: data.endDate,
    });

    if (dateErrors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid dates', details: dateErrors },
        { status: 400 }
      );
    }

    // Generate secure approval token
    const approvalToken = randomBytes(32).toString('hex');

    // Create the booking request
    const bookingRequest = await prisma.bookingRequest.create({
      data: {
        guestName: data.guestName,
        guestEmail: data.guestEmail,
        guestPhone: data.guestPhone || null,
        startDate: data.startDate,
        endDate: data.endDate,
        numGuests: data.numGuests,
        specialRequests: data.specialRequests || null,
        status: 'PENDING',
        approvalToken,
        source: 'DIRECT',
      },
    });

    // Send confirmation email to guest
    await sendBookingConfirmationEmail({
      to: data.guestEmail,
      guestName: data.guestName,
      startDate: data.startDate.toISOString().split('T')[0],
      endDate: data.endDate.toISOString().split('T')[0],
      numGuests: data.numGuests,
      bookingId: bookingRequest.id,
      approvalToken: approvalToken,
    });

    // TODO: Send email notification to admin with approval link

    return NextResponse.json(
      {
        success: true,
        message: 'Booking request submitted successfully.',
        bookingId: bookingRequest.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating booking request:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
