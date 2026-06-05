import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    let setting = await prisma.rateSetting.findFirst();

    if (!setting) {
      // Create default rates if none exist
      setting = await prisma.rateSetting.create({
        data: {
          weekdayRate: 500,
          weekendRate: 650,
          holidayRate: 700,
          weeklyDiscount: 350,
          cleaningFee: 300,
        },
      });
    }

    return NextResponse.json(setting);
  } catch (error) {
    console.error('Failed to fetch rate settings:', error);
    return NextResponse.json({ error: 'Failed to load rate settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { weekdayRate, weekendRate, holidayRate, weeklyDiscount, cleaningFee } = body;

    // Basic validation
    if (
      typeof weekdayRate !== 'number' ||
      typeof weekendRate !== 'number' ||
      typeof holidayRate !== 'number' ||
      typeof weeklyDiscount !== 'number' ||
      typeof cleaningFee !== 'number'
    ) {
      return NextResponse.json({ error: 'All rate fields are required and must be numbers' }, { status: 400 });
    }

    if (weekdayRate < 0 || weekendRate < 0 || holidayRate < 0 || weeklyDiscount < 0 || cleaningFee < 0) {
      return NextResponse.json({ error: 'Rates cannot be negative' }, { status: 400 });
    }

    let setting = await prisma.rateSetting.findFirst();

    if (setting) {
      const updated = await prisma.rateSetting.update({
        where: { id: setting.id },
        data: {
          weekdayRate,
          weekendRate,
          holidayRate,
          weeklyDiscount,
          cleaningFee,
        },
      });
      return NextResponse.json(updated);
    } else {
      const created = await prisma.rateSetting.create({
        data: {
          weekdayRate,
          weekendRate,
          holidayRate,
          weeklyDiscount,
          cleaningFee,
        },
      });
      return NextResponse.json(created);
    }
  } catch (error) {
    console.error('Failed to save rate settings:', error);
    return NextResponse.json({ error: 'Failed to save rate settings' }, { status: 500 });
  }
}
