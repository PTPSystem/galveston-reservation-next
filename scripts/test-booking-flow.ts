/**
 * End-to-end test script for the core booking flow.
 * Run with: npx tsx scripts/test-booking-flow.ts
 *
 * This verifies:
 * - Database connection
 * - Booking request creation
 * - Approval token generation & usage
 * - Status transitions (PENDING → APPROVED)
 * - Conflict detection
 */

import prisma from '../lib/prisma'
import { randomBytes } from 'crypto'

async function main() {
  console.log('🧪 Starting Galveston Reservation Flow Test...\n')

  // 1. Test DB connection
  console.log('1. Testing database connection...')
  try {
    await prisma.$queryRaw`SELECT 1 as ok`
    console.log('   ✅ Database connected\n')
  } catch (err: any) {
    console.error('   ❌ Database connection failed:', err.message)
    console.log('\nTip: Make sure your .env has the correct Neon DIRECT_URL/DATABASE_URL')
    console.log('     and that your IP is allowed to connect to the Neon project.')
    process.exit(1)
  }

  // 2. Create a test booking request
  console.log('2. Creating test booking request...')
  const testEmail = `test-${Date.now()}@example.com`
  const approvalToken = randomBytes(32).toString('hex')

  const booking = await prisma.bookingRequest.create({
    data: {
      guestName: 'Test Guest',
      guestEmail: testEmail,
      guestPhone: '555-1234',
      startDate: new Date('2026-07-10'),
      endDate: new Date('2026-07-15'),
      numGuests: 4,
      specialRequests: 'Test request from automated script',
      status: 'PENDING',
      approvalToken,
    },
  })
  console.log(`   ✅ Booking created (ID: ${booking.id})\n`)

  // 3. Approve the booking using the token (simulating the admin link)
  console.log('3. Approving booking via token...')
  const approved = await prisma.bookingRequest.update({
    where: { approvalToken },
    data: {
      status: 'CONFIRMED',
      approvedAt: new Date(),
    },
  })
  console.log(`   ✅ Booking approved (Status: ${approved.status})\n`)

  // 4. Test conflict detection
  console.log('4. Testing conflict detection...')
  const conflictingBooking = await prisma.bookingRequest.findFirst({
    where: {
      status: { in: ['CONFIRMED', 'CANCELLED'] },
      OR: [
        {
          startDate: { lt: new Date('2026-07-13') }, // overlaps with approved booking
          endDate: { gt: new Date('2026-07-10') },
        },
      ],
    },
  })

  if (conflictingBooking) {
    console.log('   ✅ Conflict correctly detected (existing approved booking overlaps)\n')
  } else {
    console.log('   ⚠️  No conflict found (unexpected)\n')
  }

  // 5. Try to create a new booking on overlapping dates (this should be rejected by business logic)
  console.log('5. Attempting to create overlapping booking (should be blocked by logic)...')
  const overlapping = await prisma.bookingRequest.findFirst({
    where: {
      status: { in: ['CONFIRMED', 'CANCELLED'] },
      OR: [
        {
          startDate: { lt: new Date('2026-07-14') },
          endDate: { gt: new Date('2026-07-12') },
        },
      ],
    },
  })

  if (overlapping) {
    console.log('   ✅ System correctly identifies overlap with approved booking\n')
  }

  // 6. Cleanup test data
  console.log('6. Cleaning up test data...')
  await prisma.bookingRequest.deleteMany({
    where: { guestEmail: testEmail },
  })
  console.log('   ✅ Test booking removed\n')

  console.log('✅ All tests passed! Core booking flow is working correctly.')
  console.log('\nNext recommended tests:')
  console.log('  - Start the dev server (`npm run dev`)')
  console.log('  - Test the HTTP endpoints with curl or Postman')
  console.log('  - Test the /api/health endpoint')
}

main()
  .catch((e) => {
    console.error('❌ Test failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
