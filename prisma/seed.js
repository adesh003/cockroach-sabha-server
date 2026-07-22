import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding authentic Indian political data to PostgreSQL...');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@adesh.com' },
    update: {},
    create: {
      email: 'admin@adesh.com',
      anonymousName: '🏛 Speaker of the House',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=speaker',
      bio: 'Official Office of the Speaker — Cockroach Sabha Floor Administrator',
      college: 'Lok Sabha (Lower House)',
      role: 'ADMIN',
    },
  });

  const upscUser = await prisma.user.upsert({
    where: { email: 'upsc.aspirant@sabha.in' },
    update: {},
    create: {
      email: 'upsc.aspirant@sabha.in',
      anonymousName: '📜 UPSC 4th Attempt Veteran #402',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=upsc',
      bio: 'Pre-cleared 2 times. Fighting for exam transparency & age relaxation.',
      college: 'Central Vista Corridor',
      role: 'USER',
    },
  });

  const chaiUser = await prisma.user.upsert({
    where: { email: 'chai.analyst@sabha.in' },
    update: {},
    create: {
      email: 'chai.analyst@sabha.in',
      anonymousName: '☕ Senior Chai Stall Analyst #901',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=chai',
      bio: 'Analyzing Indian Electoral Debates one kulhad chai at a time.',
      college: 'Corner Chai Stall Parliament',
      role: 'USER',
    },
  });

  const seedPosts = [
    {
      content: '🚨 BREAKING LOK SABHA MOTION: The delay in UPSC CSE Prelims scorecard release & lack of answer key transparency before mains must be investigated by a Supreme Court Constitution bench!',
      category: 'Unemployment & UPSC',
      college: 'Lok Sabha (Lower House)',
      status: 'APPROVED',
      userId: upscUser.id,
    },
    {
      content: '☕ CHAI PE CHARCHA: Why are middle-class salaried taxpayers in India paying 30% income tax while getting zero social security or pothole-free roads? Parliament must debate tax rebates for youth!',
      category: 'Chai Pe Charcha',
      college: 'Corner Chai Stall Parliament',
      status: 'APPROVED',
      userId: chaiUser.id,
    },
    {
      content: '📜 CONSTITUTION BENCH MOTION: Free speech on college campuses and internet shutdown rules in India need strict judicial review under Article 19(1)(a).',
      category: 'Constitution & Fundamental Rights',
      college: 'Constitution Bench (Supreme Court)',
      status: 'APPROVED',
      userId: adminUser.id,
    },
    {
      content: '🗳 YOUTH ELECTORAL REFORM: Voter turnout among 18-25 youth dropped in urban centers. We need online voter registration & mobile voting booths in major IT/University hubs.',
      category: 'Youth & Electoral Reform',
      college: 'Rajya Sabha (Upper House)',
      status: 'APPROVED',
      userId: upscUser.id,
    },
    {
      content: '📢 RESIGNATION PETITION: Youth demand immediate independent inquiry into NEET/NTA exam leaks and accountability from the Ministry of Education.',
      category: 'Youth & Electoral Reform',
      college: 'Central Vista Corridor',
      status: 'APPROVED',
      userId: chaiUser.id,
    }
  ];

  for (const p of seedPosts) {
    await prisma.post.create({
      data: p,
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
