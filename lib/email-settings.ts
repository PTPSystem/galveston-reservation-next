import prisma from './prisma';

export interface EmailRecipients {
  propertyManagerEmail: string;
  ownerEmail: string;
}

/**
 * Get the current email recipients (Property Manager + Owner).
 * Falls back to a default if no settings exist in the database.
 */
export async function getEmailRecipients(): Promise<EmailRecipients> {
  const setting = await prisma.emailSetting.findFirst();

  if (setting) {
    return {
      propertyManagerEmail: setting.propertyManagerEmail,
      ownerEmail: setting.ownerEmail,
    };
  }

  // Default fallback (from .env.example)
  return {
    propertyManagerEmail: process.env.BOOKING_APPROVAL_EMAIL || 'livingbayfront@gmail.com',
    ownerEmail: process.env.BOOKING_APPROVAL_EMAIL || 'livingbayfront@gmail.com',
  };
}

/**
 * Update the email recipients.
 */
export async function updateEmailRecipients(data: EmailRecipients): Promise<EmailRecipients> {
  const existing = await prisma.emailSetting.findFirst();

  if (existing) {
    const updated = await prisma.emailSetting.update({
      where: { id: existing.id },
      data: {
        propertyManagerEmail: data.propertyManagerEmail,
        ownerEmail: data.ownerEmail,
      },
    });

    return {
      propertyManagerEmail: updated.propertyManagerEmail,
      ownerEmail: updated.ownerEmail,
    };
  } else {
    const created = await prisma.emailSetting.create({
      data: {
        propertyManagerEmail: data.propertyManagerEmail,
        ownerEmail: data.ownerEmail,
      },
    });

    return {
      propertyManagerEmail: created.propertyManagerEmail,
      ownerEmail: created.ownerEmail,
    };
  }
}
