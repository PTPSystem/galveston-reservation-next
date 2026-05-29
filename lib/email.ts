import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

interface SendBookingConfirmationParams {
  to: string;
  guestName: string;
  startDate: string;
  endDate: string;
  numGuests: number;
  bookingId: number;
  approvalToken?: string;
}

export async function sendBookingConfirmationEmail({
  to,
  guestName,
  startDate,
  endDate,
  numGuests,
  bookingId,
  approvalToken,
}: SendBookingConfirmationParams) {
  if (!resend) {
    console.log('[Email] Resend not configured - skipping confirmation email');
    return { success: false, skipped: true };
  }

  const formattedStart = new Date(startDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const formattedEnd = new Date(endDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  try {
    const { data, error } = await resend.emails.send({
      from: 'Bayfront Retreat <bookings@yourdomain.com>', // TODO: Update with real domain when ready
      to: [to],
      subject: 'Your booking request has been received - Bayfront Retreat',
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
          <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Thank you, ${guestName.split(' ')[0]}!</h1>
          <p style="font-size: 16px; color: #374151; margin-bottom: 24px;">
            We've received your request to stay at Bayfront Retreat.
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 8px 0; font-weight: 600;">Requested Dates</p>
            <p style="margin: 0; color: #374151;">
              ${formattedStart} — ${formattedEnd}<br/>
              ${numGuests} guest${numGuests > 1 ? 's' : ''}
            </p>
          </div>

          <p style="color: #374151;">
            We will review your request and send you a personalized quote within 24 hours.
          </p>

          ${approvalToken ? `
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/${approvalToken}" 
               style="color: #059669; text-decoration: underline;">
              View your quote (once sent)
            </a>
          </p>
          ` : ''}

          <p style="color: #374151; margin-top: 24px;">
            If you have any questions in the meantime, just reply to this email.
          </p>

          <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">
            — The Bayfront Retreat Team
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Failed to send confirmation:', error);
      return { success: false, error };
    }

    console.log('[Email] Confirmation sent:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Exception sending confirmation:', err);
    return { success: false, error: err };
  }
}

interface SendQuoteEmailParams {
  to: string;
  guestName: string;
  startDate: string;
  endDate: string;
  pricing: any;
  approvalToken: string;
}

/**
 * Sends the finalized quote email to the guest after admin approval.
 */
export async function sendQuoteEmail({
  to,
  guestName,
  startDate,
  endDate,
  pricing,
  approvalToken,
}: SendQuoteEmailParams) {
  if (!resend) {
    console.log('[Email] Resend not configured - skipping quote email');
    return { success: false, skipped: true };
  }

  const formattedStart = new Date(startDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const formattedEnd = new Date(endDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const total = pricing.totalGuestPrice?.toFixed(2) ?? '—';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'bookings@yourdomain.com';

  try {
    const { data, error } = await resend.emails.send({
      from: `Bayfront Retreat <${fromEmail}>`,
      to: [to],
      subject: `Your Quote for Bayfront Retreat – ${formattedStart} to ${formattedEnd}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
          <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Hi ${guestName.split(' ')[0]},</h1>
          
          <p style="font-size: 16px; color: #374151;">
            Thank you for your interest in Bayfront Retreat. Here is your personalized quote:
          </p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0; font-weight: 600;">Stay Details</p>
            <p style="margin: 0; color: #374151;">
              ${formattedStart} → ${formattedEnd}<br/>
              ${pricing.nights || '?'} nights
            </p>

            <hr style="margin: 16px 0; border: none; border-top: 1px solid #e5e7eb;" />

            <p style="margin: 0 0 4px 0; font-weight: 600; font-size: 18px;">Total Due: <span style="color: #059669;">$${total}</span></p>
          </div>

          <p style="margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/${approvalToken}" 
               style="background-color: #059669; color: white; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: 600;">
              View Your Full Quote
            </a>
          </p>

          <p style="color: #374151; margin-top: 32px;">
            Please reply to this email or call us to confirm your stay.
          </p>

          <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">
            — The Bayfront Retreat Team
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Failed to send quote:', error);
      return { success: false, error };
    }

    console.log('[Email] Quote sent to guest:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Exception sending quote:', err);
    return { success: false, error: err };
  }
}

interface SendInternalNewRequestParams {
  recipients: string[];
  guestName: string;
  guestEmail: string;
  startDate: string;
  endDate: string;
  numGuests: number;
  bookingId: number;
  approvalToken: string;
}

/**
 * Sends a notification to internal recipients when a new booking request is submitted.
 */
export async function sendInternalNewRequestNotification({
  recipients,
  guestName,
  guestEmail,
  startDate,
  endDate,
  numGuests,
  bookingId,
  approvalToken,
}: SendInternalNewRequestParams) {
  if (!resend) {
    console.log('[Email] Resend not configured - skipping internal new request notification');
    return { success: false, skipped: true };
  }

  const formattedStart = new Date(startDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const formattedEnd = new Date(endDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'bookings@yourdomain.com';

  try {
    const { data, error } = await resend.emails.send({
      from: `Bayfront Retreat <${fromEmail}>`,
      to: recipients,
      subject: `New Booking Request: ${guestName} — ${formattedStart} to ${formattedEnd}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
          <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">New Booking Request</h1>

          <p><strong>Guest:</strong> ${guestName} (${guestEmail})</p>
          <p><strong>Dates:</strong> ${formattedStart} → ${formattedEnd}</p>
          <p><strong>Guests:</strong> ${numGuests}</p>
          <p><strong>Request ID:</strong> #${bookingId}</p>

          <p style="margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/requests/${bookingId}" 
               style="color: #059669; text-decoration: underline; font-weight: 600;">
              Review & Quote in Admin
            </a>
          </p>

          <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">
            — Bayfront Retreat System
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Failed to send internal new request notification:', error);
      return { success: false, error };
    }

    console.log('[Email] Internal new request notification sent:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Exception sending internal new request notification:', err);
    return { success: false, error: err };
  }
}

interface SendInternalConfirmationParams {
  recipients: string[];
  guestName: string;
  guestEmail: string;
  startDate: string;
  endDate: string;
  pricing: any;
  bookingId: number;
}

/**
 * Sends an internal notification to Property Manager and/or Owner
 * when a booking has been confirmed with a quote.
 */
export async function sendInternalBookingConfirmedEmail({
  recipients,
  guestName,
  guestEmail,
  startDate,
  endDate,
  pricing,
  bookingId,
}: SendInternalConfirmationParams) {
  if (!resend) {
    console.log('[Email] Resend not configured - skipping internal notification');
    return { success: false, skipped: true };
  }

  if (!recipients || recipients.length === 0) {
    console.log('[Email] No internal recipients configured');
    return { success: false, skipped: true };
  }

  const formattedStart = new Date(startDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const formattedEnd = new Date(endDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const total = pricing.totalGuestPrice?.toFixed(2) ?? '—';

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'bookings@yourdomain.com';

  try {
    const { data, error } = await resend.emails.send({
      from: `Bayfront Retreat <${fromEmail}>`,
      to: recipients,
      subject: `Booking Confirmed: ${guestName} — ${formattedStart} to ${formattedEnd}`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111827;">
          <h1 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Booking Confirmed</h1>

          <p><strong>Guest:</strong> ${guestName} (${guestEmail})</p>
          <p><strong>Dates:</strong> ${formattedStart} → ${formattedEnd}</p>
          <p><strong>Total Quote:</strong> $${total}</p>
          <p><strong>Booking ID:</strong> #${bookingId}</p>

          <p style="margin-top: 24px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/requests/${bookingId}" 
               style="color: #059669; text-decoration: underline;">
              View in Admin Dashboard
            </a>
          </p>

          <p style="margin-top: 32px; font-size: 14px; color: #6b7280;">
            — Bayfront Retreat System
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Failed to send internal confirmation:', error);
      return { success: false, error };
    }

    console.log('[Email] Internal confirmation sent:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Exception sending internal confirmation:', err);
    return { success: false, error: err };
  }
}

