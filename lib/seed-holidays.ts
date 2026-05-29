import prisma from './prisma';
import { defaultHolidayPeriods } from './constants/holidays';

export async function seedDefaultHolidaysIfEmpty() {
  console.log('🌱 Checking for default holiday periods...');

  let seeded = false;

  for (const h of defaultHolidayPeriods) {
    const existing = await prisma.holidayPeriod.findFirst({
      where: {
        startDate: h.startDate,
        endDate: h.endDate,
      },
    });

    if (!existing) {
      await prisma.holidayPeriod.create({
        data: {
          name: h.name,
          startDate: h.startDate,
          endDate: h.endDate,
          rate: h.rate,
          notes: h.notes,
        },
      });
      seeded = true;
    }
  }

  if (seeded) {
    console.log('✅ Ensured default holiday periods exist.');
    return true;
  }

  return false;
}

export async function seedDefaultEmailSettingsIfEmpty() {
  const existing = await prisma.emailSetting.findFirst();

  if (!existing) {
    await prisma.emailSetting.create({
      data: {
        propertyManagerEmail: process.env.BOOKING_APPROVAL_EMAIL || 'livingbayfront@gmail.com',
        ownerEmail: process.env.BOOKING_APPROVAL_EMAIL || 'livingbayfront@gmail.com',
      },
    });
    console.log('✅ Seeded default email recipients.');
    return true;
  }

  return false;
}
