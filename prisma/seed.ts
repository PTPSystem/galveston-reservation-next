import prisma from '../lib/prisma';

async function main() {
  console.log('🌱 Seeding holiday periods...');

  // Clear existing
  await prisma.holidayPeriod.deleteMany();

  const holidayPeriods = [
    {
      name: "Spring Break 2026",
      startDate: new Date("2026-03-07"),
      endDate: new Date("2026-03-22"),
      rate: 700,
      notes: "Major local event - very high demand",
    },
    {
      name: "Memorial Day Weekend",
      startDate: new Date("2026-05-22"),
      endDate: new Date("2026-05-25"),
      rate: 700,
      notes: "",
    },
    {
      name: "July 4th Week",
      startDate: new Date("2026-06-27"),
      endDate: new Date("2026-07-05"),
      rate: 700,
      notes: "Independence Day celebrations",
    },
    {
      name: "Labor Day Weekend",
      startDate: new Date("2026-08-28"),
      endDate: new Date("2026-08-31"),
      rate: 700,
      notes: "",
    },
    {
      name: "Thanksgiving Week",
      startDate: new Date("2026-11-21"),
      endDate: new Date("2026-11-29"),
      rate: 700,
      notes: "Includes Black Friday",
    },
    {
      name: "Christmas & New Year",
      startDate: new Date("2026-12-19"),
      endDate: new Date("2027-01-03"),
      rate: 700,
      notes: "Peak winter holiday season",
    },
    {
      name: "Galveston Mardi Gras",
      startDate: new Date("2026-02-13"),
      endDate: new Date("2026-02-17"),
      rate: 650,
      notes: "Local event - elevated demand",
    },
    {
      name: "Easter Weekend",
      startDate: new Date("2026-04-03"),
      endDate: new Date("2026-04-06"),
      rate: 700,
      notes: "",
    },
  ];

  await prisma.holidayPeriod.createMany({
    data: holidayPeriods,
  });

  console.log(`✅ Seeded ${holidayPeriods.length} holiday periods.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
