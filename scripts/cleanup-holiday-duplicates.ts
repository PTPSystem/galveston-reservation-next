import prisma from '../lib/prisma';

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate holiday periods...');

  const all = await prisma.holidayPeriod.findMany({
    orderBy: { createdAt: 'asc' }, // keep the oldest version of each
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
    console.log('✅ No duplicates found.');
    return;
  }

  await prisma.holidayPeriod.deleteMany({
    where: { id: { in: toDelete } },
  });

  console.log(`✅ Removed ${toDelete.length} duplicate holiday period(s).`);
}

cleanupDuplicates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
