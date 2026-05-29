import { sendBookingConfirmationEmail, sendQuoteEmail } from '../lib/email';

/**
 * Test script to send sample emails via Resend.
 * 
 * Usage:
 *   RESEND_API_KEY=your_key RESEND_FROM_EMAIL=onboarding@resend.dev npx tsx scripts/test-emails.ts
 */

async function main() {
  const testEmail = 'howard.shen@gmail.com';

  console.log(`\nSending test emails to: ${testEmail}\n`);

  // Test 1: New Request Confirmation
  console.log('→ Sending Booking Confirmation Email...');
  const confirmationResult = await sendBookingConfirmationEmail({
    to: testEmail,
    guestName: 'Howard Shen',
    startDate: '2026-07-10',
    endDate: '2026-07-17',
    numGuests: 4,
    bookingId: 999,
    approvalToken: 'test-token-abc123',
  });
  console.log('   Result:', confirmationResult);

  // Test 2: Quote Email (after approval)
  console.log('\n→ Sending Quote Email...');
  const quoteResult = await sendQuoteEmail({
    to: testEmail,
    guestName: 'Howard Shen',
    startDate: '2026-07-10',
    endDate: '2026-07-17',
    pricing: {
      totalGuestPrice: 4250,
      nights: 7,
      baseRateSum: 3500,
      jamaicaBeachTax: 315,
      texasStateTax: 210,
      cleaningFee: 300,
    },
    approvalToken: 'test-token-abc123',
  });
  console.log('   Result:', quoteResult);

  console.log('\n✅ Test emails sent (check your inbox / spam folder).\n');
}

main().catch((err) => {
  console.error('Error sending test emails:', err);
  process.exit(1);
});
