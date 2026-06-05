import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY 
  ? new Resend(process.env.RESEND_API_KEY) 
  : null;

const fromEmail = process.env.RESEND_FROM_EMAIL || 'bookings@yourdomain.com';
const isFromEmailConfigured = fromEmail !== 'bookings@yourdomain.com';

export function getEmailConfigStatus() {
  return {
    hasApiKey: !!process.env.RESEND_API_KEY,
    fromEmail,
    isFromEmailConfigured,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  };
}

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
    console.warn('[Email] RESEND_API_KEY is missing. Emails will not be sent.');
    return { success: false, skipped: true, reason: 'missing_api_key' };
  }

  if (!isFromEmailConfigured) {
    console.error('[Email] RESEND_FROM_EMAIL is not configured (still using default). Emails will fail.');
    return { success: false, skipped: true, reason: 'invalid_from_email' };
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
      from: `Bayfront Retreat <${fromEmail}>`,
      to: [to],
      subject: 'Your booking request has been received - Bayfront Retreat',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1f2937; background-color: #ffffff;">
          <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">
            Thank you, ${guestName.split(' ')[0]}.
          </h1>
          
          <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 24px 0;">
            We've received your request to stay at Bayfront Retreat and will review it shortly.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Requested Dates</p>
            <p style="margin: 0; font-size: 15px; color: #111827;">
              <strong>${formattedStart}</strong> — <strong>${formattedEnd}</strong><br>
              ${numGuests} guest${numGuests > 1 ? 's' : ''}
            </p>
          </div>

          <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 24px 0;">
            We will review your request and send you a personalized quote within 24 hours.
          </p>

          ${approvalToken ? `
          <p style="margin: 0 0 24px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/${approvalToken}" 
               style="color: #0f766e; text-decoration: underline; font-weight: 500;">
              View your request status
            </a>
          </p>
          ` : ''}

          <p style="font-size: 14px; color: #6b7280; margin: 32px 0 0 0;">
            If you have any questions, just reply to this email.<br><br>
            — Bayfront Retreat
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
    console.warn('[Email] RESEND_API_KEY is missing. Quote email skipped.');
    return { success: false, skipped: true, reason: 'missing_api_key' };
  }

  if (!isFromEmailConfigured) {
    console.error('[Email] RESEND_FROM_EMAIL is not configured. Quote email will fail.');
    return { success: false, skipped: true, reason: 'invalid_from_email' };
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
  const base = pricing.baseRateSum?.toFixed(2) ?? '0.00';
  const nightlyAdj = pricing.nightlyAdjSum?.toFixed(2) ?? '0.00';
  const stayAdj = pricing.stayAdjSum?.toFixed(2) ?? '0.00';
  const subtotal = pricing.netAfterAdjustments?.toFixed(2) ?? total;
  const jamaicaTax = pricing.jamaicaBeachTax?.toFixed(2) ?? '0.00';
  const texasTax = pricing.texasStateTax?.toFixed(2) ?? '0.00';
  const cleaning = pricing.cleaningFee?.toFixed(2) ?? pricing.cleaning?.toFixed(2) ?? '300.00';
  const nights = pricing.nights || '?';

  try {
    const { data, error } = await resend.emails.send({
      from: `Bayfront Retreat <${fromEmail}>`,
      to: [to],
      subject: `Your Reservation is Confirmed – Bayfront Retreat`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1f2937; background-color: #ffffff;">
          <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 8px 0; color: #111827;">
            Your reservation is confirmed!
          </h1>
          
          <p style="font-size: 15px; color: #374151; margin: 0 0 24px 0;">
            Hi ${guestName.split(' ')[0]},<br><br>
            Great news — your stay at Bayfront Retreat has been confirmed.
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Confirmed Dates</p>
            <p style="margin: 0 0 16px 0; font-size: 15px; color: #111827;">
              <strong>${formattedStart}</strong> — <strong>${formattedEnd}</strong><br>
              ${nights} nights
            </p>

            <p style="margin: 0 0 8px 0; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Charge Breakdown</p>

            <table style="width: 100%; font-size: 14px; color: #374151; border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 0;">Base Rate</td>
                <td style="padding: 4px 0; text-align: right;">$${base}</td>
              </tr>
              ${parseFloat(nightlyAdj) !== 0 ? `
              <tr>
                <td style="padding: 4px 0;">Nightly Adjustments</td>
                <td style="padding: 4px 0; text-align: right;">${parseFloat(nightlyAdj) > 0 ? '+' : ''}$${nightlyAdj}</td>
              </tr>` : ''}
              ${parseFloat(stayAdj) !== 0 ? `
              <tr>
                <td style="padding: 4px 0;">Stay Adjustments</td>
                <td style="padding: 4px 0; text-align: right;">${parseFloat(stayAdj) > 0 ? '+' : ''}$${stayAdj}</td>
              </tr>` : ''}
              <tr style="border-top: 1px solid #e5e7eb;">
                <td style="padding: 8px 0 4px 0; font-weight: 500;">Subtotal after Adjustments</td>
                <td style="padding: 8px 0 4px 0; text-align: right; font-weight: 500;">$${subtotal}</td>
              </tr>
              ${parseFloat(jamaicaTax) > 0 ? `
              <tr>
                <td style="padding: 4px 0;">Jamaica Beach Tax (9%)</td>
                <td style="padding: 4px 0; text-align: right;">$${jamaicaTax}</td>
              </tr>` : ''}
              ${parseFloat(texasTax) > 0 ? `
              <tr>
                <td style="padding: 4px 0;">Texas State Tax (6%)</td>
                <td style="padding: 4px 0; text-align: right;">$${texasTax}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 4px 0;">Cleaning Fee</td>
                <td style="padding: 4px 0; text-align: right;">$${cleaning}</td>
              </tr>
              <tr style="border-top: 2px solid #111827; font-weight: 600; font-size: 15px;">
                <td style="padding: 10px 0 4px 0;">Total Charged</td>
                <td style="padding: 10px 0 4px 0; text-align: right;">$${total}</td>
              </tr>
            </table>
          </div>

          <p style="margin: 0 0 24px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/booking/${approvalToken}" 
               style="display: inline-block; background-color: #0f766e; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
              View Full Details &amp; Manage Booking
            </a>
          </p>

          <p style="font-size: 14px; color: #4b5563; margin: 0;">
            If you have any questions, just reply to this email. We look forward to hosting you!
          </p>

          <p style="font-size: 13px; color: #9ca3af; margin-top: 32px;">
            — Bayfront Retreat
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
    console.warn('[Email] RESEND_API_KEY is missing. Internal notification skipped.');
    return { success: false, skipped: true, reason: 'missing_api_key' };
  }

  if (!isFromEmailConfigured) {
    console.error('[Email] RESEND_FROM_EMAIL is not configured. Internal notification will fail.');
    return { success: false, skipped: true, reason: 'invalid_from_email' };
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
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 24px; color: #1f2937; background-color: #ffffff;">
          <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">
            New Booking Request
          </h1>

          <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Guest</p>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #111827;">${guestName} (${guestEmail})</p>

            <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Dates</p>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #111827;">${formattedStart} → ${formattedEnd}</p>

            <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Guests</p>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #111827;">${numGuests}</p>

            <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Request ID</p>
            <p style="margin: 0; font-size: 15px; color: #111827;">#${bookingId}</p>
          </div>

          <p style="margin: 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/requests/${bookingId}" 
               style="color: #0f766e; text-decoration: underline; font-weight: 500;">
              Review &amp; Quote in Admin
            </a>
          </p>

          <p style="font-size: 13px; color: #9ca3af; margin-top: 28px;">
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
    console.warn('[Email] RESEND_API_KEY is missing. Internal confirmation skipped.');
    return { success: false, skipped: true, reason: 'missing_api_key' };
  }

  if (!isFromEmailConfigured) {
    console.error('[Email] RESEND_FROM_EMAIL is not configured. Internal confirmation will fail.');
    return { success: false, skipped: true, reason: 'invalid_from_email' };
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
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px 24px; color: #1f2937; background-color: #ffffff;">
          <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">
            Booking Confirmed
          </h1>

          <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Guest</p>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #111827;">${guestName} (${guestEmail})</p>

            <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Dates</p>
            <p style="margin: 0 0 12px 0; font-size: 15px; color: #111827;">${formattedStart} → ${formattedEnd}</p>

            <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Total Quote</p>
            <p style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; color: #111827;">$${total}</p>

            <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Booking ID</p>
            <p style="margin: 0; font-size: 15px; color: #111827;">#${bookingId}</p>
          </div>

          <p style="margin: 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/admin/requests/${bookingId}" 
               style="color: #0f766e; text-decoration: underline; font-weight: 500;">
              View in Admin Dashboard
            </a>
          </p>

          <p style="font-size: 13px; color: #9ca3af; margin-top: 28px;">
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

interface SendInviteParams {
  to: string;
  inviteLink: string;
  inviterName?: string;
  role: string;
}

export async function sendInviteEmail({
  to,
  inviteLink,
  inviterName,
  role,
}: SendInviteParams) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY is missing. Invite email skipped.');
    return { success: false, skipped: true, reason: 'missing_api_key' };
  }

  if (!isFromEmailConfigured) {
    console.error('[Email] RESEND_FROM_EMAIL is not configured. Invite email will fail.');
    return { success: false, skipped: true, reason: 'invalid_from_email' };
  }

  const roleLabel =
    role === "ADMIN"
      ? "Admin"
      : role === "OWNER"
      ? "Owner"
      : "Property Manager";

  try {
    const { data, error } = await resend.emails.send({
      from: `Bayfront Retreat <${fromEmail}>`,
      to: [to],
      subject: `Invitation to Bayfront Retreat Admin (${roleLabel})`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1f2937; background-color: #ffffff;">
          <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px 0; color: #111827;">
            You're invited to Bayfront Retreat Admin
          </h1>
          
          <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 24px 0;">
            ${inviterName ? `${inviterName} has invited you` : "You have been invited"} to join as <strong>${roleLabel}</strong>.
          </p>

          <p style="font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 24px 0;">
            Click the button below to set your password and activate your account.
          </p>

          <p style="margin: 0 0 24px 0;">
            <a href="${inviteLink}" 
               style="display: inline-block; background-color: #0f766e; color: white; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px;">
              Accept Invitation &amp; Set Password
            </a>
          </p>

          <p style="font-size: 14px; color: #4b5563; margin: 0;">
            This link will expire in 7 days. If you did not expect this invitation, you can ignore this email.
          </p>

          <p style="font-size: 13px; color: #9ca3af; margin-top: 32px;">
            — Bayfront Retreat
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Failed to send invite:', error);
      return { success: false, error };
    }

    console.log('[Email] Invite sent:', data?.id);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Exception sending invite:', err);
    return { success: false, error: err };
  }
}

interface SendVerificationCodeParams {
  to: string;
  code: string;
}

export async function sendVerificationCodeEmail({
  to,
  code,
}: SendVerificationCodeParams) {
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY is missing. Verification code skipped.');
    return { success: false, skipped: true, reason: 'missing_api_key' };
  }

  if (!isFromEmailConfigured) {
    console.error('[Email] RESEND_FROM_EMAIL is not configured.');
    return { success: false, skipped: true, reason: 'invalid_from_email' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: `Bayfront Retreat <${fromEmail}>`,
      to: [to],
      subject: `Your verification code: ${code}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 24px; color: #1f2937;">
          <p style="font-size: 15px;">Your verification code is:</p>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${code}</p>
          <p style="font-size: 13px; color: #6b7280;">This code expires in 10 minutes.</p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email] Failed to send code:', error);
      return { success: false, error };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error('[Email] Exception sending code:', err);
    return { success: false, error: err };
  }
}

