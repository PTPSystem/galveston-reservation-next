import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    const all = await prisma.holidayPeriod.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const seen = new Set<string>();
    const toDelete: number[] = [];

    for (const period of all) {
      const key = `${period.startDate.toISOString()}-${period.endDate.toISOString()}`;
      
      if (seen.has(key)) {
        toDelete.push(period.id);
      } else {
        seen.add(key);
      }
    }

    if (toDelete.length === 0) {
      return NextResponse.json({ 
        success: true, 
        deleted: 0,
        message: "No duplicates found" 
      });
    }

    await prisma.holidayPeriod.deleteMany({
      where: { id: { in: toDelete } },
    });

    return NextResponse.json({ 
      success: true, 
      deleted: toDelete.length,
      message: `Removed ${toDelete.length} duplicate holiday period(s)` 
    });

  } catch (error: any) {
    console.error("Failed to clean duplicates:", error);
    
    // Helpful message for connection issues
    if (error.code === 'ECONNREFUSED' || error.message?.includes('connect')) {
      return NextResponse.json({ 
        success: false, 
        error: "Could not connect to database from the server. Please run the SQL script in Neon instead (see scripts/clean-holiday-duplicates.sql)"
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: false, 
      error: "Failed to remove duplicates" 
    }, { status: 500 });
  }
}
