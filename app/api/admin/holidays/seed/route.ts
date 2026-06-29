import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { defaultHolidayPeriods } from '@/lib/constants/holidays';
import { requireAdminSession } from '@/lib/admin-auth';

export async function POST() {
  const authResult = await requireAdminSession();
  if (!authResult.ok) {
    return authResult.response;
  }

  try {
    await prisma.holidayPeriod.deleteMany();

    const data = defaultHolidayPeriods.map(h => ({
      name: h.name,
      startDate: h.startDate,
      endDate: h.endDate,
      rate: h.rate,
      notes: h.notes,
    }));

    await prisma.holidayPeriod.createMany({ data });

    return NextResponse.json({ 
      success: true, 
      count: data.length,
      message: "Default holiday periods seeded successfully" 
    });
  } catch (error) {
    console.error("Seeding failed:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to seed holidays" 
    }, { status: 500 });
  }
}
