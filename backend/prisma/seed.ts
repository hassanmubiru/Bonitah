import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create a sample course for testing certificate issuance
  const course = await prisma.course.upsert({
    where: {
      onChainId: '0x0000000000000000000000000000000000000000000000000000000000000001',
    },
    update: {},
    create: {
      title: 'Financial Literacy Basics',
      onChainId: '0x0000000000000000000000000000000000000000000000000000000000000001',
      lessons: {
        create: [
          {
            title: 'Introduction to Budgeting',
            order: 1,
            contentType: 'article',
            contentUrl: '/content/articles/budgeting-intro.md',
          },
          {
            title: 'Understanding Savings Accounts',
            order: 2,
            contentType: 'video',
            contentUrl: '/content/videos/savings-accounts.mp4',
          },
          {
            title: 'Investment Basics Quiz',
            order: 3,
            contentType: 'quiz',
            contentUrl: '/content/quizzes/investment-basics.json',
          },
        ],
      },
    },
    include: {
      lessons: true,
    },
  });

  console.log('Created course:', course.title);

  // Create another sample course
  const advancedCourse = await prisma.course.upsert({
    where: {
      onChainId: '0x0000000000000000000000000000000000000000000000000000000000000002',
    },
    update: {},
    create: {
      title: 'Advanced DeFi Strategies',
      onChainId: '0x0000000000000000000000000000000000000000000000000000000000000002',
      lessons: {
        create: [
          {
            title: 'Understanding Liquidity Pools',
            order: 1,
            contentType: 'article',
            contentUrl: '/content/articles/liquidity-pools.md',
          },
          {
            title: 'Yield Farming Strategies',
            order: 2,
            contentType: 'video',
            contentUrl: '/content/videos/yield-farming.mp4',
          },
          {
            title: 'Risk Management in DeFi',
            order: 3,
            contentType: 'article',
            contentUrl: '/content/articles/defi-risk-management.md',
          },
          {
            title: 'DeFi Security Quiz',
            order: 4,
            contentType: 'quiz',
            contentUrl: '/content/quizzes/defi-security.json',
          },
        ],
      },
    },
    include: {
      lessons: true,
    },
  });

  console.log('Created course:', advancedCourse.title);

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });